/**
 * The number that powers both the MatchScreen "ROUND N" header chip
 * and the "Guess #N" sub-counter, AND that the MatchResult subtitle
 * reads back as "in N guesses".
 *
 * Phase 4 unified the formula because the previous header used
 * `timeline.length + 1` (combined player + opponent count), which
 * doubled every round and disagreed with `MatchResultScreen`'s
 * per-side count. After a 12-guess Mode 2 match, the header read
 * "ROUND 23" while the result celebrated "12 guesses".
 *
 * Definition: the *active* side's current move number — the guess
 * they're about to submit. On player_first matches this is what the
 * Wordle-trained user expects ROUND to count, and at the moment of a
 * winning guess it equals the number `MatchResultScreen` reports back
 * (the subtitle's `turns` reads the same `MatchState.result.turns`).
 *
 *   active_turn_player    → playerGuesses.length + 1
 *   active_turn_opponent  → opponentGuesses.length + 1
 *   active_parallel       → playerGuesses.length + 1 (Mode 7 — player POV)
 *   completed / setup     → max(p, o) (matches `result.turns` post-win)
 *
 * Mock path (no engine): falls back to counting `side === 'self'`
 * entries in the static timeline + 1, so the dev-picker loop displays
 * the player's move number too.
 */

import type { GuessEntry, MatchState } from '../types';

export function currentGuessNumberFromMatch(state: MatchState): number {
  const p = state.playerGuesses.length;
  const o = state.opponentGuesses.length;
  switch (state.phase) {
    case 'active_turn_player':
      return p + 1;
    case 'active_turn_opponent':
      return o + 1;
    case 'active_parallel':
      return p + 1;
    case 'setup':
    case 'completed':
      return Math.max(p, o);
  }
}

export function currentGuessNumberFromMockTimeline(
  timeline: readonly GuessEntry[],
): number {
  return timeline.filter((e) => e.side === 'self').length + 1;
}
