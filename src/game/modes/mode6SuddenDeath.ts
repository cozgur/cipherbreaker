/**
 * Mode 6 — Sudden Death. Mode 1's ColorMatch evaluator + 10K
 * candidate pool, with a 5-guess-per-player budget enforced via
 * `rules.maxGuessesPerPlayer = 5` from the catalog. The engine layer
 * (`turnBasedEngine.buildModeBaseExtras` + `submitGuess` decrement +
 * `checkEndConditions` exhaustion check) does the rest — this mode
 * file deliberately ships zero new strategy logic.
 *
 * Why no `mode6/` folder: the only difference from Mode 1 is the
 * guess budget, which lives in the catalog rules and is honoured by
 * the engine. Re-exporting `evaluateColorMatch` and Mode 1's bot via
 * a sibling `mode6/` subdirectory was the Phase 3 prediction; at
 * Phase 5 the direct import is shorter, makes the Mode 1 dependency
 * obvious, and saves two pass-through files. ARCHITECTURE.md §Phase
 * 5 records the deviation.
 */

import { findMode } from '@data/modeCatalog';

import { ModeNotFoundError } from '../errors';
import { buildAllCandidates } from '../shared/candidatePool';
import { generateRandomDigits } from '../shared/secretGeneration';
import {
  composeValidators,
  validateDigitsOnly,
  validateLength,
} from '../shared/validation';
import type { ModeDefinition, RNG, ValidationResult } from '../types';
import { makeGuess, thinkingTime } from './mode1/bot';
import { evaluateColorMatch, SECRET_LENGTH } from './mode1/evaluate';

const MODE_ID = 6 as const;

const catalog = (() => {
  const c = findMode(MODE_ID);
  if (c === undefined) throw new ModeNotFoundError(MODE_ID);
  return c;
})();

const validate = composeValidators(validateLength(SECRET_LENGTH), validateDigitsOnly);

export const mode6SuddenDeath: ModeDefinition = {
  id: MODE_ID,
  meta: catalog.meta,
  rules: catalog.rules,
  generateSecret: (rng: RNG): string => generateRandomDigits(SECRET_LENGTH, false, rng),
  validateGuess: (guess: string): ValidationResult => validate(guess),
  evaluate: evaluateColorMatch,
  bot: {
    initSolverState: () => ({ kind: 'candidatePool', pool: buildAllCandidates(false) }),
    makeGuess,
    thinkingTime,
  },
};
