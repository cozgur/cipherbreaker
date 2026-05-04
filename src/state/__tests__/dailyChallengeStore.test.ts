/**
 * Phase 7A.4 CP4 — dailyChallengeStore + cross-store coordination.
 *
 * Tests both the per-attempt state machine (currentAttempt lifecycle,
 * cross-midnight stale-drop) and the userStore side-effects
 * (recordDailyResult, recordMissedDay) the store fires at the right
 * moments.
 */

import { useDailyChallengeStore } from '../dailyChallengeStore';
import type { DailyResultSummary } from '@game/daily/types';
import { useUserStore, USER_STORE_DEFAULTS, DAILY_CHALLENGE_DEFAULTS } from '../userStore';
import { getDailySecret } from '@game/daily/dailySeed';

// Phase 7A.4 CP5 iOS-test correction: tier-4 turn budget bumped
// from 6 to 10 (Mastermind paradigm — see dailyConfig.ts comment).
const FRESH_CONFIG = { digits: 4, turnLimit: 10 };

function resetStores(): void {
  useDailyChallengeStore.setState({ currentAttempt: null, isSubmitting: false });
  useUserStore.setState({
    dailyChallenge: DAILY_CHALLENGE_DEFAULTS,
    stats: USER_STORE_DEFAULTS.stats,
    tokens: USER_STORE_DEFAULTS.tokens,
  });
}

describe('dailyChallengeStore.startToday', () => {
  beforeEach(resetStores);

  it('seeds a fresh attempt when no in-progress state exists', () => {
    const seeded = useDailyChallengeStore.getState().startToday('2026-05-10', FRESH_CONFIG);
    expect(seeded).toBe(true);
    const attempt = useDailyChallengeStore.getState().currentAttempt;
    expect(attempt).not.toBeNull();
    expect(attempt!.date).toBe('2026-05-10');
    expect(attempt!.digits).toBe(4);
    expect(attempt!.turnLimit).toBe(10);
    expect(attempt!.guesses).toEqual([]);
  });

  it('the seeded secret matches getDailySecret(date, digits) — global determinism', () => {
    useDailyChallengeStore.getState().startToday('2026-05-10', FRESH_CONFIG);
    const attempt = useDailyChallengeStore.getState().currentAttempt;
    expect(attempt!.secret).toBe(getDailySecret('2026-05-10', 4));
  });

  it('returns false (resume) when an in-progress attempt is for the same date', () => {
    useDailyChallengeStore.getState().startToday('2026-05-10', FRESH_CONFIG);
    // Pretend the user submitted one guess.
    const before = useDailyChallengeStore.getState().currentAttempt!;
    useDailyChallengeStore.setState({
      currentAttempt: {
        ...before,
        guesses: [{ guess: '1234', plus: 1, minus: 0, isWin: false }],
      },
    });
    const seeded = useDailyChallengeStore.getState().startToday('2026-05-10', FRESH_CONFIG);
    expect(seeded).toBe(false);
    // Persisted board untouched.
    expect(useDailyChallengeStore.getState().currentAttempt!.guesses).toHaveLength(1);
  });

  it('cross-midnight stale: silent drop + userStore.recordMissedDay (streak break)', () => {
    // Yesterday's attempt left mid-board, user playing 7 day later.
    useDailyChallengeStore.setState({
      currentAttempt: {
        date: '2026-05-10',
        secret: '1234',
        digits: 4,
        turnLimit: 10,
        guesses: [],
        hintsUsed: 0,
        revealedPositions: [],
        revealedDigits: [],
        probedDigits: [],
      },
    });
    useUserStore.setState({
      dailyChallenge: {
        ...DAILY_CHALLENGE_DEFAULTS,
        lastPlayedDate: '2026-05-09',
        currentStreak: 5,
        longestStreak: 5,
      },
    });
    useDailyChallengeStore.getState().startToday('2026-05-17', FRESH_CONFIG);
    const userDaily = useUserStore.getState().dailyChallenge;
    // Streak broken on stale-drop.
    expect(userDaily.currentStreak).toBe(0);
    // lastPlayedDate updated to today (the stale drop counts as the
    // "missed day" boundary).
    expect(userDaily.lastPlayedDate).toBe('2026-05-17');
    // Fresh attempt seeded for today.
    expect(useDailyChallengeStore.getState().currentAttempt!.date).toBe('2026-05-17');
  });
});

