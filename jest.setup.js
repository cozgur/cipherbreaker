/* eslint-disable @typescript-eslint/no-require-imports */

// AsyncStorage v3 — inline in-memory mock. The package's `./jest`
// subpath isn't reachable through jest-expo's resolver matrix, and
// the persist middleware only exercises the get/set/remove/clear
// surface, so a 30-line shim is cheaper than wrestling with package
// exports.
jest.mock('@react-native-async-storage/async-storage', () => {
  // Inline in-memory mock — v3's `./jest` subpath isn't reachable
  // through jest-expo's resolver matrix, and shipping our own
  // 30-line shim is cheaper than wrestling with package exports.
  // Persist middleware only needs getItem/setItem/removeItem.
  const store = new Map();
  const api = {
    getItem: (key) => Promise.resolve(store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
      return Promise.resolve();
    },
    removeItem: (key) => {
      store.delete(key);
      return Promise.resolve();
    },
    clear: () => {
      store.clear();
      return Promise.resolve();
    },
    getAllKeys: () => Promise.resolve(Array.from(store.keys())),
    multiGet: (keys) =>
      Promise.resolve(keys.map((k) => [k, store.has(k) ? store.get(k) : null])),
    multiSet: (pairs) => {
      for (const [k, v] of pairs) store.set(k, String(v));
      return Promise.resolve();
    },
    multiRemove: (keys) => {
      for (const k of keys) store.delete(k);
      return Promise.resolve();
    },
  };
  return {
    __esModule: true,
    default: api,
    useAsyncStorage: () => api,
  };
});

// Reanimated v4 ships a "mock" that still boots Worklets — unusable in Node.
// We stub the surface our primitives actually touch: `Easing` functions +
// the default Animated namespace (moti keys off the latter internally).
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const identity = (value) => value;
  const easingFactory = () => identity;
  const Easing = new Proxy(
    { linear: identity, ease: identity, in: easingFactory, out: easingFactory, inOut: easingFactory, sin: identity, bezier: easingFactory },
    { get: (target, prop) => (prop in target ? target[prop] : easingFactory) },
  );
  return {
    __esModule: true,
    default: {
      View,
      createAnimatedComponent: (Component) => Component,
    },
    Easing,
    createAnimatedComponent: (Component) => Component,
    useSharedValue: (initial) => ({ value: initial }),
    useAnimatedStyle: () => ({}),
    withTiming: identity,
    withSpring: identity,
    withRepeat: identity,
    withSequence: identity,
    runOnJS: (fn) => fn,
  };
});

// Phase 7A.6 CP3.1 — `generateUsername` returns a stable
// `'nova_code'` in tests so snapshots and existing username
// assertions stay deterministic. Production runs the real function
// (random `player_<hex4>`); `usernameGen.test.ts` calls
// `jest.unmock('@lib/usernameGen')` to exercise the real impl.
jest.mock('@lib/usernameGen', () => ({
  generateUsername: jest.fn(() => 'nova_code'),
}));

// Phase 7A.6 CP6 — expo-notifications wraps native APNs / Android
// notification surfaces that aren't reachable in Node. We stub the
// two methods CP6 actually calls (getPermissionsAsync,
// requestPermissionsAsync) and return a `'granted'` shape by
// default. Tests override per-case with
// `(Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce(...)`.
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({
    status: 'granted',
    granted: true,
    canAskAgain: true,
    expires: 'never',
  })),
  requestPermissionsAsync: jest.fn(async () => ({
    status: 'granted',
    granted: true,
    canAskAgain: true,
    expires: 'never',
  })),
}));

// Phase 7A.5 Codex round 2 finding 3 — `useReducedMotion` wraps
// `AccessibilityInfo.isReduceMotionEnabled()` which resolves
// asynchronously. Without a mock, every test that mounts a
// component using the hook produces an `act()` warning when the
// promise resolves and triggers a setReducedMotion. The default
// returns `false` so animations run normally in tests; per-test
// overrides flip via `(useReducedMotion as jest.Mock)
// .mockReturnValue(true)`. The exported reference is a `jest.fn`
// so the import-binding resolution stays stable across the
// destructure boundary (a plain function would not be re-mockable
// post-import).
jest.mock('@/lib/useReducedMotion', () => ({
  useReducedMotion: jest.fn(() => false),
}));

// Moti spins up reanimated worklets under MotiView/animate — in Jest we
// just need the children to render; animations are visual concerns the
// device screenshot covers.
jest.mock('moti', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Passthrough = React.forwardRef((props, ref) =>
    React.createElement(View, { ...props, ref }, props.children),
  );
  Passthrough.displayName = 'MotiViewMock';
  return {
    __esModule: true,
    MotiView: Passthrough,
    MotiText: Passthrough,
    MotiImage: Passthrough,
    AnimatePresence: ({ children }) => children,
  };
});

// ─────────────────────────────────────────────────────────────
// Phase 2 — global state hygiene between tests.
// AsyncStorage mock above is module-scoped; each test still gets a
// pristine store snapshot via this hook. `waitForHydration` resolves
// the persist round-trip Zustand fires asynchronously after
// `clearStorage` so a fast follow-up read can't observe stale state.
// ─────────────────────────────────────────────────────────────
const { useUserStore, USER_STORE_DEFAULTS } = require('./src/state/userStore');
const { useSettingsStore, SETTINGS_STORE_DEFAULTS } = require('./src/state/settingsStore');
const { useMatchStore } = require('./src/state/matchStore');
const { useLiveMatchStore } = require('./src/state/liveMatchStore');
const { waitForHydration } = require('./src/test-utils/zustandHydration');
const AsyncStorage = require('@react-native-async-storage/async-storage').default;

beforeEach(async () => {
  await AsyncStorage.clear();
  await useUserStore.persist.clearStorage();
  await useSettingsStore.persist.clearStorage();
  await useMatchStore.persist.clearStorage();

  useUserStore.setState({ ...USER_STORE_DEFAULTS });
  useSettingsStore.setState({ ...SETTINGS_STORE_DEFAULTS });
  useMatchStore.setState({ matchState: null });
  useLiveMatchStore.setState({ liveClocks: null });

  await waitForHydration(useUserStore);
  await waitForHydration(useSettingsStore);
  await waitForHydration(useMatchStore);
});
