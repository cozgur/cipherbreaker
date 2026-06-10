/**
 * Phase 8.5.2 + 8.5.3 — IAP manager (expo-iap mocked).
 *
 * Covers the transport layer:
 *   - initialize: connects, fetches the catalog SKUs as 'in-app',
 *     caches the result; idempotent on a second call; surfaces typed
 *     CONNECTION_FAILED / PRODUCTS_FETCH_FAILED; null fetch → [].
 *   - getProducts: returns the cache; throws NOT_INITIALIZED pre-init.
 *   - addTransactionListener: registers the update listener (and the
 *     error listener only when onError is given); the returned handle
 *     removes just its own registrations.
 *   - dispose: removes tracked listeners, ends the connection, and
 *     resets state so getProducts throws again.
 *   - 8.5.3 — purchase()/finishPurchase() wrap requestPurchase/
 *     finishTransaction; setPurchaseHandler attaches ONE persistent
 *     listener (idempotently) and routes events to the current handler;
 *     dispose clears the handler so a later attach re-registers.
 */

import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
} from 'expo-iap';

import {
  initialize,
  getProducts,
  addTransactionListener,
  setPurchaseHandler,
  purchase,
  finishPurchase,
  dispose,
  IapError,
} from '../iapManager';
import { PRODUCT_SKUS } from '../productCatalog';

jest.mock('expo-iap', () => ({
  initConnection: jest.fn(),
  endConnection: jest.fn(),
  fetchProducts: jest.fn(),
  requestPurchase: jest.fn(),
  finishTransaction: jest.fn(),
  purchaseUpdatedListener: jest.fn(),
  purchaseErrorListener: jest.fn(),
}));

const mockInitConnection = initConnection as unknown as jest.Mock;
const mockEndConnection = endConnection as unknown as jest.Mock;
const mockFetchProducts = fetchProducts as unknown as jest.Mock;
const mockRequestPurchase = requestPurchase as unknown as jest.Mock;
const mockFinishTransaction = finishTransaction as unknown as jest.Mock;
const mockPurchaseUpdated = purchaseUpdatedListener as unknown as jest.Mock;
const mockPurchaseError = purchaseErrorListener as unknown as jest.Mock;

const SAMPLE_PRODUCTS = [
  { id: 'com.ozgurcetintas.cipherbreaker.tokens_500', displayPrice: '$0.99' },
];

beforeEach(() => {
  mockInitConnection.mockReset().mockResolvedValue(true);
  mockEndConnection.mockReset().mockResolvedValue(undefined);
  mockFetchProducts.mockReset().mockResolvedValue(SAMPLE_PRODUCTS);
  mockRequestPurchase.mockReset().mockResolvedValue(null);
  mockFinishTransaction.mockReset().mockResolvedValue(undefined);
  mockPurchaseUpdated.mockReset().mockReturnValue({ remove: jest.fn() });
  mockPurchaseError.mockReset().mockReturnValue({ remove: jest.fn() });
});

afterEach(async () => {
  // Reset the module singleton between tests (no-op when never connected).
  await dispose();
});

