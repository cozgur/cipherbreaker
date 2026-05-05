/**
 * Phase 7A.5 CP1 — interstitial threshold predicate.
 *
 * Pure-function suite. The counter side (increment / reset) lives
 * on `userStore` and is exercised in `userStore.test.ts`; this
 * file pins only the gate predicate.
 */

import { INTERSTITIAL_MATCH_THRESHOLD } from '../constants';
import { shouldShowInterstitial } from '../interstitial';

describe('shouldShowInterstitial', () => {
  it('returns false below the threshold (0, 1, 2)', () => {
    expect(shouldShowInterstitial(0)).toBe(false);
    expect(shouldShowInterstitial(1)).toBe(false);
    expect(shouldShowInterstitial(2)).toBe(false);
  });

  it('returns true at the threshold (inclusive boundary)', () => {
    expect(shouldShowInterstitial(INTERSTITIAL_MATCH_THRESHOLD)).toBe(true);
    expect(shouldShowInterstitial(3)).toBe(true);
  });

  it('returns true above the threshold (4, 5, 100 — defensive past-reset)', () => {
    expect(shouldShowInterstitial(4)).toBe(true);
    expect(shouldShowInterstitial(5)).toBe(true);
    expect(shouldShowInterstitial(100)).toBe(true);
  });

  it('handles 0 explicitly (fresh user, no matches yet)', () => {
    expect(shouldShowInterstitial(0)).toBe(false);
  });
});
