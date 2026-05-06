/**
 * Phase 7A.6 CP7.2 — persist-rehydration regression guard.
 *
 * CP7.2 root cause: Fast Refresh on iOS Simulator preserved a
 * stale Zustand store instance across CP7 → CP7.1 module swaps,
 * so the new `stampOnboardingComplete` action was missing from
 * the in-memory store even though the bundle and source had it.
 * Symptom: `[TypeError: stampOnboardingComplete is not a function
 * (it is undefined)]` at the CP4 Start Playing handler. The fix
 * was a Metro `--clear` restart (a developer-side action), not a
 * code change — but this test exists to catch the OTHER scenario
 * where this symptom could appear: a future refactor where the
 * persist middleware genuinely strips actions during rehydration.
 *
 * The test exercises the full persist cycle that unit tests with
 * `useUserStore.setState({...defaults})` shortcut around:
 *   1. Pre-populate AsyncStorage with realistic prior-session
 *      state (a player mid-onboarding, force-quit between CPs).
 *   2. Force `useUserStore.persist.rehydrate()` — runs the full
 *      `migrate(persisted, version)` → `merge(migrated,
 *      currentState)` → `set(stateFromStorage, true)` chain.
 *   3. Assert that all post-CP7.1 onboarding actions remain
 *      callable and behave correctly.
 *
 * If a future refactor (e.g. a custom `merge` that drops
 * function values, or an over-eager `partialize` that includes
 * action keys with `undefined` values) breaks the post-rehydrate
 * action set, these tests fail and surface the issue at CI time
 * instead of at iOS Simulator runtime.
 *
 * Pinned actions: every onboarding action that flips state.
 * Adding new ones in future CPs should add a corresponding
 * post-rehydrate callability assertion here.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ONBOARDING_DEFAULTS,
  USER_STORE_DEFAULTS,
  useUserStore,
} from '@/state/userStore';

const PERSIST_KEY = 'cipherbreaker.user.v1';
const STORE_VERSION = 5;

async function seedPersistedState(state: object): Promise<void> {
  await AsyncStorage.setItem(
    PERSIST_KEY,
    JSON.stringify({ state, version: STORE_VERSION }),
  );
  await useUserStore.persist.rehydrate();
}

describe('Phase 7A.6 CP7.2 — onboarding actions survive persist rehydration', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await useUserStore.persist.clearStorage();
  });

  it('all onboarding actions are callable on a freshly-created store', () => {
    const state = useUserStore.getState();
    expect(typeof state.markIntroSeen).toBe('function');
    expect(typeof state.markTutorialMatchCompleted).toBe('function');
    expect(typeof state.markTokenWalkthroughSeen).toBe('function');
    expect(typeof state.markBlitzTeaserSeen).toBe('function');
    expect(typeof state.markMirrorTeaserSeen).toBe('function');
    expect(typeof state.markNotificationOptInAsked).toBe('function');
    expect(typeof state.completeOnboarding).toBe('function');
    expect(typeof state.stampOnboardingComplete).toBe('function');
  });

  it('all onboarding actions remain callable after rehydrate from realistic prior state', async () => {
    // Realistic mid-onboarding state: user walked CP2 + CP3,
    // backgrounded the app at CP4. On relaunch the store
    // rehydrates from disk and the actions must remain wired.
    await seedPersistedState({
      ...USER_STORE_DEFAULTS,
      hasOnboarded: false,
      onboarding: {
        ...ONBOARDING_DEFAULTS,
        introSeen: true,
        tutorialMatchCompleted: true,
      },
    });

    const state = useUserStore.getState();
    expect(typeof state.markIntroSeen).toBe('function');
    expect(typeof state.markTutorialMatchCompleted).toBe('function');
    expect(typeof state.markTokenWalkthroughSeen).toBe('function');
    expect(typeof state.markBlitzTeaserSeen).toBe('function');
    expect(typeof state.markMirrorTeaserSeen).toBe('function');
    expect(typeof state.markNotificationOptInAsked).toBe('function');
    expect(typeof state.completeOnboarding).toBe('function');
    expect(typeof state.stampOnboardingComplete).toBe('function');
  });

  it('stampOnboardingComplete behaves correctly after rehydrate (the CP7.2 user-visible scenario)', async () => {
    // Models the exact scenario the user hit: walked CP2 + CP3,
    // landed on CP4, tapped Start playing. Pre-CP7.2 with a
    // stale store instance, this would crash. Post-CP7.2 with a
    // fresh persist cycle, it must work.
    await seedPersistedState({
      ...USER_STORE_DEFAULTS,
      hasOnboarded: false,
      onboarding: {
        ...ONBOARDING_DEFAULTS,
        introSeen: true,
        tutorialMatchCompleted: true,
        tokenWalkthroughSeen: true,
      },
    });

    useUserStore.getState().stampOnboardingComplete('2026-05-07');
    const after = useUserStore.getState();
    expect(after.hasOnboarded).toBe(true);
    expect(after.onboarding.completedAt).toBe('2026-05-07');
    // CP5 / CP6 trigger gates remain open — the whole CP7.1 fix.
    expect(after.onboarding.blitzTeaserSeen).toBe(false);
    expect(after.onboarding.mirrorTeaserSeen).toBe(false);
    expect(after.onboarding.notificationOptInAsked).toBe(false);
  });

  it('completeOnboarding behaves correctly after rehydrate (Skip-path coverage)', async () => {
    await seedPersistedState({
      ...USER_STORE_DEFAULTS,
      hasOnboarded: false,
      onboarding: { ...ONBOARDING_DEFAULTS },
    });

    useUserStore.getState().completeOnboarding('2026-05-07');
    const after = useUserStore.getState();
    expect(after.onboarding.completedAt).toBe('2026-05-07');
    // Skip path silences ALL post-onboarding nudges — pinned
    // alongside the linear path so future drift either way is
    // caught.
    expect(after.onboarding.blitzTeaserSeen).toBe(true);
    expect(after.onboarding.mirrorTeaserSeen).toBe(true);
    expect(after.onboarding.notificationOptInAsked).toBe(true);
  });
});
