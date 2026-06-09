/**
 * Phase 8.5.3 / 8.5.6 — purchase flow orchestration + re-delivery.
 *
 * `./iapManager` is mocked (purchase / finishPurchase / setPurchaseHandler)
 * so we capture the ONE persistent handler the flow installs via
 * `startPurchaseListener` and drive it like the real listener would. The
 * REAL `userStore` runs the grant, so the grant + idempotency are verified
 * by their side effects (token balance / `adsRemoved` / `iapHistory`).
 *
 * Coverage:
 *   - solicited: success result is grant-FREE (caller finalizes); audit
 *     fields; pending(state) + pending(deferred error); cancel / network /
 *     verification-failed / malformed-no-JWS / sync reject; concurrency.
 *   - finalizePurchase: consumable grant + finish(true); non-consumable
 *     finish(false); duplicate still finishes, no re-credit; invalid_product
 *     is NOT finished.
 *   - finalizeUnsolicited (re-delivery): valid → grant + finish silently;
 *     forged → left unfinished; pending → left unfinished; idempotent
 *     re-delivery credits once but finishes each time.
 *   - lifecycle: start installs / stop clears; launch re-delivery grants
 *     with no purchase in flight; orphan error is swallowed.
 *
 * expo-iap is also mocked (manual mock) because errors.ts reads the
 * ErrorCode enum at runtime.
 */

import { ErrorCode } from 'expo-iap';

import { purchase, finishPurchase, setPurchaseHandler, type PurchaseHandler } from '../iapManager';
import {
  purchaseProduct,
  finalizePurchase,
  finalizeUnsolicited,
  startPurchaseListener,
  stopPurchaseListener,
  type VerifiedTransaction,
} from '../purchaseFlow';
import { toWireSku, type ProductId } from '../productCatalog';
import { USER_STORE_DEFAULTS, useUserStore } from '@state/userStore';

jest.mock('expo-iap');
jest.mock('../iapManager', () => ({
  purchase: jest.fn(() => Promise.resolve()),
  finishPurchase: jest.fn(() => Promise.resolve()),
  setPurchaseHandler: jest.fn(),
}));

const mockPurchase = purchase as unknown as jest.Mock;
const mockFinish = finishPurchase as unknown as jest.Mock;
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

function verifiedTx(overrides: Partial<VerifiedTransaction> = {}): VerifiedTransaction {
  return {
    transactionId: 'txn-1',
    originalTransactionId: 'orig-9',
    productId: 'tokens_500',
    purchaseDate: 1_700_000_000_000,
    environment: 'Production',
    ...overrides,
  };
}

/** Build a PurchaseError-shaped event matching onError's parameter type. */
const errEvent = (code: string, message = 'err'): Parameters<PurchaseHandler['onError']>[0] =>
  ({ code, message, name: 'PurchaseError' }) as Parameters<PurchaseHandler['onError']>[0];

beforeEach(() => {
  handler = null;
  mockPurchase.mockReset().mockResolvedValue(undefined);
  mockFinish.mockReset().mockResolvedValue(undefined);
  // Capture whatever handler the flow installs (persistentHandler on start,
  // null on stop).
  mockSetHandler.mockReset().mockImplementation((h: PurchaseHandler | null) => {
    handler = h;
  });
  useUserStore.setState({ ...USER_STORE_DEFAULTS });
  // Production wires this at app launch (RootNavigator); tests install it
  // explicitly so the persistent handler is live.
  startPurchaseListener();
});

/** Configure the mocked purchase() to fire `fn(handler)` once invoked. */
function fireOnPurchaseCall(fn: (h: PurchaseHandler) => void): void {
  mockPurchase.mockImplementation(async () => {
    if (handler) fn(handler);
  });
}

