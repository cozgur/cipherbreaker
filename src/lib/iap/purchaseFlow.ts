/**
 * Phase 8.5.3 / 8.5.6 — purchase flow orchestration + re-delivery.
 *
 * Owns ONE persistent purchase handler (installed at app launch by
 * `startPurchaseListener`) that every StoreKit purchase/error event flows
 * through. Two kinds of event arrive on it:
 *
 *   - **Solicited** — a `purchaseProduct` call is in flight and the event's
 *     SKU matches the `pending` registration. The result is handed back to
 *     that call's awaiter; the *caller* (ShopScreen) then runs
 *     `finalizePurchase` (grant + finish). `purchaseProduct` itself stays
 *     grant-free.
 *   - **Unsolicited** — a StoreKit re-delivery with no matching `pending`:
 *     an interrupted purchase, an Ask-to-Buy approval that arrived after the
 *     sheet closed, or an unfinished transaction replayed on relaunch.
 *     `finalizeUnsolicited` grants + finishes it silently so it stops
 *     re-delivering.
 *
 * Why one persistent handler (8.5.6) and not a per-purchase handler
 * (8.5.3): re-delivery can fire at *any* time — including at launch before
 * any purchase is initiated. A per-purchase `setPurchaseHandler` would
 * clobber the launch handler and drop re-deliveries on the floor. The
 * handler lives for the whole session; `pending` is the only per-purchase
 * state.
 *
 * Three solicited outcomes (StoreKit 2 + Ask-to-Buy reality):
 *   - `success` — verified `purchased` transaction → `VerifiedTransaction`
 *     (audit fields) + the raw purchase for the finish step.
 *   - `pending` — Ask-to-Buy parental approval; neither success nor error.
 *     Fires again later as an *unsolicited* event when approved.
 *   - `error`   — typed `IAPError`.
 *
 * Idempotency note: correlation is by wire SKU (one purchase in flight at a
 * time). The real safety net against double-grants is `grantIAPTokens`'
 * `transactionId` dedup — a re-delivery of an already-granted transaction
 * is a silent no-op, then still finished so it stops replaying.
 *
 * Runtime dependency edge: this module imports `useUserStore` (to grant);
 * `userStore` imports only the `VerifiedTransaction` *type* from here, so
 * the edge is one-directional and erased at runtime — no cycle.
 */

import {
  purchase as initiatePurchase,
  finishPurchase,
  setPurchaseHandler,
  type Purchase,
  type PurchaseError,
  type PurchaseHandler,
} from './iapManager';
import { getProductById, getProductBySku, type ProductId } from './productCatalog';
import { IAPError, coerceIAPError, fromPurchaseError, isPendingCode } from './errors';
import { isApplePurchase, validateTransaction } from './receiptValidator';
import { useUserStore, type UserStoreActions } from '@state/userStore';

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

/** Outcome of the grant step, surfaced back to the UI by `finalizePurchase`. */
type GrantResult = ReturnType<UserStoreActions['grantIAPTokens']>;

/** A solicited purchase awaiting its listener callback. */
interface Pending {
  readonly wireSku: string;
  readonly resolveOnce: (result: PurchaseResult) => void;
}

/** The single in-flight solicited purchase, or null. Doubles as the
 *  "one purchase at a time" guard. */
let pending: Pending | null = null;

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
 * The single persistent purchase handler. Routes a solicited event to the
 * in-flight `purchaseProduct` awaiter (the caller finalizes); routes
 * everything else to `finalizeUnsolicited` (re-delivery → grant + finish).
 */
const persistentHandler: PurchaseHandler = {
  onPurchase: (purchase) => {
    if (pending && purchase.productId === pending.wireSku) {
      // Solicited: hand the result to purchaseProduct; the caller
      // (ShopScreen) runs grant + finish via finalizePurchase.
      pending.resolveOnce(resultForPurchase(purchase));
      return;
    }
    // Unsolicited re-delivery — grant + finish here so StoreKit stops
    // replaying it.
    void finalizeUnsolicited(purchase);
  },
  onError: (error) => {
    if (pending) {
      pending.resolveOnce(resultForError(error));
      return;
    }
    // An error with no purchase in flight has nothing to recover.
    console.log('[iap] purchase error with no purchase in flight', { code: error.code });
  },
};

