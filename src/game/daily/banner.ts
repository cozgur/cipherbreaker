/**
 * Phase 7A.4 CP5 — Daily Challenge HomeScreen banner helpers.
 *
 * Pure functions consumed by the banner component on HomeScreen.
 * Lifted out of the screen file so they're directly testable
 * without a render — the visual state machine and the countdown
 * formatter both have edge cases the screen-level test surface
 * can't easily exercise.
 *
 * Banner has three visual states (per CP5 plan):
 *   - 'fresh'   — today's puzzle is unstarted (or in-progress —
 *                 same visual; tap routes via the navigation guard
 *                 to either Daily fresh or Daily resume).
 *   - 'cracked' — today's recorded result was a success.
 *   - 'failed'  — today's recorded result was a turn-limit miss.
 *
 * The four-state design (fresh / in-progress / cracked / failed)
 * was rejected for CP5 — visually identical "go play today's
 * puzzle" CTA covers both fresh and in-progress without confusing
 * the player. The store-level `currentAttempt` decides whether the
 * route lands fresh or mid-board.
 */

import type { DailyChallengeConfig, DailyResultSummary } from './types';

export type DailyBannerState = 'fresh' | 'cracked' | 'failed';

export function getDailyBannerState(
  today: string,
  lastResult: DailyResultSummary | null,
): DailyBannerState {
  if (lastResult !== null && lastResult.date === today) {
    return lastResult.success ? 'cracked' : 'failed';
  }
  return 'fresh';
}

/**
 * Time remaining until local-calendar midnight, formatted as
 * `"Xh Ym"`. Pure function for testability — the screen layer
 * runs this on a 60-second `setInterval`. The minutes round DOWN
 * so a 14h 32m 45s remainder reads `"14h 32m"` (no UX-confusing
 * jump from 32 → 31 mid-second).
 *
 * Edge cases:
 *   - Past midnight (impossible if `now` is fresh, but a frozen
 *     `now` from a test fixture or a clock skew might land here)
 *     → `"0m"`. Caller should re-derive `today` and re-render in
 *     that case.
 *   - Less than a minute remaining → `"0m"`. The 60s interval will
 *     pick up the rollover within one tick.
 */
export function timeUntilNextDaily(now: Date): string {
  // Local midnight = the start of tomorrow's local-calendar day.
  // Constructor-arity `new Date(year, month, date+1)` stays in
  // local time and handles month/year rollover natively.
  const tomorrowMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  const diffMs = tomorrowMidnight.getTime() - now.getTime();
  if (diffMs <= 0) return '0m';
  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

/**
 * Banner copy lookup — one place to source the "TODAY'S PUZZLE"
 * style strings so the screen file isn't dotted with literals
 * that drift when the wording is iterated post-launch.
 *
 * `Cracked X/Y` and `Day not cracked` re-use the result-screen
 * wording on purpose so the player who taps the banner sees
 * familiar copy on the next screen.
 */
export interface BannerCopy {
  readonly headline: string;
  readonly subline: string;
}

export function buildBannerCopy(
  state: DailyBannerState,
  config: DailyChallengeConfig,
  dayNumber: number,
  countdown: string,
  lastResult: DailyResultSummary | null,
  currentStreak: number,
): BannerCopy {
  if (state === 'cracked' && lastResult !== null) {
    return {
      headline: `✓ Cracked in ${lastResult.turnsUsed}/${lastResult.turnLimit}`,
      subline: `🔥 Streak ${currentStreak} · Next in ${countdown}`,
    };
  }
  if (state === 'failed' && lastResult !== null) {
    return {
      headline: `Day #${dayNumber} not cracked`,
      subline: `Streak broken · Next in ${countdown}`,
    };
  }
  // 'fresh' — covers both unstarted-today and in-progress-today.
  return {
    headline: `Today's puzzle 🔓`,
    subline: `Day #${dayNumber} · ${config.digits} digits · Resets in ${countdown}`,
  };
}
