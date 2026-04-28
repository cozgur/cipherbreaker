/**
 * Mode 5 — Blackout. Façade over `mode5/{evaluate,bot}.ts`. Same
 * shape as `mode1ColorMatch.ts` — Phase 4 proved the template scales
 * to Mode 2/3, Phase 5 keeps it identical for Mode 5.
 *
 * Constraints (mirror Mode 1):
 *   - This file is the public façade. Helpers live in `mode5/`.
 *   - **No React import.** Asserted by the grep test in `__tests__/`.
 *   - `evaluate` is pure: same `(guess, secret)` → same feedback.
 *     The feedback exposes `locked: number` only; `states` are all
 *     `'blackout'` so the per-mode row component cannot leak
 *     positional info to the player (SPEC §3.7).
 *   - `bot.thinkingTime` does NOT consume from `ctx.rng` — UI delay
 *     is decoupled from resume identity (ARCHITECTURE §Phase 3).
 *   - `digitsUnique: true` (catalog flipped Phase 5). The bot opens
 *     against the 5040-entry unique pool and the chunked filter is
 *     mandatory on the opening narrow.
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
import { makeGuess, thinkingTime } from './mode5/bot';
import { evaluateBlackout, SECRET_LENGTH } from './mode5/evaluate';

const MODE_ID = 5 as const;

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

export const mode5Blackout: ModeDefinition = {
  id: MODE_ID,
  meta: catalog.meta,
  rules: catalog.rules,
  generateSecret: (rng: RNG): string => generateRandomDigits(SECRET_LENGTH, true, rng),
  validateGuess: (guess: string): ValidationResult => validate(guess),
  evaluate: evaluateBlackout,
  bot: {
    initSolverState: () => ({ kind: 'candidatePool', pool: buildAllCandidates(true) }),
    makeGuess,
    thinkingTime,
  },
};
