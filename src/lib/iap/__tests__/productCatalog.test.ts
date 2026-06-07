/**
 * Phase 8.5.2 — IAP product catalog.
 *
 * Covers:
 *   - Shape: 5 products, consumables carry a positive tokenAmount,
 *     the lone non-consumable (remove_ads) carries none.
 *   - Badges: MOST POPULAR → tokens_1500, BEST VALUE → tokens_15000,
 *     and only those two.
 *   - Identifiers: short ids + derived wire SKUs are unique, every
 *     SKU is `SKU_PREFIX + shortId`, and the two id arrays line up.
 *   - Lookups: getProductById (short) and getProductBySku (wire),
 *     including the undefined miss path.
 */

import {
  PRODUCT_CATALOG,
  PRODUCT_IDS,
  PRODUCT_SKUS,
  SKU_PREFIX,
  getProductById,
  getProductBySku,
  toWireSku,
  type ConsumableProduct,
  type ProductId,
} from '../productCatalog';

describe('productCatalog', () => {
  describe('shape', () => {
    it('exports exactly 5 products', () => {
      expect(PRODUCT_CATALOG).toHaveLength(5);
    });

    it('has four consumables, each with a positive tokenAmount', () => {
      const consumables = PRODUCT_CATALOG.filter((p) => p.type === 'consumable');
      expect(consumables).toHaveLength(4);
      for (const p of consumables) {
        // Narrowing on the discriminant exposes tokenAmount.
        expect(p.type === 'consumable' && p.tokenAmount > 0).toBe(true);
      }
    });

    it('has exactly one non-consumable (remove_ads) with no tokenAmount', () => {
      const nonConsumables = PRODUCT_CATALOG.filter((p) => p.type === 'non-consumable');
      expect(nonConsumables).toHaveLength(1);
      const removeAds = getProductById('remove_ads');
      expect(removeAds?.type).toBe('non-consumable');
      expect(removeAds !== undefined && 'tokenAmount' in removeAds).toBe(false);
    });

    it('maps the four pack token amounts correctly', () => {
      const amounts = PRODUCT_CATALOG.filter((p) => p.type === 'consumable').map((p) =>
        p.type === 'consumable' ? p.tokenAmount : -1,
      );
      expect(amounts).toEqual([500, 1500, 5000, 15000]);
    });
  });

  describe('badges', () => {
    const consumables = PRODUCT_CATALOG.filter(
      (p): p is ConsumableProduct => p.type === 'consumable',
    );
    const byId = (id: string): ConsumableProduct | undefined =>
      consumables.find((p) => p.productId === id);

    it('assigns MOST POPULAR to tokens_1500', () => {
      expect(byId('tokens_1500')?.badge).toBe('MOST POPULAR');
    });

    it('assigns BEST VALUE to tokens_15000', () => {
      expect(byId('tokens_15000')?.badge).toBe('BEST VALUE');
    });

    it('leaves the other three products unbadged', () => {
      const badged = consumables.filter((p) => p.badge !== undefined);
      const ids = badged.map((p) => p.productId);
      expect(ids).toHaveLength(2);
      expect(ids).toContain('tokens_1500');
      expect(ids).toContain('tokens_15000');
    });
  });

  describe('identifiers', () => {
    it('PRODUCT_IDS lists all five short ids in catalog order', () => {
      expect(PRODUCT_IDS).toEqual([
        'tokens_500',
        'tokens_1500',
        'tokens_5000',
        'tokens_15000',
        'remove_ads',
      ]);
    });

    it('derives every wire SKU as SKU_PREFIX + shortId', () => {
      for (const p of PRODUCT_CATALOG) {
        expect(p.sku).toBe(`${SKU_PREFIX}${p.productId}`);
        expect(p.sku.startsWith('com.ozgurcetintas.cipherbreaker.')).toBe(true);
      }
    });

    it('PRODUCT_SKUS matches the catalog skus in order', () => {
      expect(PRODUCT_SKUS).toEqual(PRODUCT_CATALOG.map((p) => p.sku));
    });

    it('toWireSku composes the prefix and short id', () => {
      expect(toWireSku('tokens_500')).toBe('com.ozgurcetintas.cipherbreaker.tokens_500');
      expect(toWireSku('remove_ads')).toBe('com.ozgurcetintas.cipherbreaker.remove_ads');
    });

    it('short ids and wire SKUs are each unique', () => {
      expect(new Set(PRODUCT_IDS).size).toBe(PRODUCT_IDS.length);
      expect(new Set(PRODUCT_SKUS).size).toBe(PRODUCT_SKUS.length);
    });
  });

  describe('lookups', () => {
    it('getProductById returns the matching entry', () => {
      const p = getProductById('tokens_5000');
      expect(p?.productId).toBe('tokens_5000');
      expect(p?.displayName).toBe('Premium Pack');
    });

    it('getProductById returns undefined for an unknown id', () => {
      expect(getProductById('tokens_999' as ProductId)).toBeUndefined();
    });

    it('getProductBySku resolves a wire SKU to its entry', () => {
      const p = getProductBySku('com.ozgurcetintas.cipherbreaker.tokens_15000');
      expect(p?.productId).toBe('tokens_15000');
    });

    it('getProductBySku returns undefined for an unknown SKU', () => {
      expect(getProductBySku('com.someone.else.tokens_500')).toBeUndefined();
      expect(getProductBySku('tokens_500')).toBeUndefined();
    });
  });
});
