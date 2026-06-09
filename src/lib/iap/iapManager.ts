/**
 * Phase 8.5.2 — IAP manager (foundation skeleton).
 *
 * Thin lifecycle wrapper over `expo-iap` (StoreKit 2, no backend). Owns
 * the store connection, the fetched-product cache, and the purchase
 * listeners — the seams the rest of Phase 8.5 builds on. Module-level
 * singleton (matching `sound.ts` / `jitTooltipManager.ts`): exactly one
 * StoreKit connection per app session.
 *
 * Surface:
 *   - `initialize`  — connect + fetch the catalog's products
 *   - `getProducts` — read the cached StoreKit products
 *   - `addTransactionListener` — general purchase update/error subscription
 *   - `setPurchaseHandler` — route the ONE persistent purchase listener to
 *     a handler (8.5.3 — `purchaseFlow` uses this; 8.5.6 keeps it set for
 *     re-delivery grants)
 *   - `purchase` / `finishPurchase` — initiate + finalize a transaction
 *   - `dispose`     — tear down listeners + connection
 *
 * `iapManager` is a transport layer: it owns the StoreKit connection and
 * the event plumbing but holds NO purchase business logic and mutates NO
 * app state. Validation, grant, and idempotency live in `purchaseFlow` /
 * `userStore` (8.5.3 / 8.5.4+).
 *
 * Explicitly NOT here (later sub-phases):
 *   - token grant / `iapHistory` (8.5.4 / 8.5.6)
 *   - Restore Purchases UI + entitlement application (8.5.7)
 *
 * Errors surface as typed `IapError`s so callers can branch on `.code`
 * instead of string-matching native messages.
 */

import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type Product as StoreProduct,
  type Purchase,
  // The listener delivers the richer error from `errorMapping`; the
  // top-level `PurchaseError` is a *different* (looser) type, so we
  // bind to the one the listener signature actually uses.
  type ExpoPurchaseError as PurchaseError,
} from 'expo-iap';

import { PRODUCT_SKUS } from './productCatalog';

/** Re-exported so purchase-flow code (8.5.3+) imports store types from
 *  one place rather than reaching into `expo-iap` directly. */
export type { StoreProduct, Purchase, PurchaseError };

export type IapErrorCode =
  | 'CONNECTION_FAILED'
  | 'PRODUCTS_FETCH_FAILED'
  | 'NOT_INITIALIZED';

/** Typed IAP failure. `code` is stable; `cause` keeps the native error. */
export class IapError extends Error {
  readonly code: IapErrorCode;
  override readonly cause?: unknown;

  constructor(code: IapErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'IapError';
    this.code = code;
    this.cause = cause;
  }
}

/** Subscription handle returned by `expo-iap` listeners. */
interface Subscription {
  remove: () => void;
}

/** Callbacks for the purchase event stream. `onError` is optional —
 *  callers that only care about successful updates can omit it. */
export interface TransactionListeners {
  readonly onPurchase: (purchase: Purchase) => void;
  readonly onError?: (error: PurchaseError) => void;
}

/** Handler the single persistent purchase listener routes events to. */
export interface PurchaseHandler {
  readonly onPurchase: (purchase: Purchase) => void;
  readonly onError: (error: PurchaseError) => void;
}

// ── module-singleton state ───────────────────────────────────────────
/** Native store connection is open (initConnection succeeded). */
let storeConnected = false;
/** Fully ready: connection open AND products fetched. Gates getProducts. */
let initialized = false;
let products: readonly StoreProduct[] = [];
const subscriptions: Subscription[] = [];

/** The current purchase handler, or null. Swapping this is a cheap
 *  variable assignment — we do NOT re-register expo-iap listeners per
 *  purchase (that would risk StoreKit re-emitting unfinished
 *  transactions onto a freshly-attached listener). */
let purchaseHandler: PurchaseHandler | null = null;
/** Set once the persistent purchase listener pair is attached. */
let purchaseListenerAttached = false;

/**
 * Connect to StoreKit and fetch the catalog's products. Idempotent: a
 * second call while already connected is a no-op (returns the cache).
 *
 * `type: 'in-app'` covers both consumables and the non-consumable
 * (Remove Ads); subscriptions would be `'subs'`, which this app has none
 * of. A null/empty StoreKit response is cached as `[]` — not an error
 * (e.g. unsigned Paid Apps Agreement returns an empty list, which the
 * UI handles as "unavailable" rather than a crash).
 *
 * @throws {IapError} `CONNECTION_FAILED` if the store won't connect,
 *   `PRODUCTS_FETCH_FAILED` if the product query throws.
 */
