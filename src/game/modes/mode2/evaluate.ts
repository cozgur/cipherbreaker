/**
 * SPEC §3.3 binary-search evaluator. Compares the *integer* values of
 * `guess` and `secret` (so `'0817' < '3817'` numerically, not by
 * string sort) and emits `'higher'` when the secret is greater.
 *
 * Pure: same `(guess, secret)` → same feedback. Lives in its own file
 * so `bot.ts` can re-use it for consistency tests without forcing a
 * façade ↔ helper circular import.
 *
 * On an exact match the union still requires a `dir` value — we set
 * `'higher'` arbitrarily and rely on `isWin: true` to suppress the
 * pill in `Mode2Row` (the timeline never paints a misleading arrow on
 * a winning guess).
 */

import type { NormalizedFeedback } from '../../types';

export const SECRET_LENGTH = 4 as const;

export function evaluateHighLow(guess: string, secret: string): NormalizedFeedback {
  const g = Number.parseInt(guess, 10);
  const s = Number.parseInt(secret, 10);
  if (g === s) {
    return { kind: 'direction', dir: 'higher', isWin: true };
  }
  return {
    kind: 'direction',
    dir: g < s ? 'higher' : 'lower',
    isWin: false,
  };
}
