/**
 * Phase 8.5.2 — IAP product catalog (single source of truth).
 *
 * Five products ship: four consumable token packs (Pocket / Standard /
 * Premium / Mega) and one non-consumable (Remove Ads). This module owns
 * the canonical list; `ShopScreen` (8.5.5) and `iapManager` (this
 * sub-phase) both consume it instead of re-declaring product data.
 *
 * Two identifier representations, deliberately split:
 *   - `ProductId` (short, e.g. `'tokens_500'`) — the *internal*
 *     discriminant. It drives the discriminated union, `getProductById`,
 *     and badge mapping. Ergonomic for code; never sent to the store.
 *   - `WireSku` (full reverse-DNS, e.g.
 *     `'com.ozgurcetintas.cipherbreaker.tokens_500'`) — the string passed
 *     to StoreKit / App Store Connect. ASC product IDs are permanent and
 *     must match this byte-for-byte.
 *
 * The wire SKU is *derived* from the short id + `SKU_PREFIX` (never hand
 * typed per entry) so the two representations can't drift. `SKU_PREFIX`
 * follows the current bundle id `com.ozgurcetintas.cipherbreaker`
 * (Phase 8.4) — superseding the pre-8.4 `com.cipherbreaker.*` namespace
 * the Phase 7A.5 `IAP_REMOVE_ADS_PRODUCT_ID` placeholder used.
 *
 * Prices here are display-only fallbacks; the authoritative localized
 * price comes from StoreKit at runtime (`Product.displayPrice`). Actual
 * purchase / grant wiring is 8.5.3+ — this module is data only.
 */

/** Reverse-DNS namespace for every StoreKit product id. Matches the
 *  app bundle identifier (`app.json` → `ios.bundleIdentifier`). */
export const SKU_PREFIX = 'com.ozgurcetintas.cipherbreaker.' as const;

/** Internal short identifier — the discriminant used throughout the app. */
export type ProductId =
  | 'tokens_500'
  | 'tokens_1500'
  | 'tokens_5000'
  | 'tokens_15000'
  | 'remove_ads';

/** Short id of a consumable pack (everything except Remove Ads). */
export type ConsumableProductId = Exclude<ProductId, 'remove_ads'>;

/** Full App Store Connect / StoreKit product identifier (wire string). */
export type WireSku = `${typeof SKU_PREFIX}${ProductId}`;

/** A purchasable consumable token pack. `tokenAmount` is required. */
export interface ConsumableProduct {
  readonly productId: ConsumableProductId;
  readonly sku: WireSku;
  readonly type: 'consumable';
  readonly displayName: string;
  /** Display-only fallback; StoreKit's localized price is authoritative. */
  readonly displayPrice: string;
  /** Tokens credited on a verified purchase (8.5.6). */
  readonly tokenAmount: number;
  readonly badge?: 'MOST POPULAR' | 'BEST VALUE';
}

/** The single non-consumable. No `tokenAmount` — it flips `adsRemoved`. */
export interface NonConsumableProduct {
  readonly productId: 'remove_ads';
  readonly sku: WireSku;
  readonly type: 'non-consumable';
  readonly displayName: string;
  readonly displayPrice: string;
}

export type Product = ConsumableProduct | NonConsumableProduct;

/** Derive the wire SKU for a short id. The only place the two join. */
export function toWireSku(productId: ProductId): WireSku {
  return `${SKU_PREFIX}${productId}`;
}

export const PRODUCT_CATALOG: readonly Product[] = [
  {
    productId: 'tokens_500',
    sku: toWireSku('tokens_500'),
    type: 'consumable',
    displayName: 'Pocket Pack',
    displayPrice: '$0.99',
    tokenAmount: 500,
  },
  {
    productId: 'tokens_1500',
    sku: toWireSku('tokens_1500'),
    type: 'consumable',
    displayName: 'Standard Pack',
    displayPrice: '$2.99',
    tokenAmount: 1500,
    badge: 'MOST POPULAR',
  },
  {
    productId: 'tokens_5000',
    sku: toWireSku('tokens_5000'),
    type: 'consumable',
    displayName: 'Premium Pack',
    displayPrice: '$7.99',
    tokenAmount: 5000,
  },
  {
    productId: 'tokens_15000',
    sku: toWireSku('tokens_15000'),
    type: 'consumable',
    displayName: 'Mega Pack',
    displayPrice: '$19.99',
    tokenAmount: 15000,
    badge: 'BEST VALUE',
  },
  {
    productId: 'remove_ads',
    sku: toWireSku('remove_ads'),
    type: 'non-consumable',
    displayName: 'Remove Ads',
    displayPrice: '$2.99',
  },
] as const;

/** Short ids, catalog order. */
export const PRODUCT_IDS: readonly ProductId[] = PRODUCT_CATALOG.map((p) => p.productId);

/** Wire SKUs, catalog order — pass to `fetchProducts({ skus })`. */
export const PRODUCT_SKUS: readonly WireSku[] = PRODUCT_CATALOG.map((p) => p.sku);

/** Look up a catalog entry by its short id. */
export function getProductById(id: ProductId): Product | undefined {
  return PRODUCT_CATALOG.find((p) => p.productId === id);
}

/** Reverse lookup by wire SKU — the purchase listener (8.5.3+) receives
 *  the wire string from StoreKit and needs to resolve it to a catalog
 *  entry to know how many tokens to grant. */
export function getProductBySku(sku: string): Product | undefined {
  return PRODUCT_CATALOG.find((p) => p.sku === sku);
}
