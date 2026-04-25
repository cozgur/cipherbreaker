import type { GuessEntry, NormalizedFeedback } from '@game/types';

import { isWinningFeedback, lastFeedback } from '../feedback';

describe('isWinningFeedback (defensive isWin read)', () => {
  it('returns true when isWin === true', () => {
    const f: NormalizedFeedback = {
      kind: 'colorMatch',
      states: ['green', 'green', 'green', 'green'],
      isWin: true,
    };
    expect(isWinningFeedback(f)).toBe(true);
  });

  it('returns false when isWin === false', () => {
    const f: NormalizedFeedback = {
      kind: 'colorMatch',
      states: ['green', 'green', 'green', 'gray'],
      isWin: false,
    };
    expect(isWinningFeedback(f)).toBe(false);
  });

  it('returns false when isWin is undefined (Phase 1B mock fixtures)', () => {
    const f: NormalizedFeedback = {
      kind: 'colorMatch',
      states: ['neutral', 'neutral', 'neutral', 'neutral'],
    };
    expect(isWinningFeedback(f)).toBe(false);
  });

  it('returns false when feedback itself is null (no-guess-yet path)', () => {
    expect(isWinningFeedback(null)).toBe(false);
    expect(isWinningFeedback(undefined)).toBe(false);
  });
});

describe('lastFeedback', () => {
  function entry(isWin: boolean): GuessEntry {
    return {
      side: 'self',
      guessIndex: 1,
      digits: [1, 2, 3, 4],
      feedback: {
        kind: 'colorMatch',
        states: ['green', 'green', 'green', 'green'],
        isWin,
      },
    };
  }

  it('returns null on empty history', () => {
    expect(lastFeedback([])).toBeNull();
  });

  it('returns the most recent entry feedback', () => {
    const entries: GuessEntry[] = [entry(false), entry(false), entry(true)];
    expect(lastFeedback(entries)).toEqual({
      kind: 'colorMatch',
      states: ['green', 'green', 'green', 'green'],
      isWin: true,
    });
  });
});
