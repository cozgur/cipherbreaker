import type { DailyGuessRecord, DailyProbeRecord } from '../types';
import {
  analyzeHintCandidates,
  canProbeDigit,
  computeEarnedHints,
  HINT_CAP,
  HINT_PROBE_TOKEN_COST,
  HINT_REVEAL_TOKEN_COST,
  HINT_THRESHOLDS,
  hintCostForState,
  probeResult,
} from '../hint';

const guess = (g: string, plus: number, minus: number): DailyGuessRecord => ({
  guess: g,
  plus,
  minus,
  isWin: plus === g.length,
});

describe('computeEarnedHints — streak-driven earning', () => {
  it('first hint at streak 7 (was 6 → 7): +1 to pool, lastAt=7', () => {
    const next = computeEarnedHints(0, 0, 6, 7);
    expect(next).toEqual({ earnedHints: 1, lastHintEarnedAtStreak: 7 });
  });

  it('second hint at streak 14 (was 13 → 14): +1 cumulative, lastAt=14', () => {
    const next = computeEarnedHints(1, 7, 13, 14);
    expect(next).toEqual({ earnedHints: 2, lastHintEarnedAtStreak: 14 });
  });

  it('third hint at streak 21: cap=3, lastAt=21', () => {
    const next = computeEarnedHints(2, 14, 20, 21);
    expect(next).toEqual({ earnedHints: 3, lastHintEarnedAtStreak: 21 });
  });

  it('beyond streak 21: idempotent at cap', () => {
    const next = computeEarnedHints(3, 21, 21, 30);
    expect(next).toEqual({ earnedHints: 3, lastHintEarnedAtStreak: 21 });
  });

  it('streak holds AT a threshold (kaybetme bozmaz day): no re-grant', () => {
    const next = computeEarnedHints(1, 7, 7, 7);
    expect(next).toEqual({ earnedHints: 1, lastHintEarnedAtStreak: 7 });
  });

  it('streak break (newStreak=0): pool fully resets', () => {
    const next = computeEarnedHints(2, 14, 9, 0);
    expect(next).toEqual({ earnedHints: 0, lastHintEarnedAtStreak: 0 });
  });

  it('streak break to fresh-success (newStreak=1 after gap): pool resets', () => {
    const next = computeEarnedHints(2, 14, 9, 1);
    expect(next).toEqual({ earnedHints: 0, lastHintEarnedAtStreak: 0 });
  });

  it('user already burned earned hints — replenishes at next threshold', () => {
    const next = computeEarnedHints(0, 7, 13, 14);
    expect(next).toEqual({ earnedHints: 1, lastHintEarnedAtStreak: 14 });
  });

  it('jump straight from 0 to high streak: all crossed thresholds grant (cap 3)', () => {
    const next = computeEarnedHints(0, 0, 0, 22);
    expect(next).toEqual({ earnedHints: 3, lastHintEarnedAtStreak: 21 });
  });

  it('streak below the first threshold: no change', () => {
    const next = computeEarnedHints(0, 0, 5, 6);
    expect(next).toEqual({ earnedHints: 0, lastHintEarnedAtStreak: 0 });
  });

  it('exposed constants match the design', () => {
    expect(HINT_CAP).toBe(3);
    expect(HINT_REVEAL_TOKEN_COST).toBe(100);
    expect(HINT_PROBE_TOKEN_COST).toBe(50);
    expect(HINT_THRESHOLDS).toEqual([7, 14, 21]);
  });
});

describe('hintCostForState', () => {
  it('"earned" wins regardless of which hint type is being bought', () => {
    expect(hintCostForState(1, 0, HINT_REVEAL_TOKEN_COST)).toBe('earned');
    expect(hintCostForState(1, 0, HINT_PROBE_TOKEN_COST)).toBe('earned');
  });

  it('falls back to tokens when pool is empty and balance covers the type cost', () => {
    expect(hintCostForState(0, 100, HINT_REVEAL_TOKEN_COST)).toBe('tokens');
    expect(hintCostForState(0, 50, HINT_PROBE_TOKEN_COST)).toBe('tokens');
    // Probe is cheaper, so a balance that covers probe but not
    // reveal goes 'tokens' for probe, 'unaffordable' for reveal.
    expect(hintCostForState(0, 60, HINT_PROBE_TOKEN_COST)).toBe('tokens');
    expect(hintCostForState(0, 60, HINT_REVEAL_TOKEN_COST)).toBe('unaffordable');
  });

  it('"unaffordable" when neither pool nor balance covers the cost', () => {
    expect(hintCostForState(0, 99, HINT_REVEAL_TOKEN_COST)).toBe('unaffordable');
    expect(hintCostForState(0, 49, HINT_PROBE_TOKEN_COST)).toBe('unaffordable');
  });
});