describe('purchaseProduct — solicited result (grant-free)', () => {
  it('returns success WITHOUT granting — the caller finalizes', async () => {
    fireOnPurchaseCall((h) => h.onPurchase(makePurchase() as never));
    const result = await purchaseProduct('tokens_500');

    expect(result.status).toBe('success');
    expect(mockPurchase).toHaveBeenCalledWith(toWireSku('tokens_500'));
    // purchaseProduct does not grant or finish; finalize is the caller's job.
    expect(useUserStore.getState().tokens).toBe(USER_STORE_DEFAULTS.tokens);
    expect(mockFinish).not.toHaveBeenCalled();
  });

  it('extracts all audit-trail fields (short productId, ids, env, token)', async () => {
    fireOnPurchaseCall((h) => h.onPurchase(makePurchase({ environmentIOS: 'Sandbox' }) as never));
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

describe('purchaseProduct — concurrency', () => {
  it('rejects a second purchase while one is in flight', async () => {
    mockPurchase.mockImplementation(async () => {
      /* never fires the handler — first purchase stays pending */
    });
    const first = purchaseProduct('tokens_500');
    const second = await purchaseProduct('tokens_1500');
    expect(second.status).toBe('error');
    if (second.status === 'error') expect(second.error.code).toBe('UNKNOWN');

    // settle the first so module state (pending) resets for later tests
    handler?.onPurchase(makePurchase() as never);
    await first;
  });
});

describe('finalizePurchase — grant + finish', () => {
  it('grants a consumable and finishes it (isConsumable=true)', async () => {
    const grant = await finalizePurchase(verifiedTx(), { id: 'txn-1' } as never);
    expect(grant.success).toBe(true);
    expect(useUserStore.getState().tokens).toBe(USER_STORE_DEFAULTS.tokens + 500);
    expect(mockFinish).toHaveBeenCalledWith({ id: 'txn-1' }, true);
  });

  it('grants a non-consumable (Remove Ads) and finishes it (isConsumable=false)', async () => {
    const grant = await finalizePurchase(
      verifiedTx({ productId: 'remove_ads', transactionId: 'rm-1' }),
      { id: 'rm-1' } as never,
    );
    expect(grant.success).toBe(true);
    expect(useUserStore.getState().adsRemoved).toBe(true);
    expect(mockFinish).toHaveBeenCalledWith({ id: 'rm-1' }, false);
  });

  it('finishes a duplicate (already credited) WITHOUT re-granting', async () => {
    useUserStore.setState({
      iapHistory: [
        {
          transactionId: 'txn-1',
          originalTransactionId: 'orig-9',
          productId: 'tokens_500',
          tokensGranted: 500,
          timestamp: 1,
          purchaseDate: 1,
          expirationDate: null,
          environment: 'Production',
        },
      ],
    });
    const grant = await finalizePurchase(verifiedTx(), { id: 'txn-1' } as never);
    expect(grant).toEqual({ success: false, error: 'duplicate' });
    expect(useUserStore.getState().tokens).toBe(USER_STORE_DEFAULTS.tokens); // not re-credited
    expect(mockFinish).toHaveBeenCalledTimes(1); // still finished (stop re-delivery)
  });

  it('does NOT finish an invalid_product grant (leaves it for native resolution)', async () => {
    const grant = await finalizePurchase(
      verifiedTx({ productId: 'tokens_999' as ProductId }),
      {} as never,
    );
    expect(grant).toEqual({ success: false, error: 'invalid_product' });
    expect(mockFinish).not.toHaveBeenCalled();
  });
});

describe('finalizeUnsolicited — re-delivery handling', () => {
  it('grants + finishes a valid re-delivered transaction silently', async () => {
    await finalizeUnsolicited(makePurchase() as never);
    expect(useUserStore.getState().tokens).toBe(USER_STORE_DEFAULTS.tokens + 500);
    expect(mockFinish).toHaveBeenCalledTimes(1);
  });

  it('leaves a forged/failed re-delivery unfinished (no grant)', async () => {
    await finalizeUnsolicited(makePurchase({ purchaseToken: null }) as never);
    expect(useUserStore.getState().tokens).toBe(USER_STORE_DEFAULTS.tokens);
    expect(mockFinish).not.toHaveBeenCalled();
  });

  it('leaves a still-pending re-delivery unfinished (not yet grantable)', async () => {
    await finalizeUnsolicited(makePurchase({ purchaseState: 'pending' }) as never);
    expect(useUserStore.getState().tokens).toBe(USER_STORE_DEFAULTS.tokens);
    expect(mockFinish).not.toHaveBeenCalled();
  });

  it('is idempotent — a re-delivered already-granted transaction credits once but finishes each time', async () => {
    await finalizeUnsolicited(makePurchase() as never); // grants 500
    await finalizeUnsolicited(makePurchase() as never); // same txn-1 → duplicate
    expect(useUserStore.getState().tokens).toBe(USER_STORE_DEFAULTS.tokens + 500);
    expect(mockFinish).toHaveBeenCalledTimes(2);
  });
});

describe('persistent listener lifecycle', () => {
  it('startPurchaseListener installs a handler (routed by beforeEach)', () => {
    expect(mockSetHandler).toHaveBeenCalled();
    expect(handler).not.toBeNull();
  });

  it('stopPurchaseListener clears the handler', () => {
    stopPurchaseListener();
    expect(mockSetHandler).toHaveBeenLastCalledWith(null);
  });

  it('grants a launch re-delivery with no purchase in flight', async () => {
    // No purchaseProduct call — a pure StoreKit replay at launch.
    handler?.onPurchase(makePurchase() as never);
    await Promise.resolve();
    expect(useUserStore.getState().tokens).toBe(USER_STORE_DEFAULTS.tokens + 500);
    expect(mockFinish).toHaveBeenCalledTimes(1);
  });

  it('swallows an orphan error with no purchase in flight', () => {
    expect(() => handler?.onError(errEvent(ErrorCode.NetworkError) as never)).not.toThrow();
  });
});
