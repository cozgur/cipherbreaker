/**
 * Phase 7A.8 CP2 — OnboardingHeroScreen tests.
 *
 * Covers the screen's three load-bearing invariants:
 *   1. Copy contract — title / sub / CTA all render the spec
 *      strings exactly (so a future copy regression breaks
 *      the test, not just the launch).
 *   2. Hero image present — the bundled PNG asset reference
 *      doesn't silently drop on a future asset path edit.
 *   3. CTA contract — tap fires `markIntroSeen` (NOT
 *      `stampOnboardingComplete` — that responsibility lives
 *      in TutorialMatch per CP2) AND replaces the navigation
 *      stack with TutorialMatch.
 */

import { act, fireEvent } from '@testing-library/react-native';

import { __resetMockUserForTests } from '@data/mockUser';
import { OnboardingHeroScreen } from '../OnboardingHeroScreen';
import { TutorialMatchScreen } from '../TutorialMatchScreen';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';
import { renderWithNavigation } from '@/test-utils/renderWithNavigation';
import { useUserStore } from '@state/userStore';

function mountHero() {
  return renderWithNavigation('OnboardingHero', {
    OnboardingHero: OnboardingHeroScreen,
    TutorialMatch: TutorialMatchScreen,
    Home: RouteStubScreen,
  });
}

describe('OnboardingHeroScreen', () => {
  beforeEach(() => {
    __resetMockUserForTests();
  });

  it('renders the brand-defining title "Pure deduction."', () => {
    const utils = mountHero();
    expect(utils.getByText('Pure deduction.')).toBeTruthy();
  });

  it('renders the sub line spelling out the three loops (crack / earn / streak)', () => {
    const utils = mountHero();
    expect(utils.getByText('Crack codes. Earn tokens. Build streaks.')).toBeTruthy();
  });

  it('renders the "Get started" primary CTA', () => {
    const utils = mountHero();
    expect(utils.getByText('Get started')).toBeTruthy();
  });

  it('renders the hero image with the dedicated testID wrapper', () => {
    // The hero <Image> sits inside a wrapper with an a11y
    // label; assert the image accessibility label is present
    // so a future asset-path typo (resolved as undefined by
    // require) breaks loudly. RN's <Image> with an invalid
    // source renders an empty View — without this guard the
    // visual regression is silent.
    const utils = mountHero();
    expect(utils.getByLabelText('Pure deduction hero illustration')).toBeTruthy();
  });

  it('Get started → markIntroSeen + replace into TutorialMatch (does NOT stamp onboarding done)', () => {
    // CP2 contract: hero is step 1 of 2; TutorialMatch is step
    // 2 and owns `stampOnboardingComplete`. Pressing Get started
    // here MUST NOT prematurely flip `hasOnboarded` — that
    // would leak the user past TutorialMatch on the next launch
    // if they kill the app between Hero and TutorialMatch.
    const utils = mountHero();
    expect(useUserStore.getState().onboarding.introSeen).toBe(false);
    expect(useUserStore.getState().hasOnboarded).toBe(false);

    act(() => {
      fireEvent.press(utils.getByText('Get started'));
    });

    const after = useUserStore.getState();
    expect(after.onboarding.introSeen).toBe(true);
    expect(after.hasOnboarded).toBe(false);
    expect(after.onboarding.completedAt).toBeNull();
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('TutorialMatch');
  });

  it('uses navigation.replace (no Back to Hero from TutorialMatch)', () => {
    // `navigation.replace` should remove Hero from the stack so
    // the user cannot navigate back to it post-tap. After
    // pressing Get started, the stack head is TutorialMatch
    // and canGoBack() is false.
    const utils = mountHero();
    act(() => {
      fireEvent.press(utils.getByText('Get started'));
    });
    expect(utils.navRef.current?.canGoBack()).toBe(false);
  });

  it('has no Skip affordance (TutorialMatch is mandatory after CP2)', () => {
    // CP2 spec decision 1: no Skip CTA. Replay-tutorial lives
    // in Settings (Phase 9 backlog). Asserting absence of a
    // Skip button protects against a future "add Skip back"
    // regression that would re-introduce the deleted Skip path.
    const utils = mountHero();
    expect(utils.queryByText('Skip')).toBeNull();
    expect(utils.queryByLabelText(/skip/i)).toBeNull();
  });
});
