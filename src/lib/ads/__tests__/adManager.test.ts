/**
 * Phase 8.6.2 — adManager SDK bring-up contract.
 *
 * Runs against the automatic manual mock in
 * `__mocks__/react-native-google-mobile-ads.js` (singleton `mobileAds()`
 * object → the jest.fn()s are shared and assertable). Asserts:
 *   - non-personalized/global request config is set BEFORE SDK init;
 *   - idempotency (second call + concurrent calls → ONE SDK init);
 *   - failure containment (resolves false, never rejects, dev-logged)
 *     and that a failed run does NOT latch — the next call retries;
 *   - the npa=1 request options every ad load (8.6.3/8.6.4) must use.
 */

import mobileAds from 'react-native-google-mobile-ads';

import {
  __resetForTests,
  initialize,
  isInitialized,
  NON_PERSONALIZED_REQUEST_OPTIONS,
} from '../adManager';

const sdk = (mobileAds as unknown as jest.Mock)();
const mockSetRequestConfiguration = sdk.setRequestConfiguration as jest.Mock;
const mockSdkInitialize = sdk.initialize as jest.Mock;

beforeEach(() => {
  __resetForTests();
  mockSetRequestConfiguration.mockReset().mockResolvedValue(undefined);
  mockSdkInitialize.mockReset().mockResolvedValue([]);
});

describe('adManager.initialize', () => {
  it('initializes the SDK and resolves true', async () => {
    await expect(initialize()).resolves.toBe(true);
    expect(mockSdkInitialize).toHaveBeenCalledTimes(1);
    expect(isInitialized()).toBe(true);
  });

  it('sets the request configuration BEFORE the SDK initializes', async () => {
    await initialize();
    expect(mockSetRequestConfiguration).toHaveBeenCalledTimes(1);
    const configOrder = mockSetRequestConfiguration.mock.invocationCallOrder[0] ?? 0;
    const initOrder = mockSdkInitialize.mock.invocationCallOrder[0] ?? 0;
    expect(configOrder).toBeLessThan(initOrder);
  });

  it('applies the COPPA/consent tags and content rating in the global config', async () => {
    await initialize();
    expect(mockSetRequestConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        maxAdContentRating: 'T',
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
      }),
    );
  });

  it('is idempotent — a second call after success does not re-init the SDK', async () => {
    await initialize();
    await expect(initialize()).resolves.toBe(true);
    expect(mockSdkInitialize).toHaveBeenCalledTimes(1);
    expect(mockSetRequestConfiguration).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent callers onto one SDK init', async () => {
    const [a, b] = await Promise.all([initialize(), initialize()]);
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(mockSdkInitialize).toHaveBeenCalledTimes(1);
  });

  it('contains an init failure — resolves false, never rejects', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockSdkInitialize.mockRejectedValue(new Error('no ads SDK'));
    await expect(initialize()).resolves.toBe(false);
    expect(isInitialized()).toBe(false);
    logSpy.mockRestore();
  });

  it('does not latch a failed run — the next call retries and can succeed', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockSdkInitialize.mockRejectedValueOnce(new Error('transient'));
    await expect(initialize()).resolves.toBe(false);
    await expect(initialize()).resolves.toBe(true);
    expect(mockSdkInitialize).toHaveBeenCalledTimes(2);
    expect(isInitialized()).toBe(true);
    logSpy.mockRestore();
  });

  it('contains a setRequestConfiguration failure the same way (no ad request can precede config)', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockSetRequestConfiguration.mockRejectedValue(new Error('config refused'));
    await expect(initialize()).resolves.toBe(false);
    expect(mockSdkInitialize).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});

describe('NON_PERSONALIZED_REQUEST_OPTIONS', () => {
  it('carries npa=1 (requestNonPersonalizedAdsOnly) for every future ad load', () => {
    expect(NON_PERSONALIZED_REQUEST_OPTIONS).toEqual({
      requestNonPersonalizedAdsOnly: true,
    });
  });

  it('is frozen — call sites cannot mutate the guarantee', () => {
    expect(Object.isFrozen(NON_PERSONALIZED_REQUEST_OPTIONS)).toBe(true);
  });
});
