/**
 * Engine selection. The registry-aware caller passes the
 * `ModeDefinition`; we pick `parallelEngine` when the mode declares
 * `flags.parallelRace`, otherwise `turnBasedEngine`.
 *
 * Phase 6 split the flag concept: `parallelRace` is the **engine**
 * discriminator (Mode 6 + Mode 7), while `sharedSecret` (Mode 7 only)
 * lives on `modeRouter` for the SecretSetup-skip semantic. Don't merge
 * them back — see `types.ts` ModeRuleFlags.
 */

import type { ModeDefinition } from '../types';
import * as parallelEngine from './parallelEngine';
import * as turnBasedEngine from './turnBasedEngine';

export type Engine = typeof turnBasedEngine;

export function selectEngine(mode: ModeDefinition): Engine {
  if (mode.rules.flags.parallelRace === true) {
    // Phase 6: parallelEngine exports the same surface as turnBased
    // (createMatch, startMatch, submitGuess, applyTimeout,
    // applyClockSnapshot). The cast is mechanical — the two modules
    // are structurally interchangeable but TS can't see it across
    // wildcard re-exports without help.
    return parallelEngine as unknown as Engine;
  }
  return turnBasedEngine;
}

export { turnBasedEngine, parallelEngine };
