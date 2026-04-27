/**
 * Mode 2 bot strategy — binary-search interval tracking. Each guess+
 * feedback collapses one bound of the `[low, high]` integer range;
 * `pickInRange` chooses the next guess by difficulty.
 *
 * Boundaries (mirror Mode 1):
 *   - `narrowRange` and `makeGuess` are pure modulo `ctx.rng` —
 *     deterministic given a seeded cursor.
 *   - `thinkingTime` is the sole `Math.random` consumer. UI delay is
 *     decoupled from resume identity (ARCHITECTURE §Phase 3). The
 *     body is copied verbatim from Mode 1's `bot.ts`; Phase 5 promotes
 *     this into a shared helper once a third mode pulls on it.
 */

import { BOT_THINK_MAX_MS, BOT_THINK_MIN_MS } from '@game/constants';

import type { BotContext, GuessEntry, RNG, SolverState } from '../../types';
import { SECRET_LENGTH } from './evaluate';

const MIN_VALUE = 0;
const MAX_VALUE = 9999;

type Difficulty = BotContext['difficulty'];

/**
 * Format a 0..9999 integer as the canonical 4-digit guess string.
 * Leading zeros are mandatory — the engine compares as strings until
 * the evaluator's `parseInt` boundary, so `'17'` would be rejected as
 * `WRONG_LENGTH`.
 */
function formatGuess(n: number): string {
  return n.toString(10).padStart(SECRET_LENGTH, '0');
}

/**
 * Apply the latest feedback to the bot's running interval. Returns a
 * fresh `[low, high]`; the caller falls back to the un-narrowed
 * interval if this collapses to an empty span (shouldn't happen with
 * a healthy engine, but defensive against hand-edited state).
 */
function narrowRange(
  range: { readonly low: number; readonly high: number },
  lastEntry: GuessEntry,
): { low: number; high: number } {
  const lastFeedback = lastEntry.feedback;
  if (lastFeedback.kind !== 'direction') {
    throw new Error(
      `mode2: expected direction feedback in history, got '${lastFeedback.kind}'`,
    );
  }
  const lastGuess = Number.parseInt(lastEntry.digits.join(''), 10);
  // 'higher' = secret was greater than the guess; pull `low` up.
  // 'lower'  = secret was smaller; pull `high` down.
  if (lastFeedback.dir === 'higher') {
    return { low: Math.max(range.low, lastGuess + 1), high: range.high };
  }
  return { low: range.low, high: Math.min(range.high, lastGuess - 1) };
}

/**
 * Difficulty-weighted pick over `[low, high]`. Hard returns the
 * midpoint deterministically (zero `rng` draws — matches Mode 1's
 * "hard never consumes from rng" invariant). Normal samples
 * uniformly. Easy biases toward the outer thirds, weakening binary
 * search in the same spirit as Mode 1's "bottom-third on easy".
 */
function pickInRange(low: number, high: number, difficulty: Difficulty, rng: RNG): number {
  if (low === high) return low;
  if (difficulty === 'hard') {
    return Math.floor((low + high) / 2);
  }
  if (difficulty === 'easy' && high - low >= 6) {
    const span = high - low + 1;
    const third = Math.floor(span / 3);
    // Coin-flip between the bottom and top thirds; uniform within.
    if (rng.next() < 0.5) {
      return rng.int(low, low + third - 1);
    }
    return rng.int(high - third + 1, high);
  }
  return rng.int(low, high);
}

/**
 * SPEC §3.3 — narrow the bot's interval by one feedback round and
 * pick the next guess. The opening turn (no feedback yet) runs against
 * the full `[0, 9999]` and produces the difficulty-weighted opener
 * (`5000` on hard).
 */
export async function makeGuess(
  ctx: BotContext,
): Promise<{ guess: string; newSolverState: SolverState }> {
  if (ctx.solverState.kind !== 'directionRange') {
    throw new Error(
      `mode2: expected solverState.kind='directionRange', got '${ctx.solverState.kind}'`,
    );
  }

  let { low, high } = ctx.solverState;
  const lastEntry = ctx.previousGuesses[ctx.previousGuesses.length - 1];
  if (lastEntry !== undefined) {
    const next = narrowRange({ low, high }, lastEntry);
    // Empty span → earlier feedback was internally inconsistent. Reset
    // to the full range so the match doesn't deadlock.
    if (next.low <= next.high) {
      low = next.low;
      high = next.high;
    } else {
      low = MIN_VALUE;
      high = MAX_VALUE;
    }
  }

  const value = pickInRange(low, high, ctx.difficulty, ctx.rng);
  const guess = formatGuess(value);
  return {
    guess,
    newSolverState: { kind: 'directionRange', low, high },
  };
}

/**
 * UI delay only. `Math.random` source so resume after suspend doesn't
 * re-roll the durable RNG for a cosmetic delay. Body copied verbatim
 * from Mode 1; Phase 5 will lift this into a shared helper once Mode 3
 * (and beyond) confirm the same shape applies everywhere.
 */
export function thinkingTime(ctx: BotContext): number {
  const span = BOT_THINK_MAX_MS - BOT_THINK_MIN_MS;
  const bands: Record<Difficulty, readonly [number, number]> = {
    easy: [0.4, 1.0],
    normal: [0.2, 0.7],
    hard: [0.0, 0.4],
  };
  const [lowFrac, highFrac] = bands[ctx.difficulty];
  const warmup = ctx.turnNumber <= 3 ? 1.0 : 0.8;
  const lowMs = BOT_THINK_MIN_MS + span * lowFrac;
  const highMs = BOT_THINK_MIN_MS + span * highFrac * warmup;
  let value = Math.min(lowMs, highMs) + Math.random() * Math.abs(highMs - lowMs);
  if (Math.random() < 0.08) {
    value = Math.min(BOT_THINK_MAX_MS, value + 5000 + Math.random() * 5000);
  }
  return Math.max(BOT_THINK_MIN_MS, Math.min(BOT_THINK_MAX_MS, Math.round(value)));
}
