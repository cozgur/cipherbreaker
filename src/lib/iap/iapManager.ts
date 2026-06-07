/**
 * Phase 8.5.2 — IAP manager (foundation skeleton).
 *
 * Thin lifecycle wrapper over `expo-iap` (StoreKit 2, no backend). Owns
 * the store connection, the fetched-product cache, and the purchase
 * listeners — the seams the rest of Phase 8.5 builds on. Module-level
 * singleton (matching `sound.ts` / `jitTooltipManager.ts`): exactly one
 * StoreKit connection per app session.
 *
 * Scope this sub-phase is *foundation only*:
 *   - `initialize`  — connect + fetch the catalog's products
 *   - `getProducts` — read the cached StoreKit products
 *   - `addTransactionListener` — subscribe to purchase updates/errors
 *   - `dispose`     — tear down listeners + connection
 *
 * Explicitly NOT here (later sub-phases):
 *   - purchase flow + receipt validation (8.5.3)
 *   - token grant / `iapHistory` (8.5.4 / 8.5.6)
 *   - Restore Purchases (8.5.7)
 *
 * Errors surface as typed `IapError`s so callers can branch on `.code`
 * instead of string-matching native messages.
 */

import {
  initConnection,
  endConnection,
  fetchProducts,
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

// ── module-singleton state ───────────────────────────────────────────
/** Native store connection is open (initConnection succeeded). */
let storeConnected = false;
/** Fully ready: connection open AND products fetched. Gates getProducts. */
let initialized = false;
let products: readonly StoreProduct[] = [];
const subscriptions: Subscription[] = [];

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
 * Tear everything down: remove all tracked listeners and close the store
 * connection. Safe to call when never initialized (no-op). Resets state
 * so a later `initialize` starts clean.
 */
export async function dispose(): Promise<void> {
  for (const sub of subscriptions) sub.remove();
  subscriptions.length = 0;

  // Close the native connection even if init half-failed (connected but
  // products never fetched), so nothing is left dangling.
  if (storeConnected) {
    storeConnected = false;
    initialized = false;
    products = [];
    await endConnection();
  }
}
