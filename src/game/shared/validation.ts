/**
 * Guess validators — first-failure-wins composers that return a
 * structured `ValidationResult`. *Never throws* (per ROADMAP §Hata
 * Stratejisi: user errors propagate as data, not exceptions).
 *
 * Each atomic validator does one thing; modes wire them via
 * `composeValidators(...)` in their `validateGuess` impl. Mode 3 and
 * Mode 5 chain `validateLength + validateDigitsOnly + validateUnique`;
 * Modes 1, 2, 4, 6, 7 chain just the first two.
 */

import type { ValidationError, ValidationResult } from '@game/types';

const OK: ValidationResult = { ok: true };

function fail(error: ValidationError): ValidationResult {
  return { ok: false, error };
}

/**
 * Single source of truth for validation copy. SecretSetup hardcoded
 * the English version of `NOT_UNIQUE` directly in JSX; the engine
 * path then surfaced the Turkish version from this file inline on
 * MatchScreen, mixing two languages in one app. Translating here
 * keeps both surfaces in step automatically — SecretSetupScreen now
 * also re-uses `ERROR_NOT_UNIQUE`.
 */
export const ERROR_WRONG_LENGTH = (expected: number): string =>
  `Guess must be ${expected} digits.`;
export const ERROR_NOT_DIGITS = 'Use digits 0-9 only.';
export const ERROR_NOT_UNIQUE = 'All digits must be unique';

export function validateLength(expected: number) {
  return function check(guess: string): ValidationResult {
    if (guess.length !== expected) {
      return fail({
        code: 'WRONG_LENGTH',
        message: ERROR_WRONG_LENGTH(expected),
      });
    }
    return OK;
  };
}

export function validateDigitsOnly(guess: string): ValidationResult {
  if (!/^\d+$/.test(guess)) {
    return fail({
      code: 'NOT_DIGITS',
      message: ERROR_NOT_DIGITS,
    });
  }
  return OK;
}

export function validateUnique(guess: string): ValidationResult {
  const seen = new Set<string>();
  for (const ch of guess) {
    if (seen.has(ch)) {
      return fail({
        code: 'NOT_UNIQUE',
        message: ERROR_NOT_UNIQUE,
      });
    }
    seen.add(ch);
  }
  return OK;
}

/**
 * Run validators in order; return the first failure or `{ ok: true }`
 * if every step passes. Empty composition (no validators) is a
 * deliberate "always ok" — used by tests and by trivial modes.
 */
export function composeValidators(
  ...validators: ReadonlyArray<(guess: string) => ValidationResult>
): (guess: string) => ValidationResult {
  return function combined(guess: string): ValidationResult {
    for (const v of validators) {
      const result = v(guess);
      if (!result.ok) return result;
    }
    return OK;
  };
}
