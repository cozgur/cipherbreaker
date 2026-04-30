/**
 * Interleave a `MatchState`'s `playerGuesses` + `opponentGuesses` into
 * a chronological `GuessEntry[]` for the MatchScreen scrollback.
 *
 * Two ordering strategies — caller picks via `opts.chronological`:
 *
 *   - **Round-robin (default).** Turn-based engines (Modes 1-5)
 *     strictly alternate sides starting from `firstAuthor`, so the
 *     merge is a deterministic alternation walk — no per-entry
 *     timestamp needed. `firstAuthor` is set by
 *     `turnBasedEngine.startMatch`. Pre-Phase-3 persisted states
 *     hydrate without it; we fall back to `'self'`.
 *
 *   - **Chronological (`{ chronological: true }`).** Phase 6 CP5 —
 *     parallel-engine modes (Mode 6 Sudden Death) accept submissions
 *     from either side at any time, so round-robin would render the
 *     timeline in a misleading "logical turn" order rather than the
 *     order the player saw the guesses arrive. Sort by
 *     `entry.createdAt` (set by the engine on submit). Stable tie-
 *     break: player entries before opponent entries when timestamps
 *     are equal — viewer-anchored, matches Mode 6's `firstAuthor='self'`.
 *
 * Mode 7 (Mirror) does not call this adapter — `MatchScreen` reads
 * `matchState.playerGuesses` directly to keep the rival's feedback
 * out of the player's view (single-perspective race).
 */

import type { GuessEntry, GuessSide, MatchState } from '../types';

export interface InterleaveOptions {
  /**
   * When `true`, merge by `entry.createdAt` instead of round-robin.
   * Required for parallel modes; turn-based modes leave this off so
   * the existing alternation contract is undisturbed.
   */
  readonly chronological?: boolean;
}

export function interleaveTimeline(
  state: MatchState,
  opts: InterleaveOptions = {},
): readonly GuessEntry[] {
  if (opts.chronological === true) {
    return mergeByCreatedAt(state.playerGuesses, state.opponentGuesses);
  }
  return alternate(state);
}

function alternate(state: MatchState): readonly GuessEntry[] {
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

/**
 * Stable merge of two pre-sorted (by insertion order, which is
 * already chronological per side) arrays into one chronologically
 * ordered array.
 *
 * Entries without `createdAt` (pre-Phase-6-CP5 persisted state, or
 * test fixtures that haven't been updated) sort to the front of their
 * own side's queue with `0`. Production engines always set the field
 * after CP5, so this fallback only matters for hydrate-from-legacy.
 */
function mergeByCreatedAt(
  player: readonly GuessEntry[],
  opponent: readonly GuessEntry[],
): readonly GuessEntry[] {
  const out: GuessEntry[] = [];
  let pi = 0;
  let oi = 0;
  while (pi < player.length && oi < opponent.length) {
    const p = player[pi];
    const o = opponent[oi];
    if (p === undefined) {
      pi += 1;
      continue;
    }
    if (o === undefined) {
      oi += 1;
      continue;
    }
    const pt = p.createdAt ?? 0;
    const ot = o.createdAt ?? 0;
    // Tie-break: player first when timestamps are equal — matches the
    // viewer-anchored `firstAuthor='self'` default the parallel engine
    // sets so the deterministic ordering is "you appear before the
    // opponent at the same instant".
    if (pt <= ot) {
      out.push(p);
      pi += 1;
    } else {
      out.push(o);
      oi += 1;
    }
  }
  while (pi < player.length) {
    const p = player[pi];
    if (p !== undefined) out.push(p);
    pi += 1;
  }
  while (oi < opponent.length) {
    const o = opponent[oi];
    if (o !== undefined) out.push(o);
    oi += 1;
  }
  return out;
}