describe('dailyChallengeStore.submitGuess — validation + evaluation', () => {
  beforeEach(() => {
    resetStores();
    useDailyChallengeStore.getState().startToday('2026-05-10', FRESH_CONFIG);
  });

  it('rejects malformed input via validation (length / digits)', () => {
    const tooShort = useDailyChallengeStore.getState().submitGuess('123');
    expect(tooShort.error?.code).toBe('WRONG_LENGTH');

    const letters = useDailyChallengeStore.getState().submitGuess('12a4');
    expect(letters.error?.code).toBe('NOT_DIGITS');

    // currentAttempt unchanged on validation failure.
    expect(useDailyChallengeStore.getState().currentAttempt!.guesses).toHaveLength(0);
  });

  it('appends a record + feedback for a valid non-winning guess', () => {
    const attempt = useDailyChallengeStore.getState().currentAttempt!;
    // Build a guaranteed-non-winning input: invert the secret. With
    // a 4-digit secret, inversion will not match (vanishing chance
    // of palindrome wins, accepted as a flake risk; if it ever
    // surfaces we hand-craft).
    const reversed = attempt.secret.split('').reverse().join('');
    const submitted = reversed === attempt.secret ? attempt.secret.replace(/./g, (d) =>
      d === '9' ? '0' : String(Number.parseInt(d, 10) + 1),
    ) : reversed;
    const result = useDailyChallengeStore.getState().submitGuess(submitted);
    expect(result.error).toBeNull();
    expect(result.record).not.toBeNull();
    expect(result.summary).toBeNull();
    const record = result.record!;
    expect(record.guess).toBe(submitted);
    expect(record.isWin).toBe(false);
    expect(useDailyChallengeStore.getState().currentAttempt!.guesses).toHaveLength(1);
  });

  it('a winning guess closes the attempt and stamps userStore.lastResult', () => {
    const attempt = useDailyChallengeStore.getState().currentAttempt!;
    const result = useDailyChallengeStore.getState().submitGuess(attempt.secret);
    expect(result.error).toBeNull();
    expect(result.summary).not.toBeNull();
    expect(result.summary!.success).toBe(true);
    expect(result.summary!.turnsUsed).toBe(1);
    expect(result.summary!.turnLimit).toBe(10);
    // currentAttempt cleared.
    expect(useDailyChallengeStore.getState().currentAttempt).toBeNull();
    // userStore took the result.
    expect(useUserStore.getState().dailyChallenge.lastResult).not.toBeNull();
    expect(useUserStore.getState().dailyChallenge.lastResult!.success).toBe(true);
    expect(useUserStore.getState().dailyChallenge.currentStreak).toBe(1);
    expect(useUserStore.getState().dailyChallenge.history).toHaveLength(1);
  });

  it('hitting the turn limit without winning closes the attempt as a failure', () => {
    // Submit 10 guaranteed-wrong guesses (tier-4 turn budget post
    // Mastermind paradigm correction). We pick guesses that share
    // no digits with the secret to deterministically miss; if the
    // secret somehow contains every digit, the test gracefully
    // detects an early win and skips.
    const wrong = [
      '1111',
      '2222',
      '3333',
      '4444',
      '5555',
      '6666',
      '7777',
      '8888',
      '9999',
      '1212',
    ];
    let summary: DailyResultSummary | null = null;
    for (const g of wrong) {
      const r = useDailyChallengeStore.getState().submitGuess(g);
      summary = r.summary;
      if (summary !== null) break;
    }
    if (summary === null) {
      throw new Error('test fixture failed to exhaust the turn limit');
    }
    expect(summary.success).toBe(false);
    expect(summary.turnsUsed).toBe(10);
    expect(useDailyChallengeStore.getState().currentAttempt).toBeNull();
    expect(useUserStore.getState().dailyChallenge.lastResult!.success).toBe(false);
    // Streak: failure on first play stays at 0.
    expect(useUserStore.getState().dailyChallenge.currentStreak).toBe(0);
  });

  it('a guess submitted with no in-progress attempt is a defensive identity', () => {
    useDailyChallengeStore.setState({ currentAttempt: null });
    const r = useDailyChallengeStore.getState().submitGuess('1234');
    expect(r.error).toBeNull();
    expect(r.record).toBeNull();
    expect(r.summary).toBeNull();
  });
});

