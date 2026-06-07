/**
 * Phase 8.5.3 — Restore Purchases discovery.
 *
 * Covers: non-consumables returned, consumables filtered out, empty →
 * [], a failed StoreKit query → typed IAPError, and ordering by
 * purchaseDate. expo-iap mocked (manual mock) to control
 * getAvailablePurchases.
 */

import { getAvailablePurchases } from 'expo-iap';

import { getEntitlements } from '../restorePurchases';
import { IAPError } from '../errors';
import { toWireSku, type ProductId } from '../productCatalog';

jest.mock('expo-iap');

const mockGetAvailable = getAvailablePurchases as unknown as jest.Mock;

function makePurchase(short: ProductId, overrides: Record<string, unknown> = {}): unknown {
  return {
    id: `txn-${short}`,
    transactionId: `txn-${short}`,
    originalTransactionIdentifierIOS: `orig-${short}`,
    productId: toWireSku(short),
    purchaseState: 'purchased',
    purchaseToken: 'jws',
    transactionDate: 1_700_000_000_000,
    environmentIOS: 'Production',
    store: 'apple',
    platform: 'ios',
    quantity: 1,
    isAutoRenewing: false,
    ...overrides,
  };
}

beforeEach(() => {
  mockGetAvailable.mockReset().mockResolvedValue([]);
});

describe('getEntitlements', () => {
  it('returns only non-consumable entitlements, filtering consumables', async () => {
    mockGetAvailable.mockResolvedValue([
      makePurchase('tokens_500'), // consumable — filtered
      makePurchase('remove_ads'), // non-consumable — kept
    ]);
    const entitlements = await getEntitlements();
    expect(entitlements).toHaveLength(1);
    expect(entitlements[0]?.productId).toBe('remove_ads');
    expect(entitlements[0]?.transactionId).toBe('txn-remove_ads');
  });

  it('scopes the query to active items', async () => {
    await getEntitlements();
    expect(mockGetAvailable).toHaveBeenCalledWith({ onlyIncludeActiveItemsIOS: true });
  });

  it('returns an empty array when nothing is held (not an error)', async () => {
    mockGetAvailable.mockResolvedValue([]);
    await expect(getEntitlements()).resolves.toEqual([]);
  });

  it('orders multiple entitlements by purchaseDate ascending', async () => {
    mockGetAvailable.mockResolvedValue([
      makePurchase('remove_ads', { transactionId: 'newer', transactionDate: 200 }),
      makePurchase('remove_ads', { transactionId: 'older', transactionDate: 100 }),
    ]);
    const entitlements = await getEntitlements();
    expect(entitlements.map((e) => e.purchaseDate)).toEqual([100, 200]);
    expect(entitlements[0]?.transactionId).toBe('older');
  });

  it('throws a typed IAPError when the StoreKit query fails', async () => {
    mockGetAvailable.mockRejectedValue({ code: 'network-error', message: 'offline' });
    await expect(getEntitlements()).rejects.toBeInstanceOf(IAPError);
    await expect(getEntitlements()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});
