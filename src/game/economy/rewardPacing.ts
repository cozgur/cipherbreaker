/**
 * Phase 7A.5 CP2 — DDA-aware reward multiplier.
 *
 * The mode catalog's `rewardWin` / `rewardDraw` / `stake` fields
 * are the **easy-band base**. At reward-grant time
 * (`MatchScreen.tsx`'s `rewardForOutcome`) the active match's
 * stamped `botDifficulty` (Phase 7A.2 DDA) maps onto a multiplier
 * applied to the base, producing the actual token credit.
 *
 * Why the easy band is the base, not the normal band:
 *   The DDA is hidden by design (SPEC §5.5 — no UI surface).
 *   Centring the base on `'normal'` and slashing it on `'easy'`
 *   would mean players who happen to be in the easy band see a
 *   smaller chip — a leaky difficulty signal. Anchoring at easy
 *   means everyone gets at least the catalog number; the upside
 *   for the harder bands is silent. Matches the "no-downside"
 *   reading that Phase 7A.2 already established for the DDA UX.
 *
 * Multipliers (from `constants.ts`, Phase 7A.5 brainstorm Q1):
 *   easy:   1.00× — the reference baseline
 *   normal: 1.20× — ~20% premium for the ~3-7/10 win-rate band
 *   hard:   1.50× — 50% premium for 8-10/10 win-rate band
 *
 * `Math.floor` rounds down so the credited amount is an integer
 * and never overstates the multiplier (a 180-base hard reward
 * lands at 270 cleanly; a 100-base normal lands at 120). The
 * choice between floor / round / ceil is a one-line policy lever
 * — floor is the most conservative for the wallet (no fractional
 * over-credit) and matches how the rest of the codebase
 * (`avgTurns` rounding, hint cost rounding) handles integer-only
 * reward currency.
 *
 * What gets multiplied:
 *   victory  → win reward × multiplier
 *   draw     → draw reward × multiplier
 *   stalemate → stake refund (NOT multiplied — refunding the
 *               original transaction, not earning new tokens)
 *   defeat   → 0 (no multiplier on a zero credit)
 *
 * The reward-pacing decision tree above lives in `MatchScreen.tsx`
 * (the only call site); this module ships the pure multiplier
 * math.
 *
 * Daily Challenge does NOT consume this. Daily uses its own digit-
 * tier-based reward gradient (`dailyConfig.ts`) and is bot-less by
 * design (no DDA stamp). Pinned by an invariant test: the
 * `recordDailyResult` action never reaches `rewardForOutcome`.
 *
 * Pure module — no React, no AsyncStorage, no engines / store
 * imports. Same `economy/` discipline `adCap.ts` and
 * `interstitial.ts` follow.
 */

import {
  REWARD_MULTIPLIER_EASY,
  REWARD_MULTIPLIER_HARD,
  REWARD_MULTIPLIER_NORMAL,
} from './constants';
import type { BotDifficulty } from '@game/types';

const MULTIPLIER_BY_DIFFICULTY: Readonly<Record<BotDifficulty, number>> = {
  easy: REWARD_MULTIPLIER_EASY,
  normal: REWARD_MULTIPLIER_NORMAL,
  hard: REWARD_MULTIPLIER_HARD,
};

/**
 * Compute the credited token amount for a given base reward and
 * the match's stamped difficulty. Negative or non-integer base
 * inputs are tolerated — `Math.floor` does the right thing on a
 * `0` base (returns `0`) and on a fractional one (truncates), so
 * the function is total over its declared signature.
 *
 * Callers in `MatchScreen.tsx` already gate on the outcome before
 * calling this (only `'victory'` and `'draw'` paths feed it); the
 * function itself stays outcome-agnostic so a future "rewarded
 * stalemate variant" or "consolation-draw bonus" can hook in
 * without expanding its signature.
 */
export function computeReward(baseReward: number, difficulty: BotDifficulty): number {
  return Math.floor(baseReward * MULTIPLIER_BY_DIFFICULTY[difficulty]);
}
