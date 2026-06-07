/**
 * Phase 8.5.3 — transaction structural validation.
 *
 * Covers the supplementary guard (NOT crypto — that's StoreKit native):
 * isApplePurchase narrowing, and validateTransaction accepting a
 * well-formed Apple `purchased` transaction while rejecting non-apple,
 * non-purchased, missing-id, missing-JWS, and unknown-product cases.
 * Sandbox environment must NOT cause rejection.
 *
 * No expo-iap mock needed: receiptValidator imports only TYPES from
 * expo-iap (erased at runtime) plus the real product catalog.
 */

import type { Purchase } from 'expo-iap';

import { isApplePurchase, validateTransaction } from '../receiptValidator';
import { toWireSku } from '../productCatalog';

function makePurchase(overrides: Record<string, unknown> = {}): Purchase {
  return {
    id: 'txn-1',
    transactionId: 'txn-1',
    originalTransactionIdentifierIOS: 'orig-1',
    productId: toWireSku('tokens_500'),
    purchaseState: 'purchased',
    purchaseToken: 'jws.signed.payload',
    transactionDate: 1_700_000_000_000,
    environmentIOS: 'Production',
    store: 'apple',
    platform: 'ios',
    quantity: 1,
    isAutoRenewing: false,
    ...overrides,
  } as unknown as Purchase;
}

describe('isApplePurchase', () => {
  it('is true for an apple-store purchase', () => {
    expect(isApplePurchase(makePurchase())).toBe(true);
  });

  it('is false for a non-apple store', () => {
    expect(isApplePurchase(makePurchase({ store: 'google' }))).toBe(false);
  });
});

describe('validateTransaction', () => {
  it('accepts a well-formed purchased Apple transaction', () => {
    expect(validateTransaction(makePurchase())).toBe(true);
  });

  it('accepts a sandbox transaction (environment is not a gate)', () => {
    expect(validateTransaction(makePurchase({ environmentIOS: 'Sandbox' }))).toBe(true);
  });

  it('rejects a non-apple purchase', () => {
    expect(validateTransaction(makePurchase({ store: 'google' }))).toBe(false);
  });

  it('rejects a non-purchased state (e.g. pending)', () => {
    expect(validateTransaction(makePurchase({ purchaseState: 'pending' }))).toBe(false);
  });

  it('rejects a missing transaction id', () => {
    expect(validateTransaction(makePurchase({ transactionId: '' }))).toBe(false);
  });

  it('rejects a missing JWS (purchaseToken)', () => {
    expect(validateTransaction(makePurchase({ purchaseToken: null }))).toBe(false);
  });

  it('rejects an unknown product not in the catalog', () => {
    expect(validateTransaction(makePurchase({ productId: 'com.someone.else.thing' }))).toBe(false);
  });
});