/**
 * Install the persistent purchase handler. Call once at app launch
 * (RootNavigator), BEFORE `iapManager.initialize`, so a transaction
 * re-delivered during launch is routed (not dropped). Idempotent —
 * `setPurchaseHandler` attaches the underlying expo-iap listener only once.
 */
export function startPurchaseListener(): void {
  setPurchaseHandler(persistentHandler);
}

/** Clear the persistent handler (test teardown / explicit shutdown). */
export function stopPurchaseListener(): void {
  setPurchaseHandler(null);
}

/**
 * Grant the transaction's entitlement, then finish the StoreKit
 * transaction so it stops re-delivering. Shared by the solicited path
 * (ShopScreen, after a `success` result) and the unsolicited path
 * (`finalizeUnsolicited`).
 *
 * Finish runs when the entitlement is recorded — either freshly granted
 * (`success`) or already credited by a prior delivery (`duplicate`). On
 * `invalid_product` the transaction is deliberately left UNfinished (we
 * don't grant for an unknown product, and finishing would discard it).
 *
 * `finishPurchase` swallows its own errors, so this never rejects on a
 * finish failure — the grant has already landed and a failed finish just
 * means one more harmless (idempotent) re-delivery.
 */
export async function finalizePurchase(
  transaction: VerifiedTransaction,
  rawPurchase: Purchase,
): Promise<GrantResult> {
  const grant = useUserStore.getState().grantIAPTokens(transaction);
  if (grant.success || grant.error === 'duplicate') {
    const product = getProductById(transaction.productId);
    await finishPurchase(rawPurchase, product?.type === 'consumable');
  }
  return grant;
}

/**
 * Handle an unsolicited (re-delivered) transaction: a transaction that
 * arrived with no matching in-flight purchase. If it fails validation
 * (forged/failed, or a still-pending Ask-to-Buy that isn't grantable yet)
 * it is logged and left unfinished — we cannot trust-grant it, and we will
 * not finish a transaction we didn't verify; StoreKit replays it until it
 * resolves natively. Otherwise it is granted + finished silently (no UI).
 */
export async function finalizeUnsolicited(purchase: Purchase): Promise<void> {
  if (!validateTransaction(purchase)) {
    console.log('[iap] unsolicited transaction not grantable (left unfinished)', {
      id: purchase.id,
      state: purchase.purchaseState,
    });
    return;
  }
  await finalizePurchase(toVerifiedTransaction(purchase), purchase);
}

/**
 * Purchase a catalog product by its short id. Resolves with a
 * `PurchaseResult`; never rejects (all failure modes map to an `error`
 * result). On `success` the caller runs `finalizePurchase` (grant +
 * finish) — this function stays grant-free so the solicited and
 * unsolicited paths share one grant point.
 *
 * Requires `startPurchaseListener` to have run (the persistent handler
 * delivers the result). Rejects a concurrent call — one purchase in flight
 * at a time.
 */
export async function purchaseProduct(productId: ProductId): Promise<PurchaseResult> {
  const product = getProductById(productId);
  if (product === undefined) {
    return {
      status: 'error',
      error: new IAPError('PRODUCT_NOT_FOUND', `Unknown product: ${productId}`),
    };
  }
  if (pending !== null) {
    return {
      status: 'error',
      error: new IAPError('UNKNOWN', 'A purchase is already in progress.'),
    };
  }

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
  pending = { wireSku, resolveOnce };

  try {
    await initiatePurchase(wireSku);
  } catch (thrown) {
    resolveOnce(resultForThrown(thrown));
  }

  try {
    return await done;
  } finally {
    pending = null;
  }
}
