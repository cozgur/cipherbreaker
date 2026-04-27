/**
 * Mode 2 — High & Low. Façade over `mode2/{evaluate,bot}.ts`; same
 * shape as `mode1ColorMatch.ts` so Phase 4-5 maintenance is one
 * grep-able pattern.
 *
 * Constraints (mirrors Mode 1):
 *   - This file is the public façade. Helpers live in `mode2/` and
 *     stay individually grep-able.
 *   - **No React import.** Asserted by the grep test in `__tests__/`.
 *   - `evaluate` is pure: same `(guess, secret)` → same feedback.
 *   - `bot.thinkingTime` does NOT consume from `ctx.rng` — UI delay
 *     is decoupled from resume identity (ARCHITECTURE §Phase 3).
 */

import { findMode } from '@data/modeCatalog';

import { ModeNotFoundError } from '../errors';
import { generateRandomDigits } from '../shared/secretGeneration';
import {
  composeValidators,
  validateDigitsOnly,
  validateLength,
} from '../shared/validation';
import type { ModeDefinition, RNG, ValidationResult } from '../types';
import { makeGuess, thinkingTime } from './mode2/bot';
import { evaluateHighLow, SECRET_LENGTH } from './mode2/evaluate';

const MODE_ID = 2 as const;

const catalog = (() => {
  const c = findMode(MODE_ID);
  if (c === undefined) throw new ModeNotFoundError(MODE_ID);
  return c;
})();

const validate = composeValidators(validateLength(SECRET_LENGTH), validateDigitsOnly);

export const mode2HighLow: ModeDefinition = {
  id: MODE_ID,
  meta: catalog.meta,
  rules: catalog.rules,
  generateSecret: (rng: RNG): string => generateRandomDigits(SECRET_LENGTH, false, rng),
  validateGuess: (guess: string): ValidationResult => validate(guess),
  evaluate: evaluateHighLow,
  bot: {
    initSolverState: () => ({ kind: 'directionRange', low: 0, high: 9999 }),
    makeGuess,
    thinkingTime,
  },
};
