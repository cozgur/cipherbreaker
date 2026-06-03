/**
 * Phase 7A.6 CP7 + Phase 7A.8 CP2 — RootNavigator integration tests.
 *
 * Asserts the early-exit conditional flow:
 *   hasOnboarded === true → Home (master gate)
 *   !introSeen → OnboardingHero (CP2, single slide replacing the
 *               3-slide intro carousel + deleted token walkthrough)
 *   !tutorialMatchCompleted → TutorialMatch (Phase 7A.6 CP3,
 *               unchanged; CP2 moved the completion stamp into
 *               its `finishAndExit`)
 *   otherwise → Home (failsafe + linear-complete)
 *
 * Phase 7A.8 CP2 deleted `OnboardingTokenWalkthrough`. The
 * `tokenWalkthroughSeen` flag stays in schema as dead data
 * (Phase 9 cleanup queued in PHASE-9-BACKLOG.md).
 *
 * Force-quit recovery is implicit in the chain: a user who quit
 * mid-flow has the prior step's flag set, so the next launch
 * lands on the next unseen step.
 */

import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { __resetMockUserForTests } from '@data/mockUser';
import {
  ONBOARDING_DEFAULTS,
  USER_STORE_DEFAULTS,
  useUserStore,
} from '@state/userStore';
import { RootNavigator } from '../RootNavigator';

const insets = { top: 44, left: 0, right: 0, bottom: 34 };

function renderRoot() {
  return render(
    <SafeAreaProvider initialMetrics={{ insets, frame: { x: 0, y: 0, width: 390, height: 844 } }}>
      <RootNavigator />
    </SafeAreaProvider>,
  );
}

/**
 * Pin the userStore to a fresh-install-ish baseline (CP3.1 zeroed
 * defaults) and apply the given onboarding/hasOnboarded overrides.
 * Tests that need a specific point in the early-exit chain
 * compose the overrides directly, e.g.
 *   pinOnboardingState({ hasOnboarded: false, introSeen: true })
 * lands the user on TutorialMatch.
 */
function pinOnboardingState(overrides: {
  readonly hasOnboarded?: boolean;
  readonly introSeen?: boolean;
  readonly tutorialMatchCompleted?: boolean;
  readonly completedAt?: string | null;
}): void {
  __resetMockUserForTests();
  useUserStore.setState({
    ...USER_STORE_DEFAULTS,
    hasOnboarded: overrides.hasOnboarded ?? false,
    onboarding: {
      ...ONBOARDING_DEFAULTS,
      introSeen: overrides.introSeen ?? false,
      tutorialMatchCompleted: overrides.tutorialMatchCompleted ?? false,
      completedAt: overrides.completedAt ?? null,
    },
  });
}

