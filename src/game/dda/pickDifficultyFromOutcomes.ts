/**
 * Hidden DDA — Phase 7A.2 (SPEC §5.5).
 *
 * Pure mapping from the player's rolling last-N match outcomes onto a
 * `BotDifficulty`. Wired into `matchStore.createMatch`, where it freezes
 * the difficulty for the match's lifetime; engines stay userStore-naïve
 * and pass the stamped value through.
 *
 * Naming note: the bot module already exports a different
 * `selectByDifficulty(pool, difficulty, rng)` that picks a *guess* given
 * a difficulty (mode1/bot.ts:95). This function picks a *difficulty*
 * given outcomes — opposite direction of the same domain — so it gets
 * its own verb to keep grep + import sites unambiguous.
 *
 * Threshold (Option B — wide normal band, agreed in Phase 7A.2 plan):
 *   0–2 victories / 10 → 'easy'   (player struggling — soften the bot)
 *   3–7 victories / 10 → 'normal' (target band)
 *   8–10 victories / 10 → 'hard'  (player dominating — stiffen the bot)
 *
 * Win rule: only `'victory'` counts as a win. `'draw'` and `'stalemate'`
 * count toward the denominator (they're real matches in the window) but
 * not the numerator — they signal "neither dominance nor struggle." This
 * matches `userStore.recordMatchResult`'s winRate semantics so the two
 * counters stay coherent.
 *
 * Edge case worth knowing: 10 consecutive draws/stalemates → 0 wins →
 * 'easy'. Practically vanishing in current modes (Mode 4 timeout-draws
 * and Mode 6 stalemates are both rare); not worth a weighted scheme.
 *
 * Warm-up: while the rolling window is below `RECENT_WINDOW_SIZE`, fall
 * back to `'normal'`. Avoids overreacting to a 1- or 2-match streak in
 * either direction. The window itself is fed by `recordMatchResult`'s
 * cap-10 sliding push (userStore.ts), which is why we slice defensively
 * here too — keeps this file independently correct if the cap ever
 * grows.
 */

import type { MatchResultOutcome } from '@navigation/routes';

import type { BotDifficulty } from '../types';

export const RECENT_WINDOW_SIZE = 10;
export const WARMUP_DEFAULT: BotDifficulty = 'normal';

const EASY_MAX_WINS = 2;
const HARD_MIN_WINS = 8;

export function pickDifficultyFromOutcomes(
  recentMatches: readonly MatchResultOutcome[],
): BotDifficulty {
  if (recentMatches.length < RECENT_WINDOW_SIZE) {
    return WARMUP_DEFAULT;
  }
  // Defensive slice — userStore caps at 10, but a future cap bump or a
  // hand-built fixture longer than 10 must still grade on the last 10.
  const window = recentMatches.slice(-RECENT_WINDOW_SIZE);
  let wins = 0;
  for (const outcome of window) {
    if (outcome === 'victory') wins += 1;
  }
  if (wins <= EASY_MAX_WINS) return 'easy';
  if (wins >= HARD_MIN_WINS) return 'hard';
  return 'normal';
}