export async function initialize(): Promise<readonly StoreProduct[]> {
  if (initialized) return products;

  // Reuse an already-open connection (e.g. a prior call that connected
  // but failed at the fetch step) instead of reconnecting.
  if (!storeConnected) {
    let ok: boolean;
    try {
      ok = await initConnection();
    } catch (error) {
      throw new IapError('CONNECTION_FAILED', 'Failed to connect to the store.', error);
    }
    if (!ok) {
      throw new IapError('CONNECTION_FAILED', 'Store connection was refused.');
    }
    storeConnected = true;
  }

  // Atomic: only flip `initialized` once products are cached. A fetch
  // failure leaves the manager un-initialized so a later call retries
  // the fetch instead of returning an empty cache forever.
  try {
    const result = await fetchProducts({ skus: [...PRODUCT_SKUS], type: 'in-app' });
    products = (result ?? []) as readonly StoreProduct[];
  } catch (error) {
    throw new IapError('PRODUCTS_FETCH_FAILED', 'Failed to fetch products.', error);
  }
  initialized = true;

  return products;
}

/**
 * Cached StoreKit products from the last successful `initialize`.
 * @throws {IapError} `NOT_INITIALIZED` if called before `initialize`.
 */
export function getProducts(): readonly StoreProduct[] {
  if (!initialized) {
    throw new IapError('NOT_INITIALIZED', 'Call initialize() before getProducts().');
  }
  return products;
}

/**
 * Subscribe to the purchase event stream. Both the update and (optional)
 * error subscriptions are tracked so `dispose` tears them down. Returns
 * a handle that removes *only this* registration — use it for
 * component-scoped cleanup (e.g. a screen unmount) without killing the
 * whole connection.
 */
export function addTransactionListener(listeners: TransactionListeners): Subscription {
  const local: Subscription[] = [];

  const update = purchaseUpdatedListener(listeners.onPurchase);
  subscriptions.push(update);
  local.push(update);

  if (listeners.onError) {
    const error = purchaseErrorListener(listeners.onError);
    subscriptions.push(error);
    local.push(error);
  }

  return {
    remove: () => {
      for (const sub of local) {
        sub.remove();
        const idx = subscriptions.indexOf(sub);
        if (idx !== -1) subscriptions.splice(idx, 1);
      }
    },
  };
}

/**
 * Attach the single persistent purchase listener pair (idempotent). It
 * forwards every event to the *current* `purchaseHandler`; an event that
 * arrives with no handler set (StoreKit re-delivery of an unfinished
 * transaction, e.g. after an app kill) is logged and dropped here —
 * 8.5.6 will keep a handler installed to grant on re-delivery.
 */
function ensurePurchaseListener(): void {
  if (purchaseListenerAttached) return;

  const update = purchaseUpdatedListener((purchase) => {
    if (purchaseHandler) purchaseHandler.onPurchase(purchase);
    else console.log('[iap] purchase update with no handler (re-delivery?)', { id: purchase.id });
  });
  const error = purchaseErrorListener((err) => {
    if (purchaseHandler) purchaseHandler.onError(err);
    else console.log('[iap] purchase error with no handler', { code: err.code });
  });

  subscriptions.push(update, error);
  purchaseListenerAttached = true;
}

/**
 * Route the persistent purchase listener to `handler` (or clear it with
 * `null`). Attaches the listener on first use. `purchaseFlow` sets a
 * handler for the duration of a purchase and clears it on settle.
 */
export function setPurchaseHandler(handler: PurchaseHandler | null): void {
  ensurePurchaseListener();
  purchaseHandler = handler;
}

/**
 * Initiate a purchase for a wire SKU. expo-iap's `requestPurchase` is
 * event-based — the OS payment sheet drives it and the result arrives on
 * the persistent listener (success → `onPurchase`, failure → `onError`).
 * This call resolves once the request is *submitted*; it may still reject
 * synchronously if the store rejects the request outright.
 */
export async function purchase(wireSku: string): Promise<void> {
  await requestPurchase({ request: { apple: { sku: wireSku } }, type: 'in-app' });
}

/**
 * Finalize a transaction so StoreKit stops re-delivering it. MUST be
 * called only *after* the grant succeeds (8.5.6) — finishing before
 * granting would lose the entitlement on a crash. `isConsumable` decides
 * whether StoreKit keeps it in `currentEntitlements` (non-consumables) or
 * drops it (consumables); derive it from the catalog product type.
 *
 * Errors are swallowed (logged, not thrown): a failed `finishTransaction`
 * is non-fatal because the grant already landed and StoreKit will simply
 * re-deliver the unfinished transaction on the next launch, where the
 * idempotent `transactionId` dedup makes the re-grant a silent no-op.
 * Throwing here would only surface a confusing error *after* a successful
 * purchase.
 */
export async function finishPurchase(purchase: Purchase, isConsumable: boolean): Promise<void> {
  try {
    await finishTransaction({ purchase, isConsumable });
  } catch (error) {
    console.log('[iap] finishPurchase failed (transaction will re-deliver)', { isConsumable, error });
  }
}

/**
 * Tear everything down: remove all tracked listeners and close the store
 * connection. Safe to call when never initialized (no-op). Resets state
 * so a later `initialize` starts clean.
 */
export async function dispose(): Promise<void> {
  for (const sub of subscriptions) sub.remove();
  subscriptions.length = 0;
  purchaseHandler = null;
  purchaseListenerAttached = false;

  // Close the native connection even if init half-failed (connected but
  // products never fetched), so nothing is left dangling.
  if (storeConnected) {
    storeConnected = false;
    initialized = false;
    products = [];
    await endConnection();
  }
}
