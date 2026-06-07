/**
 * Phase 8.5.2 — IAP manager skeleton (expo-iap mocked).
 *
 * Covers the foundation lifecycle only (no purchase/restore yet):
 *   - initialize: connects, fetches the catalog SKUs as 'in-app',
 *     caches the result; idempotent on a second call; surfaces typed
 *     CONNECTION_FAILED / PRODUCTS_FETCH_FAILED; null fetch → [].
 *   - getProducts: returns the cache; throws NOT_INITIALIZED pre-init.
 *   - addTransactionListener: registers the update listener (and the
 *     error listener only when onError is given); the returned handle
 *     removes just its own registrations.
 *   - dispose: removes tracked listeners, ends the connection, and
 *     resets state so getProducts throws again.
 */

import {
  initConnection,
  endConnection,
  fetchProducts,
  purchaseUpdatedListener,
  purchaseErrorListener,
} from 'expo-iap';

import {
  initialize,
  getProducts,
  addTransactionListener,
  dispose,
  IapError,
} from '../iapManager';
import { PRODUCT_SKUS } from '../productCatalog';

jest.mock('expo-iap', () => ({
  initConnection: jest.fn(),
  endConnection: jest.fn(),
  fetchProducts: jest.fn(),
  purchaseUpdatedListener: jest.fn(),
  purchaseErrorListener: jest.fn(),
}));

const mockInitConnection = initConnection as unknown as jest.Mock;
const mockEndConnection = endConnection as unknown as jest.Mock;
const mockFetchProducts = fetchProducts as unknown as jest.Mock;
const mockPurchaseUpdated = purchaseUpdatedListener as unknown as jest.Mock;
const mockPurchaseError = purchaseErrorListener as unknown as jest.Mock;

const SAMPLE_PRODUCTS = [
  { id: 'com.ozgurcetintas.cipherbreaker.tokens_500', displayPrice: '$0.99' },
];

beforeEach(() => {
  mockInitConnection.mockReset().mockResolvedValue(true);
  mockEndConnection.mockReset().mockResolvedValue(undefined);
  mockFetchProducts.mockReset().mockResolvedValue(SAMPLE_PRODUCTS);
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
