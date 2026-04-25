/**
 * Pure, deterministic secret generation. Engines call this from
 * `mode.generateSecret(rng)`; the unique-vs-any choice is mode-driven
 * (`rules.digitsUnique`). Output is a digit string (`'4731'`) to match
 * the candidate pool format — see `candidatePool.ts` rationale.
 */

import type { RNG } from '@game/types';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/**
 * Generate a `length`-digit string from `rng`. When `unique=true`
 * (Modes 3, 5) the digits are sampled without replacement; otherwise
 * each position is independent.
 *
 * `length > 10` with `unique=true` is impossible (10 digits, finite
 * pool) — we throw rather than loop forever.
 */
export function generateRandomDigits(length: number, unique: boolean, rng: RNG): string {
  if (length <= 0 || !Number.isInteger(length)) {
    throw new RangeError(`generateRandomDigits: length must be a positive integer; got ${length}`);
  }
  if (unique && length > DIGITS.length) {
    throw new RangeError(
      `generateRandomDigits: cannot pick ${length} unique digits from ${DIGITS.length}`,
    );
  }

  if (!unique) {
    let out = '';
    for (let i = 0; i < length; i += 1) {
      out += rng.pick(DIGITS);
    }
    return out;
  }

  // Sample-without-replacement via Fisher-Yates on a fresh copy.
  const pool = rng.shuffle(DIGITS);
  return pool.slice(0, length).join('');
}
