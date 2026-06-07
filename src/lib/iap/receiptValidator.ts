/**
 * Phase 8.5.3 — transaction validation (client-side, no backend).
 *
 * Two layers of trust, and it's important to be precise about which one
 * lives here:
 *
 *   1. **Cryptographic verification — NOT here, done natively.** On iOS,
 *      StoreKit 2 verifies the JWS signature inside the OS *before*
 *      expo-iap ever emits the transaction to JS. A transaction that
 *      arrives via `purchaseUpdatedListener` is already
 *      StoreKit-verified by construction; a verification *failure*
 *      surfaces instead as the `purchase-verification-failed` error code
 *      (→ `VERIFICATION_FAILED`). This satisfies decision #2 ("client-
 *      side via StoreKit 2's built-in JWS verification") literally — we
 *      rely on the OS, and accept the bounded jailbreak-forge risk
 *      (8.5.1) rather than adding Apple server-to-server validation.
 *
 *   2. **Structural sanity — this module.** `validateTransaction` is a
 *      *supplementary* guard over the parsed transaction: it confirms
 *      the shape is what we expect (an Apple purchase, in the
 *      `purchased` state, with a known catalog product, a transaction
 *      id, and a JWS token present). It is NOT a re-implementation of
 *      signature verification — that's impossible client-side without
 *      Apple credentials and is already done by layer 1.
 *
 * Environment (`Sandbox` / `Production`) is informational only: we do
 * NOT reject sandbox transactions in production builds, because Apple's
 * App Review uses sandbox against production binaries (8.5.7/8.5.8 may
 * refine this).
 */

import { type Purchase, type PurchaseIOS } from 'expo-iap';

import { getProductBySku } from './productCatalog';

/**
 * Narrow a platform-agnostic `Purchase` to the iOS shape. The app is
 * iOS-only; we key on the non-deprecated `store` field (`'apple'`)
 * rather than the `@deprecated platform` field.
 */
export function isApplePurchase(purchase: Purchase): purchase is PurchaseIOS {
  return purchase.store === 'apple';
}

/**
 * Structural validation of a delivered transaction (see module header —
 * this is the supplementary guard, not signature verification). Returns
 * a plain boolean per the sub-phase contract; the specific failure
 * reason is logged so 8.5.8 sandbox debugging isn't blind to *why* a
 * transaction was rejected.
 */
export function validateTransaction(purchase: Purchase): boolean {
  if (!isApplePurchase(purchase)) {
    console.log('[iap] validateTransaction reject: not_apple_store', { store: purchase.store });
    return false;
  }
  if (purchase.purchaseState !== 'purchased') {
    console.log('[iap] validateTransaction reject: not_purchased', {
      state: purchase.purchaseState,
    });
    return false;
  }
  if (typeof purchase.transactionId !== 'string' || purchase.transactionId.length === 0) {
    console.log('[iap] validateTransaction reject: missing_transaction_id');
    return false;
  }
  // `purchaseToken` is the unified JWS on iOS; its absence means we never
  // received a signed payload, so treat the transaction as untrusted.
  if (typeof purchase.purchaseToken !== 'string' || purchase.purchaseToken.length === 0) {
    console.log('[iap] validateTransaction reject: missing_jws', {
      transactionId: purchase.transactionId,
    });
    return false;
  }
  if (getProductBySku(purchase.productId) === undefined) {
    console.log('[iap] validateTransaction reject: unknown_product', {
      productId: purchase.productId,
    });
    return false;
  }
  return true;
}
