/**
 * `NormalizedFeedback` helpers. Both are defensive about the
 * `isWin?: boolean` field — Phase 1B mock entries don't carry it, so
 * `undefined` is a legal "no win signal" and we must not coerce it
 * to anything else.
 */

import type { GuessEntry, NormalizedFeedback } from '@game/types';

/** Strict `isWin === true`. Missing or false-y → not a win. */
export function isWinningFeedback(feedback: NormalizedFeedback | null | undefined): boolean {
  return feedback?.isWin === true;
}

/**
 * Last-emitted feedback for a side, or `null` if the side hasn't
 * guessed yet. Engines hand the result to `checkEndConditions` so
 * "this turn cracked it" survives the trip through `submitGuess`.
 */
export function lastFeedback(guesses: readonly GuessEntry[]): NormalizedFeedback | null {
  if (guesses.length === 0) return null;
  const last = guesses[guesses.length - 1];
  return last ? last.feedback : null;
}
