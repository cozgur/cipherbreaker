/**
 * SPEC §3.7 Blackout evaluator. Reveals only the count of right-spot
 * matches — never which positions matched, never which digits the
 * guess shares with the secret outside their slot. The engine emits
 * all four `states` as `'blackout'` so the row component can never
 * accidentally leak per-position info to the player; the `locked`
 * count is the only data carrier.
 *
 * Pure: same `(guess, secret)` → same feedback. Lives in its own
 * file so `bot.ts` can re-use the count helper for candidate
 * filtering without forcing a façade-level circular import.
 *
 * Worked example (SPEC §3.7): secret=`'3847'`, guess=`'3249'`
 *   - pos 0: `3` == `3` → +1
 *   - pos 1, 2, 3: no positional match
 *   - feedback: `locked=1`, all tiles `'blackout'`, `isWin=false`
 */

import type { DigitTileVisualState, NormalizedFeedback } from '../../types';

export const SECRET_LENGTH = 4 as const;

/**
 * Per-position-match count. Standalone helper so the bot's pool
 * narrowing can re-use the exact same arithmetic the evaluator
 * advertised — no risk of the two drifting.
 */
export function countLocked(guess: string, secret: string): number {
  let locked = 0;
  for (let i = 0; i < SECRET_LENGTH; i += 1) {
    if (guess[i] === secret[i]) locked += 1;
  }
  return locked;
}

const ALL_BLACKOUT: readonly DigitTileVisualState[] = [
  'blackout',
  'blackout',
  'blackout',
  'blackout',
];

export function evaluateBlackout(guess: string, secret: string): NormalizedFeedback {
  const locked = countLocked(guess, secret);
  return {
    kind: 'blackout',
    states: ALL_BLACKOUT,
    locked,
    isWin: locked === SECRET_LENGTH,
  };
}
