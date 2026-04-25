/**
 * Per-mode navigation policy. Concentrates the "what comes next?"
 * decisions that screens used to make inline. Today there are only
 * two callers (Matchmaking, MatchResult); pulling the logic here
 * means Phase 6 (Mirror engine) and Phase 7B (rematch policy) can
 * tweak routing without touching every screen.
 */

import { findMode } from '@data/modeCatalog';

/**
 * After matchmaking resolves, modes that carry their own player-set
 * secret (Modes 1–6) head to SecretSetup; Mode 7 (Mirror, parallel
 * race) skips it because both players race the same engine-generated
 * code, so there is nothing for the player to choose.
 */
export function nextRouteAfterMatchmaking(modeId: number): 'SecretSetup' | 'Match' {
  const mode = findMode(modeId);
  if (mode?.rules.flags.parallelRace === true) {
    return 'Match';
  }
  return 'SecretSetup';
}
