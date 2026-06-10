/**
 * Phase 8.6.2 — Google Mobile Ads SDK bring-up (foundation only).
 *
 * Thin lifecycle wrapper over `react-native-google-mobile-ads`, the ads
 * sibling of `iapManager` (same module-singleton pattern: exactly one SDK
 * init per app session). This sub-phase is install + init + config — NO
 * ad loading lives here yet; the rewarded wire (8.6.3) and interstitial
 * wire (8.6.4) build on these seams.
 *
 * Non-personalized only (8.6.1 locked decision): this app ships with NO
 * ATT prompt and NO tracking. In this library `requestNonPersonalizedAdsOnly`
 * (npa=1) is a PER-REQUEST option, not a global init flag — so the
 * contract is two-sided:
 *   1. `initialize()` sets the global `RequestConfiguration` (content
 *      rating + COPPA/consent tags) BEFORE the SDK starts;
 *   2. every ad load in 8.6.3/8.6.4 MUST pass
 *      `NON_PERSONALIZED_REQUEST_OPTIONS` to `createForAdRequest`.
 * Exporting the options object from here (rather than each call site
 * spelling its own literal) makes the npa=1 guarantee greppable and
 * testable in one place.
 *
 * Failure containment: ads are a revenue layer, never a launch
 * dependency. `initialize()` NEVER rejects — it resolves `false` on
 * failure (logged in dev) so RootNavigator can fire-and-forget. A failed
 * run does not latch: the next call retries (mirrors `iapManager`).
 */

import mobileAds, {
  MaxAdContentRating,
  type RequestOptions,
} from 'react-native-google-mobile-ads';

/**
 * npa=1 — MUST be passed to every `createForAdRequest` (rewarded 8.6.3,
 * interstitial 8.6.4). The single source of the non-personalized
 * guarantee; do not construct request options anywhere else.
 */
export const NON_PERSONALIZED_REQUEST_OPTIONS: RequestOptions = Object.freeze({
  requestNonPersonalizedAdsOnly: true,
});

// ── module-singleton state ───────────────────────────────────────────
/** SDK started successfully (config set + initialize resolved). */
let initialized = false;
/** The in-flight `initialize` run, or null. Coalesces concurrent
 *  callers onto ONE config+init sequence; cleared on settle so a
 *  failed run can be retried. */
let initializePromise: Promise<boolean> | null = null;

/**
 * Start the Google Mobile Ads SDK. Idempotent: a second call after
 * success is a no-op (`true`); concurrent calls share one in-flight run.
 *
 * The global request configuration is applied BEFORE `initialize()` so
 * no ad request can ever go out ahead of it:
 *   - `maxAdContentRating: T` — puzzle-game audience; revisit alongside
 *     the real ad unit IDs at 8.6 sealing.
 *   - `tagForChildDirectedTreatment: false` / `tagForUnderAgeOfConsent:
 *     false` — explicit "not child-directed" declarations (COPPA/GDPR
 *     tags), per the app's 12+ general-audience positioning.
 *   - `testDeviceIdentifiers: ['EMULATOR']` in dev builds only.
 *
 * Resolves `true` when the SDK is ready, `false` on failure (never
 * rejects — see module docs on failure containment).
 */
export async function initialize(): Promise<boolean> {
  if (initialized) return true;
  if (initializePromise) return initializePromise;

  const run = (async () => {
    try {
      await mobileAds().setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.T,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
        testDeviceIdentifiers: __DEV__ ? ['EMULATOR'] : [],
      });
      await mobileAds().initialize();
      initialized = true;
      if (__DEV__) console.log('[ads] SDK initialized (non-personalized config set)');
      return true;
    } catch (error) {
      if (__DEV__) console.log('[ads] SDK initialize failed (will retry on next call)', { error });
      return false;
    }
  })();
  initializePromise = run;

  // Clear the in-flight handle on settle: after success the `initialized`
  // fast-path serves later calls; after failure the next call retries.
  try {
    return await run;
  } finally {
    if (initializePromise === run) initializePromise = null;
  }
}

/** Whether the SDK is ready. 8.6.3/8.6.4 gate ad loads on this. */
export function isInitialized(): boolean {
  return initialized;
}

/** Test-only: reset the module singleton (no native teardown exists —
 *  the GMA SDK has no `dispose` — so tests reset the JS state instead). */
export function __resetForTests(): void {
  initialized = false;
  initializePromise = null;
}
