import type { DailyChallengeState } from '../types';
import {
  calendarDayIndex,
  effectiveDigitTier,
  getDailyConfig,
  TIER_4_PERIOD,
  TIER_5_PERIOD,
} from '../dailyConfig';

// Phase 7A.8 CP9.1 — the day index is per-user now. These suites pin a
// concrete first-play epoch so the tier-ramp assertions read off a
// stable Day 1; a player's own first daily is `EPOCH`.
const EPOCH = '2026-05-01';

const FRESH_STATE: DailyChallengeState = {
  firstPlayedDate: null,
  lastPlayedDate: null,
  currentStreak: 0,
  longestStreak: 0,
  effectiveDayOffset: 0,
  lastResult: null,
  history: [],
  earnedHints: 0,
  lastHintEarnedAtStreak: 0,
};

// A player who started on EPOCH (firstPlayedDate set), no regression.
const playerState = (overrides: Partial<DailyChallengeState> = {}): DailyChallengeState => ({
  ...FRESH_STATE,
  firstPlayedDate: EPOCH,
  ...overrides,
});

const stateWithOffset = (offset: number): DailyChallengeState =>
  playerState({ effectiveDayOffset: offset });

describe('calendarDayIndex — per-user epoch', () => {
  it('Day 1 is the epoch itself', () => {
    expect(calendarDayIndex(EPOCH, EPOCH)).toBe(1);
  });

  it('Day 2 is the day after the epoch', () => {
    expect(calendarDayIndex('2026-05-02', EPOCH)).toBe(2);
  });

  it('Day 30 is 29 days after the epoch', () => {
    expect(calendarDayIndex('2026-05-30', EPOCH)).toBe(30);
  });

  it('pre-epoch dates produce non-positive indices', () => {
    expect(calendarDayIndex('2026-04-30', EPOCH)).toBe(0);
    expect(calendarDayIndex('2026-04-25', EPOCH)).toBe(-5);
  });
});

describe('getDailyConfig — per-user Day 1 (firstPlayedDate null)', () => {
  it('a never-played user is Day 1 / tier-4 on ANY date', () => {
    // firstPlayedDate null → epoch coalesces to the indexed date → Day 1.
    expect(getDailyConfig('2026-05-01', FRESH_STATE)).toEqual({ digits: 4, turnLimit: 10 });
    expect(getDailyConfig('2026-12-31', FRESH_STATE)).toEqual({ digits: 4, turnLimit: 10 });
  });

  it('tier ramps from the player s own first day, not a global epoch', () => {
    // Two players, different first days, both on THEIR day 8 → tier 5.
    expect(getDailyConfig('2026-05-08', playerState({ firstPlayedDate: '2026-05-01' }))).toEqual({
      digits: 5,
      turnLimit: 12,
    });
    expect(getDailyConfig('2026-07-08', playerState({ firstPlayedDate: '2026-07-01' }))).toEqual({
      digits: 5,
      turnLimit: 12,
    });
  });
});

describe('effectiveDigitTier — pure tier mapping', () => {
  // Turn budgets corrected post-CP5 iOS test (Mastermind paradigm —
  // less info per row than Wordle, multiset confusion). 10/12/14
  // lands the casual-friendly win band; hardcore skill solve still
  // achievable in 5-7 turns.
  it.each([1, 2, 5, 7])('effectiveDay=%i → tier 4 (4 digits, 10 turns)', (day) => {
    expect(effectiveDigitTier(day)).toEqual({ digits: 4, turnLimit: 10 });
  });

  it.each([8, 12, 17])('effectiveDay=%i → tier 5 (5 digits, 12 turns)', (day) => {
    expect(effectiveDigitTier(day)).toEqual({ digits: 5, turnLimit: 12 });
  });

  it.each([18, 50, 365])('effectiveDay=%i → tier 6 (6 digits, 14 turns) — cap', (day) => {
    expect(effectiveDigitTier(day)).toEqual({ digits: 6, turnLimit: 14 });
  });

  it('floors at tier-4 for non-positive effective day (pre-launch / heavy regression)', () => {
    expect(effectiveDigitTier(0)).toEqual({ digits: 4, turnLimit: 10 });
    expect(effectiveDigitTier(-5)).toEqual({ digits: 4, turnLimit: 10 });
    expect(effectiveDigitTier(-100)).toEqual({ digits: 4, turnLimit: 10 });
  });

  it('boundaries: 7→tier4, 8→tier5; 17→tier5, 18→tier6', () => {
    expect(effectiveDigitTier(7).digits).toBe(4);
    expect(effectiveDigitTier(8).digits).toBe(5);
    expect(effectiveDigitTier(17).digits).toBe(5);
    expect(effectiveDigitTier(18).digits).toBe(6);
  });

  it('tier period constants are 7 and 10 (used by streak.ts regression math)', () => {
    expect(TIER_4_PERIOD).toBe(7);
    expect(TIER_5_PERIOD).toBe(10);
  });
});

describe('getDailyConfig — user-aware (Reading A + effectiveDayOffset)', () => {
  it('player on their Day 7 → tier 4 (no offset to apply)', () => {
    expect(getDailyConfig('2026-05-07', playerState())).toEqual({ digits: 4, turnLimit: 10 });
  });

  it('player on their Day 8 → tier 5 (calendar promotion)', () => {
    expect(getDailyConfig('2026-05-08', playerState())).toEqual({ digits: 5, turnLimit: 12 });
  });

  it('player on their Day 18 → tier 6 (calendar promotion)', () => {
    expect(getDailyConfig('2026-05-18', playerState())).toEqual({ digits: 6, turnLimit: 14 });
  });

  it('regressed user (offset 7), calendar Day 18 → effective Day 11 → tier 5', () => {
    expect(getDailyConfig('2026-05-18', stateWithOffset(7))).toEqual({
      digits: 5,
      turnLimit: 12,
    });
  });

  it('heavily regressed user (offset 14), calendar Day 18 → effective Day 4 → tier 4', () => {
    expect(getDailyConfig('2026-05-18', stateWithOffset(14))).toEqual({
      digits: 4,
      turnLimit: 10,
    });
  });

  it('tier-6 → tier-5 regression (offset 10), calendar Day 18 → effective Day 8 → tier 5', () => {
    expect(getDailyConfig('2026-05-18', stateWithOffset(10))).toEqual({
      digits: 5,
      turnLimit: 12,
    });
  });

  it('regression takes 10 calendar days at tier-5 to climb back to tier-6', () => {
    expect(getDailyConfig('2026-05-27', stateWithOffset(10))).toEqual({
      digits: 5,
      turnLimit: 12,
    });
    expect(getDailyConfig('2026-05-28', stateWithOffset(10))).toEqual({
      digits: 6,
      turnLimit: 14,
    });
  });

  it('regression takes 7 calendar days at tier-4 to climb back to tier-5', () => {
    expect(getDailyConfig('2026-05-08', stateWithOffset(7))).toEqual({
      digits: 4,
      turnLimit: 10,
    });
    expect(getDailyConfig('2026-05-14', stateWithOffset(7))).toEqual({
      digits: 4,
      turnLimit: 10,
    });
    expect(getDailyConfig('2026-05-15', stateWithOffset(7))).toEqual({
      digits: 5,
      turnLimit: 12,
    });
  });

  it('pre-epoch date floors to tier-4 even with offset zero', () => {
    expect(getDailyConfig('2026-04-30', playerState())).toEqual({ digits: 4, turnLimit: 10 });
  });
});
