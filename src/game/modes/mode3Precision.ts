/**
 * Mode 3 — Precision. Façade over `mode3/{evaluate,bot}.ts`. Same
 * shape as `mode1ColorMatch.ts` so adding a mode is one mechanical
 * pattern.
 *
 * Constraints (mirrors Mode 1):
 *   - This file is the public façade. Helpers live in `mode3/`.
 *   - **No React import.** Asserted by the grep test in `__tests__/`.
 *   - `evaluate` is pure: same `(guess, secret)` → same feedback.
 *   - `bot.thinkingTime` does NOT consume from `ctx.rng` — UI delay
 *     is decoupled from resume identity.
 *   - `digitsUnique: true` (catalog) — both the secret generator and
 *     `validateGuess` chain enforce it. Phase 4 flipped the flag to
 *     true; the unique pool of 5040 candidates is what the bot opens
 *     against.
 */

import { findMode } from '@data/modeCatalog';

import { ModeNotFoundError } from '../errors';
import { buildAllCandidates } from '../shared/candidatePool';
import { generateRandomDigits } from '../shared/secretGeneration';
import {
  composeValidators,
  validateDigitsOnly,
  validateLength,
  validateUnique,
} from '../shared/validation';
import type { ModeDefinition, RNG, ValidationResult } from '../types';
import { makeGuess, thinkingTime } from './mode3/bot';
import { evaluatePrecision, SECRET_LENGTH } from './mode3/evaluate';

const MODE_ID = 3 as const;

const catalog = (() => {
  const c = findMode(MODE_ID);
  if (c === undefined) throw new ModeNotFoundError(MODE_ID);
  return c;
})();

const validate = composeValidators(
  validateLength(SECRET_LENGTH),
  validateDigitsOnly,
  validateUnique,
);

export const mode3Precision: ModeDefinition = {
  id: MODE_ID,
  meta: catalog.meta,
  rules: catalog.rules,
  generateSecret: (rng: RNG): string => generateRandomDigits(SECRET_LENGTH, true, rng),
  validateGuess: (guess: string): ValidationResult => validate(guess),
  evaluate: evaluatePrecision,
  bot: {
    initSolverState: () => ({ kind: 'candidatePool', pool: buildAllCandidates(true) }),
    makeGuess,
    thinkingTime,
  },
};