describe('dailyChallengeStore — userStore side-effects on completion', () => {
  beforeEach(resetStores);

  it('recordDailyResult appends a history entry capped at 90', () => {
    // Pre-fill userStore with 90 history entries; the next one
    // should trim the oldest.
    const ninety = Array.from({ length: 90 }, (_, i) => ({
      date: `2025-12-${String((i % 28) + 1).padStart(2, '0')}`,
      digits: 4,
      turns: 5,
      success: true,
      hintsUsed: 0,
    }));
    useUserStore.setState({
      dailyChallenge: { ...DAILY_CHALLENGE_DEFAULTS, history: ninety },
    });

    useDailyChallengeStore.getState().startToday('2026-05-10', FRESH_CONFIG);
    const seeded = useDailyChallengeStore.getState().currentAttempt!;
    useDailyChallengeStore.getState().submitGuess(seeded.secret);

    const history = useUserStore.getState().dailyChallenge.history;
    expect(history).toHaveLength(90);
    expect(history[history.length - 1]!.date).toBe('2026-05-10');
  });

  it('clearAttempt resets currentAttempt without touching userStore', () => {
    useDailyChallengeStore.getState().startToday('2026-05-10', FRESH_CONFIG);
    const userBefore = useUserStore.getState().dailyChallenge;
    useDailyChallengeStore.getState().clearAttempt();
    expect(useDailyChallengeStore.getState().currentAttempt).toBeNull();
    expect(useUserStore.getState().dailyChallenge).toEqual(userBefore);
  });
});

describe('userStore — recordMissedDay tier regression', () => {
  beforeEach(resetStores);

  it('first call (no lastPlayedDate) just stamps today, no streak penalty', () => {
    useUserStore.getState().recordMissedDay('2026-05-10');
    const next = useUserStore.getState().dailyChallenge;
    expect(next.lastPlayedDate).toBe('2026-05-10');
    expect(next.currentStreak).toBe(0);
    expect(next.effectiveDayOffset).toBe(0);
  });

  it('tier-5 missed day: streak resets, offset += 7 (re-enter tier-4 band)', () => {
    useUserStore.setState({
      dailyChallenge: {
        ...DAILY_CHALLENGE_DEFAULTS,
        lastPlayedDate: '2026-05-10', // calendar Day 10 → tier 5
        currentStreak: 5,
        longestStreak: 8,
        effectiveDayOffset: 0,
      },
    });
    useUserStore.getState().recordMissedDay('2026-05-13');
    const next = useUserStore.getState().dailyChallenge;
    expect(next.currentStreak).toBe(0);
    expect(next.longestStreak).toBe(8);
    expect(next.effectiveDayOffset).toBe(7);
    expect(next.lastPlayedDate).toBe('2026-05-13');
  });

  it('tier-6 missed day: streak resets, offset += 10 (re-enter tier-5 band)', () => {
    useUserStore.setState({
      dailyChallenge: {
        ...DAILY_CHALLENGE_DEFAULTS,
        lastPlayedDate: '2026-05-22', // Day 22 → tier 6
        currentStreak: 12,
        longestStreak: 12,
        effectiveDayOffset: 0,
      },
    });
    useUserStore.getState().recordMissedDay('2026-05-25');
    const next = useUserStore.getState().dailyChallenge;
    expect(next.currentStreak).toBe(0);
    expect(next.effectiveDayOffset).toBe(10);
  });

  it('tier-4 missed day: streak resets, offset stays 0 (floor)', () => {
    useUserStore.setState({
      dailyChallenge: {
        ...DAILY_CHALLENGE_DEFAULTS,
        lastPlayedDate: '2026-05-04', // Day 4 → tier 4
        currentStreak: 3,
        longestStreak: 3,
        effectiveDayOffset: 0,
      },
    });
    useUserStore.getState().recordMissedDay('2026-05-07');
    const next = useUserStore.getState().dailyChallenge;
    expect(next.currentStreak).toBe(0);
    expect(next.effectiveDayOffset).toBe(0);
  });
});

