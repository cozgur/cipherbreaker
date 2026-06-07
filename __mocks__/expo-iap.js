/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Manual mock for `expo-iap` (a native module, unusable in Node/Jest).
 *
 * Provides jest.fn() stubs for every function the IAP layer calls plus
 * the FULL `ErrorCode` enum with its real kebab-case string values —
 * `errors.ts` builds its code-map from `ErrorCode.*` at module load, so a
 * missing member would silently produce an `undefined` map key. Tests
 * activate this with `jest.mock('expo-iap')` and configure the fns
 * per-case (mockResolvedValue / mockImplementation / mockReturnValue).
 */

// Real OpenIAP ErrorCode values (mirrors node_modules/expo-iap types).
const ErrorCode = {
  ActivityUnavailable: 'activity-unavailable',
  AlreadyOwned: 'already-owned',
  AlreadyPrepared: 'already-prepared',
  BillingResponseJsonParseError: 'billing-response-json-parse-error',
  BillingUnavailable: 'billing-unavailable',
  ConnectionClosed: 'connection-closed',
  DeferredPayment: 'deferred-payment',
  DeveloperError: 'developer-error',
  DuplicatePurchase: 'duplicate-purchase',
  EmptySkuList: 'empty-sku-list',
  FeatureNotSupported: 'feature-not-supported',
  IapNotAvailable: 'iap-not-available',
  InitConnection: 'init-connection',
  Interrupted: 'interrupted',
  ItemNotOwned: 'item-not-owned',
  ItemUnavailable: 'item-unavailable',
  NetworkError: 'network-error',
  NotEnded: 'not-ended',
  NotPrepared: 'not-prepared',
  Pending: 'pending',
  PurchaseError: 'purchase-error',
  PurchaseVerificationFailed: 'purchase-verification-failed',
  PurchaseVerificationFinishFailed: 'purchase-verification-finish-failed',
  PurchaseVerificationFinished: 'purchase-verification-finished',
  QueryProduct: 'query-product',
  ReceiptFailed: 'receipt-failed',
  ReceiptFinished: 'receipt-finished',
  ReceiptFinishedFailed: 'receipt-finished-failed',
  RemoteError: 'remote-error',
  ServiceDisconnected: 'service-disconnected',
  ServiceError: 'service-error',
  ServiceTimeout: 'service-timeout',
  SkuNotFound: 'sku-not-found',
  SkuOfferMismatch: 'sku-offer-mismatch',
  SyncError: 'sync-error',
  TransactionValidationFailed: 'transaction-validation-failed',
  Unknown: 'unknown',
  UserCancelled: 'user-cancelled',
  UserError: 'user-error',
};

module.exports = {
  __esModule: true,
  ErrorCode,
  initConnection: jest.fn(() => Promise.resolve(true)),
  endConnection: jest.fn(() => Promise.resolve()),
  fetchProducts: jest.fn(() => Promise.resolve([])),
  requestPurchase: jest.fn(() => Promise.resolve(null)),
  finishTransaction: jest.fn(() => Promise.resolve()),
  getAvailablePurchases: jest.fn(() => Promise.resolve([])),
  purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
};
