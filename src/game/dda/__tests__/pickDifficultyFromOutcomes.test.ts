import type { MatchResultOutcome } from '@navigation/routes';

import {
  pickDifficultyFromOutcomes,
  RECENT_WINDOW_SIZE,
  WARMUP_DEFAULT,
} from '../pickDifficultyFromOutcomes';

const V: MatchResultOutcome = 'victory';
const D: MatchResultOutcome = 'defeat';
const DR: MatchResultOutcome = 'draw';
const SM: MatchResultOutcome = 'stalemate';

const repeat = (outcome: MatchResultOutcome, n: number): MatchResultOutcome[] =>
  Array.from({ length: n }, () => outcome);

describe('pickDifficultyFromOutcomes', () => {
  describe('warm-up — fewer than RECENT_WINDOW_SIZE matches', () => {
    it('returns the warm-up default for an empty window', () => {
      expect(pickDifficultyFromOutcomes([])).toBe(WARMUP_DEFAULT);
      expect(WARMUP_DEFAULT).toBe('normal');
    });

    it('returns warm-up default for 1..9 matches regardless of outcomes', () => {
      for (let n = 1; n < RECENT_WINDOW_SIZE; n += 1) {
        expect(pickDifficultyFromOutcomes(repeat(V, n))).toBe(WARMUP_DEFAULT);
        expect(pickDifficultyFromOutcomes(repeat(D, n))).toBe(WARMUP_DEFAULT);
      }
    });

    it('does NOT trigger easy/hard during warm-up even on extreme runs', () => {
      // 9 victories in a row would otherwise be 'hard' under the threshold,
      // but warm-up keeps difficulty at 'normal' until the window fills.
      expect(pickDifficultyFromOutcomes(repeat(V, 9))).toBe('normal');
      expect(pickDifficultyFromOutcomes(repeat(D, 9))).toBe('normal');
    });
  });

  describe('full window — easy band (0–2 wins)', () => {
    it('returns easy at 0 victories / 10', () => {
      expect(pickDifficultyFromOutcomes(repeat(D, 10))).toBe('easy');
    });

    it('returns easy at 1 victory / 10', () => {
      expect(pickDifficultyFromOutcomes([V, ...repeat(D, 9)])).toBe('easy');
    });

    it('returns easy at the upper boundary (2 victories / 10)', () => {
      expect(pickDifficultyFromOutcomes([V, V, ...repeat(D, 8)])).toBe('easy');
    });
  });

  describe('full window — normal band (3–7 wins)', () => {
    it('returns normal at the lower boundary (3 victories / 10)', () => {
      expect(pickDifficultyFromOutcomes([...repeat(V, 3), ...repeat(D, 7)])).toBe('normal');
    });

    it('returns normal at the midpoint (5 victories / 10)', () => {
      expect(pickDifficultyFromOutcomes([...repeat(V, 5), ...repeat(D, 5)])).toBe('normal');
    });

    it('returns normal at the upper boundary (7 victories / 10)', () => {
      expect(pickDifficultyFromOutcomes([...repeat(V, 7), ...repeat(D, 3)])).toBe('normal');
    });
  });

  describe('full window — hard band (8–10 wins)', () => {
    it('returns hard at the lower boundary (8 victories / 10)', () => {
      expect(pickDifficultyFromOutcomes([...repeat(V, 8), ...repeat(D, 2)])).toBe('hard');
    });

    it('returns hard at 9 victories / 10', () => {
      expect(pickDifficultyFromOutcomes([...repeat(V, 9), D])).toBe('hard');
    });

    it('returns hard at 10 victories / 10', () => {
      expect(pickDifficultyFromOutcomes(repeat(V, 10))).toBe('hard');
    });
  });

  describe('draw / stalemate — count toward denominator, not numerator', () => {
    it('treats draws as non-wins (7V + 3D = normal, not hard)', () => {
      expect(pickDifficultyFromOutcomes([...repeat(V, 7), ...repeat(DR, 3)])).toBe('normal');
    });

    it('treats stalemates as non-wins (7V + 3SM = normal, not hard)', () => {
      expect(pickDifficultyFromOutcomes([...repeat(V, 7), ...repeat(SM, 3)])).toBe('normal');
    });

    it('mixed draw + stalemate count as non-wins (8V + 1DR + 1SM = hard)', () => {
      // Sanity — 8 victories still trips hard; the 2 non-wins are immaterial.
      expect(pickDifficultyFromOutcomes([...repeat(V, 8), DR, SM])).toBe('hard');
    });

    it('all draws → 0 wins → easy (documented edge case, vanishing in practice)', () => {
      expect(pickDifficultyFromOutcomes(repeat(DR, 10))).toBe('easy');
    });

    it('all stalemates → 0 wins → easy', () => {
      expect(pickDifficultyFromOutcomes(repeat(SM, 10))).toBe('easy');
    });
  });

  describe('boundary oscillation — sliding window flips difficulty at threshold edges', () => {
    // These cover the case the static threshold tests don't: as the
    // window slides forward (one outcome dropped from the head, one
    // appended to the tail), the wins count can change by ±1 and trip
    // a band boundary. Regression guard for off-by-one slice + count
    // bugs that wouldn't surface from full-window fixtures alone.

    it('2 → 3 flip — appending a victory while a defeat slides off pushes easy → normal', () => {
      // Window: [D, V, V, D, D, D, D, D, D, D] — 2 victories → easy.
      const before: MatchResultOutcome[] = [D, V, V, D, D, D, D, D, D, D];
      expect(pickDifficultyFromOutcomes(before)).toBe('easy');
      // Push a new victory; the leading defeat falls off under the
      // cap-10 sliding window. Graded last-10 becomes
      // [V, V, D, D, D, D, D, D, D, V] — 3 victories → normal.
      const after = [...before, V];
      expect(pickDifficultyFromOutcomes(after)).toBe('normal');
    });

    it('7 → 8 flip — appending a victory while a defeat slides off pushes normal → hard', () => {
      // Window: [D, V, V, V, V, V, V, V, D, D] — 7 victories → normal.
      const before: MatchResultOutcome[] = [D, V, V, V, V, V, V, V, D, D];
      expect(pickDifficultyFromOutcomes(before)).toBe('normal');
      // Push a new victory; the leading defeat falls off. Graded last-10
      // becomes [V, V, V, V, V, V, V, D, D, V] — 8 victories → hard.
      const after = [...before, V];
      expect(pickDifficultyFromOutcomes(after)).toBe('hard');
    });
  });

  describe('rolling window — slices the last RECENT_WINDOW_SIZE entries', () => {
    it('15-entry input where the leading 5 are victories: only the last 10 grade', () => {
      // First 5 victories fall off the window; last 10 are all defeats → easy.
      const sequence: MatchResultOutcome[] = [...repeat(V, 5), ...repeat(D, 10)];
      expect(pickDifficultyFromOutcomes(sequence)).toBe('easy');
    });

    it('15-entry input with the dominant streak at the tail flips to hard', () => {
      // First 5 defeats fall off; last 10 are all victories → hard.
      const sequence: MatchResultOutcome[] = [...repeat(D, 5), ...repeat(V, 10)];
      expect(pickDifficultyFromOutcomes(sequence)).toBe('hard');
    });

    it('20-entry input grades the trailing 10 only', () => {
      // First 10 are V (would be 'hard' alone); next 10 are D → easy.
      const sequence: MatchResultOutcome[] = [...repeat(V, 10), ...repeat(D, 10)];
      expect(pickDifficultyFromOutcomes(sequence)).toBe('easy');
    });
  });
});
