/**
 * Pure, deterministic secret generation. Engines call this from
 * `mode.generateSecret(rng)`; the unique-vs-any choice is mode-driven
 * (`rules.digitsUnique`). Output is a digit string (`'4731'`) to match
 * the candidate pool format — see `candidatePool.ts` rationale.
 */

import type { RNG } from '@game/types';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
const NONZERO_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/**
 * Generate a `length`-digit string from `rng`. When `unique=true`
 * (Modes 3, 5) the digits are sampled without replacement; otherwise
 * each position is independent.
 *
 * SPEC §3 convention: the first digit is always 1–9 — code-breaker
 * displays would otherwise render leading-zero ambiguity ("0234" vs
 * "234"). The non-unique pool drops from 10 000 → 9 000; the unique
 * pool from 5040 → 4536 (= 10·9·8·7 − 9·8·7).
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
    let out = rng.pick(NONZERO_DIGITS);
    for (let i = 1; i < length; i += 1) {
      out += rng.pick(DIGITS);
    }
    return out;
  }

  // Unique: first digit from 1–9, then sample remaining length−1 from
  // the other nine digits without replacement.
  const first = rng.pick(NONZERO_DIGITS);
  const remaining = DIGITS.filter((d) => d !== first);
  const shuffled = rng.shuffle(remaining);
  return first + shuffled.slice(0, length - 1).join('');
}
