/**
 * Phase 7A.4 CP7 — multi-day Daily Challenge simulation.
 *
 * The unit suites for streak.ts and dailyChallengeStore.ts exercise
 * one transition at a time. This file walks the cross-store contract
 * across multiple consecutive days so a regression in either store's
 * action layer (or in the seam between them) is caught at the user-
 * journey level — not just at the per-function level.
 *
 * Why store-level (no UI render): the simulation depends on the
 * date being a parameter, not on what `new Date()` returns at the
 * moment a screen mounts. The store's `startToday(date, config)`
 * accepts the date directly, so we step Day 1 → Day 2 → ... by
 * calling the action with successive date strings — no Date
 * mocking, no remount churn, deterministic and fast. Same pattern
 * as `streak.test.ts`'s 30-day continuous loop, lifted to the
 * cross-store level so the earnedHints pool, history cap, and
 * cross-midnight stale-drop side effect are all verified together.
 */

import { useDailyChallengeStore } from '@state/dailyChallengeStore';
import {
  DAILY_CHALLENGE_DEFAULTS,
  USER_STORE_DEFAULTS,
  useUserStore,
} from '@state/userStore';
import { getDailyConfig } from '@game/daily/dailyConfig';
import { addDaysLocal, formatDailyDate, parseDailyDate } from '@game/daily/dailyDate';

const LAUNCH_EPOCH = '2026-05-01';

function resetStores(): void {
  useDailyChallengeStore.setState({ currentAttempt: null, isSubmitting: false });
  useUserStore.setState({
    dailyChallenge: DAILY_CHALLENGE_DEFAULTS,
    stats: USER_STORE_DEFAULTS.stats,
    tokens: USER_STORE_DEFAULTS.tokens,
  });
}

/**
 * Step into `date`'s puzzle and submit the seeded secret to win it.
 * Returns the result summary so the caller can assert per-day state.
 */
function playDayWin(date: string): void {
  const dailyState = useUserStore.getState().dailyChallenge;
  const config = getDailyConfig(date, dailyState);
  useDailyChallengeStore.getState().startToday(date, config);
  const attempt = useDailyChallengeStore.getState().currentAttempt;
  if (attempt === null) {
    throw new Error(`playDayWin: no attempt seeded for ${date}`);
  }
  const r = useDailyChallengeStore.getState().submitGuess(attempt.secret);
  if (r.summary === null || r.summary.success !== true) {
    throw new Error(`playDayWin: expected immediate win for ${date}`);
  }
}

