/**
 * Phase 8.5.6 — RootNavigator app-launch IAP wiring.
 *
 * Separate file (not the onboarding-routing suite) because it FULLY mocks
 * `iapManager` + `purchaseFlow` to assert the launch effect's contract,
 * whereas the routing suite runs them for real against the expo-iap manual
 * mock. Asserts:
 *   - the persistent purchase listener is started, then the store is
 *     initialized — listener BEFORE init, so a transaction re-delivered
 *     during launch is routed, not dropped;
 *   - the connection is disposed on unmount;
 *   - a launch-time initialize failure is caught (non-fatal — the tree
 *     still renders; the shop surfaces its own soft retry).
 */

import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { __resetMockUserForTests } from '@data/mockUser';
import { dispose, initialize } from '@lib/iap/iapManager';
import { startPurchaseListener } from '@lib/iap/purchaseFlow';
import { USER_STORE_DEFAULTS, useUserStore } from '@state/userStore';
import { RootNavigator } from '../RootNavigator';

jest.mock('@lib/iap/iapManager', () => ({
  initialize: jest.fn(() => Promise.resolve([])),
  dispose: jest.fn(() => Promise.resolve()),
}));
jest.mock('@lib/iap/purchaseFlow', () => ({
  startPurchaseListener: jest.fn(),
  purchaseProduct: jest.fn(),
  finalizePurchase: jest.fn(),
}));

const mockInitialize = initialize as unknown as jest.Mock;
const mockDispose = dispose as unknown as jest.Mock;
const mockStartListener = startPurchaseListener as unknown as jest.Mock;

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
  mockInitialize.mockReset().mockResolvedValue([]);
  mockDispose.mockReset().mockResolvedValue(undefined);
  mockStartListener.mockReset();
});

describe('RootNavigator — Phase 8.5.6 launch IAP wiring', () => {
  it('starts the purchase listener and initializes the store once on mount', () => {
    renderRoot();
    expect(mockStartListener).toHaveBeenCalledTimes(1);
    expect(mockInitialize).toHaveBeenCalledTimes(1);
  });

  it('starts the listener BEFORE initializing (so launch re-delivery is routed)', () => {
    renderRoot();
    const listenerOrder = mockStartListener.mock.invocationCallOrder[0] ?? 0;
    const initOrder = mockInitialize.mock.invocationCallOrder[0] ?? 0;
    expect(listenerOrder).toBeLessThan(initOrder);
  });

  it('disposes the store connection on unmount', () => {
    const utils = renderRoot();
    utils.unmount();
    expect(mockDispose).toHaveBeenCalledTimes(1);
  });

  it('catches a launch-time initialize failure without crashing the tree', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockInitialize.mockRejectedValue(new Error('no store at launch'));
    const utils = renderRoot();
    // The tree still rendered (fresh-install default → OnboardingHero).
    expect(utils.getByText('Pure deduction.')).toBeTruthy();
    logSpy.mockRestore();
  });
});
