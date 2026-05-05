/**
 * Phase 7A.5 CP1 — interstitial frequency-cap predicate.
 *
 * One pure boolean function, called by CP3's match-completion seam
 * (`MatchResultScreen.tsx`) to decide whether the next post-match
 * navigation should route through `InterstitialAdScreen`. The
 * counter itself lives on `userStore.matchesSinceLastInterstitial`
 * (CP1 schema); incrementing on match completion + resetting after
 * the ad fires lives on the userStore actions
 * (`incrementMatchCounter`, `resetMatchCounter`).
 *
 * Advisor discipline: kept under `economy/`, not folded into any
 * shared `counters/` helper with `daily/`. The two domains
 * (interstitial pacing vs. daily-challenge attempt cadence) have
 * different lifecycle ownership and different reset triggers; a
 * shared helper would be a premature abstraction across two
 * unrelated cap mechanisms.
 *
 * Daily Challenge does NOT consume this gate. Daily completion
 * goes through `dailyChallengeStore.submitGuess` →
 * `recordDailyResult`, which never touches the match counter.
 * Pinned by an invariant test in `userStore.test.ts`.
 */

import { INTERSTITIAL_MATCH_THRESHOLD } from './constants';

/**
 * `true` iff the player has completed at least
 * `INTERSTITIAL_MATCH_THRESHOLD` Mode 1–7 matches since the last
 * interstitial fired. Threshold-inclusive — counter exactly equal
 * to the threshold triggers the ad.
 *
 * Pure, no Date / store reads — the call site supplies the count.
 * Combined with `iap.ts`'s `canShowInterstitial` for the full
 * "should I show?" decision (which also factors in Remove-Ads
 * IAP and the daily ad cap).
 */
export function shouldShowInterstitial(matchesCount: number): boolean {
  return matchesCount >= INTERSTITIAL_MATCH_THRESHOLD;
}
