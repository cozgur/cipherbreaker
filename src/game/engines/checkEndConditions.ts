/**
 * Single source of truth for "is this match over?". Engine
 * `submitGuess` and `applyTimeout` both funnel here, so all win/draw/
 * stalemate logic lives in exactly one file.
 *
 * Decision order matters — earlier branches win:
 *   1. Mode 4 — clock snapshot ≤ 0 on either side → opposite wins.
 *      SPEC §3.6: "Süresi ilk biten oyuncu OTOMATİK KAYBEDER, gizli
 *      sayıyı çözmüş olsa bile" — a timeout beats a crack on the
 *      timed-out side. The Phase 5 device walkthrough caught the
 *      inverted ordering (Phase 2 had crack first, which would
 *      reward a winning-guess-at-zero with `player_won/cracked`).
 *   2. Both sides cracked the secret on the same turn → draw.
 *   3. One side cracked → that side wins ('cracked').
 *   4. Mode 6 — guess limits exhausted → stalemate (single-side
 *      exhaustion is non-terminal per SPEC §3.10; see `Mode 6`
 *      branch below).
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

  // Mode 4 — Blitz time-out. Reads the persisted snapshot, not the
  // live tick value (tick resolution is owned by `liveMatchStore`).
  // SPEC §3.6 precedence: this branch sits ABOVE crack so a timeout
  // on the submitter's side wins over their cracking guess.
  if (mode.rules.perPlayerTimeLimitMs !== undefined && state.clockSnapshot) {
    const { playerMs, opponentMs } = state.clockSnapshot;
    if (playerMs <= 0 && opponentMs <= 0) {
      // Both clocks at zero in the same frame is a vanishingly rare
      // race; SPEC doesn't formally cover it. Resolve as a draw to
      // keep `checkEndConditions` total.
      return { outcome: 'draw', reason: 'simultaneous_crack', turns };
    }
    if (playerMs <= 0) {
      return { outcome: 'opponent_won', reason: 'player_time_out', turns };
    }
    if (opponentMs <= 0) {
      return { outcome: 'player_won', reason: 'opponent_time_out', turns };
    }
  }

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

  // Mode 6 — Sudden Death guess budget. SPEC §3.10 says rounds give
  // each side a full turn before exhaustion ends the match: with
  // strict alternation the side that goes second is always exactly
  // one guess behind, so calling the match the moment one side hits
  // zero would deny the trailing side their final attempt. We only
  // declare termination when BOTH have exhausted (→ stalemate). The
  // single-side `player_guess_limit` / `opponent_guess_limit` reason
  // types stay in the union — Phase 5+ modes that allow asymmetric
  // budgets (e.g. handicap variants) might still produce them, but
  // turn-based Mode 6 alone cannot.
  if (mode.rules.maxGuessesPerPlayer !== undefined && state.guessLimits) {
    const playerExhausted = state.guessLimits.playerRemaining <= 0;
    const opponentExhausted = state.guessLimits.opponentRemaining <= 0;
    if (playerExhausted && opponentExhausted) {
      return { outcome: 'stalemate', reason: 'both_exhausted', turns };
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
