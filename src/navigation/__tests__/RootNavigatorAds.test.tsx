/**
 * Phase 8.6.2 — RootNavigator app-launch AdMob wiring.
 *
 * Sibling of `RootNavigatorIap.test.tsx` (same rationale: fully mocks
 * the manager to assert the launch effect's contract, while the routing
 * suites exercise the real modules against the automatic
 * `react-native-google-mobile-ads` manual mock). Asserts:
 *   - the ads SDK initializes once at root mount;
 *   - ad init does NOT gate on `adsRemoved` (Remove Ads only suppresses
 *     interstitial loads in 8.6.4; rewarded stays available to payers);
 *   - a launch-time failure — even a rejection, which the real manager
 *     never produces — is caught and the tree still renders.
 */

import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { __resetMockUserForTests } from '@data/mockUser';
import { initialize as initializeAds } from '@lib/ads/adManager';
import { USER_STORE_DEFAULTS, useUserStore } from '@state/userStore';
import { RootNavigator } from '../RootNavigator';

jest.mock('@lib/ads/adManager', () => ({
  initialize: jest.fn(() => Promise.resolve(true)),
}));
jest.mock('@lib/iap/iapManager', () => ({
  initialize: jest.fn(() => Promise.resolve([])),
  dispose: jest.fn(() => Promise.resolve()),
}));
jest.mock('@lib/iap/purchaseFlow', () => ({
  startPurchaseListener: jest.fn(),
}));

const mockInitializeAds = initializeAds as unknown as jest.Mock;

const insets = { top: 44, left: 0, right: 0, bottom: 34 };

function renderRoot() {
  return render(
    <SafeAreaProvider initialMetrics={{ insets, frame: { x: 0, y: 0, width: 390, height: 844 } }}>
      <RootNavigator />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  __resetMockUserForTests();
  useUserStore.setState({ ...USER_STORE_DEFAULTS });
  mockInitializeAds.mockReset().mockResolvedValue(true);
});

describe('RootNavigator — Phase 8.6.2 launch AdMob wiring', () => {
  it('initializes the ads SDK once on mount', () => {
    renderRoot();
    expect(mockInitializeAds).toHaveBeenCalledTimes(1);
  });

  it('initializes even when the player has purchased Remove Ads', () => {
    useUserStore.setState({ ...USER_STORE_DEFAULTS, adsRemoved: true });
    renderRoot();
    expect(mockInitializeAds).toHaveBeenCalledTimes(1);
  });

  it('catches a launch-time ads init rejection without crashing the tree', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockInitializeAds.mockRejectedValue(new Error('no ads at launch'));
    const utils = renderRoot();
    // The tree still rendered (fresh-install default → OnboardingHero).
    expect(utils.getByText('Pure deduction.')).toBeTruthy();
    logSpy.mockRestore();
  });
});