describe('dailyChallengeStore.useHint — Hint A priority + cost paths', () => {
  beforeEach(() => {
    resetStores();
  });

  function seedAttempt(overrides: Partial<{
    secret: string;
    guesses: { guess: string; plus: number; minus: number; isWin: boolean }[];
    revealedPositions: number[];
    revealedDigits: number[];
    probedDigits: { digit: number; exists: boolean }[];
    hintsUsed: number;
  }> = {}): void {
    useDailyChallengeStore.setState({
      currentAttempt: {
        date: '2026-05-01',
        secret: overrides.secret ?? '1234',
        digits: 4,
        turnLimit: 10,
        guesses: overrides.guesses ?? [],
        hintsUsed: overrides.hintsUsed ?? 0,
        revealedPositions: overrides.revealedPositions ?? [],
        revealedDigits: overrides.revealedDigits ?? [],
        probedDigits: overrides.probedDigits ?? [],
      },
    });
  }

  it('no-attempt when nothing in flight', () => {
    expect(useDailyChallengeStore.getState().useHint()).toEqual({ kind: 'no-attempt' });
  });

  it('warning when no informative signal — does NOT charge or count', () => {
    seedAttempt({ guesses: [{ guess: '5678', plus: 0, minus: 0, isWin: false }] });
    const tokensBefore = useUserStore.getState().tokens;
    const r = useDailyChallengeStore.getState().useHint();
    expect(r).toEqual({ kind: 'warning' });
    expect(useUserStore.getState().tokens).toBe(tokensBefore);
    expect(useDailyChallengeStore.getState().currentAttempt!.hintsUsed).toBe(0);
  });

  it('green path with earned hint: reveals position 0, decrements pool, hintsUsed +1', () => {
    seedAttempt({ guesses: [{ guess: '1567', plus: 1, minus: 0, isWin: false }] });
    useUserStore.setState({
      dailyChallenge: { ...DAILY_CHALLENGE_DEFAULTS, earnedHints: 2 },
    });
    const r = useDailyChallengeStore.getState().useHint();
    expect(r).toEqual({ kind: 'green', position: 0, digit: '1', cost: 'earned' });
    expect(useUserStore.getState().dailyChallenge.earnedHints).toBe(1);
    const attempt = useDailyChallengeStore.getState().currentAttempt!;
    expect(attempt.hintsUsed).toBe(1);
    expect(attempt.revealedPositions).toEqual([0]);
  });

  it('green path with token cost when pool is empty', () => {
    seedAttempt({ guesses: [{ guess: '1567', plus: 1, minus: 0, isWin: false }] });
    useUserStore.setState({ tokens: 500 });
    const tokensBefore = useUserStore.getState().tokens;
    const r = useDailyChallengeStore.getState().useHint();
    expect(r.kind).toBe('green');
    if (r.kind === 'green') {
      expect(r.cost).toBe('tokens');
    }
    expect(useUserStore.getState().tokens).toBe(tokensBefore - 100);
  });

  it('yellow path: no plus signal but minus signal — reveals digit existence', () => {
    // secret 1234; guess 4587 → plus=0, minus=1 (digit 4 in secret).
    seedAttempt({ guesses: [{ guess: '4587', plus: 0, minus: 1, isWin: false }] });
    useUserStore.setState({
      dailyChallenge: { ...DAILY_CHALLENGE_DEFAULTS, earnedHints: 1 },
    });
    const r = useDailyChallengeStore.getState().useHint();
    expect(r).toEqual({ kind: 'yellow', digit: 4, cost: 'earned' });
    const attempt = useDailyChallengeStore.getState().currentAttempt!;
    expect(attempt.revealedDigits).toEqual([4]);
    expect(attempt.hintsUsed).toBe(1);
  });

  it('unaffordable when pool empty AND tokens < 100', () => {
    seedAttempt({ guesses: [{ guess: '1567', plus: 1, minus: 0, isWin: false }] });
    useUserStore.setState({ tokens: 50 });
    const r = useDailyChallengeStore.getState().useHint();
    expect(r).toEqual({ kind: 'unaffordable' });
    expect(useUserStore.getState().tokens).toBe(50);
    expect(useDailyChallengeStore.getState().currentAttempt!.hintsUsed).toBe(0);
  });
});

