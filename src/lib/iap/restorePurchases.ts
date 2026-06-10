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
    // Only grant from a settled entitlement with a real id. `getAvailablePurchases`
    // can surface unfinished / still-pending rows (e.g. an Ask-to-Buy `remove_ads`
    // awaiting approval); granting one would flip `adsRemoved` for a purchase that
    // hasn't completed. `purchaseState === 'purchased'` + a non-empty
    // `transactionId` are the fields guaranteed present on an owned entitlement, so
    // this is over-rejection-safe. We deliberately do NOT require the JWS
    // (`purchaseToken`) here the way a live purchase event does: restore rows come
    // from StoreKit's already-verified `currentEntitlements`, and whether expo-iap
    // repopulates the JWS on the query path is unverified until the 8.6 restore
    // device pass (obligation 4) — JWS-strictness lands there, not before.
    .filter((purchase) => purchase.purchaseState === 'purchased')
    .filter((purchase) => typeof purchase.transactionId === 'string' && purchase.transactionId.length > 0)
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
