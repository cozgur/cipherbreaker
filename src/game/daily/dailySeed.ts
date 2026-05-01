/**
 * Phase 7A.4 CP3 — deterministic Daily Challenge secret generator.
 *
 * `getDailySecret(date, digits)` produces the same secret string for
 * the same `(date, digits)` pair on every device, every cold start.
 * That global determinism is the whole point of "today's puzzle is
 * the same code everyone is solving" — Wordle's social loop applied
 * to numeric deduction.
 *
 * Algorithm:
 *   1. Stable string hash of `daily:${date}:${digits}` → uint32 seed.
 *   2. `createRNG(seed)` — mulberry32 from `lib/random` (already used
 *      by the engines, so the bit pattern is well-trodden).
 *   3. `generateRandomDigits(digits, false, rng)` — non-unique pool
 *      (multiset allowed in Daily, unlike Mode 3) with the SPEC §3
 *      first-digit ≠ 0 invariant (Phase 7A.1).
 *
 * Why include `digits` in the hash input: a future tier-aware
 * regression model that switches a player from 5-digit to 4-digit
 * for "today" must produce a different secret than the calendar's
 * 5-digit secret would have produced. Hashing both fields means
 * `(2026-05-08, 4)` and `(2026-05-08, 5)` yield independent secrets.
 *
 * The hash function is FNV-1a (32-bit) — small, stable across JS
 * engines, no platform dependency. Lives here, not in `lib/`,
 * because the only consumer today is Daily (advisor discipline:
 * don't share helpers prematurely).
 */

import { createRNG } from '@/lib/random';

import { generateRandomDigits } from '@game/shared/secretGeneration';

const FNV_OFFSET = 2_166_136_261;
const FNV_PRIME = 16_777_619;

function hashString(s: string): number {
  let hash = FNV_OFFSET;
  for (let i = 0; i < s.length; i += 1) {
    hash ^= s.charCodeAt(i);
    // Math.imul keeps the multiplication 32-bit on every JS engine
    // (Number multiplication overflows past 2^53 otherwise).
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

export function getDailySecret(date: string, digits: number): string {
  if (!Number.isInteger(digits) || digits <= 0) {
    throw new RangeError(`getDailySecret: digits must be a positive integer; got ${digits}`);
  }
  const seed = hashString(`daily:${date}:${digits}`);
  const rng = createRNG(seed);
  // `unique=false` — Daily allows multiset secrets ('1233', '0000',
  // ...). Mode 3 stays unique-only via its own seam.
  return generateRandomDigits(digits, false, rng);
}