describe('dailyChallengeStore.useProbe — Hint B', () => {
  beforeEach(resetStores);

  function seedAttempt(overrides: { secret?: string; probedDigits?: { digit: number; exists: boolean }[] } = {}): void {
    useDailyChallengeStore.setState({
      currentAttempt: {
        date: '2026-05-01',
        secret: overrides.secret ?? '1234',
        digits: 4,
        turnLimit: 10,
        guesses: [],
        hintsUsed: 0,
        revealedPositions: [],
        revealedDigits: [],
        probedDigits: overrides.probedDigits ?? [],
      },
    });
  }

  it('no-attempt when nothing in flight', () => {
    expect(useDailyChallengeStore.getState().useProbe(5)).toEqual({ kind: 'no-attempt' });
  });

  it('resolved=true when digit is in secret (earned cost)', () => {
    seedAttempt({ secret: '1234' });
    useUserStore.setState({
      dailyChallenge: { ...DAILY_CHALLENGE_DEFAULTS, earnedHints: 1 },
    });
    const r = useDailyChallengeStore.getState().useProbe(2);
    expect(r).toEqual({ kind: 'resolved', digit: 2, exists: true, cost: 'earned' });
    expect(useUserStore.getState().dailyChallenge.earnedHints).toBe(0);
    const attempt = useDailyChallengeStore.getState().currentAttempt!;
    expect(attempt.hintsUsed).toBe(1);
    expect(attempt.probedDigits).toEqual([{ digit: 2, exists: true }]);
  });

  it('resolved=false when digit is NOT in secret (token cost: 50)', () => {
    seedAttempt({ secret: '1234' });
    useUserStore.setState({ tokens: 200 });
    const r = useDailyChallengeStore.getState().useProbe(7);
    expect(r).toEqual({ kind: 'resolved', digit: 7, exists: false, cost: 'tokens' });
    expect(useUserStore.getState().tokens).toBe(150);
  });

  it('already-probed when the digit was already interrogated', () => {
    seedAttempt({ probedDigits: [{ digit: 5, exists: false }] });
    useUserStore.setState({ tokens: 1000 });
    const r = useDailyChallengeStore.getState().useProbe(5);
    expect(r).toEqual({ kind: 'already-probed' });
    expect(useUserStore.getState().tokens).toBe(1000);
    expect(useDailyChallengeStore.getState().currentAttempt!.hintsUsed).toBe(0);
  });

  it('unaffordable when pool empty AND tokens < 50', () => {
    seedAttempt();
    useUserStore.setState({ tokens: 25 });
    const r = useDailyChallengeStore.getState().useProbe(3);
    expect(r).toEqual({ kind: 'unaffordable' });
    expect(useUserStore.getState().tokens).toBe(25);
  });
});

describe('userStore.recordDailyResult — earnedHints integration', () => {
  beforeEach(resetStores);

  it('crossing streak 7 grants +1 earnedHint atomically with the streak update', () => {
    useUserStore.setState({
      dailyChallenge: {
        ...DAILY_CHALLENGE_DEFAULTS,
        lastPlayedDate: '2026-05-06',
        currentStreak: 6,
        longestStreak: 6,
      },
    });
    useUserStore.getState().recordDailyResult({
      date: '2026-05-07',
      digits: 4,
      turnLimit: 10,
      turnsUsed: 5,
      success: true,
      secret: '1234',
      feedbackTrail: [],
      hintsUsed: 0,
    });
    const next = useUserStore.getState().dailyChallenge;
    expect(next.currentStreak).toBe(7);
    expect(next.earnedHints).toBe(1);
    expect(next.lastHintEarnedAtStreak).toBe(7);
  });

  it('streak break (gap >= 2) wipes earnedHints in lockstep', () => {
    useUserStore.setState({
      dailyChallenge: {
        ...DAILY_CHALLENGE_DEFAULTS,
        lastPlayedDate: '2026-05-10',
        currentStreak: 8,
        longestStreak: 8,
        earnedHints: 2,
        lastHintEarnedAtStreak: 7,
      },
    });
    useUserStore.getState().recordDailyResult({
      date: '2026-05-13',
      digits: 4,
      turnLimit: 10,
      turnsUsed: 10,
      success: false,
      secret: '1234',
      feedbackTrail: [],
      hintsUsed: 0,
    });
    const next = useUserStore.getState().dailyChallenge;
    expect(next.currentStreak).toBe(0);
    expect(next.earnedHints).toBe(0);
    expect(next.lastHintEarnedAtStreak).toBe(0);
  });
});
