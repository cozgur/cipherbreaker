/**
 * Mode 1 bot strategy — pool filter + difficulty-weighted pick + UI
 * delay generator. Split out of `mode1ColorMatch.ts` so the parent
 * file stays under the 200-line Faz 3 ceiling and so Phase 4-5 mode
 * implementations have a clear template for "where the strategy lives
 * once the mode grows beyond a single file".
 *
 * Boundaries:
 *   - `narrowPool` and `makeGuess` are pure (modulo `ctx.rng`, which is
 *     deterministic given a seeded state) — same inputs → same guess.
 *   - `thinkingTime` is the sole `Math.random` consumer. UI delay is
 *     decoupled from resume identity (see ARCHITECTURE §Phase 3).
 */

import { BOT_THINK_MAX_MS, BOT_THINK_MIN_MS } from '@game/constants';

import { selectByDifficulty } from '../../shared/botHelpers';
import {
  filterByFeedback,
  filterByFeedbackChunked,
} from '../../shared/candidatePool';
import type { BotContext, GuessEntry, SolverState } from '../../types';
import { evaluateColorMatch, SECRET_LENGTH } from './evaluate';

/** Pools at or above this size yield to the UI thread between chunks. */
const HEAVY_FILTER_THRESHOLD = 1000;

/**
 * Filter the candidate pool against the *latest* guess+feedback the bot
 * received. Each candidate survives only if `evaluate(lastGuess, c)`
 * matches the feedback the engine already produced — that's SPEC §4.2
 * "consistent candidates". We filter against just the last entry
 * (instead of replaying the full history) because the prior pool was
 * already filtered against everything before it; the constraints
 * compose by induction.
 *
 * Pools ≥ `HEAVY_FILTER_THRESHOLD` (the opening 10 000) yield to the UI
 * between chunks. Once narrowed, the synchronous variant is faster.
 */
async function narrowPool(
  pool: readonly string[],
  lastEntry: GuessEntry,
): Promise<string[]> {
  const lastGuess = lastEntry.digits.join('');
  const lastFeedback = lastEntry.feedback;
  if (lastFeedback.kind !== 'colorMatch') {
    throw new Error(
      `mode1: expected colorMatch feedback in history, got '${lastFeedback.kind}'`,
    );
  }
  const expected = lastFeedback.states;
  const isConsistent = (candidate: string): boolean => {
    const fb = evaluateColorMatch(lastGuess, candidate);
    if (fb.kind !== 'colorMatch') return false;
    for (let i = 0; i < SECRET_LENGTH; i += 1) {
      if (fb.states[i] !== expected[i]) return false;
    }
    return true;
  };
  if (pool.length >= HEAVY_FILTER_THRESHOLD) {
    return filterByFeedbackChunked(pool, isConsistent);
  }
  return filterByFeedback(pool, isConsistent);
}

/**
 * SPEC §4.2 consistent-candidate pool + SPEC §4.3 difficulty bias. The
 * full pool survives the opening turn (no feedback yet); subsequent
 * turns shrink it monotonically. `newSolverState.pool = filtered` so
 * the next call works against the already-narrowed set.
 */
export async function makeGuess(
  ctx: BotContext,
): Promise<{ guess: string; newSolverState: SolverState }> {
  if (ctx.solverState.kind !== 'candidatePool') {
    throw new Error(
      `mode1: expected solverState.kind='candidatePool', got '${ctx.solverState.kind}'`,
    );
  }

  let pool = ctx.solverState.pool;
  const lastEntry = ctx.previousGuesses[ctx.previousGuesses.length - 1];
  if (lastEntry !== undefined) {
    const narrowed = await narrowPool(pool, lastEntry);
    // Defensive — an empty narrowed pool means earlier feedback in this
    // match is internally inconsistent (engine bug, hand-edited state).
    // Fall back to the un-narrowed pool so the match doesn't deadlock.
    pool = narrowed.length > 0 ? narrowed : pool;
  }

  if (pool.length === 0) {
    return { guess: '0000', newSolverState: { kind: 'candidatePool', pool: [] } };
  }

  const guess = selectByDifficulty(pool, ctx.difficulty, ctx.rng);
  return { guess, newSolverState: { kind: 'candidatePool', pool } };
}

/**
 * UI delay only. `Math.random` is the entropy source so a resume after
 * suspend doesn't re-roll the durable RNG just to re-derive a cosmetic
 * delay. SPEC §4.4: 2–12s band, difficulty + turn-number skew, ~8%
 * chance of a long "phone-down" outlier.
 */
export function thinkingTime(ctx: BotContext): number {
  const span = BOT_THINK_MAX_MS - BOT_THINK_MIN_MS;
  const bands: Record<BotContext['difficulty'], readonly [number, number]> = {
    easy: [0.4, 1.0],
    normal: [0.2, 0.7],
    hard: [0.0, 0.4],
  };
  const [lowFrac, highFrac] = bands[ctx.difficulty];
  const warmup = ctx.turnNumber <= 3 ? 1.0 : 0.8;
  const low = BOT_THINK_MIN_MS + span * lowFrac;
  const high = BOT_THINK_MIN_MS + span * highFrac * warmup;
  let value = Math.min(low, high) + Math.random() * Math.abs(high - low);
  if (Math.random() < 0.08) {
    value = Math.min(BOT_THINK_MAX_MS, value + 5000 + Math.random() * 5000);
  }
  return Math.max(BOT_THINK_MIN_MS, Math.min(BOT_THINK_MAX_MS, Math.round(value)));
}
