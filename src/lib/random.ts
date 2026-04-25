/**
 * Deterministic, serializable RNG. The whole engine layer uses this
 * (never `Math.random()`) so a match can be replayed bit-for-bit from
 * a `{seed, callCount}` snapshot — required for cold-start resume,
 * snapshot tests, and post-mortem replay debugging.
 *
 * Algorithm: mulberry32. Picked over splitmix32 for two reasons:
 *   1. Single-uint32 state — trivial to serialise.
 *   2. Passes the bias tests bots actually care about (uniform `int`,
 *      shuffle entropy) at this scale; we don't need a CSPRNG.
 *
 * Hot path is `next()`. It increments `callCount` on every draw, so
 * `getState()` can hand back the exact cursor needed to resume.
 * `int`, `pick`, `shuffle`, `weightedPick` all funnel through `next()`,
 * which means the call-count bookkeeping covers every consumer.
 */

import type { RNG, RNGStateSnapshot } from '@game/types';

export type RNGState = RNGStateSnapshot;

/**
 * mulberry32 — Tommy Ettinger's variant. Single-uint32 state, the
 * canonical "good enough for games" PRNG.
 */
function mulberry32(state: number): number {
  // Coerce to a uint32 so `>>>` shifts behave consistently on
  // implementations that widen integers (V8 does, but the contract is
  // defensive so future runtimes can't drift the sequence).
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Build an RNG from either a fresh seed (number) or a saved cursor
 * snapshot. Calling `createRNG({ seed: 42, callCount: 5 })` produces
 * a generator that yields the *same* next value as
 * `createRNG(42)` would after five `next()` calls — that's the
 * resume contract.
 */
export function createRNG(stateOrSeed: RNGState | number): RNG {
  const cursor: { seed: number; callCount: number } =
    typeof stateOrSeed === 'number'
      ? { seed: stateOrSeed >>> 0, callCount: 0 }
      : { seed: stateOrSeed.seed >>> 0, callCount: stateOrSeed.callCount };

  function step(): number {
    // Advance the call count *before* sampling so the snapshot taken
    // immediately after `next()` reflects "we've consumed this many".
    cursor.callCount += 1;
    // mulberry32 is stateless given (seed + callCount); each call is a
    // pure function of the cursor.
    return mulberry32(cursor.seed + cursor.callCount - 1);
  }

  function nextInt(min: number, max: number): number {
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
      throw new RangeError(`RNG.int requires min <= max; got [${min}, ${max}]`);
    }
    const span = max - min + 1;
    return min + Math.floor(step() * span);
  }

  function pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) {
      throw new RangeError('RNG.pick called with an empty array');
    }
    const value = arr[nextInt(0, arr.length - 1)];
    // `noUncheckedIndexedAccess` types `value` as `T | undefined`; the
    // bounds we just enforced make `undefined` impossible here.
    return value as T;
  }

  function shuffle<T>(arr: readonly T[]): T[] {
    const out = arr.slice();
    // Fisher–Yates from the end down, swapping with `step()`-derived
    // indices so the shuffle is fully accounted for in the call count.
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = nextInt(0, i);
      const a = out[i] as T;
      const b = out[j] as T;
      out[i] = b;
      out[j] = a;
    }
    return out;
  }

  function weightedPick<T extends string>(weights: Readonly<Record<T, number>>): T {
    const keys = Object.keys(weights) as T[];
    if (keys.length === 0) {
      throw new RangeError('RNG.weightedPick called with an empty record');
    }
    let total = 0;
    for (const key of keys) {
      const w = weights[key];
      if (w < 0 || !Number.isFinite(w)) {
        throw new RangeError(`RNG.weightedPick: weight for '${key}' is invalid: ${w}`);
      }
      total += w;
    }
    if (total <= 0) {
      throw new RangeError('RNG.weightedPick: total weight must be > 0');
    }
    const roll = step() * total;
    let acc = 0;
    for (const key of keys) {
      acc += weights[key];
      if (roll < acc) return key;
    }
    // Floating-point drift could push past the last cumulative bound;
    // returning the last key is the standard fallback.
    return keys[keys.length - 1] as T;
  }

  return {
    next: step,
    int: nextInt,
    pick,
    shuffle,
    weightedPick,
    getState: () => ({ seed: cursor.seed, callCount: cursor.callCount }),
  };
}
