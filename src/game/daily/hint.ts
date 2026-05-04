/**
 * Phase 7A.4 CP6 — Daily Challenge hint mechanic.
 *
 * Two product-level hint actions, one shared earned-hint pool:
 *
 *   Hint A — Reveal (cost 100 tokens / 1 earned).
 *     Player taps "Hint" and the system picks the most informative
 *     reveal it can:
 *       'green'   — positional certainty exists (player has at
 *                   least one guess with `plus >= 1`). The hint
 *                   surfaces a still-unrevealed correct
 *                   `(position, digit)` pair.
 *       'yellow'  — no positional certainty yet, but at least one
 *                   guess returned `minus >= 1`. The hint confirms
 *                   one specific digit (from the player's wrong-
 *                   position attempts) is in the secret, without
 *                   pinning where.
 *       'warning' — no signal at all (no plus, no minus). The
 *                   button still resolves but charges nothing — a
 *                   hint with no information is no hint.
 *
 *   Hint B — Probe (cost 50 tokens / 1 earned).
 *     Player picks a digit; the system answers `exists` /
 *     `not exists`. Cheaper than Reveal because the information
 *     content is bounded (one yes/no), and the player chooses
 *     which question to spend on.
 *
 * `computeEarnedHints` runs from `userStore.recordDailyResult`
 * after every Daily completion: 7 / 14 / 21 streak crossings each
 * grant +1 (cap 3); a streak break wipes both the pool and the
 * cursor. The pool is shared by Hint A and Hint B — burn it on
 * either, the next streak threshold tops it back up.
 *
 * Pure module; the store is the only consumer for the action-side
 * decisions.
 */

import type { DailyGuessRecord, DailyProbeRecord } from './types';

export const HINT_CAP = 3;
export const HINT_REVEAL_TOKEN_COST = 100;
export const HINT_PROBE_TOKEN_COST = 50;
/** Streak milestones that grant +1 to the earned-hint pool. */
export const HINT_THRESHOLDS = [7, 14, 21] as const;

export interface EarnedHintsUpdate {
  readonly earnedHints: number;
  readonly lastHintEarnedAtStreak: number;
}

/**
 * Map a streak transition onto the new earned-hint pool. Pure.
 *
 * `prevStreak` is the streak value BEFORE today's outcome was
 * recorded; `newStreak` is the value AFTER. A streak break
 * (`newStreak < prevStreak`) wipes both the pool and the
 * `lastHintEarnedAtStreak` cursor — when the player rebuilds, the
 * thresholds re-grant from scratch (max +3 over a 21-day climb).
 *
 * Idempotency: `lastHintEarnedAtStreak` records the highest
 * threshold the player has already collected at, so a streak that
 * holds at or above 7 across multiple recordings doesn't re-grant
 * the +1 again.
 */
export function computeEarnedHints(
  prevEarnedHints: number,
  prevLastEarnedAtStreak: number,
  prevStreak: number,
  newStreak: number,
): EarnedHintsUpdate {
  const broke = newStreak < prevStreak;
  let earnedHints = broke ? 0 : prevEarnedHints;
  let lastAt = broke ? 0 : prevLastEarnedAtStreak;
  for (const t of HINT_THRESHOLDS) {
    if (newStreak >= t && lastAt < t) {
      earnedHints = Math.min(HINT_CAP, earnedHints + 1);
      lastAt = t;
    }
  }
  return { earnedHints, lastHintEarnedAtStreak: lastAt };
}

export type HintCostKind = 'earned' | 'tokens' | 'unaffordable';

/**
 * Decide what the next hint costs given the current earned-pool +
 * token balance + which hint type the player is buying. `'earned'`
 * consumes one from the pool; `'tokens'` debits the cost; `'unaffordable'`
 * means the user has neither — UI disables the button.
 */
export function hintCostForState(
  earnedHints: number,
  tokens: number,
  tokenCost: number,
): HintCostKind {
  if (earnedHints > 0) return 'earned';
  if (tokens >= tokenCost) return 'tokens';
  return 'unaffordable';
}

