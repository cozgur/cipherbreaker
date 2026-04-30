/**
 * Mode 7 — Mirror. Same Wordle-style evaluator + 10K candidate pool as
 * Mode 1, but routed through `parallelEngine`: both sides race the
 * **same** engine-generated secret (`flags.sharedSecret`) with no turn
 * rotation and no per-player guess budget. First to crack wins;
 * everything else is composition.
 *
 * Why no `mode7/` folder: Mirror's *only* mechanical differences from
 * Mode 1 are the engine selector (`parallelRace`) and the shared-secret
 * routing skip — both expressed via catalog flags, neither requiring a
 * fresh evaluator or solver. Mirroring the Mode 6 façade pattern keeps
 * the Mode 1 reuse explicit at import time.
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

const MODE_ID = 7 as const;

const catalog = (() => {
  const c = findMode(MODE_ID);
  if (c === undefined) throw new ModeNotFoundError(MODE_ID);
  return c;
})();

const validate = composeValidators(validateLength(SECRET_LENGTH), validateDigitsOnly);

export const mode7Mirror: ModeDefinition = {
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
