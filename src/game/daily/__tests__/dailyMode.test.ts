/**
 * Phase 7A.8 CP9 — Daily mode rotation picker suite.
 *
 * Pins the deterministic {1, 3} alternation, the date-derived
 * convenience wrapper, and the catalog-sourced header label. Mode 2
 * is intentionally NOT in the rotation (deferred to Phase 9).
 */

import { dailyModeForDate, dailyModeLabel, pickDailyMode } from '../dailyMode';

describe('pickDailyMode', () => {
  it('returns Mode 1 for an even seed and Mode 3 for an odd seed', () => {
    expect(pickDailyMode(0)).toBe(1);
    expect(pickDailyMode(1)).toBe(3);
    expect(pickDailyMode(2)).toBe(1);
    expect(pickDailyMode(3)).toBe(3);
  });

  it('is deterministic — same seed always yields the same mode', () => {
    for (const seed of [0, 1, 7, 42, 99, 1000]) {
      expect(pickDailyMode(seed)).toBe(pickDailyMode(seed));
    }
  });

  it('only ever returns 1 or 3 (Mode 2 is never picked)', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      expect([1, 3]).toContain(pickDailyMode(seed));
      expect(pickDailyMode(seed)).not.toBe(2);
    }
  });

  it('splits ~50/50 across a contiguous seed range (strict alternation)', () => {
    let mode1 = 0;
    let mode3 = 0;
    for (let seed = 0; seed < 1000; seed += 1) {
      if (pickDailyMode(seed) === 1) mode1 += 1;
      else mode3 += 1;
    }
    expect(mode1).toBe(500);
    expect(mode3).toBe(500);
  });
});

describe('dailyModeForDate — per-user epoch (CP9.1)', () => {
  const EPOCH = '2026-05-01';

  it('resolves the player s Day 1 (odd) to Mode 3 — every player s first Daily is Precision', () => {
    // date === epoch → calendarDayIndex 1 (odd) → Mode 3.
    expect(dailyModeForDate(EPOCH, EPOCH)).toBe(3);
  });

  it('resolves Day 2 (even) to Mode 1 and Day 3 (odd) back to Mode 3', () => {
    expect(dailyModeForDate('2026-05-02', EPOCH)).toBe(1);
    expect(dailyModeForDate('2026-05-03', EPOCH)).toBe(3);
  });
});

describe('dailyModeLabel', () => {
  it('title-cases the modeCatalog name for the header', () => {
    expect(dailyModeLabel(1)).toBe('Color Match');
    expect(dailyModeLabel(3)).toBe('Precision');
  });
});
