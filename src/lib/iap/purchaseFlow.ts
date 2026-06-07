/**
 * Phase 8.5.3 — purchase flow orchestration.
 *
 * Drives a single purchase end-to-end on top of the `iapManager`
 * transport: validate the product, install a purchase handler, fire the
 * event-based `requestPurchase`, and resolve a three-state result when
 * the persistent listener reports back.
 *
 * Three outcomes (StoreKit 2 + Ask-to-Buy reality):
 *   - `success` — verified `purchased` transaction → `VerifiedTransaction`
 *     (audit fields) + the raw purchase for the later finish step.
 *   - `pending` — Ask-to-Buy parental approval; neither success nor
 *     error. The transaction fires again later when approved.
 *   - `error`   — typed `IAPError`.
 *
 * Boundaries this sub-phase respects:
 *   - NO token grant and NO `finishTransaction` here. The caller (8.5.5
 *     UI → 8.5.6 grant) invokes `grantIAPTokens` then `iapManager
 *     .finishPurchase` *after* a successful grant, so a crash mid-grant
 *     re-delivers rather than silently losing the entitlement. ⚠️ This
 *     means 8.5.5's UI wire must not run against device/sandbox before
 *     8.5.6 lands, or every purchase re-delivers unfinished forever.
 *   - Correlation is by wire SKU. A concurrent purchase is rejected (one
 *     in flight at a time), and a stale same-product re-delivery inside
 *     our window could resolve this purchase — the real safety net is
 *     8.5.6's transactionId idempotency on the grant, not correlation
 *     here. Documented as a known limit.
 */

import {
  purchase as initiatePurchase,
  setPurchaseHandler,
  type Purchase,
  type PurchaseError,
} from './iapManager';
import { getProductById, getProductBySku, type ProductId } from './productCatalog';
import { IAPError, coerceIAPError, fromPurchaseError, isPendingCode } from './errors';
import { isApplePurchase, validateTransaction } from './receiptValidator';

/** Audit-relevant fields lifted from a verified iOS transaction. The
 *  full persisted schema (incl. expiration) lands in 8.5.4; `productId`
 *  is the short catalog id (resolved from the wire SKU). */
export interface VerifiedTransaction {
  readonly transactionId: string;
  readonly originalTransactionId: string;
  readonly productId: ProductId;
  readonly purchaseDate: number;
  readonly environment: string;
  readonly appAccountToken?: string;
}

export type PurchaseResult =
  | { readonly status: 'success'; readonly transaction: VerifiedTransaction; readonly rawPurchase: Purchase }
  | { readonly status: 'pending' }
  | { readonly status: 'error'; readonly error: IAPError };

/** One purchase at a time — StoreKit's payment sheet is modal, but guard
 *  defensively against rapid double-taps before the sheet appears. */
let inFlight = false;

/** Extract audit fields from a verified iOS purchase. Caller guarantees
 *  `validateTransaction` passed, so the catalog lookup resolves. */
function toVerifiedTransaction(purchase: Purchase): VerifiedTransaction {
  // `isApplePurchase` narrowing is established by validateTransaction;
  // re-narrow here for type access to the iOS-specific fields.
  const ios = isApplePurchase(purchase) ? purchase : null;
  const product = getProductBySku(purchase.productId);
  return {
    transactionId: ios?.transactionId ?? purchase.id,
    originalTransactionId: ios?.originalTransactionIdentifierIOS ?? ios?.transactionId ?? purchase.id,
    // Resolvable because validateTransaction confirmed the product.
    productId: (product as { productId: ProductId }).productId,
    purchaseDate: purchase.transactionDate,
    environment: ios?.environmentIOS ?? 'unknown',
    appAccountToken: ios?.appAccountToken ?? undefined,
  };
}

/** Map a settled purchase event to a result. */
function resultForPurchase(purchase: Purchase): PurchaseResult {
  if (purchase.purchaseState === 'pending') {
    return { status: 'pending' };
  }
  if (!validateTransaction(purchase)) {
    return {
      status: 'error',
      error: new IAPError('VERIFICATION_FAILED', 'Transaction failed validation.'),
    };
  }
  return { status: 'success', transaction: toVerifiedTransaction(purchase), rawPurchase: purchase };
}

/** Map an error event to a result (pending states are not errors). */
function resultForError(error: PurchaseError): PurchaseResult {
  if (error.code !== undefined && isPendingCode(error.code)) return { status: 'pending' };
  return { status: 'error', error: fromPurchaseError(error) };
}

/** Map an unknown thrown value (sync reject from `requestPurchase`). */
function resultForThrown(thrown: unknown): PurchaseResult {
  if (
    thrown !== null &&
    typeof thrown === 'object' &&
    'code' in thrown &&
    isPendingCode(String((thrown as { code: unknown }).code))
  ) {
    return { status: 'pending' };
  }
  return { status: 'error', error: coerceIAPError(thrown, 'Purchase failed.') };
}

/**
 * Purchase a catalog product by its short id. Resolves with a
 * `PurchaseResult`; never rejects (all failure modes map to an `error`
 * result). The grant + finish steps are the caller's responsibility
 * (8.5.6).
 */
export async function purchaseProduct(productId: ProductId): Promise<PurchaseResult> {
  const product = getProductById(productId);
  if (product === undefined) {
    return {
      status: 'error',
      error: new IAPError('PRODUCT_NOT_FOUND', `Unknown product: ${productId}`),
    };
  }
  if (inFlight) {
    return {
      status: 'error',
      error: new IAPError('UNKNOWN', 'A purchase is already in progress.'),
    };
  }
  inFlight = true;

  const wireSku = product.sku;
  let settle: (result: PurchaseResult) => void;
  const done = new Promise<PurchaseResult>((resolve) => {
    settle = resolve;
  });
  let settled = false;
  const resolveOnce = (result: PurchaseResult): void => {
    if (settled) return;
    settled = true;
    settle(result);
  };

  setPurchaseHandler({
    onPurchase: (purchase) => {
      // Correlate by wire SKU; ignore unrelated re-deliveries this window.
      if (purchase.productId !== wireSku) return;
      resolveOnce(resultForPurchase(purchase));
    },
    onError: (error) => {
      resolveOnce(resultForError(error));
    },
  });

  try {
    await initiatePurchase(wireSku);
  } catch (thrown) {
    resolveOnce(resultForThrown(thrown));
  }

  try {
    return await done;
  } finally {
    setPurchaseHandler(null);
    inFlight = false;
  }
}
