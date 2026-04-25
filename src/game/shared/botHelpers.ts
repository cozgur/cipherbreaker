/**
 * Bot helpers shared across modes. `selectByDifficulty` is the heart of
 * the "easy / normal / hard" knob — it picks from a pre-filtered
 * candidate pool with bias toward optimal (hard) or random (easy).
 *
 * `randomThinkingTime` produces the chess-clock-style delay the UI
 * shows as the typing indicator. Range comes from `BOT_THINK_*`
 * constants; difficulty narrows it further to keep "hard" feeling
 * snappy and "easy" feeling thoughtful (more human-like uncertainty).
 */

import { BOT_THINK_MAX_MS, BOT_THINK_MIN_MS } from '@game/constants';
import type { BotContext, RNG } from '@game/types';

type Difficulty = BotContext['difficulty'];

/**
 * Pick from a filtered pool with bias matched to difficulty.
 *
 * - `hard`: always the first candidate (assumes the mode's makeGuess
 *   sorted/scored the pool — first = best).
 * - `normal`: uniformly random.
 * - `easy`: uniformly random *and* takes the worst third when the
 *   pool is large enough to bias visibly. Falls back to uniform on
 *   small pools so we don't hand the player a free win.
 */
export function selectByDifficulty(
  pool: readonly string[],
  difficulty: Difficulty,
  rng: RNG,
): string {
  if (pool.length === 0) {
    throw new RangeError('selectByDifficulty: candidate pool is empty');
  }
  if (difficulty === 'hard') {
    return pool[0] as string;
  }
  if (difficulty === 'easy' && pool.length >= 6) {
    // Bottom third — bias toward suboptimal but still legal candidates.
    const start = Math.floor((pool.length * 2) / 3);
    return rng.pick(pool.slice(start));
  }
  return rng.pick(pool);
}

/**
 * Random think delay shaped by difficulty + how deep into the match we
 * are. Early turns lean toward the slow end (the bot is "deliberating
 * the opening"); late turns trend faster as the candidate pool
 * narrows. Always clamped to `[BOT_THINK_MIN_MS, BOT_THINK_MAX_MS]`.
 */
export function randomThinkingTime(difficulty: Difficulty, turnNumber: number, rng: RNG): number {
  const span = BOT_THINK_MAX_MS - BOT_THINK_MIN_MS;
  // Each difficulty owns ~1/3 of the span, anchored at the min.
  const difficultyOffsets: Record<Difficulty, [number, number]> = {
    easy: [0.4, 1.0],
    normal: [0.2, 0.7],
    hard: [0.0, 0.4],
  };
  const [lowFrac, highFrac] = difficultyOffsets[difficulty];
  // Linear "warm up" — turns 1..3 sit higher in the band, turns 4+
  // shrink the upper bound by ~20% to keep the match flowing.
  const warmup = turnNumber <= 3 ? 1.0 : 0.8;
  const low = BOT_THINK_MIN_MS + span * lowFrac;
  const high = BOT_THINK_MIN_MS + span * highFrac * warmup;
  const min = Math.min(low, high);
  const max = Math.max(low, high);
  // `rng.next()` is `[0, 1)`; spread it across the difficulty band.
  const value = min + rng.next() * (max - min);
  return Math.max(BOT_THINK_MIN_MS, Math.min(BOT_THINK_MAX_MS, Math.round(value)));
}
