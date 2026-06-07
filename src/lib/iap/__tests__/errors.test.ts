/**
 * Phase 8.5.3 — IAP error taxonomy.
 *
 * Covers: expo-iap ErrorCode → IAPErrorCode mapping (each bucket +
 * unmapped/empty → UNKNOWN), pending-code detection, IAPError field
 * preservation, fromPurchaseError (incl. undefined code), and
 * coerceIAPError across passthrough / code-shaped / plain / non-object.
 */

import { ErrorCode } from 'expo-iap';

import {
  IAPError,
  coerceIAPError,
  fromPurchaseError,
  isPendingCode,
  mapExpoErrorCode,
} from '../errors';

jest.mock('expo-iap');

describe('mapExpoErrorCode', () => {
  it('maps cancellation', () => {
    expect(mapExpoErrorCode(ErrorCode.UserCancelled)).toBe('USER_CANCELLED');
  });

  it('maps connectivity codes to NETWORK_ERROR', () => {
    for (const code of [
      ErrorCode.NetworkError,
      ErrorCode.ServiceTimeout,
      ErrorCode.ServiceDisconnected,
      ErrorCode.ConnectionClosed,
      ErrorCode.ServiceError,
      ErrorCode.RemoteError,
    ]) {
      expect(mapExpoErrorCode(code)).toBe('NETWORK_ERROR');
    }
  });

  it('maps product-availability codes to PRODUCT_NOT_FOUND', () => {
    for (const code of [
      ErrorCode.SkuNotFound,
      ErrorCode.ItemUnavailable,
      ErrorCode.EmptySkuList,
      ErrorCode.QueryProduct,
    ]) {
      expect(mapExpoErrorCode(code)).toBe('PRODUCT_NOT_FOUND');
    }
  });

  it('maps verification codes to VERIFICATION_FAILED', () => {
    for (const code of [
      ErrorCode.PurchaseVerificationFailed,
      ErrorCode.PurchaseVerificationFinishFailed,
      ErrorCode.TransactionValidationFailed,
    ]) {
      expect(mapExpoErrorCode(code)).toBe('VERIFICATION_FAILED');
    }
  });

  it('maps duplicate/owned codes to DUPLICATE_TRANSACTION', () => {
    expect(mapExpoErrorCode(ErrorCode.DuplicatePurchase)).toBe('DUPLICATE_TRANSACTION');
    expect(mapExpoErrorCode(ErrorCode.AlreadyOwned)).toBe('DUPLICATE_TRANSACTION');
  });

  it('falls back to UNKNOWN for unmapped or empty codes', () => {
    expect(mapExpoErrorCode(ErrorCode.Unknown)).toBe('UNKNOWN');
    expect(mapExpoErrorCode(ErrorCode.DeveloperError)).toBe('UNKNOWN');
    expect(mapExpoErrorCode('')).toBe('UNKNOWN');
    expect(mapExpoErrorCode('totally-made-up')).toBe('UNKNOWN');
  });

  it('does not map reserved payment codes (no expo-iap source)', () => {
    // PAYMENT_INVALID / PAYMENT_NOT_ALLOWED are reserved but unproduced.
    const produced = [
      ErrorCode.UserCancelled,
      ErrorCode.NetworkError,
      ErrorCode.SkuNotFound,
      ErrorCode.PurchaseVerificationFailed,
      ErrorCode.DuplicatePurchase,
    ].map(mapExpoErrorCode);
    expect(produced).not.toContain('PAYMENT_INVALID');
    expect(produced).not.toContain('PAYMENT_NOT_ALLOWED');
  });
});

describe('isPendingCode', () => {
  it('is true for deferred/pending states', () => {
    expect(isPendingCode(ErrorCode.DeferredPayment)).toBe(true);
    expect(isPendingCode(ErrorCode.Pending)).toBe(true);
  });

  it('is false for real failures', () => {
    expect(isPendingCode(ErrorCode.UserCancelled)).toBe(false);
    expect(isPendingCode(ErrorCode.NetworkError)).toBe(false);
    expect(isPendingCode('')).toBe(false);
  });
});

describe('IAPError', () => {
  it('preserves code, message, and originalError', () => {
    const original = new Error('native');
    const err = new IAPError('NETWORK_ERROR', 'no signal', original);
    expect(err.code).toBe('NETWORK_ERROR');
    expect(err.message).toBe('no signal');
    expect(err.originalError).toBe(original);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('IAPError');
  });
});

describe('fromPurchaseError', () => {
  it('maps code and preserves the source error', () => {
    const pe = { code: ErrorCode.UserCancelled, message: 'user backed out', name: 'PurchaseError' };
    const err = fromPurchaseError(pe);
    expect(err.code).toBe('USER_CANCELLED');
    expect(err.message).toBe('user backed out');
    expect(err.originalError).toBe(pe);
  });

  it('treats an undefined code as UNKNOWN', () => {
    const err = fromPurchaseError({ code: undefined, message: 'mystery', name: 'PurchaseError' });
    expect(err.code).toBe('UNKNOWN');
  });
});

describe('coerceIAPError', () => {
  it('passes an existing IAPError through unchanged', () => {
    const original = new IAPError('PRODUCT_NOT_FOUND', 'gone');
    expect(coerceIAPError(original)).toBe(original);
  });

  it('maps a code-shaped error', () => {
    const err = coerceIAPError({ code: ErrorCode.NetworkError, message: 'offline' });
    expect(err.code).toBe('NETWORK_ERROR');
    expect(err.message).toBe('offline');
  });

  it('wraps a plain Error as UNKNOWN, keeping its message', () => {
    const err = coerceIAPError(new Error('boom'));
    expect(err.code).toBe('UNKNOWN');
    expect(err.message).toBe('boom');
  });

  it('uses the fallback message for non-objects', () => {
    const err = coerceIAPError('weird', 'fallback msg');
    expect(err.code).toBe('UNKNOWN');
    expect(err.message).toBe('fallback msg');
  });
});
