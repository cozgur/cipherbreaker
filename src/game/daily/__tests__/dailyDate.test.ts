/**
 * Phase 7A.4 CP3 — local-calendar date helpers test suite.
 *
 * The DST-immunity property is the load-bearing claim. Tests build
 * synthetic `Date` objects via the local-time constructor; the
 * helpers extract `getFullYear/Month/Date` and lift to UTC midnights
 * for arithmetic. Those steps are deterministic regardless of the
 * test machine's timezone — the tests pass identically on a UTC
 * runner, an EU runner, or a US East Coast runner.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  addDaysLocal,
  dayDifferenceLocal,
  formatDailyDate,
  parseDailyDate,
} from '../dailyDate';

describe('formatDailyDate', () => {
  it('zero-pads single-digit months and days', () => {
    expect(formatDailyDate(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(formatDailyDate(new Date(2026, 8, 9))).toBe('2026-09-09');
  });

  it('uses local-calendar getters (matches getFullYear/Month/Date round-trip)', () => {
    const d = new Date(2026, 4, 1);
    expect(formatDailyDate(d)).toBe('2026-05-01');
  });

  it('handles year boundary (Dec 31 vs Jan 1)', () => {
    expect(formatDailyDate(new Date(2026, 11, 31))).toBe('2026-12-31');
    expect(formatDailyDate(new Date(2027, 0, 1))).toBe('2027-01-01');
  });
});

describe('parseDailyDate', () => {
  it('parses a canonical YYYY-MM-DD string into a local-anchored midnight Date', () => {
    const d = parseDailyDate('2026-05-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it('round-trips with formatDailyDate for any valid calendar day', () => {
    for (const sample of ['2026-01-01', '2026-05-15', '2026-12-31', '2027-02-28']) {
      expect(formatDailyDate(parseDailyDate(sample))).toBe(sample);
    }
  });

  it('rejects malformed input (length / separator / numeric)', () => {
    expect(() => parseDailyDate('2026/05/01')).toThrow(RangeError);
    expect(() => parseDailyDate('20260501')).toThrow(RangeError);
    expect(() => parseDailyDate('26-05-01')).toThrow(RangeError);
    expect(() => parseDailyDate('not a date')).toThrow(RangeError);
  });

  it('rejects calendar-impossible dates (Feb 30, month 13)', () => {
    expect(() => parseDailyDate('2026-02-30')).toThrow(RangeError);
    expect(() => parseDailyDate('2026-13-01')).toThrow(RangeError);
    expect(() => parseDailyDate('2026-04-31')).toThrow(RangeError);
  });
});

describe('addDaysLocal', () => {
  it('adds positive day counts within the same month', () => {
    const d = new Date(2026, 4, 1);
    expect(formatDailyDate(addDaysLocal(d, 6))).toBe('2026-05-07');
  });

  it('rolls month forward correctly (May 30 + 5 = June 4)', () => {
    const d = new Date(2026, 4, 30);
    expect(formatDailyDate(addDaysLocal(d, 5))).toBe('2026-06-04');
  });

  it('rolls year forward correctly (Dec 31 + 1 = Jan 1)', () => {
    const d = new Date(2026, 11, 31);
    expect(formatDailyDate(addDaysLocal(d, 1))).toBe('2027-01-01');
  });

  it('handles negative day counts (May 5 - 10 = April 25)', () => {
    const d = new Date(2026, 4, 5);
    expect(formatDailyDate(addDaysLocal(d, -10))).toBe('2026-04-25');
  });

  it('leaves the date unchanged for n=0', () => {
    const d = new Date(2026, 4, 1);
    expect(formatDailyDate(addDaysLocal(d, 0))).toBe('2026-05-01');
  });
});

describe('dayDifferenceLocal — DST-immunity guarantee', () => {
  it('returns 1 for consecutive calendar days', () => {
    const a = new Date(2026, 4, 1);
    const b = new Date(2026, 4, 2);
    expect(dayDifferenceLocal(a, b)).toBe(1);
  });

  it('returns negative when "to" precedes "from" (yesterday → today algebra)', () => {
    const a = new Date(2026, 4, 5);
    const b = new Date(2026, 4, 3);
    expect(dayDifferenceLocal(a, b)).toBe(-2);
  });

  it('returns 0 for the same calendar day across different times of day', () => {
    const morning = new Date(2026, 4, 1, 6, 30);
    const evening = new Date(2026, 4, 1, 22, 15);
    expect(dayDifferenceLocal(morning, evening)).toBe(0);
  });

  it('survives the EU spring-forward DST boundary (2026-03-29: 23-hour day)', () => {
    // Last Sunday of March 2026. In EU locales this day is 23 hours
    // long. Naive `(b-a)/86400000` yields ~2.04 days for March 28 →
    // March 31; our function must yield exactly 3.
    const sat = new Date(2026, 2, 28);
    const tue = new Date(2026, 2, 31);
    expect(dayDifferenceLocal(sat, tue)).toBe(3);
  });

  it('survives the US fall-back DST boundary (2026-11-01: 25-hour day)', () => {
    // First Sunday of November 2026. 25-hour day in US locales.
    // Naive math yields ~2.96 days; ours yields exactly 3.
    const fri = new Date(2026, 9, 30);
    const mon = new Date(2026, 10, 2);
    expect(dayDifferenceLocal(fri, mon)).toBe(3);
  });

  it('round-trips with addDaysLocal across an arbitrary offset', () => {
    const start = new Date(2026, 4, 1);
    for (const offset of [-30, -1, 0, 1, 7, 30, 365]) {
      const moved = addDaysLocal(start, offset);
      expect(dayDifferenceLocal(start, moved)).toBe(offset);
    }
  });

  it('handles leap year correctly (Feb 29 2028 → Mar 1 2028 = 1 day)', () => {
    const feb29 = new Date(2028, 1, 29);
    const mar1 = new Date(2028, 2, 1);
    expect(dayDifferenceLocal(feb29, mar1)).toBe(1);
  });

  it('counts a full non-leap year as 365 days', () => {
    const a = new Date(2026, 0, 1);
    const b = new Date(2027, 0, 1);
    expect(dayDifferenceLocal(a, b)).toBe(365);
  });

  it('counts a full leap year as 366 days', () => {
    const a = new Date(2028, 0, 1);
    const b = new Date(2029, 0, 1);
    expect(dayDifferenceLocal(a, b)).toBe(366);
  });
});

describe('source-file invariants — toISOString prohibition', () => {
  // Hard rule: dailyDate.ts must never use Date.prototype.toISOString
  // (UTC drift trap). A future PR re-introducing it fails here.
  // Block + line comments are stripped first so the prohibition
  // documented in the file header itself does not trip the check.
  it('dailyDate.ts does not call toISOString in production code', () => {
    const path = join(__dirname, '..', 'dailyDate.ts');
    const src = readFileSync(path, 'utf8');
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    expect(stripped).not.toMatch(/\.toISOString\b/);
  });
});
