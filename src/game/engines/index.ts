/**
 * Engine selection. The registry-aware caller passes the
 * `ModeDefinition`; we pick `parallelEngine` when the mode declares
 * `flags.parallelRace`, otherwise `turnBasedEngine`.
 *
 * The flag name `parallelRace` is canonical (matches the existing
 * Phase 1B catalog + modeRouter); ROADMAP §Engine Ayrımı's
 * `parallelMode` was a working name. Renaming would touch the catalog
 * + router + every existing test for no behavioural gain.
 */

import type { ModeDefinition } from '../types';
import * as parallelEngine from './parallelEngine';
import * as turnBasedEngine from './turnBasedEngine';

export type Engine = typeof turnBasedEngine;

export function selectEngine(mode: ModeDefinition): Engine {
  if (mode.rules.flags.parallelRace === true) {
    // The two engines share a structural interface; cast keeps the
    // dispatch site type-safe without forcing the parallel stub to
    // re-export every internal helper turn-based exposes.
    return parallelEngine as unknown as Engine;
  }
  return turnBasedEngine;
}

export { turnBasedEngine, parallelEngine };
