/**
 * Phase 7A.4 CP3 — streak + regression-offset arithmetic.
 *
 * Pure function `computeNextDailyStreakState(prev, today, todayResult)`
 * → the streak / longestStreak / effectiveDayOffset triple after
 * processing today's outcome. The action layer in `dailyChallengeStore`
 * (CP4) calls this and merges the result into `DailyChallengeState`.
 *
 * Rules (SPEC §7A.4 + Phase 7A.4 brainstorm):
 *   - Consecutive-day SUCCESS: currentStreak += 1, longestStreak
 *     pulls up to the new value if higher.
 *   - Consecutive-day FAILURE: currentStreak preserved (kaybetme
 *     bozmaz — the player gets credit for showing up). No regression.
 *   - MISSED day (gap of 2+ calendar days, or stale in-progress
 *     dropped on cross-midnight): currentStreak resets to 0. The
 *     prior tier's regression penalty applies — `effectiveDayOffset
 *     += TIER_4_PERIOD` if user was at tier-5, `+= TIER_5_PERIOD` if
 *     at tier-6, +0 at tier-4 (floor — cannot regress further).
 *   - First play (lastPlayedDate === null): streak becomes 1 on
 *     success, 0 on failure. No regression on first play.
 *
 * The "user was at tier X" reading uses the **previous** state's
 * effective tier as of `lastPlayedDate` — that's the tier the streak
 * lived in, which is what the regression should fall back from.
 */

import type { DailyChallengeState, DailyResultSummary } from './types';
import {
  calendarDayIndex,
  effectiveDigitTier,
  TIER_4_PERIOD,
  TIER_5_PERIOD,
} from './dailyConfig';
import { dayDifferenceLocal, parseDailyDate } from './dailyDate';

export interface DailyStreakUpdate {
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly effectiveDayOffset: number;
}

/**
 * Compute the streak/regression triple as of `today` given the
 * previous state and the optional outcome the player just submitted.
 * `todayResult === null` means "the call site is processing a
 * cross-midnight stale-drop" (no submission, just clean up the
 * streak). `todayResult !== null` means a real submission today.
 */
export function computeNextDailyStreakState(
  prev: DailyChallengeState,
  today: string,
  todayResult: DailyResultSummary | null,
): DailyStreakUpdate {
  const previousOffset = prev.effectiveDayOffset;
  const previousStreak = prev.currentStreak;
  const previousLongest = prev.longestStreak;

  // Branch 1 — first play ever, no regression bookkeeping.
  if (prev.lastPlayedDate === null) {
    if (todayResult === null) {
      // Fresh state, nothing to update — safe identity return.
      return {
        currentStreak: previousStreak,
        longestStreak: previousLongest,
        effectiveDayOffset: previousOffset,
      };
    }
    const success = todayResult.success;
    const newStreak = success ? 1 : 0;
    return {
      currentStreak: newStreak,
      longestStreak: Math.max(previousLongest, newStreak),
      effectiveDayOffset: previousOffset,
    };
  }

  const gap = dayDifferenceLocal(parseDailyDate(prev.lastPlayedDate), parseDailyDate(today));

  // Branch 2 — same calendar day. Idempotent: re-recording the same
  // day's result preserves streak (the result store is the source
  // of truth for whether today succeeded).
  if (gap === 0) {
    return {
      currentStreak: previousStreak,
      longestStreak: previousLongest,
      effectiveDayOffset: previousOffset,
    };
  }

  // Branch 3 — consecutive day. Success advances the streak; failure
  // preserves it (kaybetme bozmaz).
  if (gap === 1) {
    if (todayResult === null) {
      // Should not happen in production (the call site only
      // synthesises null on cross-midnight stale drops, which by
      // definition are gap >= 2). Defensive identity.
      return {
        currentStreak: previousStreak,
        longestStreak: previousLongest,
        effectiveDayOffset: previousOffset,
      };
    }
    if (todayResult.success) {
      const newStreak = previousStreak + 1;
      return {
        currentStreak: newStreak,
        longestStreak: Math.max(previousLongest, newStreak),
        effectiveDayOffset: previousOffset,
      };
    }
    return {
      currentStreak: previousStreak,
      longestStreak: previousLongest,
      effectiveDayOffset: previousOffset,
    };
  }

  // Branch 4 — gap >= 2 (or negative — clock went backwards somehow,
  // treat as a missed-day reset). Streak breaks. Apply regression.
  const lastTierEffectiveDay =
    calendarDayIndex(prev.lastPlayedDate) - previousOffset;
  const lastTier = effectiveDigitTier(lastTierEffectiveDay);
  let regressionDelta = 0;
  if (lastTier.digits === 6) {
    regressionDelta = TIER_5_PERIOD; // tier-6 break → re-enter tier-5 band
  } else if (lastTier.digits === 5) {
    regressionDelta = TIER_4_PERIOD; // tier-5 break → re-enter tier-4 band
  }
  // tier-4 break: regressionDelta stays 0 (floor — cannot regress).

  const newOffset = previousOffset + regressionDelta;
  if (todayResult === null) {
    // Cross-midnight stale drop — streak breaks but no new submission
    // (the missed day itself counts as the failure).
    return {
      currentStreak: 0,
      longestStreak: previousLongest,
      effectiveDayOffset: newOffset,
    };
  }
  // Player submits after a gap; the regression already applied for
  // the missed days, then today's result resets the streak counter.
  const newStreak = todayResult.success ? 1 : 0;
  return {
    currentStreak: newStreak,
    longestStreak: Math.max(previousLongest, newStreak),
    effectiveDayOffset: newOffset,
  };
}
