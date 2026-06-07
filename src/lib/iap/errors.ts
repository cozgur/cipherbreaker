/**
 * Phase 8.5.3 — typed IAP error taxonomy.
 *
 * `expo-iap` surfaces failures through `purchaseErrorListener` (and
 * rejected mutations) carrying an OpenIAP `ErrorCode` string. Those
 * codes are fine-grained and platform-spanning; the app wants a small,
 * stable taxonomy it can branch on. `IAPError` is that wrapper, and
 * `mapExpoErrorCode` is the single translation point.
 *
 * Note on coverage: StoreKit 1's granular SKError payment codes
 * (`paymentInvalid`, `paymentNotAllowed`) are NOT individually exposed
 * by expo-iap's OpenIAP error set, so `PAYMENT_INVALID` /
 * `PAYMENT_NOT_ALLOWED` are reserved in the union (for clarity + a
 * future server-validation layer) but are not currently produced by the
 * mapping — unmapped codes fall through to `UNKNOWN`.
 *
 * Pending / deferred states (Ask-to-Buy parental approval) are NOT
 * errors — the purchase flow intercepts them as a `pending` result
 * before they ever reach this mapping. `isPendingCode` exists so callers
 * can make that distinction.
 */

// The error the purchase listener delivers is `errorMapping`'s
// `PurchaseError` (code optional), NOT the top-level one — bind to it so
// our mapping matches what actually arrives at runtime.
import { ErrorCode, type ExpoPurchaseError as PurchaseError } from 'expo-iap';

export type IAPErrorCode =
  | 'USER_CANCELLED'
  | 'PAYMENT_INVALID'
  | 'PAYMENT_NOT_ALLOWED'
  | 'PRODUCT_NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'VERIFICATION_FAILED'
  | 'DUPLICATE_TRANSACTION'
  | 'UNKNOWN';

/** App-facing IAP failure. `originalError` preserves the source error
 *  (expo-iap `PurchaseError`, a thrown native error, etc.) for logs. */
export class IAPError extends Error {
  readonly code: IAPErrorCode;
  readonly originalError?: unknown;

  constructor(code: IAPErrorCode, message: string, originalError?: unknown) {
    super(message);
    this.name = 'IAPError';
    this.code = code;
    this.originalError = originalError;
  }
}

/** expo-iap codes that mean "awaiting external approval", not failure. */
const PENDING_CODES: ReadonlySet<string> = new Set([
  ErrorCode.DeferredPayment,
  ErrorCode.Pending,
]);

/** True for Ask-to-Buy / deferred states the flow should treat as
 *  pending rather than mapping to an `IAPError`. */
export function isPendingCode(code: string): boolean {
  return PENDING_CODES.has(code);
}

const CODE_MAP: Readonly<Record<string, IAPErrorCode>> = {
  [ErrorCode.UserCancelled]: 'USER_CANCELLED',

  [ErrorCode.NetworkError]: 'NETWORK_ERROR',
  [ErrorCode.ServiceTimeout]: 'NETWORK_ERROR',
  [ErrorCode.ServiceDisconnected]: 'NETWORK_ERROR',
  [ErrorCode.ConnectionClosed]: 'NETWORK_ERROR',
  [ErrorCode.ServiceError]: 'NETWORK_ERROR',
  [ErrorCode.RemoteError]: 'NETWORK_ERROR',

  [ErrorCode.SkuNotFound]: 'PRODUCT_NOT_FOUND',
  [ErrorCode.ItemUnavailable]: 'PRODUCT_NOT_FOUND',
  [ErrorCode.EmptySkuList]: 'PRODUCT_NOT_FOUND',
  [ErrorCode.QueryProduct]: 'PRODUCT_NOT_FOUND',

  [ErrorCode.PurchaseVerificationFailed]: 'VERIFICATION_FAILED',
  [ErrorCode.PurchaseVerificationFinishFailed]: 'VERIFICATION_FAILED',
  [ErrorCode.TransactionValidationFailed]: 'VERIFICATION_FAILED',

  [ErrorCode.DuplicatePurchase]: 'DUPLICATE_TRANSACTION',
  [ErrorCode.AlreadyOwned]: 'DUPLICATE_TRANSACTION',
};

/**
 * Translate an expo-iap OpenIAP `ErrorCode` (or any raw code string) to
 * the app's `IAPErrorCode`. Unmapped codes — including the reserved
 * payment codes and pending states — resolve to `UNKNOWN`; callers that
 * care about pending should check `isPendingCode` first.
 */
export function mapExpoErrorCode(code: string): IAPErrorCode {
  return CODE_MAP[code] ?? 'UNKNOWN';
}

/** Build an `IAPError` from an expo-iap `PurchaseError`, preserving the
 *  source error and its human-readable message. */
export function fromPurchaseError(error: PurchaseError): IAPError {
  return new IAPError(mapExpoErrorCode(error.code ?? ''), error.message, error);
}

/**
 * Coerce any thrown value (a rejected expo-iap mutation, a native error,
 * etc.) into an `IAPError`. A value already an `IAPError` passes through;
 * a `{ code }`-shaped error is mapped; anything else becomes `UNKNOWN`.
 * Does NOT special-case pending states — callers that distinguish pending
 * (the purchase flow) must check `isPendingCode` before calling this.
 */
export function coerceIAPError(thrown: unknown, fallbackMessage = 'Unexpected IAP error.'): IAPError {
  if (thrown instanceof IAPError) return thrown;
  if (thrown !== null && typeof thrown === 'object' && 'code' in thrown) {
    const code = String((thrown as { code: unknown }).code);
    const message =
      'message' in thrown ? String((thrown as { message: unknown }).message) : fallbackMessage;
    return new IAPError(mapExpoErrorCode(code), message, thrown);
  }
  return new IAPError('UNKNOWN', thrown instanceof Error ? thrown.message : fallbackMessage, thrown);
}
