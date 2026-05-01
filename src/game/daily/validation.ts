/**
 * Phase 7A.4 CP2 — Daily Challenge guess validation.
 *
 * Two atomic rules: length match (variable per day's tier) and
 * digit-only content. NO uniqueness check — Daily allows multiset
 * (this is the cardinal Mode 3 vs Daily separation).
 *
 * Reuses the shared atomic validators from
 * `src/game/shared/validation.ts` (Phase 7A.4 CP1 confirmed they
 * are length-agnostic). The composition lives here, in the Daily
 * domain folder, so a future Daily-specific rule (e.g. a tier-aware
 * leading-zero check, post-launch) lands without touching shared
 * helpers.
 */

import type { ValidationResult } from '@game/types';
import {
  composeValidators,
  validateDigitsOnly,
  validateLength,
} from '@game/shared/validation';

export function validateDailyGuess(guess: string, length: number): ValidationResult {
  const chain = composeValidators(validateLength(length), validateDigitsOnly);
  return chain(guess);
}