/**
 * Result of `analyzeHintCandidates(...)` — the priority decision
 * for Hint A. The store's `useHint()` consumes this to decide what
 * to reveal and (for `'warning'`) whether to charge.
 */
export type HintCandidate =
  | { readonly kind: 'green'; readonly position: number; readonly digit: string }
  | { readonly kind: 'yellow'; readonly digit: number }
  | { readonly kind: 'warning' };

/**
 * Pick the most informative Hint A candidate available right now.
 * Priority green > yellow > warning. Pure function.
 *
 *   green  — at least one guess has `plus >= 1` AND there is a
 *            position the player hasn't already revealed.
 *   yellow — no green available, but at least one guess has
 *            `minus >= 1`, AND there is a digit from those guesses
 *            that's in the secret AND the player hasn't already
 *            revealed it via a prior yellow.
 *   warning — neither: no informative signal at all.
 *
 * The picker is deterministic (smallest-index-first for green;
 * smallest-numerical-value-first for yellow). Random picking was
 * considered and rejected — deterministic is test-friendly and
 * "leftmost / lowest" reads as natural.
 */
export function analyzeHintCandidates(
  secret: string,
  guesses: readonly DailyGuessRecord[],
  revealedPositions: readonly number[],
  revealedDigits: readonly number[],
): HintCandidate {
  const hasPlus = guesses.some((g) => g.plus >= 1);
  const hasMinus = guesses.some((g) => g.minus >= 1);

  // Green branch: a position the player hasn't revealed yet.
  if (hasPlus) {
    const taken = new Set(revealedPositions);
    for (let i = 0; i < secret.length; i += 1) {
      if (!taken.has(i)) {
        const digit = secret[i] as string;
        return { kind: 'green', position: i, digit };
      }
    }
    // All positions revealed — fall through (the player has nothing
    // left to learn via green; yellow may still surface).
  }

  // Yellow branch: a digit the player has guessed (anywhere) that
  // appears in the secret AND hasn't already been revealed via
  // yellow. We deliberately scan player-guessed digits so the hint
  // reads as "you tried this digit — yes, it IS in the secret",
  // not "here's a totally new digit." Only fires when there's a
  // wrong-position signal (minus >= 1) so the player knows the
  // hint is grounded in their existing trial.
  if (hasMinus) {
    const guessedDigits = new Set<number>();
    for (const g of guesses) {
      for (const ch of g.guess) guessedDigits.add(Number.parseInt(ch, 10));
    }
    const revealedYellow = new Set(revealedDigits);
    const secretDigits = new Set<number>();
    for (const ch of secret) secretDigits.add(Number.parseInt(ch, 10));
    // Walk 0..9 so the picker is deterministic (lowest digit wins).
    for (let d = 0; d < 10; d += 1) {
      if (!guessedDigits.has(d)) continue;
      if (revealedYellow.has(d)) continue;
      if (!secretDigits.has(d)) continue;
      return { kind: 'yellow', digit: d };
    }
    // Every secret-shared guessed digit already revealed — no new
    // yellow. Fall through to warning.
  }

  return { kind: 'warning' };
}

/**
 * Hint B — pure existence test. Returns whether `digit` appears in
 * `secret`. Multiset semantics: the answer is "yes" if the digit
 * appears at all, regardless of count.
 */
export function probeResult(digit: number, secret: string): boolean {
  const target = String(digit);
  for (const ch of secret) {
    if (ch === target) return true;
  }
  return false;
}

/**
 * Hint B eligibility — has the player already probed this digit?
 * The picker UI disables already-probed entries; this is the
 * back-end guard for the same constraint.
 */
export function canProbeDigit(digit: number, probed: readonly DailyProbeRecord[]): boolean {
  for (const r of probed) {
    if (r.digit === digit) return false;
  }
  return true;
}
