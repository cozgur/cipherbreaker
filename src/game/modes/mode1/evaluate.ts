/**
 * SPEC §3.2 Wordle two-pass evaluator. Pure: same `(guess, secret)` →
 * same feedback. Lives here (instead of inline in `mode1ColorMatch.ts`)
 * because `bot.ts` re-uses it to test candidate consistency — keeping
 * the evaluator in its own file avoids a circular import between the
 * mode definition and its own bot.
 */

import type { DigitTileVisualState, NormalizedFeedback } from '../../types';

export const SECRET_LENGTH = 4 as const;

/**
 * Pass 1 paints exact-position matches green and consumes the secret
 * slot. Pass 2 paints unmatched guess positions yellow if their digit
 * appears in any *unconsumed* secret slot — repeats matter, hence the
 * `used[]` ledger.
 *
 * Worked example (SPEC): secret=`'1122'`, guess=`'1919'` → 🟢⚫🟡⚫
 *   - pos 0: `'1'==='1'` → green, used[0]=true
 *   - pos 2: `'1'` searches secret; secret[1]=`'1'` is unconsumed → yellow
 *   - pos 1, 3: `'9'` not in secret → gray
 */
export function evaluateColorMatch(guess: string, secret: string): NormalizedFeedback {
  const states: DigitTileVisualState[] = ['gray', 'gray', 'gray', 'gray'];
  const used: boolean[] = [false, false, false, false];

  for (let i = 0; i < SECRET_LENGTH; i += 1) {
    if (guess[i] === secret[i]) {
      states[i] = 'green';
      used[i] = true;
    }
  }

  for (let i = 0; i < SECRET_LENGTH; i += 1) {
    if (states[i] === 'green') continue;
    for (let j = 0; j < SECRET_LENGTH; j += 1) {
      if (used[j]) continue;
      if (guess[i] === secret[j]) {
        states[i] = 'yellow';
        used[j] = true;
        break;
      }
    }
  }

  const isWin = states.every((s) => s === 'green');
  return { kind: 'colorMatch', states, isWin };
}
