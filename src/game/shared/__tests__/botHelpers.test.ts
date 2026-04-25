import { BOT_THINK_MAX_MS, BOT_THINK_MIN_MS } from '@game/constants';
import { createRNG } from '@/lib/random';

import { randomThinkingTime, selectByDifficulty } from '../botHelpers';

describe('selectByDifficulty', () => {
  const pool = ['1234', '1243', '1324', '4321', '5678', '9012'];

  it('hard always returns the first (presumed-best) candidate', () => {
    expect(selectByDifficulty(pool, 'hard', createRNG(1))).toBe('1234');
    expect(selectByDifficulty(pool, 'hard', createRNG(2))).toBe('1234');
  });

  it('easy biases toward the back of a non-trivial pool', () => {
    // With 6 candidates, the bottom third is the last 2 entries.
    const seenIndices = new Set<number>();
    for (let seed = 0; seed < 30; seed += 1) {
      const pick = selectByDifficulty(pool, 'easy', createRNG(seed));
      seenIndices.add(pool.indexOf(pick));
    }
    // No "easy" pick should land in the top third.
    for (const idx of seenIndices) {
      expect(idx).toBeGreaterThanOrEqual(4);
    }
  });

  it('normal can pick any pool member', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 60; seed += 1) {
      seen.add(selectByDifficulty(pool, 'normal', createRNG(seed)));
    }
    expect(seen.size).toBeGreaterThan(2);
  });

  it('throws on empty pool', () => {
    expect(() => selectByDifficulty([], 'normal', createRNG(1))).toThrow(RangeError);
  });
});

describe('randomThinkingTime', () => {
  it('always returns a value within the global bot-think bounds', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const ms = randomThinkingTime('normal', 1, createRNG(seed));
      expect(ms).toBeGreaterThanOrEqual(BOT_THINK_MIN_MS);
      expect(ms).toBeLessThanOrEqual(BOT_THINK_MAX_MS);
    }
  });

  it('hard skews shorter than easy on average', () => {
    let easySum = 0;
    let hardSum = 0;
    for (let seed = 0; seed < 100; seed += 1) {
      easySum += randomThinkingTime('easy', 2, createRNG(seed));
      hardSum += randomThinkingTime('hard', 2, createRNG(seed));
    }
    expect(hardSum).toBeLessThan(easySum);
  });

  it('returns an integer (UI uses ms in setTimeout)', () => {
    const ms = randomThinkingTime('normal', 1, createRNG(42));
    expect(Number.isInteger(ms)).toBe(true);
  });
});
