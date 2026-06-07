/**
 * Phase 8.5.3 — purchase flow orchestration.
 *
 * `./iapManager` is mocked so we can capture the handler the flow
 * installs and drive it like the real persistent listener would:
 * success / pending(state) / pending(deferred error) / verification
 * failure (bad payload + error code) / cancellation / network / unknown
 * product / audit-field extraction / sandbox passthrough / concurrency
 * rejection / unmatched-redelivery-then-match.
 *
 * expo-iap is also mocked (manual mock) because errors.ts reads the
 * ErrorCode enum at runtime.
 */

import { ErrorCode } from 'expo-iap';

import { purchase, setPurchaseHandler, type PurchaseHandler } from '../iapManager';
import { purchaseProduct } from '../purchaseFlow';
import { toWireSku, type ProductId } from '../productCatalog';

jest.mock('expo-iap');
jest.mock('../iapManager', () => ({
  purchase: jest.fn(() => Promise.resolve()),
  setPurchaseHandler: jest.fn(),
}));

const mockPurchase = purchase as unknown as jest.Mock;
const mockSetHandler = setPurchaseHandler as unknown as jest.Mock;

let handler: PurchaseHandler | null = null;

function makePurchase(overrides: Record<string, unknown> = {}): unknown {
  return {
    id: 'txn-1',
    transactionId: 'txn-1',
    originalTransactionIdentifierIOS: 'orig-9',
    productId: toWireSku('tokens_500'),
    purchaseState: 'purchased',
    purchaseToken: 'jws.signed.payload',
    transactionDate: 1_700_000_000_000,
    environmentIOS: 'Production',
    appAccountToken: 'acct-7',
    store: 'apple',
    platform: 'ios',
    quantity: 1,
    isAutoRenewing: false,
    ...overrides,
  };
}

/** Build a PurchaseError-shaped event matching onError's parameter type. */
const errEvent = (code: string, message = 'err'): Parameters<PurchaseHandler['onError']>[0] =>
  ({ code, message, name: 'PurchaseError' }) as Parameters<PurchaseHandler['onError']>[0];

beforeEach(() => {
  handler = null;
  mockPurchase.mockReset().mockResolvedValue(undefined);
  mockSetHandler.mockReset().mockImplementation((h: PurchaseHandler | null) => {
    if (h) handler = h;
  });
});

/** Configure the mocked purchase() to fire `fn(handler)` once invoked. */
function fireOnPurchaseCall(fn: (h: PurchaseHandler) => void): void {
  mockPurchase.mockImplementation(async () => {
    if (handler) fn(handler);
  });
}

describe('purchaseProduct — success paths', () => {
  it('returns success with a verified transaction', async () => {
    fireOnPurchaseCall((h) => h.onPurchase(makePurchase() as never));
    const result = await purchaseProduct('tokens_500');
    expect(result.status).toBe('success');
    expect(mockPurchase).toHaveBeenCalledWith(toWireSku('tokens_500'));
  });

  it('extracts all audit-trail fields (short productId, ids, env, token)', async () => {
    fireOnPurchaseCall((h) =>
      h.onPurchase(makePurchase({ environmentIOS: 'Sandbox' }) as never),
    );
    const result = await purchaseProduct('tokens_500');
    if (result.status !== 'success') throw new Error('expected success');
    expect(result.transaction).toEqual({
      transactionId: 'txn-1',
      originalTransactionId: 'orig-9',
      productId: 'tokens_500',
      purchaseDate: 1_700_000_000_000,
      environment: 'Sandbox',
      appAccountToken: 'acct-7',
    });
    expect(result.rawPurchase).toBeDefined();
  });
});

describe('purchaseProduct — pending paths', () => {
  it('returns pending for a pending purchase state (Ask to Buy)', async () => {
    fireOnPurchaseCall((h) => h.onPurchase(makePurchase({ purchaseState: 'pending' }) as never));
    const result = await purchaseProduct('tokens_500');
    expect(result.status).toBe('pending');
  });

  it('returns pending for a deferred-payment error code', async () => {
    fireOnPurchaseCall((h) => h.onError(errEvent(ErrorCode.DeferredPayment, 'wait')));
    const result = await purchaseProduct('tokens_500');
    expect(result.status).toBe('pending');
  });
});

describe('purchaseProduct — error paths', () => {
  it('rejects an unknown product before touching the store', async () => {
    const result = await purchaseProduct('tokens_999' as ProductId);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.error.code).toBe('PRODUCT_NOT_FOUND');
    expect(mockPurchase).not.toHaveBeenCalled();
  });

  it('maps user cancellation', async () => {
    fireOnPurchaseCall((h) => h.onError(errEvent(ErrorCode.UserCancelled, 'no')));
    const result = await purchaseProduct('tokens_500');
    if (result.status !== 'error') throw new Error('expected error');
    expect(result.error.code).toBe('USER_CANCELLED');
  });

  it('maps a network failure', async () => {
    fireOnPurchaseCall((h) => h.onError(errEvent(ErrorCode.NetworkError, 'offline')));
    const result = await purchaseProduct('tokens_500');
    if (result.status !== 'error') throw new Error('expected error');
    expect(result.error.code).toBe('NETWORK_ERROR');
  });

  it('maps a verification-failed error code', async () => {
    fireOnPurchaseCall((h) => h.onError(errEvent(ErrorCode.PurchaseVerificationFailed, 'bad sig')));
    const result = await purchaseProduct('tokens_500');
    if (result.status !== 'error') throw new Error('expected error');
    expect(result.error.code).toBe('VERIFICATION_FAILED');
  });

  it('fails verification when a purchased transaction is malformed (no JWS)', async () => {
    fireOnPurchaseCall((h) => h.onPurchase(makePurchase({ purchaseToken: null }) as never));
    const result = await purchaseProduct('tokens_500');
    if (result.status !== 'error') throw new Error('expected error');
    expect(result.error.code).toBe('VERIFICATION_FAILED');
  });

  it('maps a synchronous requestPurchase rejection', async () => {
    mockPurchase.mockRejectedValue({ code: ErrorCode.NetworkError, message: 'down' });
    const result = await purchaseProduct('tokens_500');
    if (result.status !== 'error') throw new Error('expected error');
    expect(result.error.code).toBe('NETWORK_ERROR');
  });
});

describe('purchaseProduct — concurrency + correlation', () => {
  it('rejects a second purchase while one is in flight', async () => {
    mockPurchase.mockImplementation(async () => {
      /* never fires the handler — first purchase stays pending */
    });
    const first = purchaseProduct('tokens_500');
    const second = await purchaseProduct('tokens_1500');
    expect(second.status).toBe('error');
    if (second.status === 'error') expect(second.error.code).toBe('UNKNOWN');

    // settle the first so module state (inFlight) resets for later tests
    handler?.onPurchase(makePurchase() as never);
    await first;
  });

  it('ignores an unrelated re-delivery and resolves on the matching SKU', async () => {
    fireOnPurchaseCall((h) => {
      h.onPurchase(makePurchase({ productId: toWireSku('tokens_5000') }) as never); // ignored
      h.onPurchase(makePurchase({ productId: toWireSku('tokens_500') }) as never); // matches
    });
    const result = await purchaseProduct('tokens_500');
    if (result.status !== 'success') throw new Error('expected success');
    expect(result.transaction.productId).toBe('tokens_500');
  });
});
