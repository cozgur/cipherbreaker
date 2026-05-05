/**
 * Phase 7A.5 CP1 — adCap pure-function suite.
 *
 * Mirrors the discipline of Daily Challenge's `dailyDate.test.ts` —
 * pure-function tests with explicit DST coverage at the same EU /
 * US transition dates so a future regression in either module
 * can't silently desync.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  applyAdWatched,
  canWatchAd,
  getAdsRemaining,
  type AdCapState,
} from '../adCap';
import { AD_CAP_PER_DAY } from '../constants';

const FRESH: AdCapState = { adsWatchedToday: 0, adsWatchedLastDate: null };

describe('canWatchAd — gate semantics', () => {
  it('first-ever call (no prior date) allows the watch', () => {
    expect(canWatchAd(FRESH, '2026-05-05')).toBe(true);
  });

  it('returns true while count is below the daily cap', () => {
    const state: AdCapState = { adsWatchedToday: 5, adsWatchedLastDate: '2026-05-05' };
    expect(canWatchAd(state, '2026-05-05')).toBe(true);
  });

  it('returns true at one less than the cap (last allowed watch)', () => {
    const state: AdCapState = {
      adsWatchedToday: AD_CAP_PER_DAY - 1,
      adsWatchedLastDate: '2026-05-05',
    };
    expect(canWatchAd(state, '2026-05-05')).toBe(true);
  });

  it('returns false at the daily cap', () => {
    const state: AdCapState = {
      adsWatchedToday: AD_CAP_PER_DAY,
      adsWatchedLastDate: '2026-05-05',
    };
    expect(canWatchAd(state, '2026-05-05')).toBe(false);
  });

  it('returns false past the cap (defensive — should not happen, but if it does)', () => {
    const state: AdCapState = {
      adsWatchedToday: AD_CAP_PER_DAY + 5,
      adsWatchedLastDate: '2026-05-05',
    };
    expect(canWatchAd(state, '2026-05-05')).toBe(false);
  });

  it('cross-midnight: yesterday at cap → today fresh, gate allows', () => {
    const state: AdCapState = {
      adsWatchedToday: AD_CAP_PER_DAY,
      adsWatchedLastDate: '2026-05-04',
    };
    expect(canWatchAd(state, '2026-05-05')).toBe(true);
  });
});

describe('getAdsRemaining', () => {
  it('first-ever call returns the full daily cap', () => {
    expect(getAdsRemaining(FRESH, '2026-05-05')).toBe(AD_CAP_PER_DAY);
  });

  it('decrements 1:1 against adsWatchedToday on the same date', () => {
    for (let used = 0; used <= AD_CAP_PER_DAY; used += 1) {
      const state: AdCapState = { adsWatchedToday: used, adsWatchedLastDate: '2026-05-05' };
      expect(getAdsRemaining(state, '2026-05-05')).toBe(AD_CAP_PER_DAY - used);
    }
  });

  it('clamps at 0 when count is past the cap (defensive)', () => {
    const state: AdCapState = { adsWatchedToday: 99, adsWatchedLastDate: '2026-05-05' };
    expect(getAdsRemaining(state, '2026-05-05')).toBe(0);
  });

  it('returns the full cap on a stale day (cross-midnight reset)', () => {
    const state: AdCapState = {
      adsWatchedToday: AD_CAP_PER_DAY,
      adsWatchedLastDate: '2026-05-04',
    };
    expect(getAdsRemaining(state, '2026-05-05')).toBe(AD_CAP_PER_DAY);
  });
});

describe('applyAdWatched — state transitions', () => {
  it('first-ever watch: counter goes to 1, date stamps today', () => {
    expect(applyAdWatched(FRESH, '2026-05-05')).toEqual({
      adsWatchedToday: 1,
      adsWatchedLastDate: '2026-05-05',
    });
  });

  it('same-day increment: counter += 1, date unchanged', () => {
    const state: AdCapState = { adsWatchedToday: 3, adsWatchedLastDate: '2026-05-05' };
    expect(applyAdWatched(state, '2026-05-05')).toEqual({
      adsWatchedToday: 4,
      adsWatchedLastDate: '2026-05-05',
    });
  });

  it('cross-midnight: counter resets to 1, date stamps the new day', () => {
    const state: AdCapState = {
      adsWatchedToday: AD_CAP_PER_DAY,
      adsWatchedLastDate: '2026-05-04',
    };
    expect(applyAdWatched(state, '2026-05-05')).toEqual({
      adsWatchedToday: 1,
      adsWatchedLastDate: '2026-05-05',
    });
  });

  it('clamps at the cap (defensive — the gate above should already block)', () => {
    const state: AdCapState = {
      adsWatchedToday: AD_CAP_PER_DAY,
      adsWatchedLastDate: '2026-05-05',
    };
    expect(applyAdWatched(state, '2026-05-05')).toEqual({
      adsWatchedToday: AD_CAP_PER_DAY,
      adsWatchedLastDate: '2026-05-05',
    });
  });

  it('round-trips through canWatchAd: 10 successive applies hit the cap', () => {
    let state: AdCapState = FRESH;
    for (let i = 0; i < AD_CAP_PER_DAY; i += 1) {
      expect(canWatchAd(state, '2026-05-05')).toBe(true);
      state = applyAdWatched(state, '2026-05-05');
    }
    expect(canWatchAd(state, '2026-05-05')).toBe(false);
    expect(state.adsWatchedToday).toBe(AD_CAP_PER_DAY);
  });
});

describe('cross-midnight + DST smoke', () => {
  // The cap gate is keyed on local-calendar string equality. The
  // string itself comes from `formatDailyDate(new Date())` at the
  // call site (Daily Challenge's helper, DST-immune since Phase
  // 7A.4 CP3). The cap module never does date arithmetic — so the
  // DST smoke here is "verify the state machine treats DST-day
  // strings just like any other consecutive pair."

  it('EU spring-forward boundary (2026-03-29): same-day equality holds', () => {
    const state: AdCapState = { adsWatchedToday: 5, adsWatchedLastDate: '2026-03-29' };
    // The 23-hour spring-forward day is still one calendar string.
    // Same-string compare → still on cap, no spurious reset.
    expect(getAdsRemaining(state, '2026-03-29')).toBe(AD_CAP_PER_DAY - 5);
    expect(applyAdWatched(state, '2026-03-29').adsWatchedToday).toBe(6);
  });

  it('EU spring-forward (2026-03-28 → 2026-03-29): cross-day reset fires', () => {
    const state: AdCapState = {
      adsWatchedToday: AD_CAP_PER_DAY,
      adsWatchedLastDate: '2026-03-28',
    };
    expect(canWatchAd(state, '2026-03-29')).toBe(true);
    expect(applyAdWatched(state, '2026-03-29')).toEqual({
      adsWatchedToday: 1,
      adsWatchedLastDate: '2026-03-29',
    });
  });

  it('US fall-back (2026-10-31 → 2026-11-01): cross-day reset fires across the 25h day', () => {
    const state: AdCapState = {
      adsWatchedToday: AD_CAP_PER_DAY,
      adsWatchedLastDate: '2026-10-31',
    };
    expect(canWatchAd(state, '2026-11-01')).toBe(true);
    expect(applyAdWatched(state, '2026-11-01')).toEqual({
      adsWatchedToday: 1,
      adsWatchedLastDate: '2026-11-01',
    });
  });

  it('US fall-back same-day (2026-11-01): no spurious reset within the 25h day', () => {
    const state: AdCapState = { adsWatchedToday: 7, adsWatchedLastDate: '2026-11-01' };
    expect(getAdsRemaining(state, '2026-11-01')).toBe(AD_CAP_PER_DAY - 7);
  });

  it('year boundary (2026-12-31 → 2027-01-01): treated as a normal cross-day reset', () => {
    const state: AdCapState = {
      adsWatchedToday: AD_CAP_PER_DAY,
      adsWatchedLastDate: '2026-12-31',
    };
    expect(applyAdWatched(state, '2027-01-01')).toEqual({
      adsWatchedToday: 1,
      adsWatchedLastDate: '2027-01-01',
    });
  });
});

describe('source-file invariants — toISOString prohibition', () => {
  // Hard rule: adCap.ts must never call Date.prototype.toISOString
  // (UTC drift trap). Mirrors the same-named guard on dailyDate.ts.
  it('adCap.ts does not call toISOString in production code', () => {
    const path = join(__dirname, '..', 'adCap.ts');
    const src = readFileSync(path, 'utf8');
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    expect(stripped).not.toMatch(/\.toISOString\b/);
  });
});
