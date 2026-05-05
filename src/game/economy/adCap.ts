/**
 * Phase 7A.5 CP1 — Ad-watch daily cap with cross-midnight reset.
 *
 * Pure functions over the persisted `(adsWatchedToday,
 * adsWatchedLastDate)` pair. The userStore action layer
 * (`watchAdAction`) calls these; the AdWatchScreen rewire to use
 * the gated path lands in a later CP.
 *
 * Hard rules (re-stated from `dailyDate.ts` — same trap class,
 * same discipline):
 *   - NEVER use `Date.prototype.toISOString()` (UTC drift).
 *   - The "today" parameter is a 'YYYY-MM-DD' string in the
 *     player's local-calendar timezone, produced by
 *     `formatDailyDate(new Date())` at the call site.
 *   - The cap reset is "today !== lastDate" — pure string
 *     equality, which is DST-immune by construction (the date
 *     string is local-calendar, not UTC, and Daily Challenge's
 *     `formatDailyDate` already enforces that contract).
 *
 * Why reuse `formatDailyDate` instead of a local helper:
 *   Daily Challenge's date helpers are battle-tested through Phase
 *   7A.4 CP3-CP7 (DST smoke, year boundary, leap-year). One source
 *   of truth for "what calendar day is it" across the app.
 */

import { AD_CAP_PER_DAY } from './constants';

/**
 * Persisted ad-cap state slice. Shape lives on `userStore`
 * (v3 → v4 migration adds these fields). Kept as a structural
 * type rather than an interface re-export from `userStore.ts`
 * so this module stays consumable by tests + future ad-cap
 * consumers without importing the store.
 */
export interface AdCapState {
  readonly adsWatchedToday: number;
  readonly adsWatchedLastDate: string | null;
}

/**
 * `true` if the player can watch one more ad today. Cross-midnight
 * reset is implicit: if `today !== adsWatchedLastDate`, today's
 * counter is effectively zero (the prior day's count is stale and
 * `applyAdWatched` will overwrite it on the next call).
 *
 * `null` `adsWatchedLastDate` is the first-ever-watch path (no
 * prior history). Treated identically to a stale date — counter
 * is zero from the cap's perspective.
 */
export function canWatchAd(state: AdCapState, today: string): boolean {
  return getAdsRemaining(state, today) > 0;
}

/**
 * Ads remaining today. Cross-midnight detection is the same `today
 * !== lastDate` test `canWatchAd` uses — keep the two in lockstep
 * so the UI surface (CP3 — "X ads left today" copy) and the cap
 * gate never disagree.
 */
export function getAdsRemaining(state: AdCapState, today: string): number {
  if (state.adsWatchedLastDate !== today) {
    // Stale day or first-ever — full quota available.
    return AD_CAP_PER_DAY;
  }
  return Math.max(0, AD_CAP_PER_DAY - state.adsWatchedToday);
}

/**
 * Apply one ad-watched increment. Pure — returns the next state
 * shape; the userStore action wraps this with a `set(...)` call.
 *
 * Callers MUST gate on `canWatchAd` first. Calling this past the
 * cap is a programmer error (the action-layer gate exists exactly
 * to prevent this), but defensively the function still clamps at
 * `AD_CAP_PER_DAY` so a misuse never overflows the persisted
 * counter.
 */
export function applyAdWatched(state: AdCapState, today: string): AdCapState {
  if (state.adsWatchedLastDate !== today) {
    // Cross-midnight (or first-ever) — counter resets to 1
    // (today's first watch) and stamps today's date.
    return { adsWatchedToday: 1, adsWatchedLastDate: today };
  }
  return {
    adsWatchedToday: Math.min(AD_CAP_PER_DAY, state.adsWatchedToday + 1),
    adsWatchedLastDate: today,
  };
}
