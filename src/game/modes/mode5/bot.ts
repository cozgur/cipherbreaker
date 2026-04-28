/**
 * Mode 5 bot strategy — unique-digit candidate pool (5040 entries) +
 * locked-count consistency filter + difficulty-weighted pick.
 *
 * Boundaries (mirror Mode 1 + Mode 3):
 *   - `narrowPool` and `makeGuess` are pure modulo `ctx.rng` —
 *     deterministic given a seeded cursor.
 *   - `thinkingTime` is the sole `Math.random` consumer. UI delay is
 *     decoupled from resume identity (ARCHITECTURE §Phase 3). Body
 *     copied verbatim from Mode 1; Phase 5 keeps the deferral —
 *     panic-mode tuning + shared helper extraction wait for
 *     evidence (Phase 7A).
 *   - The opening pool is 5040 (`buildAllCandidates(true)`); the
 *     opening narrow MUST go through `filterByFeedbackChunked`
 *     (HEAVY_FILTER_THRESHOLD invariant — see ROADMAP §Heavy
 *     Filtering). The chunked path is what keeps the UI thread
 *     responsive while the bot crunches its first feedback round.
 */

import { BOT_THINK_MAX_MS, BOT_THINK_MIN_MS } from '@game/constants';

import { selectByDifficulty } from '../../shared/botHelpers';
import {
  filterByFeedback,
  filterByFeedbackChunked,
} from '../../shared/candidatePool';
import type { BotContext, GuessEntry, SolverState } from '../../types';
import { countLocked } from './evaluate';

/** Pools at or above this size yield to the UI thread between chunks. */
const HEAVY_FILTER_THRESHOLD = 1000;

/**
 * Filter the candidate pool against the *latest* guess + locked count.
 * A candidate survives only if `countLocked(lastGuess, c)` reproduces
 * the engine's exposed count exactly. Same induction argument as Mode
 * 1/3 — the prior pool was already filtered against everything before,
 * so the constraints compose.
 *
 * Importantly: the bot does NOT see per-position truth in the
 * feedback (SPEC §3.7 forbids it for the player; we keep the bot
 * solving the same puzzle the player solves so difficulty bands stay
 * meaningful). It only sees the count.
 */
async function narrowPool(
  pool: readonly string[],
  lastEntry: GuessEntry,
): Promise<string[]> {
  const lastGuess = lastEntry.digits.join('');
  const lastFeedback = lastEntry.feedback;
  if (lastFeedback.kind !== 'blackout') {
    throw new Error(
      `mode5: expected blackout feedback in history, got '${lastFeedback.kind}'`,
    );
  }
  const expectedLocked = lastFeedback.locked;
  const isConsistent = (candidate: string): boolean =>
    countLocked(lastGuess, candidate) === expectedLocked;
  if (pool.length >= HEAVY_FILTER_THRESHOLD) {
    return filterByFeedbackChunked(pool, isConsistent);
  }
  return filterByFeedback(pool, isConsistent);
}

/**
 * SPEC §4.2 consistent-candidate pool + SPEC §4.3 difficulty bias.
 * The full 5040 unique-digit pool survives the opening turn (no
 * feedback yet); each subsequent turn shrinks it monotonically.
 */
export async function makeGuess(
  ctx: BotContext,
): Promise<{ guess: string; newSolverState: SolverState }> {
  if (ctx.solverState.kind !== 'candidatePool') {
    throw new Error(
      `mode5: expected solverState.kind='candidatePool', got '${ctx.solverState.kind}'`,
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
 * UI delay only. Body copied verbatim from Mode 1 — Phase 5 keeps
 * the deferral; the lift to a shared helper waits for evidence
 * (Phase 7A panic-mode tuning is the trigger).
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
