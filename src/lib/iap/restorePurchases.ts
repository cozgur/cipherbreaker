/**
 * Phase 8.5.3 — Restore Purchases foundation (discovery only).
 *
 * `getEntitlements` reads the user's restorable purchases from StoreKit
 * via expo-iap's `getAvailablePurchases` and projects them to the app's
 * `Entitlement` shape. This is the DISCOVERY half of Restore Purchases;
 * 8.5.7 wires the UI button and *applies* the entitlements (flips
 * `adsRemoved` for a restored Remove Ads).
 *
 * Only NON-consumables are restorable: consumed token packs are gone
 * once finished and must not reappear here. We filter to catalog
 * non-consumables (today: Remove Ads). `onlyIncludeActiveItemsIOS`
 * scopes the StoreKit query to currently-held items.
 *
 * Failure throws a typed `IAPError` (unlike the purchase flow, which
 * returns a result); an empty result is `[]`, not an error.
 */

import { getAvailablePurchases } from 'expo-iap';

import { coerceIAPError } from './errors';
import { getProductBySku, type ProductId } from './productCatalog';
import { isApplePurchase } from './receiptValidator';

/** A restorable non-consumable entitlement the user currently holds. */
export interface Entitlement {
  readonly productId: ProductId;
  readonly transactionId: string;
  readonly purchaseDate: number;
  readonly environment: string;
}

/**
 * Discover restorable (non-consumable) entitlements, oldest purchase
 * first. Returns `[]` when the user holds none.
 * @throws {IAPError} when the StoreKit query fails.
 */
export async function getEntitlements(): Promise<Entitlement[]> {
  let purchases;
  try {
    purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
  } catch (thrown) {
    throw coerceIAPError(thrown, 'Failed to restore purchases.');
  }

  return purchases
    .filter(isApplePurchase)
    .filter((purchase) => getProductBySku(purchase.productId)?.type === 'non-consumable')
    .map((purchase) => ({
      // Non-null: the filter above confirmed the product resolves.
      productId: (getProductBySku(purchase.productId) as { productId: ProductId }).productId,
      transactionId: purchase.transactionId,
      purchaseDate: purchase.transactionDate,
      environment: purchase.environmentIOS ?? 'unknown',
    }))
    .sort((a, b) => a.purchaseDate - b.purchaseDate);
}