describe('Daily Challenge — 7-day continuous streak (no break)', () => {
  beforeEach(resetStores);

  it('streak increments each consecutive-day win, no regression accumulates', () => {
    const dates = Array.from({ length: 7 }, (_, i) =>
      formatDailyDate(addDaysLocal(parseDailyDate(LAUNCH_EPOCH), i)),
    );
    for (let i = 0; i < dates.length; i += 1) {
      playDayWin(dates[i] as string);
      const state = useUserStore.getState().dailyChallenge;
      expect(state.currentStreak).toBe(i + 1);
      expect(state.longestStreak).toBe(i + 1);
      expect(state.effectiveDayOffset).toBe(0);
      expect(state.lastPlayedDate).toBe(dates[i]);
    }
  });

  it('history grows by one entry per day with the win flag set', () => {
    const dates = Array.from({ length: 7 }, (_, i) =>
      formatDailyDate(addDaysLocal(parseDailyDate(LAUNCH_EPOCH), i)),
    );
    for (const date of dates) playDayWin(date);
    const history = useUserStore.getState().dailyChallenge.history;
    expect(history).toHaveLength(7);
    expect(history.map((h) => h.success)).toEqual(Array(7).fill(true));
    expect(history.map((h) => h.date)).toEqual(dates);
  });

  it('Day 7 win earns +1 hint (streak threshold crossing)', () => {
    const dates = Array.from({ length: 7 }, (_, i) =>
      formatDailyDate(addDaysLocal(parseDailyDate(LAUNCH_EPOCH), i)),
    );
    for (let i = 0; i < dates.length; i += 1) {
      playDayWin(dates[i] as string);
      const state = useUserStore.getState().dailyChallenge;
      // The +1 lands ATOMICALLY with the streak transition — i.e.,
      // the moment currentStreak becomes 7, earnedHints becomes 1.
      if (i + 1 >= 7) {
        expect(state.earnedHints).toBe(1);
        expect(state.lastHintEarnedAtStreak).toBe(7);
      } else {
        expect(state.earnedHints).toBe(0);
        expect(state.lastHintEarnedAtStreak).toBe(0);
      }
    }
  });

  it('Day 8 win does NOT re-grant the streak-7 hint (idempotency cursor)', () => {
    const dates = Array.from({ length: 8 }, (_, i) =>
      formatDailyDate(addDaysLocal(parseDailyDate(LAUNCH_EPOCH), i)),
    );
    for (const date of dates) playDayWin(date);
    const state = useUserStore.getState().dailyChallenge;
    expect(state.currentStreak).toBe(8);
    expect(state.earnedHints).toBe(1);
    expect(state.lastHintEarnedAtStreak).toBe(7);
  });

  it('14-day streak earns the second hint at the streak-14 threshold', () => {
    const dates = Array.from({ length: 14 }, (_, i) =>
      formatDailyDate(addDaysLocal(parseDailyDate(LAUNCH_EPOCH), i)),
    );
    for (const date of dates) playDayWin(date);
    const state = useUserStore.getState().dailyChallenge;
    expect(state.currentStreak).toBe(14);
    expect(state.earnedHints).toBe(2);
    expect(state.lastHintEarnedAtStreak).toBe(14);
  });

  it('21-day streak earns the third hint at cap (HINT_CAP=3)', () => {
    const dates = Array.from({ length: 21 }, (_, i) =>
      formatDailyDate(addDaysLocal(parseDailyDate(LAUNCH_EPOCH), i)),
    );
    for (const date of dates) playDayWin(date);
    const state = useUserStore.getState().dailyChallenge;
    expect(state.currentStreak).toBe(21);
    expect(state.earnedHints).toBe(3);
    expect(state.lastHintEarnedAtStreak).toBe(21);
  });
});

