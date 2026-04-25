/**
 * Single source of truth for "is this match over?". Engine
 * `submitGuess` and `applyTimeout` both funnel here, so all win/draw/
 * stalemate logic lives in exactly one file.
 *
 * Decision order matters — earlier branches win:
 *   1. Both sides cracked the secret on the same turn → draw.
 *   2. One side cracked → that side wins ('cracked').
 *   3. Mode 4 — clock snapshot ≤ 0 on either side → opposite wins.
 *   4. Mode 6 — guess limits exhausted → loss for the exhausted side
 *      or stalemate if both ran out.
 *   5. Otherwise → null (match continues).
 *
 * The helper is *pure* — no clocks, no stores, no side effects. The
 * caller passes the prospective new state, the helper says yes/no.
 * That makes the rule engine trivially testable and replay-friendly.
 */

import type { MatchResult, MatchState, ModeDefinition } from '../types';
import { isWinningFeedback, lastFeedback } from '../shared/feedback';

export function checkEndConditions(state: MatchState, mode: ModeDefinition): MatchResult | null {
  const turns = totalTurns(state);

  const playerCracked = isWinningFeedback(lastFeedback(state.playerGuesses));
  const opponentCracked = isWinningFeedback(lastFeedback(state.opponentGuesses));

  if (playerCracked && opponentCracked) {
    return { outcome: 'draw', reason: 'simultaneous_crack', turns };
  }
  if (playerCracked) {
    return { outcome: 'player_won', reason: 'cracked', turns };
  }
  if (opponentCracked) {
    return { outcome: 'opponent_won', reason: 'cracked', turns };
  }

  // Mode 4 — Blitz time-out. Reads the persisted snapshot, not the
  // live tick value (tick resolution is owned by `liveMatchStore`).
  if (mode.rules.perPlayerTimeLimitMs !== undefined && state.clockSnapshot) {
    const { playerMs, opponentMs } = state.clockSnapshot;
    if (playerMs <= 0 && opponentMs <= 0) {
      // Edge case the SPEC doesn't formally cover — treat as
      // simultaneous expiry → draw. checkEndConditions stays total.
      return { outcome: 'draw', reason: 'simultaneous_crack', turns };
    }
    if (playerMs <= 0) {
      return { outcome: 'opponent_won', reason: 'player_time_out', turns };
    }
    if (opponentMs <= 0) {
      return { outcome: 'player_won', reason: 'opponent_time_out', turns };
    }
  }

  // Mode 6 — Sudden Death guess budget.
  if (mode.rules.maxGuessesPerPlayer !== undefined && state.guessLimits) {
    const playerExhausted = state.guessLimits.playerRemaining <= 0;
    const opponentExhausted = state.guessLimits.opponentRemaining <= 0;
    if (playerExhausted && opponentExhausted) {
      return { outcome: 'stalemate', reason: 'both_exhausted', turns };
    }
    if (playerExhausted) {
      return { outcome: 'opponent_won', reason: 'player_guess_limit', turns };
    }
    if (opponentExhausted) {
      return { outcome: 'player_won', reason: 'opponent_guess_limit', turns };
    }
  }

  return null;
}

function totalTurns(state: MatchState): number {
  // "Turns" in the result is the per-side guess count of whichever
  // side has played more — matches how the SPEC reports "kraktıın
  // 5. turunda" in MatchResult copy.
  return Math.max(state.playerGuesses.length, state.opponentGuesses.length);
}
