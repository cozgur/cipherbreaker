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
 * Phase 7A.8 CP9.1 — the day index is now PER-USER. `calendarDayIndex(
 * date, epoch)` measures days since the player's own first-play date
 * (`dailyChallenge.firstPlayedDate`), so Day 1 = the player's first
 * Daily and the tier/mode ramp starts fresh for everyone. There is no
 * global launch-date constant anymore; the epoch is threaded in from
 * the persisted per-user state.
 */

import type { DailyChallengeConfig, DailyChallengeState } from './types';
import { dayDifferenceLocal, parseDailyDate } from './dailyDate';

/**
 * Turn budgets — Phase 7A.4 CP5 iOS-test correction. Original draft
 * inherited Wordle's 6-tries baseline; iOS playthrough surfaced that
 * the Mastermind +N/-M paradigm carries less per-row information
 * than Wordle's letter-color grid AND adds multiset confusion. 6
 * turns at 4 digits frustrated even careful players; mathematical
 * Mastermind benchmark for 4 digits is ~5 optimal / ~7-8 human /
 * ~9-10 for an ~85% retention-friendly win rate. The 10/12/14
 * ladder lands a casual-friendly win band while keeping the
 * hardcore-skill challenge intact (5-turn solve still possible).
 */
const TIER_BANDS = {
  TIER_4: { digits: 4, turnLimit: 10 },
  TIER_5: { digits: 5, turnLimit: 12 },
  TIER_6: { digits: 6, turnLimit: 14 },
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
 * Compute the day index for `date` relative to `epoch` (the player's
 * first-play date). Day 1 = the epoch date; Day 2 = the day after;
 * etc. Pure function of the date strings — DST-immune via
 * `dayDifferenceLocal`. Dates before the epoch yield non-positive
 * indices which the tier formula floors to 4.
 */
export function calendarDayIndex(date: string, epoch: string): number {
  const epochDate = parseDailyDate(epoch);
  const today = parseDailyDate(date);
  return dayDifferenceLocal(epochDate, today) + 1;
}

export function getDailyConfig(
  date: string,
  dailyState: DailyChallengeState,
): DailyChallengeConfig {
  // Per-user epoch (CP9.1): before the first play `firstPlayedDate`
  // is null, so the date being indexed IS the epoch → Day 1 / tier-4.
  // Once stamped, the tier ramps from the player's own first day.
  const epoch = dailyState.firstPlayedDate ?? date;
  const calendarDay = calendarDayIndex(date, epoch);
  const effectiveDay = calendarDay - dailyState.effectiveDayOffset;
  return effectiveDigitTier(effectiveDay);
}
