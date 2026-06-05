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
    expect(typeof state.markBlitzTeaserSeen).toBe('function');
    expect(typeof state.markMirrorTeaserSeen).toBe('function');
    expect(typeof state.markNotificationOptInAsked).toBe('function');
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
    expect(typeof state.markBlitzTeaserSeen).toBe('function');
    expect(typeof state.markMirrorTeaserSeen).toBe('function');
    expect(typeof state.markNotificationOptInAsked).toBe('function');
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

  describe('Phase 7A.8 CP3 — jitTooltipsSeen rehydration', () => {
    /**
     * CP3 added `jitTooltipsSeen` without bumping `STORE_VERSION`.
     * Legacy v6 blobs persisted before CP3 lack the namespace
     * entirely. Zustand persist's default shallow merge spreads
     * persisted state over initial state, so the missing key
     * resolves to the initial-state default (all three flags
     * false). These tests pin that contract — a future custom
     * `merge` that drops fields rather than backfilling would
     * otherwise silently rehydrate `jitTooltipsSeen: undefined`
     * and crash on the trigger sites' `seenSnap.jitTooltipsSeen
     * .firstTokenEarn` reads.
     */
    it('a pre-CP3 v6 blob lacking jitTooltipsSeen rehydrates with the default namespace', async () => {
      // Seed without jitTooltipsSeen — simulates a player whose
      // persist blob was written by a pre-CP3 build.
      const { jitTooltipsSeen: _omit, ...legacyV6 } = USER_STORE_DEFAULTS;
      await AsyncStorage.setItem(
        PERSIST_KEY,
        JSON.stringify({ state: legacyV6, version: 6 }),
      );
      await useUserStore.persist.rehydrate();

      const after = useUserStore.getState();
      expect(after.jitTooltipsSeen).toEqual({
        firstTokenEarn: false,
        firstHintSpend: false,
        firstStreakMilestone: false,
      });
      // All three mark actions remain wired post-rehydrate.
      expect(typeof after.markFirstTokenEarnTooltipSeen).toBe('function');
      expect(typeof after.markFirstHintSpendTooltipSeen).toBe('function');
      expect(typeof after.markFirstStreakMilestoneTooltipSeen).toBe('function');
    });

    it('a persisted blob with explicit jitTooltipsSeen flags wins over the default', async () => {
      await AsyncStorage.setItem(
        PERSIST_KEY,
        JSON.stringify({
          state: {
            ...USER_STORE_DEFAULTS,
            jitTooltipsSeen: {
              firstTokenEarn: true,
              firstHintSpend: false,
              firstStreakMilestone: true,
            },
          },
          version: 6,
        }),
      );
      await useUserStore.persist.rehydrate();

      const after = useUserStore.getState();
      expect(after.jitTooltipsSeen).toEqual({
        firstTokenEarn: true,
        firstHintSpend: false,
        firstStreakMilestone: true,
      });
    });
  });

  describe('Phase 7A.8 CP6 — modeUnlocked migration (v6 → v7) on rehydrate', () => {
    it('a v6 blob (with play history + dead tokenWalkthroughSeen) rehydrates to v7 defaults — no retroactive unlock', async () => {
      // A realistic v6 blob: a player who has played matches and
      // whose onboarding object still carries the now-dead
      // `tokenWalkthroughSeen` flag. v6 has no `modeUnlocked`.
      const { modeUnlocked: _omit, ...v6Base } = USER_STORE_DEFAULTS;
      await AsyncStorage.setItem(
        PERSIST_KEY,
        JSON.stringify({
          state: {
            ...v6Base,
            stats: { ...USER_STORE_DEFAULTS.stats, gamesPlayed: 12 },
            onboarding: {
              introSeen: true,
              tutorialMatchCompleted: true,
              tokenWalkthroughSeen: true,
              blitzTeaserSeen: false,
              mirrorTeaserSeen: false,
              notificationOptInAsked: false,
              completedAt: null,
            },
          },
          version: 6,
        }),
      );
      await useUserStore.persist.rehydrate();

      const after = useUserStore.getState();
      // modeUnlocked seeded with fresh-install defaults — NOT
      // back-filled from the player's 12 games (no per-mode signal,
      // no pre-economy cohort to honour).
      expect(after.modeUnlocked).toEqual({
        1: true,
        2: false,
        3: false,
        4: false,
        5: false,
        6: false,
        7: false,
      });
      // Dead field stripped from onboarding during the migration.
      expect(
        (after.onboarding as unknown as Record<string, unknown>).tokenWalkthroughSeen,
      ).toBeUndefined();
      // Surviving onboarding flags preserved through the migration.
      expect(after.onboarding.introSeen).toBe(true);
      expect(after.onboarding.tutorialMatchCompleted).toBe(true);
      // unlockMode is wired post-rehydrate.
      expect(typeof after.unlockMode).toBe('function');
      expect(typeof after.isModeUnlocked).toBe('function');
    });
  });

  describe('Phase 7A.8 CP9.1 — Daily firstPlayedDate backfill (v7 → v8) on rehydrate', () => {
    it('a v7 blob with daily history backfills firstPlayedDate from the earliest history date', async () => {
      // v7-on-disk: dailyChallenge predates the CP9.1 firstPlayedDate
      // field. The v7 → v8 migration must anchor the per-user epoch to
      // the earliest known play so the player's tier/streak don't snap
      // back to Day 1 on upgrade.
      const { firstPlayedDate: _omit, ...v7Daily } = USER_STORE_DEFAULTS.dailyChallenge;
      await AsyncStorage.setItem(
        PERSIST_KEY,
        JSON.stringify({
          state: {
            ...USER_STORE_DEFAULTS,
            dailyChallenge: {
              ...v7Daily,
              lastPlayedDate: '2026-05-12',
              currentStreak: 3,
              longestStreak: 5,
              history: [
                { date: '2026-05-10', digits: 4, turns: 3, success: true, hintsUsed: 0 },
                { date: '2026-05-12', digits: 4, turns: 4, success: true, hintsUsed: 0 },
              ],
            },
          },
          version: 7,
        }),
      );
      await useUserStore.persist.rehydrate();

      const after = useUserStore.getState();
      expect(after.dailyChallenge.firstPlayedDate).toBe('2026-05-10');
      expect(after.dailyChallenge.currentStreak).toBe(3);
      // The epoch-stamping action is wired post-rehydrate.
      expect(typeof after.markDailyFirstPlayed).toBe('function');
    });

    it('a v7 blob with no daily history rehydrates firstPlayedDate as null', async () => {
      // A fresh-ish player who never played Daily: nothing to anchor
      // to, so Day 1 stays open until their first post-upgrade play.
      const { firstPlayedDate: _omit, ...v7Daily } = USER_STORE_DEFAULTS.dailyChallenge;
      await AsyncStorage.setItem(
        PERSIST_KEY,
        JSON.stringify({
          state: { ...USER_STORE_DEFAULTS, dailyChallenge: { ...v7Daily } },
          version: 7,
        }),
      );
      await useUserStore.persist.rehydrate();

      expect(useUserStore.getState().dailyChallenge.firstPlayedDate).toBeNull();
    });
  });
});