describe('iapManager.initialize', () => {
  it('connects and fetches the catalog SKUs as in-app products', async () => {
    const products = await initialize();

    expect(mockInitConnection).toHaveBeenCalledTimes(1);
    expect(mockFetchProducts).toHaveBeenCalledWith({
      skus: [...PRODUCT_SKUS],
      type: 'in-app',
    });
    expect(products).toEqual(SAMPLE_PRODUCTS);
  });

  it('is idempotent — a second call does not reconnect or refetch', async () => {
    await initialize();
    await initialize();
    expect(mockInitConnection).toHaveBeenCalledTimes(1);
    expect(mockFetchProducts).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent callers onto ONE connect + fetch', async () => {
    // Launch init (RootNavigator) + ShopScreen mount can both call before
    // `initialized` flips. Promise.all fires both before any await resolves,
    // reproducing the race — the in-flight handle must collapse them to one
    // connect + one fetch (8.5.9 Codex finding).
    const [a, b] = await Promise.all([initialize(), initialize()]);
    expect(mockInitConnection).toHaveBeenCalledTimes(1);
    expect(mockFetchProducts).toHaveBeenCalledTimes(1);
    expect(a).toEqual(SAMPLE_PRODUCTS);
    expect(b).toEqual(SAMPLE_PRODUCTS);
  });

  it('retries on the next call after an in-flight init fails', async () => {
    // A failed run must clear the in-flight handle so a later call can retry
    // (not get stuck returning the rejected promise forever).
    mockFetchProducts.mockRejectedValueOnce(new Error('transient'));
    await expect(initialize()).rejects.toMatchObject({ code: 'PRODUCTS_FETCH_FAILED' });
    const products = await initialize();
    expect(products).toEqual(SAMPLE_PRODUCTS);
    expect(mockFetchProducts).toHaveBeenCalledTimes(2);
  });

  it('dispose() awaits an in-flight init, then tears down cleanly', async () => {
    // A dispose that races an in-flight init must let the run settle first,
    // so it closes the connection the run opened and does not leave a stale
    // `initialized` behind (8.5.9 Codex re-review SHOULD-FIX).
    let resolveFetch: (v: unknown) => void = () => {};
    mockFetchProducts.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const initP = initialize(); // suspended awaiting fetchProducts
    const disposeP = dispose(); // must await the in-flight init
    resolveFetch(SAMPLE_PRODUCTS); // let the run complete
    await initP;
    await disposeP;

    expect(mockEndConnection).toHaveBeenCalledTimes(1); // connection closed
    expect(() => getProducts()).toThrow(IapError); // state reset, no stale init
  });

  it('throws CONNECTION_FAILED when the store connection is refused', async () => {
    mockInitConnection.mockResolvedValue(false);
    await expect(initialize()).rejects.toMatchObject({ code: 'CONNECTION_FAILED' });
    expect(mockFetchProducts).not.toHaveBeenCalled();
  });

  it('throws CONNECTION_FAILED (wrapping the cause) when initConnection rejects', async () => {
    const native = new Error('native boom');
    mockInitConnection.mockRejectedValue(native);
    await expect(initialize()).rejects.toMatchObject({
      code: 'CONNECTION_FAILED',
      cause: native,
    });
  });

  it('throws PRODUCTS_FETCH_FAILED when the product query rejects', async () => {
    mockFetchProducts.mockRejectedValue(new Error('fetch boom'));
    await expect(initialize()).rejects.toBeInstanceOf(IapError);
    await expect(initialize()).rejects.toMatchObject({ code: 'PRODUCTS_FETCH_FAILED' });
  });

  it('caches an empty list when StoreKit returns null', async () => {
    mockFetchProducts.mockResolvedValue(null);
    const products = await initialize();
    expect(products).toEqual([]);
    expect(getProducts()).toEqual([]);
  });
});

describe('iapManager.getProducts', () => {
  it('returns the cached products after initialize', async () => {
    await initialize();
    expect(getProducts()).toEqual(SAMPLE_PRODUCTS);
  });

  it('throws NOT_INITIALIZED before initialize', () => {
    expect(() => getProducts()).toThrow(IapError);
    try {
      getProducts();
    } catch (e) {
      expect((e as IapError).code).toBe('NOT_INITIALIZED');
    }
  });
});

describe('iapManager.addTransactionListener', () => {
  it('registers a purchase-update listener', () => {
    addTransactionListener({ onPurchase: jest.fn() });
    expect(mockPurchaseUpdated).toHaveBeenCalledTimes(1);
    expect(mockPurchaseError).not.toHaveBeenCalled();
  });

  it('also registers an error listener when onError is provided', () => {
    addTransactionListener({ onPurchase: jest.fn(), onError: jest.fn() });
    expect(mockPurchaseUpdated).toHaveBeenCalledTimes(1);
    expect(mockPurchaseError).toHaveBeenCalledTimes(1);
  });

  it('the returned handle removes only its own registrations', () => {
    const removeUpdate = jest.fn();
    const removeError = jest.fn();
    mockPurchaseUpdated.mockReturnValue({ remove: removeUpdate });
    mockPurchaseError.mockReturnValue({ remove: removeError });

    const handle = addTransactionListener({ onPurchase: jest.fn(), onError: jest.fn() });
    handle.remove();

    expect(removeUpdate).toHaveBeenCalledTimes(1);
    expect(removeError).toHaveBeenCalledTimes(1);
  });
});