describe('Daily Challenge — streak break + tier regression', () => {
  beforeEach(resetStores);

  it('5 wins → skip Day 6 → Day 7: streak resets, tier-4 floor (offset stays 0)', () => {
    const day = (offset: number): string =>
      formatDailyDate(addDaysLocal(parseDailyDate(LAUNCH_EPOCH), offset));
    // Win Day 1..Day 5 (calendar days 1..5 — all tier-4).
    for (let i = 0; i < 5; i += 1) playDayWin(day(i));
    expect(useUserStore.getState().dailyChallenge.currentStreak).toBe(5);
    // Skip Day 6, play Day 7.
    playDayWin(day(6));
    const state = useUserStore.getState().dailyChallenge;
    // Streak resets to 1 (today's win is the new streak head).
    expect(state.currentStreak).toBe(1);
    expect(state.longestStreak).toBe(5);
    // Tier-4 break is the floor — no regression.
    expect(state.effectiveDayOffset).toBe(0);
    // Day 7 is still tier-4 (calendarDay 7, offset 0 → effectiveDay
    // 7 → tier-4 inclusive at the period boundary).
    const day7Config = getDailyConfig(day(6), state);
    expect(day7Config.digits).toBe(4);
  });

  it('tier-5 player skipping a day regresses by TIER_4_PERIOD (offset += 7)', () => {
    const day = (offset: number): string =>
      formatDailyDate(addDaysLocal(parseDailyDate(LAUNCH_EPOCH), offset));
    // Win Days 1..9 (continuously through tier-4 → tier-5 boundary at Day 8).
    for (let i = 0; i < 9; i += 1) playDayWin(day(i));
    let state = useUserStore.getState().dailyChallenge;
    expect(state.currentStreak).toBe(9);
    // Day 9 = effectiveDay 9 = tier-5.
    expect(getDailyConfig(day(8), state).digits).toBe(5);
    // Skip Day 10, play Day 11.
    playDayWin(day(10));
    state = useUserStore.getState().dailyChallenge;
    expect(state.currentStreak).toBe(1);
    expect(state.effectiveDayOffset).toBe(7);
    // Day 11 — effectiveDay = 11 - 7 = 4 → tier-4.
    expect(getDailyConfig(day(10), state).digits).toBe(4);
  });

  it('tier-6 player skipping a day regresses by TIER_5_PERIOD (offset += 10)', () => {
    // Bootstrap directly to a tier-6 state (calendar day 22, no
    // offset → effectiveDay 22 → tier-6) — replaying 21 wins is
    // covered by the continuous-streak suite above.
    useUserStore.setState({
      dailyChallenge: {
        ...DAILY_CHALLENGE_DEFAULTS,
        firstPlayedDate: LAUNCH_EPOCH, // CP9.1 — anchor Day 1 so 2026-05-22 = Day 22
        lastPlayedDate: '2026-05-22',
        currentStreak: 21,
        longestStreak: 21,
        effectiveDayOffset: 0,
      },
    });
    // Skip a day, play 2 days later.
    playDayWin('2026-05-24');
    const state = useUserStore.getState().dailyChallenge;
    expect(state.currentStreak).toBe(1);
    expect(state.effectiveDayOffset).toBe(10);
    // EffectiveDay = 24 - 10 = 14 → tier-5.
    expect(getDailyConfig('2026-05-24', state).digits).toBe(5);
  });

  it('streak break wipes the earnedHints pool in lockstep with the streak counter', () => {
    // Win 7 days to earn the first hint.
    for (let i = 0; i < 7; i += 1) {
      const date = formatDailyDate(addDaysLocal(parseDailyDate(LAUNCH_EPOCH), i));
      playDayWin(date);
    }
    expect(useUserStore.getState().dailyChallenge.earnedHints).toBe(1);
    // Skip Day 8, play Day 9 — streak break.
    playDayWin('2026-05-09');
    const state = useUserStore.getState().dailyChallenge;
    expect(state.currentStreak).toBe(1);
    expect(state.earnedHints).toBe(0);
    expect(state.lastHintEarnedAtStreak).toBe(0);
  });
});

describe('Daily Challenge — cross-midnight stale drop', () => {
  beforeEach(resetStores);

  it('mid-attempt left at Day 1, reopened at Day 2: silent drop + missed-day side effect', () => {
    // Day 1 — start an attempt, leave it incomplete.
    useDailyChallengeStore.getState().startToday(LAUNCH_EPOCH, { digits: 4, turnLimit: 10 });
    const day1Attempt = useDailyChallengeStore.getState().currentAttempt;
    expect(day1Attempt).not.toBeNull();
    expect(day1Attempt!.date).toBe(LAUNCH_EPOCH);
    // (Pretend a successful prior streak — the user "showed up" at
    // some point. The stale-drop's job is to break it.)
    useUserStore.setState({
      dailyChallenge: {
        ...DAILY_CHALLENGE_DEFAULTS,
        lastPlayedDate: '2026-04-30',
        currentStreak: 3,
        longestStreak: 3,
      },
    });

    // Day 2 — app reopens, store re-runs startToday with today's date.
    useDailyChallengeStore.getState().startToday('2026-05-02', { digits: 4, turnLimit: 10 });

    const userDaily = useUserStore.getState().dailyChallenge;
    // Streak broken on stale drop.
    expect(userDaily.currentStreak).toBe(0);
    // lastPlayedDate stamped to today (the missed-day boundary).
    expect(userDaily.lastPlayedDate).toBe('2026-05-02');
    // Fresh attempt seeded for today; Day 1's secret was silently dropped.
    const fresh = useDailyChallengeStore.getState().currentAttempt;
    expect(fresh).not.toBeNull();
    expect(fresh!.date).toBe('2026-05-02');
    expect(fresh!.guesses).toHaveLength(0);
  });

  it('mid-attempt with no prior streak: stale drop still drops, lastPlayedDate stamps', () => {
    // Day 1 — start an attempt, no prior history at all.
    useDailyChallengeStore.getState().startToday(LAUNCH_EPOCH, { digits: 4, turnLimit: 10 });
    expect(useUserStore.getState().dailyChallenge.lastPlayedDate).toBeNull();

    // Day 2 — reopen.
    useDailyChallengeStore.getState().startToday('2026-05-02', { digits: 4, turnLimit: 10 });

    const userDaily = useUserStore.getState().dailyChallenge;
    // First-ever interaction is a "missed day" — no prior tier to
    // regress from. Stamps date, leaves streak/offset at zero.
    expect(userDaily.lastPlayedDate).toBe('2026-05-02');
    expect(userDaily.currentStreak).toBe(0);
    expect(userDaily.effectiveDayOffset).toBe(0);
  });

  it('same-day reopen does NOT trigger missed-day side effect (resume)', () => {
    useDailyChallengeStore.getState().startToday(LAUNCH_EPOCH, { digits: 4, turnLimit: 10 });
    const before = useDailyChallengeStore.getState().currentAttempt!;
    // Simulate a guess so we can detect a wrongful re-seed.
    useDailyChallengeStore.setState({
      currentAttempt: {
        ...before,
        guesses: [{ guess: '5678', plus: 0, minus: 0, isWin: false }],
      },
    });
    useUserStore.setState({
      dailyChallenge: {
        ...DAILY_CHALLENGE_DEFAULTS,
        lastPlayedDate: '2026-04-30',
        currentStreak: 3,
        longestStreak: 3,
      },
    });

    // Same-day reopen.
    const seeded = useDailyChallengeStore
      .getState()
      .startToday(LAUNCH_EPOCH, { digits: 4, turnLimit: 10 });
    expect(seeded).toBe(false);
    // Streak intact — no missed-day side effect on same-day reopen.
    const userDaily = useUserStore.getState().dailyChallenge;
    expect(userDaily.currentStreak).toBe(3);
    expect(userDaily.lastPlayedDate).toBe('2026-04-30');
    // Persisted board still has the in-progress guess.
    expect(useDailyChallengeStore.getState().currentAttempt!.guesses).toHaveLength(1);
  });
});

