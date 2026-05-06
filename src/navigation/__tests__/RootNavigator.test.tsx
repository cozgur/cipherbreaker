/**
 * Phase 7A.6 CP7 — RootNavigator integration tests.
 *
 * Asserts the early-exit conditional flow:
 *   hasOnboarded === true → Home (master gate)
 *   !introSeen → OnboardingIntro (CP2)
 *   !tutorialMatchCompleted → TutorialMatch (CP3)
 *   !tokenWalkthroughSeen → OnboardingTokenWalkthrough (CP4)
 *   otherwise → Home (failsafe — defensive against corrupt state)
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
  readonly tokenWalkthroughSeen?: boolean;
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
      tokenWalkthroughSeen: overrides.tokenWalkthroughSeen ?? false,
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
    it('hasOnboarded=false + all step flags false → OnboardingIntro renders', () => {
      pinOnboardingState({ hasOnboarded: false });
      const utils = renderRoot();
      // Slide 1 of OnboardingIntro is unique to that screen.
      expect(utils.getByText('A new code every day')).toBeTruthy();
    });

    it('introSeen=true, others false → TutorialMatch renders', () => {
      pinOnboardingState({ hasOnboarded: false, introSeen: true });
      const utils = renderRoot();
      // The TutorialMatch welcome overlay headline.
      expect(utils.getByText('Crack the code')).toBeTruthy();
    });

    it('introSeen+tutorialMatchCompleted=true → OnboardingTokenWalkthrough renders', () => {
      pinOnboardingState({
        hasOnboarded: false,
        introSeen: true,
        tutorialMatchCompleted: true,
      });
      const utils = renderRoot();
      // Slide 1 of the token walkthrough is unique.
      expect(utils.getByText('Tokens for every win')).toBeTruthy();
    });

    it('all step flags true but hasOnboarded=false → Home renders (failsafe)', () => {
      // Defensive: corrupt state where every step is "seen" but the
      // master gate stayed false. The pickInitialRoute fallback
      // routes to Home rather than re-showing any step.
      pinOnboardingState({
        hasOnboarded: false,
        introSeen: true,
        tutorialMatchCompleted: true,
        tokenWalkthroughSeen: true,
      });
      const utils = renderRoot();
      expect(utils.getByText('CipherBreaker')).toBeTruthy();
    });
  });

  describe('Force-quit recovery', () => {
    it('quit at TutorialMatch → next launch lands back on TutorialMatch (not Intro)', () => {
      // Models the "user quit during CP3" scenario: introSeen was
      // flipped on Intro's "Start Playing" before the navigation
      // replace, so the persisted state has introSeen=true and
      // tutorialMatchCompleted=false. Re-launching engages the
      // chain at the tutorial step.
      pinOnboardingState({
        hasOnboarded: false,
        introSeen: true,
        tutorialMatchCompleted: false,
      });
      const utils = renderRoot();
      expect(utils.getByText('Crack the code')).toBeTruthy();
      expect(utils.queryByText('A new code every day')).toBeNull();
    });

    it('quit at OnboardingTokenWalkthrough → next launch lands back on the walkthrough', () => {
      pinOnboardingState({
        hasOnboarded: false,
        introSeen: true,
        tutorialMatchCompleted: true,
        tokenWalkthroughSeen: false,
      });
      const utils = renderRoot();
      expect(utils.getByText('Tokens for every win')).toBeTruthy();
      expect(utils.queryByText('Crack the code')).toBeNull();
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
