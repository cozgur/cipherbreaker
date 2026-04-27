/**
 * Mode 3 bot strategy — unique-digit candidate pool (5040 entries) +
 * chunked filter + difficulty-weighted pick.
 *
 * Boundaries (mirror Mode 1):
 *   - `narrowPool` and `makeGuess` are pure modulo `ctx.rng` —
 *     deterministic given a seeded cursor.
 *   - `thinkingTime` is the sole `Math.random` consumer. UI delay is
 *     decoupled from resume identity (ARCHITECTURE §Phase 3). Body is
 *     copied verbatim from Mode 1; Phase 5 promotes it to a shared
 *     helper once enough modes pull on the same shape.
 *   - The opening pool is 5040 (`buildAllCandidates(true)`); per
 *     ROADMAP §Heavy Filtering, anything ≥ 1000 *must* go through
 *     `filterByFeedbackChunked` so the UI thread stays responsive.
 */

import { BOT_THINK_MAX_MS, BOT_THINK_MIN_MS } from '@game/constants';

import { selectByDifficulty } from '../../shared/botHelpers';
import {
  filterByFeedback,
  filterByFeedbackChunked,
} from '../../shared/candidatePool';
import type { BotContext, GuessEntry, SolverState } from '../../types';
import { evaluatePrecision } from './evaluate';

/** Pools at or above this size yield to the UI thread between chunks. */
const HEAVY_FILTER_THRESHOLD = 1000;

/**
 * Filter the candidate pool against the *latest* guess+feedback. A
 * candidate survives only if `evaluatePrecision(lastGuess, c)`
 * reproduces the engine's `+plus / −minus` counts exactly. The induction
 * argument is the same as Mode 1 — the prior pool was already filtered
 * against everything before, so the constraints compose.
 */
async function narrowPool(
  pool: readonly string[],
  lastEntry: GuessEntry,
): Promise<string[]> {
  const lastGuess = lastEntry.digits.join('');
  const lastFeedback = lastEntry.feedback;
  if (lastFeedback.kind !== 'precision') {
    throw new Error(
      `mode3: expected precision feedback in history, got '${lastFeedback.kind}'`,
    );
  }
  const expectedPlus = lastFeedback.plus;
  const expectedMinus = lastFeedback.minus;
  const isConsistent = (candidate: string): boolean => {
    const fb = evaluatePrecision(lastGuess, candidate);
    if (fb.kind !== 'precision') return false;
    return fb.plus === expectedPlus && fb.minus === expectedMinus;
  };
  if (pool.length >= HEAVY_FILTER_THRESHOLD) {
    return filterByFeedbackChunked(pool, isConsistent);
  }
  return filterByFeedback(pool, isConsistent);
}

/**
 * SPEC §4.2 consistent-candidate pool + SPEC §4.3 difficulty bias. The
 * full 5040 pool survives the opening turn (no feedback yet); each
 * subsequent turn shrinks it monotonically. `newSolverState.pool =
 * filtered` so the next call works against the already-narrowed set.
 */
export async function makeGuess(
  ctx: BotContext,
): Promise<{ guess: string; newSolverState: SolverState }> {
  if (ctx.solverState.kind !== 'candidatePool') {
    throw new Error(
      `mode3: expected solverState.kind='candidatePool', got '${ctx.solverState.kind}'`,
    );
  }

  let pool = ctx.solverState.pool;
  const lastEntry = ctx.previousGuesses[ctx.previousGuesses.length - 1];
  if (lastEntry !== undefined) {
    const narrowed = await narrowPool(pool, lastEntry);
    pool = narrowed.length > 0 ? narrowed : pool;
  }

  if (pool.length === 0) {
    return { guess: '0123', newSolverState: { kind: 'candidatePool', pool: [] } };
  }

  const guess = selectByDifficulty(pool, ctx.difficulty, ctx.rng);
  return { guess, newSolverState: { kind: 'candidatePool', pool } };
}

/**
 * UI delay only. Body copied verbatim from Mode 1 — Phase 5 lifts this
 * into a shared helper once Modes 4-7 confirm the shape applies
 * everywhere. `Math.random` is the entropy source so a resume after
 * suspend doesn't re-roll the durable RNG just to re-derive a delay.
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
  const lowMs = BOT_THINK_MIN_MS + span * lowFrac;
  const highMs = BOT_THINK_MIN_MS + span * highFrac * warmup;
  let value = Math.min(lowMs, highMs) + Math.random() * Math.abs(highMs - lowMs);
  if (Math.random() < 0.08) {
    value = Math.min(BOT_THINK_MAX_MS, value + 5000 + Math.random() * 5000);
  }
  return Math.max(BOT_THINK_MIN_MS, Math.min(BOT_THINK_MAX_MS, Math.round(value)));
}
