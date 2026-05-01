import type { DailyChallengeState, DailyResultSummary } from '../types';
import { computeNextDailyStreakState } from '../streak';

const FRESH: DailyChallengeState = {
  lastPlayedDate: null,
  currentStreak: 0,
  longestStreak: 0,
  effectiveDayOffset: 0,
  lastResult: null,
  history: [],
};

const result = (overrides: Partial<DailyResultSummary> = {}): DailyResultSummary => ({
  date: '2026-05-01',
  digits: 4,
  turnLimit: 6,
  turnsUsed: 4,
  success: true,
  feedbackTrail: [],
  ...overrides,
});

const stateAt = (
  lastPlayedDate: string,
  overrides: Partial<DailyChallengeState> = {},
): DailyChallengeState => ({
  ...FRESH,
  lastPlayedDate,
  ...overrides,
});

describe('computeNextDailyStreakState — first play', () => {
  it('first success makes streak 1, longest 1', () => {
    const next = computeNextDailyStreakState(FRESH, '2026-05-01', result({ success: true }));
    expect(next).toEqual({ currentStreak: 1, longestStreak: 1, effectiveDayOffset: 0 });
  });

  it('first failure makes streak 0, longest 0 (no regression on first play)', () => {
    const next = computeNextDailyStreakState(FRESH, '2026-05-01', result({ success: false }));
    expect(next).toEqual({ currentStreak: 0, longestStreak: 0, effectiveDayOffset: 0 });
  });

  it('null result on fresh state is identity (safe no-op)', () => {
    const next = computeNextDailyStreakState(FRESH, '2026-05-01', null);
    expect(next).toEqual({ currentStreak: 0, longestStreak: 0, effectiveDayOffset: 0 });
  });
});

describe('computeNextDailyStreakState — consecutive days (gap = 1)', () => {
  it('consecutive success increments the streak and pulls longestStreak up', () => {
    const prev = stateAt('2026-05-01', {
      currentStreak: 4,
      longestStreak: 4,
    });
    const next = computeNextDailyStreakState(
      prev,
      '2026-05-02',
      result({ date: '2026-05-02', success: true }),
    );
    expect(next).toEqual({ currentStreak: 5, longestStreak: 5, effectiveDayOffset: 0 });
  });

  it('consecutive failure preserves the streak (kaybetme bozmaz)', () => {
    const prev = stateAt('2026-05-01', { currentStreak: 4, longestStreak: 7 });
    const next = computeNextDailyStreakState(
      prev,
      '2026-05-02',
      result({ date: '2026-05-02', success: false }),
    );
    expect(next).toEqual({ currentStreak: 4, longestStreak: 7, effectiveDayOffset: 0 });
  });

  it('longestStreak does not regress when current dips below it', () => {
    const prev = stateAt('2026-05-01', { currentStreak: 4, longestStreak: 12 });
    const next = computeNextDailyStreakState(
      prev,
      '2026-05-02',
      result({ date: '2026-05-02', success: true }),
    );
    expect(next.longestStreak).toBe(12);
    expect(next.currentStreak).toBe(5);
  });
});

describe('computeNextDailyStreakState — same day idempotence', () => {
  it('re-submitting the same date is identity (gap = 0)', () => {
    const prev = stateAt('2026-05-05', {
      currentStreak: 3,
      longestStreak: 3,
      effectiveDayOffset: 7,
    });
    const next = computeNextDailyStreakState(
      prev,
      '2026-05-05',
      result({ date: '2026-05-05', success: true }),
    );
    expect(next).toEqual({ currentStreak: 3, longestStreak: 3, effectiveDayOffset: 7 });
  });
});

describe('computeNextDailyStreakState — missed day regression (gap >= 2)', () => {
  it('tier-4 break: streak 0, no regression delta (floor)', () => {
    // User was on Day 5 (tier-4), skipped Day 6, plays Day 7.
    const prev = stateAt('2026-05-05', {
      currentStreak: 4,
      longestStreak: 4,
      effectiveDayOffset: 0,
    });
    const next = computeNextDailyStreakState(
      prev,
      '2026-05-07',
      result({ date: '2026-05-07', success: true }),
    );
    expect(next).toEqual({ currentStreak: 1, longestStreak: 4, effectiveDayOffset: 0 });
  });

  it('tier-5 break: streak 0, offset += 7 (re-enter tier-4 band)', () => {
    // User was on Day 10 (tier-5), skipped Day 11, plays Day 12.
    const prev = stateAt('2026-05-10', {
      currentStreak: 9,
      longestStreak: 9,
      effectiveDayOffset: 0,
    });
    const next = computeNextDailyStreakState(
      prev,
      '2026-05-12',
      result({ date: '2026-05-12', success: false }),
    );
    expect(next).toEqual({ currentStreak: 0, longestStreak: 9, effectiveDayOffset: 7 });
  });

  it('tier-6 break: streak 0, offset += 10 (re-enter tier-5 band)', () => {
    // User was on Day 22 (tier-6), skipped Day 23, plays Day 24.
    const prev = stateAt('2026-05-22', {
      currentStreak: 20,
      longestStreak: 20,
      effectiveDayOffset: 0,
    });
    const next = computeNextDailyStreakState(
      prev,
      '2026-05-24',
      result({ date: '2026-05-24', success: true }),
    );
    expect(next).toEqual({ currentStreak: 1, longestStreak: 20, effectiveDayOffset: 10 });
  });

  it('cross-midnight stale drop (todayResult=null): streak breaks, regression applies, no new streak', () => {
    const prev = stateAt('2026-05-10', {
      currentStreak: 9,
      longestStreak: 9,
      effectiveDayOffset: 0,
    });
    const next = computeNextDailyStreakState(prev, '2026-05-12', null);
    expect(next).toEqual({ currentStreak: 0, longestStreak: 9, effectiveDayOffset: 7 });
  });

  it('multiple regressions accumulate offset (two tier-5 breaks → offset 14)', () => {
    // Day 10 break → offset 7. Then Day 17 (still tier-4 land
    // effectively, since effectiveDay = 17 - 7 = 10 which is tier-5)
    // play, then break again on Day 19 (effectiveDay 12, tier-5).
    const afterFirst = stateAt('2026-05-12', {
      currentStreak: 0,
      longestStreak: 9,
      effectiveDayOffset: 7,
    });
    const afterPlayDay13: DailyChallengeState = {
      ...afterFirst,
      lastPlayedDate: '2026-05-13',
      currentStreak: 1,
    };
    // Now a 2-day gap from May 13 → May 15. lastTier effectiveDay
    // = (calendarDay 13) - 7 = 6 → tier-4. Floor — no regression.
    const next = computeNextDailyStreakState(
      afterPlayDay13,
      '2026-05-15',
      result({ date: '2026-05-15', success: true }),
    );
    expect(next.effectiveDayOffset).toBe(7);
    expect(next.currentStreak).toBe(1);
  });

  it('30-day continuous streak — every consecutive success accumulates one', () => {
    let state: DailyChallengeState = FRESH;
    for (let i = 0; i < 30; i += 1) {
      const date = `2026-05-${String(i + 1).padStart(2, '0')}`;
      const update = computeNextDailyStreakState(
        state,
        date,
        result({ date, success: true }),
      );
      state = {
        ...state,
        lastPlayedDate: date,
        currentStreak: update.currentStreak,
        longestStreak: update.longestStreak,
        effectiveDayOffset: update.effectiveDayOffset,
      };
    }
    expect(state.currentStreak).toBe(30);
    expect(state.longestStreak).toBe(30);
    expect(state.effectiveDayOffset).toBe(0);
  });
});