describe('iapManager.dispose', () => {
  it('removes tracked listeners and ends the connection', async () => {
    const removeUpdate = jest.fn();
    mockPurchaseUpdated.mockReturnValue({ remove: removeUpdate });

    await initialize();
    addTransactionListener({ onPurchase: jest.fn() });
    await dispose();

    expect(removeUpdate).toHaveBeenCalledTimes(1);
    expect(mockEndConnection).toHaveBeenCalledTimes(1);
  });

  it('resets state so getProducts throws NOT_INITIALIZED again', async () => {
    await initialize();
    await dispose();
    expect(() => getProducts()).toThrow(IapError);
  });

  it('is a no-op (no endConnection) when never initialized', async () => {
    await dispose();
    expect(mockEndConnection).not.toHaveBeenCalled();
  });
});

describe('iapManager.purchase / finishPurchase', () => {
  it('purchase() submits an in-app requestPurchase for the wire SKU', async () => {
    await purchase('com.ozgurcetintas.cipherbreaker.tokens_500');
    expect(mockRequestPurchase).toHaveBeenCalledWith({
      request: { apple: { sku: 'com.ozgurcetintas.cipherbreaker.tokens_500' } },
      type: 'in-app',
    });
  });

  it('finishPurchase() forwards the purchase + isConsumable flag', async () => {
    const fakePurchase = { id: 'txn-1' } as never;
    await finishPurchase(fakePurchase, true);
    expect(mockFinishTransaction).toHaveBeenCalledWith({
      purchase: fakePurchase,
      isConsumable: true,
    });
  });

  it('finishPurchase() swallows a finishTransaction failure (re-delivery is the fallback)', async () => {
    // The grant has already landed; a failed finish is non-fatal — StoreKit
    // re-delivers and the idempotent grant absorbs it. Must NOT reject.
    mockFinishTransaction.mockRejectedValue(new Error('finish boom'));
    await expect(finishPurchase({ id: 'txn-1' } as never, false)).resolves.toBeUndefined();
  });
});

describe('iapManager.setPurchaseHandler', () => {
  it('attaches the persistent listener once, no matter how many handlers are set', () => {
    setPurchaseHandler({ onPurchase: jest.fn(), onError: jest.fn() });
    setPurchaseHandler({ onPurchase: jest.fn(), onError: jest.fn() });
    expect(mockPurchaseUpdated).toHaveBeenCalledTimes(1);
    expect(mockPurchaseError).toHaveBeenCalledTimes(1);
  });

  it('routes purchase + error events to the current handler', () => {
    let updateCb: ((p: unknown) => void) | undefined;
    let errorCb: ((e: unknown) => void) | undefined;
    mockPurchaseUpdated.mockImplementation((cb: (p: unknown) => void) => {
      updateCb = cb;
      return { remove: jest.fn() };
    });
    mockPurchaseError.mockImplementation((cb: (e: unknown) => void) => {
      errorCb = cb;
      return { remove: jest.fn() };
    });

    const onPurchase = jest.fn();
    const onError = jest.fn();
    setPurchaseHandler({ onPurchase, onError });

    updateCb?.({ id: 'txn-1' });
    errorCb?.({ code: 'network-error' });
    expect(onPurchase).toHaveBeenCalledWith({ id: 'txn-1' });
    expect(onError).toHaveBeenCalledWith({ code: 'network-error' });
  });

  it('drops events when no handler is set (re-delivery with handler cleared)', () => {
    let updateCb: ((p: unknown) => void) | undefined;
    mockPurchaseUpdated.mockImplementation((cb: (p: unknown) => void) => {
      updateCb = cb;
      return { remove: jest.fn() };
    });
    const onPurchase = jest.fn();
    setPurchaseHandler({ onPurchase, onError: jest.fn() });
    setPurchaseHandler(null);

    expect(() => updateCb?.({ id: 'orphan' })).not.toThrow();
    expect(onPurchase).not.toHaveBeenCalled();
  });

  it('re-attaches the listener after dispose clears it', async () => {
    setPurchaseHandler({ onPurchase: jest.fn(), onError: jest.fn() });
    expect(mockPurchaseUpdated).toHaveBeenCalledTimes(1);
    await dispose();
    setPurchaseHandler({ onPurchase: jest.fn(), onError: jest.fn() });
    expect(mockPurchaseUpdated).toHaveBeenCalledTimes(2);
  });
});