describe('Daily Challenge — multi-tier progression + regression accumulation', () => {
  beforeEach(resetStores);

  it('continuous Day 1 → Day 8 ascends from tier-4 to tier-5 at the period boundary', () => {
    const day = (offset: number): string =>
      formatDailyDate(addDaysLocal(parseDailyDate(LAUNCH_EPOCH), offset));
    // Day 1..7 → tier-4 (period 7).
    for (let i = 0; i < 7; i += 1) {
      playDayWin(day(i));
      const state = useUserStore.getState().dailyChallenge;
      expect(getDailyConfig(day(i), state).digits).toBe(4);
    }
    // Day 8 → tier-5 (effectiveDay = 8 > TIER_4_PERIOD).
    playDayWin(day(7));
    const state = useUserStore.getState().dailyChallenge;
    expect(getDailyConfig(day(7), state).digits).toBe(5);
  });

  it('continuous Day 1 → Day 18 reaches tier-6 at the second period boundary', () => {
    // Bootstrap directly to a Day-17 tier-5 state — re-running the
    // 17-step loop exercises the same code path the multi-day suite
    // already covers, without inflating runtime.
    useUserStore.setState({
      dailyChallenge: {
        ...DAILY_CHALLENGE_DEFAULTS,
        firstPlayedDate: LAUNCH_EPOCH, // CP9.1 — anchor Day 1 so 2026-05-17 = Day 17
        lastPlayedDate: '2026-05-17',
        currentStreak: 17,
        longestStreak: 17,
        effectiveDayOffset: 0,
      },
    });
    playDayWin('2026-05-18');
    const state = useUserStore.getState().dailyChallenge;
    expect(state.currentStreak).toBe(18);
    expect(getDailyConfig('2026-05-18', state).digits).toBe(6);
  });

  it('two consecutive tier-5 breaks keep accumulating offset only when the prior tier qualifies', () => {
    // First: tier-5 break adds 7 to the offset.
    useUserStore.setState({
      dailyChallenge: {
        ...DAILY_CHALLENGE_DEFAULTS,
        firstPlayedDate: LAUNCH_EPOCH, // CP9.1 — anchor Day 1 so 2026-05-09 = Day 9
        lastPlayedDate: '2026-05-09',
        currentStreak: 8,
        longestStreak: 8,
        effectiveDayOffset: 0,
      },
    });
    playDayWin('2026-05-11'); // gap = 2 → break → offset += 7
    let state = useUserStore.getState().dailyChallenge;
    expect(state.effectiveDayOffset).toBe(7);
    // Second: now effectiveDay for 2026-05-11 = 11 - 7 = 4 → tier-4.
    // A subsequent break is from tier-4, so the floor applies.
    playDayWin('2026-05-13'); // gap = 2 → break → tier-4 floor, offset unchanged
    state = useUserStore.getState().dailyChallenge;
    expect(state.effectiveDayOffset).toBe(7);
    expect(state.currentStreak).toBe(1);
  });

  it('failure-then-failure consecutive days preserve the streak (kaybetme bozmaz)', () => {
    // Win Day 1 to start a streak.
    playDayWin(LAUNCH_EPOCH);
    expect(useUserStore.getState().dailyChallenge.currentStreak).toBe(1);
    // Force-fail Day 2 by recording a failure result directly via
    // userStore (the store's submit-guess path can't easily produce
    // a deterministic loss without exhausting all 10 turns —
    // the unit suite already exercises that path).
    useUserStore.getState().recordDailyResult({
      date: '2026-05-02',
      digits: 4,
      turnLimit: 10,
      turnsUsed: 10,
      success: false,
      secret: '0000',
      feedbackTrail: [],
      hintsUsed: 0,
    });
    let state = useUserStore.getState().dailyChallenge;
    // Streak preserved — failure doesn't reset (consecutive day, gap=1).
    expect(state.currentStreak).toBe(1);
    expect(state.lastPlayedDate).toBe('2026-05-02');
    // Failure on Day 3 — still consecutive, streak still preserved.
    useUserStore.getState().recordDailyResult({
      date: '2026-05-03',
      digits: 4,
      turnLimit: 10,
      turnsUsed: 10,
      success: false,
      secret: '0000',
      feedbackTrail: [],
      hintsUsed: 0,
    });
    state = useUserStore.getState().dailyChallenge;
    expect(state.currentStreak).toBe(1);
    expect(state.lastPlayedDate).toBe('2026-05-03');
  });

  it('history honours its 90-day cap when a 91-day continuous play would otherwise exceed it', () => {
    // Pre-load exactly 90 entries with unique date strings — the
    // anchor date is `__cap_anchor__` (deliberately non-canonical)
    // so it can't collide with any synthesized 'YYYY-MM-DD' entry.
    // After one more recordDailyResult, the slice(-90) policy must
    // drop the head entry (the anchor) and leave 90 total.
    const anchor = {
      date: '__cap_anchor__',
      digits: 4,
      turns: 5,
      success: true,
      hintsUsed: 0,
    } as const;
    const filler = Array.from({ length: 89 }, (_, i) => ({
      date: `2025-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      digits: 4,
      turns: 5,
      success: true,
      hintsUsed: 0,
    }));
    useUserStore.setState({
      dailyChallenge: {
        ...DAILY_CHALLENGE_DEFAULTS,
        history: [anchor, ...filler],
      },
    });
    expect(useUserStore.getState().dailyChallenge.history).toHaveLength(90);
    // One more entry → oldest gets dropped.
    useUserStore.getState().recordDailyResult({
      date: LAUNCH_EPOCH,
      digits: 4,
      turnLimit: 10,
      turnsUsed: 3,
      success: true,
      secret: '1234',
      feedbackTrail: [],
      hintsUsed: 0,
    });
    const history = useUserStore.getState().dailyChallenge.history;
    expect(history).toHaveLength(90);
    expect(history.find((h) => h.date === anchor.date)).toBeUndefined();
    expect(history[history.length - 1]?.date).toBe(LAUNCH_EPOCH);
  });
});

describe('Daily Challenge — DST transition smoke test', () => {
  beforeEach(resetStores);

  // The DST-immunity property is exhaustively unit-tested in
  // dailyDate.test.ts. The value here is one rung up: verify the
  // higher-level helpers (calendarDayIndex, getDailyConfig,
  // recordMissedDay) still produce the right answer when the date
  // strings straddle a DST boundary.

  it('EU spring-forward (2026-03-29): calendar day index is exactly +1 across the boundary', () => {
    // Last Sunday of March 2026 — the 23-hour day in EU. Calendar
    // day arithmetic must not lose a day. Pre-launch dates floor to
    // tier-4 (Day index ≤ 0 → tier-4), but the day-by-day delta is
    // still well-defined and that is what we assert here. Local-
    // calendar parts on each side of the DST boundary remain
    // exactly one calendar day apart — the property dailyDate.ts
    // exists to enforce, lifted into a higher-level smoke check.
    const dayDiff = (a: Date, b: Date): number => {
      const aUTC = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
      const bUTC = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
      return Math.round((bUTC - aUTC) / 86_400_000);
    };
    const sat = parseDailyDate('2026-03-28');
    const sun = parseDailyDate('2026-03-29');
    const mon = parseDailyDate('2026-03-30');
    expect(dayDiff(sat, sun)).toBe(1);
    expect(dayDiff(sun, mon)).toBe(1);
    expect(dayDiff(sat, mon)).toBe(2);
  });

  it('US fall-back (2026-11-01): calendar day index is exactly +1 across the boundary', () => {
    // First Sunday of November — 25-hour day in US locales.
    const fri = '2026-10-30';
    const sat = '2026-10-31';
    const sun = '2026-11-01';
    const mon = '2026-11-02';
    const dayDiff = (a: Date, b: Date): number => {
      const aUTC = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
      const bUTC = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
      return Math.round((bUTC - aUTC) / 86_400_000);
    };
    expect(dayDiff(parseDailyDate(fri), parseDailyDate(sat))).toBe(1);
    expect(dayDiff(parseDailyDate(sat), parseDailyDate(sun))).toBe(1);
    expect(dayDiff(parseDailyDate(sun), parseDailyDate(mon))).toBe(1);
  });

  it('streak across spring-forward: yesterday → today still detected as gap=1 (no break)', () => {
    // Plant lastPlayedDate at Saturday before EU spring-forward.
    useUserStore.setState({
      dailyChallenge: {
        ...DAILY_CHALLENGE_DEFAULTS,
        lastPlayedDate: '2026-03-28',
        currentStreak: 4,
        longestStreak: 4,
      },
    });
    // Play the spring-forward Sunday — gap = 1, streak should
    // advance (DST must not be misread as a gap=0 same-day or
    // gap=2 missed-day).
    playDayWin('2026-03-29');
    const state = useUserStore.getState().dailyChallenge;
    expect(state.currentStreak).toBe(5);
    expect(state.effectiveDayOffset).toBe(0);
  });

  it('streak across fall-back: yesterday → today still detected as gap=1 (no break)', () => {
    useUserStore.setState({
      dailyChallenge: {
        ...DAILY_CHALLENGE_DEFAULTS,
        lastPlayedDate: '2026-10-31',
        currentStreak: 4,
        longestStreak: 4,
      },
    });
    playDayWin('2026-11-01');
    const state = useUserStore.getState().dailyChallenge;
    expect(state.currentStreak).toBe(5);
  });

  it('missed-day regression across DST boundary: gap detected correctly', () => {
    // Plant lastPlayedDate Friday pre-fall-back, today Monday post.
    // Gap = 3 calendar days. Streak breaks; regression fires per
    // prior tier (tier-4 floor in pre-launch dates → no offset
    // delta, but the streak-zero is the load-bearing assertion).
    useUserStore.setState({
      dailyChallenge: {
        ...DAILY_CHALLENGE_DEFAULTS,
        lastPlayedDate: '2026-10-30',
        currentStreak: 8,
        longestStreak: 8,
      },
    });
    useUserStore.getState().recordMissedDay('2026-11-02');
    const state = useUserStore.getState().dailyChallenge;
    expect(state.currentStreak).toBe(0);
    expect(state.lastPlayedDate).toBe('2026-11-02');
  });
});
