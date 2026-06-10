/**
 * Phase 8.6.2 — ad unit ID constants.
 *
 * Pins the exported IDs to Google's official public TEST ad units (iOS
 * values — iOS-first launch). Until 8.6 sealing the `__DEV__` switching
 * scaffold must resolve to the SAME test IDs on both branches, so these
 * exact-value assertions hold regardless of the jest `__DEV__` value —
 * which is precisely the "no real inventory before sealing" guarantee.
 */

import { TestIds } from 'react-native-google-mobile-ads';

import { INTERSTITIAL_AD_UNIT_ID, REWARDED_AD_UNIT_ID } from '../adUnitIds';

const GOOGLE_TEST_REWARDED = 'ca-app-pub-3940256099942544/1712485313';
const GOOGLE_TEST_INTERSTITIAL = 'ca-app-pub-3940256099942544/4411468910';

describe('adUnitIds — Phase 8.6.2 test-ID scaffold', () => {
  it('exports the official Google TEST rewarded ad unit', () => {
    expect(REWARDED_AD_UNIT_ID).toBe(GOOGLE_TEST_REWARDED);
  });

  it('exports the official Google TEST interstitial ad unit', () => {
    expect(INTERSTITIAL_AD_UNIT_ID).toBe(GOOGLE_TEST_INTERSTITIAL);
  });

  it("matches the library's own iOS TestIds table (drift guard)", () => {
    expect(REWARDED_AD_UNIT_ID).toBe(TestIds.REWARDED);
    expect(INTERSTITIAL_AD_UNIT_ID).toBe(TestIds.INTERSTITIAL);
  });

  it('both IDs belong to the Google sample publisher (never a real account before sealing)', () => {
    const GOOGLE_SAMPLE_PUBLISHER = /^ca-app-pub-3940256099942544\//;
    expect(REWARDED_AD_UNIT_ID).toMatch(GOOGLE_SAMPLE_PUBLISHER);
    expect(INTERSTITIAL_AD_UNIT_ID).toMatch(GOOGLE_SAMPLE_PUBLISHER);
  });
});
