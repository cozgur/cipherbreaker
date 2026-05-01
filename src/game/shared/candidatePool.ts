/**
 * 4-digit candidate pool generation + filtering. Pools are 4-character
 * digit strings (`'1234'`) — half the memory of `number[]`, identity-
 * comparable, easy to sort/dedupe.
 *
 * SPEC §3 — secrets never start with 0 (code-breaker display
 * convention), so the bot pool excludes leading-zero candidates. The
 * non-unique pool is 9 000 (1000–9999), the unique pool is 4 536
 * (10·9·8·7 − 9·8·7 = 5040 − 504).
 *
 * Generation is module-level cached: every mode shares the same
 * "all 9000" / "all 4536 unique" arrays, so registering all seven
 * modes still pays the build cost exactly twice.
 *
 * Filtering comes in two flavours:
 *   - `filterByFeedback` — synchronous, fine for pools < 1000 (Mode 1,
 *     Mode 2 once narrowed).
 *   - `filterByFeedbackChunked` — async, yields between batches.
 *     Mandatory for Mode 3 (5040) and Mode 5 (constraint sweep). See
 *     ROADMAP §Heavy Filtering.
 */

import { FILTER_CHUNK_SIZE, SECRET_LENGTH } from '@game/constants';

import { yieldToUI } from './asyncHelpers';

let cachedAll: readonly string[] | null = null;
let cachedUnique: readonly string[] | null = null;

/**
 * Returns every 4-digit string the engine layer ever needs. `unique`
 * picks between the 9000-strong "any digit" pool (Modes 1, 2, 4, 6,
 * 7) and the 4536-strong "all distinct" pool (Modes 3, 5). Both pools
 * exclude leading-zero candidates (SPEC §3).
 *
 * Lazy-init on first call, cached for the rest of the JS lifetime —
 * generation is ~5ms but it's pure overhead during cold start.
 */
export function buildAllCandidates(unique: boolean): readonly string[] {
  if (unique) {
    if (cachedUnique !== null) return cachedUnique;
    cachedUnique = generate(true);
    return cachedUnique;
  }
  if (cachedAll !== null) return cachedAll;
  cachedAll = generate(false);
  return cachedAll;
}

function generate(unique: boolean): readonly string[] {
  const out: string[] = [];
  // Iterate 1000..9999 lexicographically; secrets cannot start with
  // 0 (SPEC §3) so the pool is one-to-one with valid candidates.
  const lower = 10 ** (SECRET_LENGTH - 1);
  const upper = 10 ** SECRET_LENGTH;
  for (let i = lower; i < upper; i += 1) {
    const padded = i.toString(10).padStart(SECRET_LENGTH, '0');
    if (unique && hasRepeat(padded)) continue;
    out.push(padded);
  }
  return out;
}

function hasRepeat(s: string): boolean {
  const seen = new Set<string>();
  for (const ch of s) {
    if (seen.has(ch)) return true;
    seen.add(ch);
  }
  return false;
}

/**
 * Filter a pool synchronously. Use only when the pool is small (Mode 1
 * after a couple of guesses, Mode 2 narrowing). Pools ≥ 1000 must use
 * the chunked variant.
 */
export function filterByFeedback(
  pool: readonly string[],
  evaluator: (candidate: string) => boolean,
): string[] {
  const out: string[] = [];
  for (const candidate of pool) {
    if (evaluator(candidate)) out.push(candidate);
  }
  return out;
}

/**
 * Same as `filterByFeedback` but yields to the UI thread every
 * `chunkSize` items. The whole chunk runs synchronously before the
 * yield so we don't pay the macrotask cost per candidate.
 */
export async function filterByFeedbackChunked(
  pool: readonly string[],
  evaluator: (candidate: string) => boolean,
  chunkSize: number = FILTER_CHUNK_SIZE,
): Promise<string[]> {
  if (chunkSize <= 0) {
    throw new RangeError(`chunkSize must be > 0; got ${chunkSize}`);
  }
  const out: string[] = [];
  for (let i = 0; i < pool.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, pool.length);
    for (let j = i; j < end; j += 1) {
      const candidate = pool[j] as string;
      if (evaluator(candidate)) out.push(candidate);
    }
    if (end < pool.length) {
      await yieldToUI();
    }
  }
  return out;
}

/** Test-only escape hatch — clears module-level caches between cases. */
export function __resetCandidatePoolCacheForTests(): void {
  cachedAll = null;
  cachedUnique = null;
}
