/**
 * Phase 8.5.5 — ShopScreen wired to the expo-iap purchase flow.
 *
 * iapManager + purchaseFlow are mocked so we drive the three result
 * states deterministically; the REAL userStore handles grantIAPTokens so
 * a successful purchase is verified by its side effects (balance +
 * iapHistory) — which proves the screen called grant with the right
 * transaction. expo-iap itself is the auto-applied manual mock (errors.ts
 * reads its ErrorCode enum).
 */

import { act, fireEvent, waitFor } from '@testing-library/react-native';

import { initialize } from '@lib/iap/iapManager';
import { purchaseProduct } from '@lib/iap/purchaseFlow';
import { IAPError } from '@lib/iap/errors';
import { USER_STORE_DEFAULTS, useUserStore } from '@state/userStore';
import { ShopScreen } from '../ShopScreen';
import { renderWithNavigation, stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';

jest.mock('@lib/iap/iapManager', () => ({ initialize: jest.fn(() => Promise.resolve([])) }));
jest.mock('@lib/iap/purchaseFlow', () => ({ purchaseProduct: jest.fn() }));

const mockInitialize = initialize as unknown as jest.Mock;
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
  });
});
