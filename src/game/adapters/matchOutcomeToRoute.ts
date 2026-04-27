/**
 * Map an engine `MatchResult` to the `MatchResultOutcome` value the
 * MatchResult route param expects. Lives in `adapters/` (not
 * `navigation/`) because it's the engine ↔ UI seam — same place the
 * `guessEntryToRowProps` adaptor sits, so the routing surface stays
 * decoupled from match state.
 */

import type { MatchResultOutcome } from '@navigation/routes';

import type { MatchResult } from '../types';

export function matchOutcomeToRoute(result: MatchResult): MatchResultOutcome {
  switch (result.outcome) {
    case 'player_won':
      return 'victory';
    case 'opponent_won':
      return 'defeat';
    case 'draw':
      return 'draw';
    case 'stalemate':
      return 'stalemate';
  }
}
