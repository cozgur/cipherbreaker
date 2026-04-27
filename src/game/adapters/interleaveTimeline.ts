/**
 * Interleave a `MatchState`'s `playerGuesses` + `opponentGuesses` into
 * a chronological `GuessEntry[]` for the MatchScreen scrollback. Turn-
 * based engines strictly alternate sides starting from `firstAuthor`,
 * so the merge is a deterministic round-robin — no per-entry timestamp
 * needed.
 *
 * `firstAuthor` is set by `turnBasedEngine.startMatch`. Pre-Phase-3
 * persisted states hydrate without it; we treat `undefined` as `'self'`
 * because Mode 1 was the first registered mode and most fresh states
 * after Phase 3 will have the field set explicitly.
 */

import type { GuessEntry, GuessSide, MatchState } from '../types';

export function interleaveTimeline(state: MatchState): readonly GuessEntry[] {
  const player = state.playerGuesses;
  const opponent = state.opponentGuesses;
  const first: GuessSide = state.firstAuthor ?? 'self';

  const out: GuessEntry[] = [];
  let pi = 0;
  let oi = 0;
  let next: GuessSide = first;

  // Walk strictly alternating; if the expected side is exhausted (one
  // side has played one more guess than the other), drain whichever
  // side still has entries.
  while (pi < player.length || oi < opponent.length) {
    if (next === 'self' && pi < player.length) {
      const entry = player[pi];
      if (entry !== undefined) out.push(entry);
      pi += 1;
      next = 'opponent';
    } else if (next === 'opponent' && oi < opponent.length) {
      const entry = opponent[oi];
      if (entry !== undefined) out.push(entry);
      oi += 1;
      next = 'self';
    } else {
      // Expected side already drained — flip without consuming.
      next = next === 'self' ? 'opponent' : 'self';
    }
  }
  return out;
}
