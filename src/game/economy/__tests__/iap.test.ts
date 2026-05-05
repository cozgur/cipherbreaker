/**
 * Phase 7A.5 CP1 — Remove Ads IAP gate primitives.
 *
 * Pure suite over `isAdsRemoved` and the composed
 * `canShowInterstitial`. The persisted-flag side (setAdsRemoved
 * action + v3→v4 migration default) lives on `userStore` and is
 * exercised in `userStore.test.ts`.
 */

import { canShowInterstitial, isAdsRemoved } from '../iap';
import { AD_CAP_PER_DAY } from '../constants';

const TODAY = '2026-05-05';

const adsRemovedState = (adsRemoved: boolean) =>
  ({
    adsWatchedToday: 0,
    adsWatchedLastDate: null,
    adsRemoved,
  }) as const;

describe('isAdsRemoved', () => {
  it('returns true when the IAP flag is set', () => {
    expect(isAdsRemoved({ adsRemoved: true })).toBe(true);
  });

  it('returns false on a fresh (un-purchased) user', () => {
    expect(isAdsRemoved({ adsRemoved: false })).toBe(false);
  });
});

describe('canShowInterstitial — composed gate', () => {
  it('returns true when ad cap has headroom AND ads-not-removed', () => {
    const state = adsRemovedState(false);
    expect(canShowInterstitial(state, TODAY)).toBe(true);
  });

  it('returns false when adsRemoved is true (Remove Ads IAP active)', () => {
    const state = adsRemovedState(true);
    expect(canShowInterstitial(state, TODAY)).toBe(false);
  });

  it('returns false when ad cap is reached (no headroom)', () => {
    const state = {
      adsWatchedToday: AD_CAP_PER_DAY,
      adsWatchedLastDate: TODAY,
      adsRemoved: false,
    };
    expect(canShowInterstitial(state, TODAY)).toBe(false);
  });

  it('Remove Ads short-circuits even when ad cap has headroom', () => {
    // Defensive — the order-of-checks must NOT change such that an
    // un-purchased ad cap somehow leaks through to an ads-removed
    // user. Both gates close independently.
    const state = {
      adsWatchedToday: 0,
      adsWatchedLastDate: null,
      adsRemoved: true,
    };
    expect(canShowInterstitial(state, TODAY)).toBe(false);
  });

  it('cross-midnight reset still gated by adsRemoved (paying user stays ad-free into the new day)', () => {
    const state = {
      adsWatchedToday: AD_CAP_PER_DAY,
      adsWatchedLastDate: '2026-05-04',
      adsRemoved: true,
    };
    expect(canShowInterstitial(state, TODAY)).toBe(false);
  });
});
