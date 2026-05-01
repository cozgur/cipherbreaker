/**
 * Phase 7A.4 CP3 — Daily Challenge progression config.
 *
 * `getDailyConfig(date, dailyState)` answers "for this player, on
 * this calendar day, how many digits and how many turns?" Two
 * inputs because the answer is user-aware: a streak break regresses
 * the player's effective tier (Reading A model — see ARCHITECTURE
 * Phase 7A.4 delta + SPEC §5.x).
 *
 * Reading A: streak break increments `effectiveDayOffset` by the
 * **prior tier's period length**, so `effectiveDay = calendarDay -
 * effectiveDayOffset` falls back into the prior tier band. Calendar
 * advance then promotes the player back at the original tempo —
 * 7 days at tier-4 to climb to tier-5, 10 more days at tier-5 to
 * climb to tier-6.
 *
 * Floor: tier-4 (4 digits, 6 turns). `effectiveDayOffset` may not
 * push the player below the entry tier; the streak module enforces
 * that invariant at write time.
 *
 * `LAUNCH_EPOCH` is a fixed string constant — the calendar day index
 * is `dayDifferenceLocal(parseDailyDate(LAUNCH_EPOCH), parseDailyDate(today)) + 1`.
 * Day 1 = launch day. Pre-launch dates yield non-positive indices
 * which the tier formula floors to 4.
 */

import type { DailyChallengeConfig, DailyChallengeState } from './types';
import { dayDifferenceLocal, parseDailyDate } from './dailyDate';

/**
 * The first day Daily Challenge is live. Day index 1 is this date.
 * Frozen as a string — when the real launch date is known the value
 * here updates and every per-player history re-aligns under the new
 * epoch. (Pre-launch dates floor to tier-4, so the rebase is safe.)
 */
export const LAUNCH_EPOCH = '2026-05-01';

const TIER_BANDS = {
  TIER_4: { digits: 4, turnLimit: 6 },
  TIER_5: { digits: 5, turnLimit: 7 },
  TIER_6: { digits: 6, turnLimit: 8 },
} as const;

/**
 * Period lengths used by `streak.ts` when applying the regression
 * penalty. Exported so the streak module's penalty arithmetic and
 * the tier formula here share one source of truth.
 *
 * - Tier-5 break: drops to tier-4 for `TIER_4_PERIOD = 7` days, then
 *   the calendar promotes the player back.
 * - Tier-6 break: drops to tier-5 for `TIER_5_PERIOD = 10` days,
 *   then the calendar promotes back.
 * - Tier-4 break: floor — no further regression possible.
 */
export const TIER_4_PERIOD = 7;
export const TIER_5_PERIOD = 10;

/**
 * Pure tier-from-effective-day mapping. Negative or zero
 * `effectiveDay` (pre-launch / heavily regressed) → tier-4 floor.
 */
export function effectiveDigitTier(effectiveDay: number): DailyChallengeConfig {
  if (effectiveDay <= TIER_4_PERIOD) return TIER_BANDS.TIER_4;
  if (effectiveDay <= TIER_4_PERIOD + TIER_5_PERIOD) return TIER_BANDS.TIER_5;
  return TIER_BANDS.TIER_6;
}

/**
 * Compute the calendar-day index for `date` relative to
 * `LAUNCH_EPOCH`. Day 1 = launch day; Day 2 = day after; etc. Pure
 * function of the date strings — DST-immune via `dayDifferenceLocal`.
 */
export function calendarDayIndex(date: string): number {
  const epoch = parseDailyDate(LAUNCH_EPOCH);
  const today = parseDailyDate(date);
  return dayDifferenceLocal(epoch, today) + 1;
}

export function getDailyConfig(
  date: string,
  dailyState: DailyChallengeState,
): DailyChallengeConfig {
  const calendarDay = calendarDayIndex(date);
  const effectiveDay = calendarDay - dailyState.effectiveDayOffset;
  return effectiveDigitTier(effectiveDay);
}
