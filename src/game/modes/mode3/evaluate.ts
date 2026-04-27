/**
 * SPEC §3.4 Precision evaluator. Pure: same `(guess, secret)` → same
 * feedback. Lives here so `bot.ts` can re-use it for candidate-pool
 * consistency filtering without forcing a circular import.
 *
 * `+N` counts right-spot hits (digit matches at the same position).
 * `−M` counts wrong-spot hits (digit appears in the secret at a
 * different position). Two-pass with a `used[]` ledger so a single
 * secret slot never serves two minus claims.
 *
 * Worked example (SPEC §3.4): secret=`'1234'`, guess=`'1249'`
 *   - pass 1: pos 0 (`1`==`1`) and pos 1 (`2`==`2`) → plus=2, used=[T,T,F,F]
 *   - pass 2: pos 2 (`4`); secret[3]=`4` is unconsumed → minus=1
 *   - pos 3 (`9`) — not in secret → no change
 *   - result: `+2 −1`
 */

import type { NormalizedFeedback } from '../../types';

export const SECRET_LENGTH = 4 as const;

export function evaluatePrecision(guess: string, secret: string): NormalizedFeedback {
  const used: boolean[] = [false, false, false, false];
  let plus = 0;
  let minus = 0;

  for (let i = 0; i < SECRET_LENGTH; i += 1) {
    if (guess[i] === secret[i]) {
      plus += 1;
      used[i] = true;
    }
  }

  for (let i = 0; i < SECRET_LENGTH; i += 1) {
    if (guess[i] === secret[i]) continue;
    for (let j = 0; j < SECRET_LENGTH; j += 1) {
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
    isWin: plus === SECRET_LENGTH,
  };
}
