/**
 * Mode 7 (Mirror) parallel engine — soft-fail stub for Phase 2.
 *
 * The interface mirrors `turnBasedEngine` so call sites can switch
 * engines via `selectEngine(mode)` without branching. Phase 6 fills
 * in the actual race semantics; until then every operation is a
 * benign no-op:
 *
 *   - `createMatch` produces a valid `MatchState` with phase
 *     `'active_parallel'` so the screen layer renders without
 *     undefined access.
 *   - `submitGuess` returns `{ state, feedback: null, error: null }`
 *     and emits a single `console.warn` so a misrouted call surfaces
 *     in dev without crashing the screen.
 *
 * **No throws.** Architectural failures the user *should* see (registry
 * miss, invalid state) come from `turnBasedEngine`. Soft-fail here is
 * deliberate: "feature not implemented yet" is not a programmer error.
 */

import { createRNG } from '@/lib/random';

import { modeRegistry } from '../modeRegistry';
import type {
  ClockSnapshot,
  GuessSide,
  MatchState,
  ModeDefinition,
  RNG,
  RNGStateSnapshot,
} from '../types';
import type { SubmitGuessResult } from './turnBasedEngine';

const NOT_IMPLEMENTED = 'parallelEngine: Faz 6 implementation pending — call ignored';

export function createMatch(
  modeId: number,
  playerSecret: string,
  rngState: RNGStateSnapshot,
): MatchState {
  const mode = modeRegistry.get(modeId);
  const rng = createRNG(rngState);
  const opponentSecret = mode.generateSecret(rng);
  const now = Date.now();
  // Mirror's contract is "both sides race the same secret". Until the
  // real engine lands we mirror player → opponent so any consumer that
  // dereferences either field gets a sensible value.
  return {
    modeId,
    playerSecret,
    opponentSecret,
    playerGuesses: [],
    opponentGuesses: [],
    phase: 'setup',
    result: null,
    rngState: rng.getState(),
    startedAt: now,
    lastUpdatedAt: now,
  };
}

export function startMatch(state: MatchState, rng: RNG): MatchState {
  if (state.phase !== 'setup') return state;
  console.warn(NOT_IMPLEMENTED);
  return {
    ...state,
    phase: 'active_parallel',
    rngState: rng.getState(),
    lastUpdatedAt: Date.now(),
  };
}

export async function submitGuess(
  state: MatchState,
  _guess: string,
  _author: GuessSide,
  _rng: RNG,
): Promise<SubmitGuessResult> {
  console.warn(NOT_IMPLEMENTED);
  return { state, feedback: null, error: null };
}

export function applyTimeout(state: MatchState, _mode: ModeDefinition): MatchState {
  console.warn(NOT_IMPLEMENTED);
  return state;
}

export function applyClockSnapshot(state: MatchState, _snapshot: ClockSnapshot): MatchState {
  return state;
}
