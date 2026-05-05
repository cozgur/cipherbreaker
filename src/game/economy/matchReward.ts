/**
 * Phase 7A.5 fix (Codex finding 1) — shared "reward from match
 * state" helper.
 *
 * Previously the `rewardForOutcome(result, mode, difficulty)`
 * function lived inside `MatchScreen.tsx` and was the only
 * computer of the per-match credit. CP6's
 * `applyRewardedDouble(extraReward)` accepted the credited
 * amount as a parameter — which Codex review (high severity)
 * flagged as a token-mint exploit: a manipulated AdWatch route
 * could pass an arbitrary `extraReward` and unlocked the wallet.
 *
 * The fix collapses the calculation into one server-style
 * authority: `applyRewardedDouble(matchId)` reads `matchState`,
 * verifies the id, and computes the doubled amount itself by
 * calling `rewardForCompletedMatch(matchState, mode)`. The user
 * cannot bypass the math because they no longer supply it.
 *
 * `MatchScreen.tsx`'s reward computation also now routes through
 * this helper — single source of truth ensures the navigation
 * `route.params.reward` and the action-side double calculation
 * agree exactly.
 *
 * Pure module — no React, no AsyncStorage, no store imports.
 */

import { computeReward } from './rewardPacing';
import type {
  BotDifficulty,
  MatchResult as EngineMatchResult,
  ModeCatalogEntry,
} from '@game/types';

/**
 * Compute the credited token amount for a completed match.
 * Mirrors `MatchScreen.tsx`'s `rewardForOutcome` — DDA-aware on
 * the win + draw paths, raw stake refund on stalemate, zero on
 * defeat. The DDA `difficulty` argument falls back to `'normal'`
 * for legacy persisted matches with no stamped band.
 */
export function rewardForCompletedMatch(
  result: EngineMatchResult,
  mode: ModeCatalogEntry,
  difficulty: BotDifficulty = 'normal',
): number {
  switch (result.outcome) {
    case 'player_won':
      return computeReward(mode.meta.rewardWin, difficulty);
    case 'draw':
      return computeReward(mode.meta.rewardDraw, difficulty);
    case 'stalemate':
      return mode.meta.stake;
    case 'opponent_won':
      return 0;
  }
}