describe('RootNavigator — onboarding flow routing (Phase 7A.6 CP7)', () => {
  describe('hasOnboarded master gate', () => {
    it('lands on Home when hasOnboarded === true (regardless of step flags)', () => {
      pinOnboardingState({ hasOnboarded: true });
      const utils = renderRoot();
      // The "CipherBreaker" hero text is unique to Home.
      expect(utils.getByText('CipherBreaker')).toBeTruthy();
    });

    it('lands on Home when hasOnboarded === true even if intro flag is false (gate wins)', () => {
      pinOnboardingState({ hasOnboarded: true, introSeen: false });
      const utils = renderRoot();
      expect(utils.getByText('CipherBreaker')).toBeTruthy();
    });
  });

  describe('Fresh-install early-exit chain', () => {
    it('hasOnboarded=false + all step flags false → OnboardingHero renders', () => {
      // CP2 hero replaced the 3-slide intro carousel. The unique
      // copy is the title "Pure deduction." (was "A new code
      // every day" pre-CP2).
      pinOnboardingState({ hasOnboarded: false });
      const utils = renderRoot();
      expect(utils.getByText('Pure deduction.')).toBeTruthy();
    });

    it('introSeen=true, others false → TutorialMatch renders', () => {
      pinOnboardingState({ hasOnboarded: false, introSeen: true });
      const utils = renderRoot();
      // The TutorialMatch welcome overlay headline.
      expect(utils.getByText('Crack the code')).toBeTruthy();
    });

    it('introSeen+tutorialMatchCompleted=true → Home renders (CP2 removed the token walkthrough step)', () => {
      // Pre-CP2 this state routed to OnboardingTokenWalkthrough.
      // CP2 deleted that route — the chain now ends at
      // TutorialMatch, so the user reaches Home via the
      // "otherwise" failsafe. The CP2 TutorialMatch handler
      // would normally also flip `hasOnboarded` itself; this
      // test models the post-tutorial / pre-stamp window or
      // a corrupt state.
      pinOnboardingState({
        hasOnboarded: false,
        introSeen: true,
        tutorialMatchCompleted: true,
      });
      const utils = renderRoot();
      expect(utils.getByText('CipherBreaker')).toBeTruthy();
    });

    it('all step flags true but hasOnboarded=false → Home renders (failsafe)', () => {
      // Defensive: corrupt state where every step is "seen" but the
      // master gate stayed false. The pickInitialRoute fallback
      // routes to Home rather than re-showing any step.
      pinOnboardingState({
        hasOnboarded: false,
        introSeen: true,
        tutorialMatchCompleted: true,
      });
      const utils = renderRoot();
      expect(utils.getByText('CipherBreaker')).toBeTruthy();
    });
  });

  describe('Force-quit recovery', () => {
    it('quit at TutorialMatch → next launch lands back on TutorialMatch (not Hero)', () => {
      // Models the "user quit between Hero and TutorialMatch"
      // scenario: introSeen was flipped on Hero's "Get started"
      // before the navigation replace, so persisted state has
      // introSeen=true, tutorialMatchCompleted=false. The chain
      // engages at the tutorial step.
      pinOnboardingState({
        hasOnboarded: false,
        introSeen: true,
        tutorialMatchCompleted: false,
      });
      const utils = renderRoot();
      expect(utils.getByText('Crack the code')).toBeTruthy();
      expect(utils.queryByText('Pure deduction.')).toBeNull();
    });

    it('in-progress user past intro+tutorial but hasOnboarded=false → Home (CP2 dropped the walkthrough step)', () => {
      // Pre-CP2 this state routed to the token walkthrough. CP2
      // deleted that step and CP6 removed the dead
      // `tokenWalkthroughSeen` flag entirely, so a user who finished
      // intro+tutorial falls through the chain to Home. Spec
      // decision 6: in-progress users lose any walkthrough state on
      // upgrade — acceptable; the walkthrough was advisory, not
      // load-bearing.
      pinOnboardingState({
        hasOnboarded: false,
        introSeen: true,
        tutorialMatchCompleted: true,
      });
      const utils = renderRoot();
      expect(utils.getByText('CipherBreaker')).toBeTruthy();
      expect(utils.queryByText('Crack the code')).toBeNull();
    });
  });

  describe('Linear-completion routing (Phase 7A.6 CP7.1)', () => {
    it('post-CP4 Start Playing state (hasOnboarded=true + teaser flags false) routes to Home via master gate', () => {
      // Models the exact post-CP7.1 linear-completion state:
      //   hasOnboarded=true, completedAt set, intro/tutorial step
      //   flags true, but teaser/notification flags STILL FALSE.
      // The master gate (`hasOnboarded === true`) wins → Home.
      // Distinct from the "all flags true + hasOnboarded false"
      // failsafe path used by Skip handlers.
      __resetMockUserForTests();
      useUserStore.setState({
        ...USER_STORE_DEFAULTS,
        hasOnboarded: true,
        onboarding: {
          ...ONBOARDING_DEFAULTS,
          introSeen: true,
          tutorialMatchCompleted: true,
          completedAt: '2026-05-05',
          // CP5 / CP6 trigger gates remain open — this is the
          // whole point of the CP7.1 hotfix.
          blitzTeaserSeen: false,
          mirrorTeaserSeen: false,
          notificationOptInAsked: false,
        },
      });
      const utils = renderRoot();
      expect(utils.getByText('CipherBreaker')).toBeTruthy();
    });
  });

  describe('Legacy Onboarding route — Phase 7A.6 CP7 cleanup', () => {
    it('does NOT render the legacy Phase-1B Onboarding screen on fresh install', () => {
      // The legacy OnboardingScreen was removed in CP7 (CP3.1
      // flagged it for removal). Its hero copy "Crack the code.\n
      // Beat your rival." should never reach the screen tree.
      pinOnboardingState({ hasOnboarded: false });
      const utils = renderRoot();
      expect(utils.queryByText('Crack the code.\nBeat your rival.')).toBeNull();
    });
  });
});