describe('analyzeHintCandidates — Hint A priority green > yellow > warning', () => {
  // Secret is fixed for legibility; test inputs vary the player's
  // observed signal.
  const SECRET = '1234';

  it('warning when no guesses have been submitted', () => {
    expect(analyzeHintCandidates(SECRET, [], [], [])).toEqual({ kind: 'warning' });
  });

  it('warning when every guess returned plus=0 minus=0 (no signal)', () => {
    expect(
      analyzeHintCandidates(SECRET, [guess('5678', 0, 0), guess('9000', 0, 0)], [], []),
    ).toEqual({ kind: 'warning' });
  });

  it('green when at least one guess has plus >= 1 — picks position 0 first', () => {
    const result = analyzeHintCandidates(SECRET, [guess('1567', 1, 0)], [], []);
    expect(result).toEqual({ kind: 'green', position: 0, digit: '1' });
  });

  it('green skips revealed positions (next smallest unrevealed wins)', () => {
    const result = analyzeHintCandidates(SECRET, [guess('1567', 1, 0)], [0, 1], []);
    expect(result).toEqual({ kind: 'green', position: 2, digit: '3' });
  });

  it('yellow when no plus signal but minus >= 1 — picks lowest secret-shared guessed digit', () => {
    // Player guessed 4587: digit 4 is in secret (minus), 5/8/7 are
    // not (since secret is "1234"). Yellow surfaces digit 4.
    const result = analyzeHintCandidates(SECRET, [guess('4587', 0, 1)], [], []);
    expect(result).toEqual({ kind: 'yellow', digit: 4 });
  });

  it('yellow skips already-revealed-yellow digits', () => {
    // Two minus-guesses revealing digits 4 and 2 are in secret;
    // user already revealed digit 2 → next yellow lands on 4.
    const result = analyzeHintCandidates(
      SECRET,
      [guess('2587', 0, 1), guess('4567', 0, 1)],
      [],
      [2],
    );
    expect(result).toEqual({ kind: 'yellow', digit: 4 });
  });

  it('warning when only minus signal exists but every secret-shared digit is already revealed', () => {
    const result = analyzeHintCandidates(
      SECRET,
      [guess('2587', 0, 1), guess('4567', 0, 1)],
      [],
      [2, 4],
    );
    expect(result).toEqual({ kind: 'warning' });
  });

  it('green priority — even with strong minus signal, green takes precedence', () => {
    // plus=1 AND minus=2. Green should win.
    const result = analyzeHintCandidates(SECRET, [guess('1432', 1, 2)], [], []);
    expect(result.kind).toBe('green');
  });

  it('falls through to yellow when every position is already revealed (rare)', () => {
    // Player has plus signal (could green) but all 4 positions are
    // already revealed → yellow if minus signal qualifies.
    const result = analyzeHintCandidates(
      SECRET,
      [guess('1432', 1, 2)], // plus=1, minus=2 (digits 4,3 wrong-pos)
      [0, 1, 2, 3],
      [],
    );
    // Yellow eligible: digits 1, 4, 3, 2 in guess; all in secret;
    // none yet revealed-yellow. Picks lowest = 1.
    expect(result).toEqual({ kind: 'yellow', digit: 1 });
  });
});

describe('probeResult — Hint B existence check', () => {
  it('true when the digit appears in the secret', () => {
    expect(probeResult(1, '1234')).toBe(true);
    expect(probeResult(4, '1234')).toBe(true);
  });

  it('false when the digit does not appear', () => {
    expect(probeResult(0, '1234')).toBe(false);
    expect(probeResult(9, '1234')).toBe(false);
  });

  it('multiset — true when digit appears multiple times (one is enough)', () => {
    expect(probeResult(1, '1111')).toBe(true);
    expect(probeResult(2, '1212')).toBe(true);
    expect(probeResult(3, '1212')).toBe(false);
  });
});

describe('canProbeDigit — already-probed exclusion', () => {
  const probed: DailyProbeRecord[] = [
    { digit: 1, exists: true },
    { digit: 5, exists: false },
  ];

  it('true when the digit has not been probed yet', () => {
    expect(canProbeDigit(0, probed)).toBe(true);
    expect(canProbeDigit(7, probed)).toBe(true);
  });

  it('false when the digit has already been probed (regardless of exists outcome)', () => {
    expect(canProbeDigit(1, probed)).toBe(false);
    expect(canProbeDigit(5, probed)).toBe(false);
  });

  it('true on an empty probed history', () => {
    expect(canProbeDigit(3, [])).toBe(true);
  });
});
