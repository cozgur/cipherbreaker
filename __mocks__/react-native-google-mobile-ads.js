/**
 * Manual mock for `react-native-google-mobile-ads` (a native module,
 * unusable in Node/Jest). As a node_modules package mock it is applied
 * AUTOMATICALLY to every suite — no `jest.mock` call needed — so the
 * RootNavigator routing suites that import `adManager` transitively get
 * this stub for free (same role `expo-iap.js` plays for the IAP layer).
 *
 * `mobileAds()` returns one module-level singleton object, so tests can
 * grab `mobileAds().setRequestConfiguration` / `.initialize` and assert
 * call order/config per-case (mockReset in beforeEach).
 */

const setRequestConfiguration = jest.fn(() => Promise.resolve());
const initialize = jest.fn(() => Promise.resolve([]));

const adsModule = { setRequestConfiguration, initialize };
const mobileAds = jest.fn(() => adsModule);

module.exports = {
  __esModule: true,
  default: mobileAds,
  MobileAds: mobileAds,
  MaxAdContentRating: { G: 'G', PG: 'PG', T: 'T', MA: 'MA' },
  TestIds: {
    REWARDED: 'ca-app-pub-3940256099942544/1712485313',
    INTERSTITIAL: 'ca-app-pub-3940256099942544/4411468910',
  },
};
