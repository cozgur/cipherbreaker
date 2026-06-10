/**
 * Phase 8.6.2 — AdMob ad unit IDs.
 *
 * ALL IDs below are Google's official public TEST ad units (the iOS
 * values of the library's own `TestIds` table — this app is iOS-first).
 * They serve real-looking demo creatives but generate no revenue and
 * carry no invalid-traffic risk, so they're safe in any build.
 *
 * ── REAL-ID SWAP POINT (8.6 sealing) ─────────────────────────────────
 * At 8.6 sealing, replace the two `PROD_*` constants with the real ad
 * unit IDs from the AdMob console (and the App IDs in app.json's
 * react-native-google-mobile-ads plugin block). The `__DEV__` switch
 * below then does the right thing automatically: dev/simulator builds
 * keep serving Google test ads (clicking real ads from a dev device is
 * an AdMob policy violation), release builds serve real inventory.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Google's official iOS TEST rewarded ad unit (public, revenue-free). */
const TEST_REWARDED_AD_UNIT_ID = 'ca-app-pub-3940256099942544/1712485313';
/** Google's official iOS TEST interstitial ad unit (public, revenue-free). */
const TEST_INTERSTITIAL_AD_UNIT_ID = 'ca-app-pub-3940256099942544/4411468910';

// Intentionally still the test units until 8.6 sealing — a production
// build made before the AdMob account is live must never request real
// inventory. See "REAL-ID SWAP POINT" above.
const PROD_REWARDED_AD_UNIT_ID = TEST_REWARDED_AD_UNIT_ID;
const PROD_INTERSTITIAL_AD_UNIT_ID = TEST_INTERSTITIAL_AD_UNIT_ID;

/** Rewarded ad unit for AdWatchScreen + rewarded-double (8.6.3). */
export const REWARDED_AD_UNIT_ID: string = __DEV__
  ? TEST_REWARDED_AD_UNIT_ID
  : PROD_REWARDED_AD_UNIT_ID;

/** Interstitial ad unit for the every-3rd-match forced layer (8.6.4). */
export const INTERSTITIAL_AD_UNIT_ID: string = __DEV__
  ? TEST_INTERSTITIAL_AD_UNIT_ID
  : PROD_INTERSTITIAL_AD_UNIT_ID;
