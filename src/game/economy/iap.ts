/**
 * Phase 7A.5 CP1 — Remove Ads IAP gate primitives.
 *
 * The persisted `adsRemoved: boolean` flag lives on `userStore`
 * (added in the same v3 → v4 migration as the ad-cap fields).
 * Production wiring: RevenueCat callback flips the flag on a
 * verified purchase. Dev / staging: a `__DEV__`-gated toggle in
 * the Settings tab flips the flag for QA without hitting the App
 * Store sandbox.
 *
 * What Remove Ads removes (brainstorm Q11): only the **forced**
 * interstitial layer (CP3). The user-elective rewarded paths
 * (`AdWatchScreen` need-driven earn loop + the "double your tokens"
 * CTA in CP6) stay available — disabling them would cap a paying
 * player's earning ceiling, which is a worse experience for the
 * user who just paid to remove ads. Q12: no token-grant bonus on
 * purchase; the value prop is the ad-free experience itself.
 *
 * `canShowInterstitial` is the composed gate — combines ad cap
 * (`canWatchAd` from `adCap.ts`) AND the Remove Ads flag. This is
 * the function CP3's match-completion seam will call to decide
 * whether to route through `InterstitialAdScreen`. Keeping the
 * composition in one place means a future re-balance lands in one
 * file; CP3 doesn't have to know about both gates.
 */

import { canWatchAd, type AdCapState } from './adCap';

/**
 * Persisted Remove Ads flag slice. Structural type so this module
 * stays test-friendly without importing `userStore`.
 */
export interface AdsRemovedState {
  readonly adsRemoved: boolean;
}

/** Pure getter — boolean read of the persisted flag. */
export function isAdsRemoved(state: AdsRemovedState): boolean {
  return state.adsRemoved;
}

/**
 * Composed gate: the interstitial may fire iff the player still
 * has ad-cap headroom AND has not purchased Remove Ads. Single
 * call site planned (CP3); colocated with the rewarded-path
 * exemption documented at module scope so future readers don't
 * have to grep both `adCap.ts` and `iap.ts` to understand the
 * decision tree.
 */
export function canShowInterstitial(
  state: AdCapState & AdsRemovedState,
  today: string,
): boolean {
  if (state.adsRemoved) return false;
  return canWatchAd(state, today);
}
