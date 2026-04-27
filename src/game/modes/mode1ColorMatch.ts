/**
 * Mode 1 — Color Match. Reference mode for Phase 4-5: the remaining
 * six modes copy this file's structure (catalog-by-reference meta/rules,
 * pure evaluator, async bot delegating to shared candidate-pool helpers).
 *
 * Constraints (ROADMAP §Faz 3):
 *   - This file is the public façade. Helpers live in `mode1/` and are
 *     small enough to grep through individually.
 *   - **No React import.** Asserted by the grep test in `__tests__/`.
 *   - `evaluate` is pure: same `(guess, secret)` → same feedback.
 *   - `bot.thinkingTime` does NOT consume from `ctx.rng` — UI delay is
 *     decoupled from resume identity (see ARCHITECTURE §Phase 3).
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

const MODE_ID = 1 as const;

// Catalog is the single source of truth for meta + rules. We re-read
// it at module load and explode loudly if Mode 1 is missing — that
// would be a programmer error (mode registered against an absent
// catalog entry), not a recoverable failure.
const catalog = (() => {
  const c = findMode(MODE_ID);
  if (c === undefined) throw new ModeNotFoundError(MODE_ID);
  return c;
})();

const validate = composeValidators(validateLength(SECRET_LENGTH), validateDigitsOnly);

export const mode1ColorMatch: ModeDefinition = {
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
