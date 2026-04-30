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
 * secret (Modes 1–6) head to SecretSetup; Mode 7 (Mirror) skips it
 * because both players race the **same** engine-generated code, so
 * there is nothing for the player to choose.
 *
 * Discriminator is `flags.sharedSecret` (Mirror-only) — NOT
 * `flags.parallelRace`. Phase 6 split the two: `parallelRace` selects
 * the engine (Mode 6 Sudden Death also rides parallelEngine after
 * Phase 6's migration) but does NOT imply a shared secret. Mode 6
 * keeps SecretSetup; only `sharedSecret` skips it.
 */
export function nextRouteAfterMatchmaking(modeId: number): 'SecretSetup' | 'Match' {
  const mode = findMode(modeId);
  if (mode?.rules.flags.sharedSecret === true) {
    return 'Match';
  }
  return 'SecretSetup';
}
