import { Dimensions } from 'react-native';
import { act, fireEvent } from '@testing-library/react-native';

import { HomeScreen } from '../HomeScreen';
import { OnboardingIntroScreen } from '../OnboardingIntroScreen';
import { ONBOARDING_DEFAULTS, USER_STORE_DEFAULTS, useUserStore } from '@state/userStore';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';
import { renderWithNavigation, stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';

const SCREEN_WIDTH = Dimensions.get('window').width;

function resetUserStoreOnboarding(): void {
  useUserStore.setState({
    ...USER_STORE_DEFAULTS,
    onboarding: { ...ONBOARDING_DEFAULTS },
    matchesCompletedSinceOnboarding: 0,
  });
}

describe('OnboardingIntroScreen', () => {
  beforeEach(() => {
    resetUserStoreOnboarding();
  });

  it('renders slide 1 by default with the correct title and body and shows Continue in the footer', () => {
    const utils = renderWithNavigation('OnboardingIntro', {
      OnboardingIntro: OnboardingIntroScreen,
      Home: HomeScreen,
    });
    expect(utils.getByText('A new code every day')).toBeTruthy();
    expect(utils.getByText('Crack it in 10 guesses or fewer.')).toBeTruthy();
    // FlatList renders all 3 slides off-screen — the footer button
    // is the source of truth for "which slide is active."
    expect(utils.getByText('Continue →')).toBeTruthy();
  });

  it('pagination dots reflect the current slide after a horizontal scroll settles', () => {
    const utils = renderWithNavigation('OnboardingIntro', {
      OnboardingIntro: OnboardingIntroScreen,
      Home: HomeScreen,
    });
    // Initially dot 0 is selected.
    expect(utils.getByTestId('onboarding-intro-dot-0').props.accessibilityState.selected).toBe(true);
    expect(utils.getByTestId('onboarding-intro-dot-1').props.accessibilityState.selected).toBe(false);

    // Simulate the user swiping to slide 2 — momentum end fires the
    // state update for the dot a11y and the footer label.
    act(() => {
      fireEvent(utils.getByTestId('onboarding-intro-list'), 'momentumScrollEnd', {
        nativeEvent: {
          contentOffset: { x: SCREEN_WIDTH },
          layoutMeasurement: { width: SCREEN_WIDTH, height: 800 },
          contentSize: { width: SCREEN_WIDTH * 3, height: 800 },
        },
      });
    });

    expect(utils.getByTestId('onboarding-intro-dot-0').props.accessibilityState.selected).toBe(false);
    expect(utils.getByTestId('onboarding-intro-dot-1').props.accessibilityState.selected).toBe(true);
  });

  it('Skip calls completeOnboarding(today) and replaces the stack with Home', () => {
    const utils = renderWithNavigation('OnboardingIntro', {
      OnboardingIntro: OnboardingIntroScreen,
      Home: HomeScreen,
    });

    expect(useUserStore.getState().onboarding.completedAt).toBeNull();

    act(() => {
      fireEvent.press(utils.getByLabelText('Skip onboarding'));
    });

    const post = useUserStore.getState();
    // completeOnboarding stamps today's local-calendar string and
    // flips every onboarding flag to true so no surface re-shows.
    expect(post.onboarding.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(post.onboarding.introSeen).toBe(true);
    expect(post.onboarding.tutorialMatchCompleted).toBe(true);
    expect(post.onboarding.notificationOptInAsked).toBe(true);
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Home');
  });

  it('Continue on slide 1 advances to slide 2, footer keeps "Continue →"', () => {
    const utils = renderWithNavigation('OnboardingIntro', {
      OnboardingIntro: OnboardingIntroScreen,
      Home: HomeScreen,
    });

    act(() => {
      fireEvent.press(utils.getByText('Continue →'));
    });

    // Slide 2 is also non-last → footer still shows Continue.
    expect(utils.getByText('Continue →')).toBeTruthy();
    expect(utils.queryByText('Start Playing →')).toBeNull();
    // Dot 1 (index) is now selected.
    expect(utils.getByTestId('onboarding-intro-dot-1').props.accessibilityState.selected).toBe(true);
  });

  it('Continue on slide 2 advances to slide 3 and the footer becomes "Start Playing →"', () => {
    const utils = renderWithNavigation('OnboardingIntro', {
      OnboardingIntro: OnboardingIntroScreen,
      Home: HomeScreen,
    });

    // Two presses to walk from slide 0 → 1 → 2.
    act(() => {
      fireEvent.press(utils.getByText('Continue →'));
    });
    act(() => {
      fireEvent.press(utils.getByText('Continue →'));
    });

    expect(utils.queryByText('Continue →')).toBeNull();
    expect(utils.getByText('Start Playing →')).toBeTruthy();
    expect(utils.getByTestId('onboarding-intro-dot-2').props.accessibilityState.selected).toBe(true);
  });

  it('Start Playing on slide 3 calls markIntroSeen and forwards to TutorialMatch', () => {
    // Phase 7A.6 CP7 — linear flow: Intro → TutorialMatch.
    const utils = renderWithNavigation('OnboardingIntro', {
      OnboardingIntro: OnboardingIntroScreen,
      TutorialMatch: RouteStubScreen,
      Home: HomeScreen,
    });
    // Walk to the last slide.
    act(() => {
      fireEvent.press(utils.getByText('Continue →'));
    });
    act(() => {
      fireEvent.press(utils.getByText('Continue →'));
    });

    expect(useUserStore.getState().onboarding.introSeen).toBe(false);

    act(() => {
      fireEvent.press(utils.getByText('Start Playing →'));
    });

    const post = useUserStore.getState();
    // markIntroSeen flips ONLY introSeen — the other onboarding
    // flags stay false so subsequent steps (tutorial, walkthrough,
    // teasers, push opt-in) can still fire / engage.
    expect(post.onboarding.introSeen).toBe(true);
    expect(post.onboarding.tutorialMatchCompleted).toBe(false);
    expect(post.onboarding.tokenWalkthroughSeen).toBe(false);
    expect(post.onboarding.notificationOptInAsked).toBe(false);
    expect(post.onboarding.completedAt).toBeNull();
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('TutorialMatch');
  });

  it('snapshots the initial slide-1 layout', () => {
    const { toJSON } = renderWithNavigation('OnboardingIntro', {
      OnboardingIntro: OnboardingIntroScreen,
      Home: HomeScreen,
    });
    expect(stableTreeForSnapshot(toJSON())).toMatchSnapshot();
  });

  it('exposes accessibility affordances on Skip, the dots tablist, and each slide', () => {
    const utils = renderWithNavigation('OnboardingIntro', {
      OnboardingIntro: OnboardingIntroScreen,
      Home: HomeScreen,
    });
    // Skip button has an explicit a11y label (visible text is just "Skip").
    expect(utils.getByLabelText('Skip onboarding')).toBeTruthy();
    // Each slide carries a composed text label so screen readers
    // announce title + body without relying on visual order.
    expect(utils.getByLabelText('A new code every day. Crack it in 10 guesses or fewer.')).toBeTruthy();
    expect(utils.getByLabelText('7 unique modes. Speed, prestige, mirror battles.')).toBeTruthy();
    expect(
      utils.getByLabelText('Earn tokens. Build streaks. Pure deduction. Daily challenge.'),
    ).toBeTruthy();
    // All three dots carry tab role + selected state.
    expect(utils.getByTestId('onboarding-intro-dot-0').props.accessibilityState.selected).toBe(true);
    expect(utils.getByTestId('onboarding-intro-dot-2').props.accessibilityState.selected).toBe(false);
  });
});
