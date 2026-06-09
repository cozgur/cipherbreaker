/**
 * Phase 8.5.5 / 8.5.6 — ShopScreen wired to the expo-iap purchase flow.
 *
 * `iapManager` is mocked and `purchaseProduct` is mocked (to drive the
 * three result states deterministically), but `finalizePurchase` is the
 * REAL implementation (partial mock) running against the REAL userStore —
 * so a success is verified by its side effects (balance + iapHistory) AND
 * we assert the screen finishes the StoreKit transaction (8.5.6) only when
 * the entitlement is recorded (grant success / duplicate), never on
 * invalid_product. expo-iap itself is the auto-applied manual mock
 * (errors.ts reads its ErrorCode enum).
 */

import { act, fireEvent, waitFor } from '@testing-library/react-native';

import { finishPurchase, initialize } from '@lib/iap/iapManager';
import { purchaseProduct } from '@lib/iap/purchaseFlow';
import { IAPError } from '@lib/iap/errors';
import { USER_STORE_DEFAULTS, useUserStore } from '@state/userStore';
import { ShopScreen } from '../ShopScreen';
import { renderWithNavigation, stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';

jest.mock('@lib/iap/iapManager', () => ({
  initialize: jest.fn(() => Promise.resolve([])),
  finishPurchase: jest.fn(() => Promise.resolve()),
}));
// Real finalizePurchase (grant + finish) over a mocked purchaseProduct, so
// the 8.5.6 finish orchestration is exercised end-to-end.
jest.mock('@lib/iap/purchaseFlow', () => ({
  ...jest.requireActual('@lib/iap/purchaseFlow'),
  purchaseProduct: jest.fn(),
}));

const mockInitialize = initialize as unknown as jest.Mock;
const mockFinish = finishPurchase as unknown as jest.Mock;
const mockPurchase = purchaseProduct as unknown as jest.Mock;

function verified(overrides: Record<string, unknown> = {}): unknown {
  return {
    transactionId: 'txn-1',
    originalTransactionId: 'orig-1',
    productId: 'tokens_500',
    purchaseDate: 1_700_000_000_000,
    environment: 'Production',
    ...overrides,
  };
}

const POCKET = 'Buy 500 tokens for $0.99';

beforeEach(() => {
  useUserStore.setState({ ...USER_STORE_DEFAULTS });
  mockInitialize.mockReset().mockResolvedValue([]);
  mockFinish.mockReset().mockResolvedValue(undefined);
  mockPurchase.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ShopScreen — layout', () => {
  it('snapshots the four-pack layout', () => {
    const { toJSON } = renderWithNavigation('Shop', { Shop: ShopScreen });
    expect(stableTreeForSnapshot(toJSON())).toMatchSnapshot();
  });

  it('shows ribbons on the popular and best-value tiers', () => {
    const { getByText } = renderWithNavigation('Shop', { Shop: ShopScreen });
    expect(getByText('MOST POPULAR')).toBeTruthy();
    expect(getByText('BEST VALUE')).toBeTruthy();
  });

  it('renders the disclaimer footer', () => {
    const { getByText } = renderWithNavigation('Shop', { Shop: ShopScreen });
    expect(getByText(/All purchases are final/)).toBeTruthy();
  });
});

describe('ShopScreen — initialization', () => {
  it('initializes the store on mount', () => {
    renderWithNavigation('Shop', { Shop: ShopScreen });
    expect(mockInitialize).toHaveBeenCalledTimes(1);
  });

  it('shows a soft status when initialization fails', async () => {
    mockInitialize.mockRejectedValue(new Error('no store'));
    const utils = renderWithNavigation('Shop', { Shop: ShopScreen });
    expect(await utils.findByText('Store unavailable. Try again later.')).toBeTruthy();
  });
});

describe('ShopScreen — purchase flow', () => {
  it('grants tokens and shows success on a successful consumable purchase', async () => {
    mockPurchase.mockResolvedValue({ status: 'success', transaction: verified(), rawPurchase: {} });
    const utils = renderWithNavigation('Shop', { Shop: ShopScreen });

    await act(async () => {
      fireEvent.press(utils.getByLabelText(POCKET));
    });

    expect(mockPurchase).toHaveBeenCalledWith('tokens_500');
    await waitFor(() => expect(useUserStore.getState().tokens).toBe(100 + 500));
    expect(useUserStore.getState().iapHistory).toHaveLength(1);
    expect(useUserStore.getState().iapHistory[0]?.transactionId).toBe('txn-1');
    // 8.5.6 — the consumable transaction is finished after the grant.
    expect(mockFinish).toHaveBeenCalledTimes(1);
    expect(mockFinish).toHaveBeenCalledWith({}, true);
    expect(await utils.findByText('Tokens added! +500 tokens')).toBeTruthy();
  });

  it('shows pending and re-enables CTAs for an Ask-to-Buy result', async () => {
    mockPurchase.mockResolvedValue({ status: 'pending' });
    const utils = renderWithNavigation('Shop', { Shop: ShopScreen });

    await act(async () => {
      fireEvent.press(utils.getByLabelText(POCKET));
    });
    expect(await utils.findByText('Purchase awaiting approval')).toBeTruthy();
    // Re-enabled: a second tap registers another purchase attempt.
    await act(async () => {
      fireEvent.press(utils.getByLabelText(POCKET));
    });
    expect(mockPurchase).toHaveBeenCalledTimes(2);
    // No tokens granted on a pending result.
    expect(useUserStore.getState().tokens).toBe(100);
  });

  it('is silent on user cancellation and re-enables CTAs', async () => {
    mockPurchase.mockResolvedValue({
      status: 'error',
      error: new IAPError('USER_CANCELLED', 'dismissed'),
    });
    const utils = renderWithNavigation('Shop', { Shop: ShopScreen });

    await act(async () => {
      fireEvent.press(utils.getByLabelText(POCKET));
    });
    expect(utils.queryByText('Something went wrong. Try again.')).toBeNull();
    expect(useUserStore.getState().tokens).toBe(100);
    // Re-enabled.
    await act(async () => {
      fireEvent.press(utils.getByLabelText(POCKET));
    });
    expect(mockPurchase).toHaveBeenCalledTimes(2);
  });

  it('shows a network error message', async () => {
    mockPurchase.mockResolvedValue({
      status: 'error',
      error: new IAPError('NETWORK_ERROR', 'offline'),
    });
    const utils = renderWithNavigation('Shop', { Shop: ShopScreen });
    await act(async () => {
      fireEvent.press(utils.getByLabelText(POCKET));
    });
    expect(await utils.findByText('Connection issue. Try again.')).toBeTruthy();
  });

  it('shows a verification-failed message', async () => {
    mockPurchase.mockResolvedValue({
      status: 'error',
      error: new IAPError('VERIFICATION_FAILED', 'bad sig'),
    });
    const utils = renderWithNavigation('Shop', { Shop: ShopScreen });
    await act(async () => {
      fireEvent.press(utils.getByLabelText(POCKET));
    });
    expect(
      await utils.findByText("Purchase couldn't be verified. Contact support."),
    ).toBeTruthy();
  });

  it.each([
    ['PAYMENT_INVALID', 'Payment method issue. Check your Apple ID.'],
    ['PAYMENT_NOT_ALLOWED', 'Purchases not allowed on this device.'],
    ['PRODUCT_NOT_FOUND', 'Product unavailable. Try again later.'],
    ['UNKNOWN', 'Something went wrong. Try again.'],
  ] as const)('maps %s to its user-facing message', async (code, message) => {
    mockPurchase.mockResolvedValue({ status: 'error', error: new IAPError(code, 'raw') });
    const utils = renderWithNavigation('Shop', { Shop: ShopScreen });
    await act(async () => {
      fireEvent.press(utils.getByLabelText(POCKET));
    });
    expect(await utils.findByText(message)).toBeTruthy();
  });

  it('blocks a concurrent tap while a purchase is in flight', async () => {
    let resolvePurchase: (value: unknown) => void = () => {};
    mockPurchase.mockReturnValue(
      new Promise((resolve) => {
        resolvePurchase = resolve;
      }),
    );
    const utils = renderWithNavigation('Shop', { Shop: ShopScreen });

    await act(async () => {
      fireEvent.press(utils.getByLabelText(POCKET));
      fireEvent.press(utils.getByLabelText(POCKET)); // second tap, same tick
    });
    expect(mockPurchase).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePurchase({ status: 'error', error: new IAPError('USER_CANCELLED', '') });
    });
  });

  it('is silent on a duplicate grant (already credited)', async () => {
    useUserStore.setState({
      iapHistory: [
        {
          transactionId: 'txn-1',
          originalTransactionId: 'orig-1',
          productId: 'tokens_500',
          tokensGranted: 500,
          timestamp: 1,
          purchaseDate: 1,
          expirationDate: null,
          environment: 'Production',
        },
      ],
    });
    mockPurchase.mockResolvedValue({
      status: 'success',
      transaction: verified({ transactionId: 'txn-1' }),
      rawPurchase: {},
    });
    const utils = renderWithNavigation('Shop', { Shop: ShopScreen });

    await act(async () => {
      fireEvent.press(utils.getByLabelText(POCKET));
    });
    expect(useUserStore.getState().tokens).toBe(100); // unchanged
    expect(useUserStore.getState().iapHistory).toHaveLength(1); // not appended
    expect(utils.queryByText(/Tokens added/)).toBeNull(); // silent
    // 8.5.6 — a duplicate is still finished so StoreKit stops re-delivering.
    expect(mockFinish).toHaveBeenCalledTimes(1);
  });

  it('does NOT finish the transaction when the product is unknown (invalid_product)', async () => {
    // A success result carrying a product not in the catalog → grant
    // returns invalid_product; the transaction is left unfinished
    // (defensive — should not occur, but must never silently finish).
    mockPurchase.mockResolvedValue({
      status: 'success',
      transaction: verified({ transactionId: 'txn-bad', productId: 'tokens_999' }),
      rawPurchase: {},
    });
    const utils = renderWithNavigation('Shop', { Shop: ShopScreen });

    await act(async () => {
      fireEvent.press(utils.getByLabelText(POCKET));
    });
    expect(useUserStore.getState().tokens).toBe(100); // unchanged
    expect(useUserStore.getState().iapHistory).toHaveLength(0); // nothing recorded
    expect(mockFinish).not.toHaveBeenCalled(); // left unfinished
    expect(utils.queryByText(/Tokens added/)).toBeNull(); // silent
  });
});
