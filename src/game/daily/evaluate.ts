/**
 * Phase 7A.4 CP2 — Daily Challenge multiset +N / -M evaluator.
 *
 * Pure mapping `(guess, secret) -> NormalizedFeedback`. Algorithm
 * parity with Mode 3 (`src/game/modes/mode3/evaluate.ts`): the same
 * two-pass `used[]`-ledger trick handles multiset because pass 1
 * marks secret slots that already paid out a `+1`, and pass 2 finds
 * the first unused secret slot per guess digit (the `break` after a
 * minus claim ensures one secret slot serves at most one minus).
 *
 * Mode 3 stays unique-only (`digitsUnique=true`) and is left
 * untouched; this file is the multiset-permitting replica with the
 * `SECRET_LENGTH` constant traded for `secret.length`. Algorithm
 * identity verified by the Mode-3-parity sweep in the test suite —
 * unique-input pairs produce byte-identical NormalizedFeedback from
 * both evaluators.
 *
 * NOT exported from `@game/types` — this is a Daily-only seam (per
 * advisor "do not share helpers prematurely"). If a future feature
 * legitimately needs the multiset evaluator outside Daily, lift it
 * to a shared module then; do not anticipate the move.
 */

import type { DigitTileVisualState, NormalizedFeedback } from '@game/types';

export function evaluateDailyGuess(guess: string, secret: string): NormalizedFeedback {
  const length = secret.length;
  const used: boolean[] = Array.from({ length }, () => false);
  let plus = 0;
  let minus = 0;

  for (let i = 0; i < length; i += 1) {
    if (guess[i] === secret[i]) {
      plus += 1;
      used[i] = true;
    }
  }

  for (let i = 0; i < length; i += 1) {
    if (guess[i] === secret[i]) continue;
    for (let j = 0; j < length; j += 1) {
      if (used[j]) continue;
      if (guess[i] === secret[j]) {
        minus += 1;
        used[j] = true;
        break;
      }
    }
  }

  return {
    kind: 'precision',
    plus,
    minus,
    isWin: plus === length,
  };
}

/**
 * Phase 7A.8 CP9 — length-generic Wordle colour-state computer for
 * Daily Mode 1 (Color Match) days.
 *
 * Production Mode 1 (`src/game/modes/mode1/evaluate.ts`) hardcodes
 * `SECRET_LENGTH = 4`; the Daily runs 4 / 5 / 6-digit tiers, so this
 * is the multiset-permitting, length-generic replica — the same
 * relationship `evaluateDailyGuess` has to Mode 3's
 * `evaluatePrecision`. Two-pass `used[]` ledger: pass 1 paints exact-
 * position greens and consumes the slot; pass 2 paints yellows
 * against still-unconsumed slots so duplicate digits never double-
 * count (parity with the production evaluator's `used[]` trick).
 *
 * Recomputed at render time from the persisted `(guess, secret)` —
 * the `DailyGuessRecord` schema stores no colour states, so adding
 * Mode 1 days needs no store migration.
 */
export function colorMatchStates(guess: string, secret: string): DigitTileVisualState[] {
  const length = secret.length;
  const states: DigitTileVisualState[] = Array.from({ length }, () => 'gray');
  const used: boolean[] = Array.from({ length }, () => false);

  for (let i = 0; i < length; i += 1) {
    if (guess[i] === secret[i]) {
      states[i] = 'green';
      used[i] = true;
    }
  }

  for (let i = 0; i < length; i += 1) {
    if (states[i] === 'green') continue;
    for (let j = 0; j < length; j += 1) {
      if (used[j]) continue;
      if (guess[i] === secret[j]) {
        states[i] = 'yellow';
        used[j] = true;
        break;
      }
    }
  }

  return states;
}
