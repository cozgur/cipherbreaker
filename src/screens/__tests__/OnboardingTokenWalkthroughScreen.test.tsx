import { Dimensions } from 'react-native';
import { act, fireEvent } from '@testing-library/react-native';

import { HomeScreen } from '../HomeScreen';
import { OnboardingTokenWalkthroughScreen } from '../OnboardingTokenWalkthroughScreen';
import { ONBOARDING_DEFAULTS, USER_STORE_DEFAULTS, useUserStore } from '@state/userStore';
import { renderWithNavigation, stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';

const SCREEN_WIDTH = Dimensions.get('window').width;

function resetUserStoreOnboarding(): void {
  useUserStore.setState({
    ...USER_STORE_DEFAULTS,
    onboarding: { ...ONBOARDING_DEFAULTS },
    matchesCompletedSinceOnboarding: 0,
  });
}

function mountWalkthrough() {
  return renderWithNavigation('OnboardingTokenWalkthrough', {
    OnboardingTokenWalkthrough: OnboardingTokenWalkthroughScreen,
    Home: HomeScreen,
  });
}

describe('OnboardingTokenWalkthroughScreen', () => {
  beforeEach(() => {
    resetUserStoreOnboarding();
  });

  it('renders slide 1 by default with the correct title and body and shows Continue in the footer', () => {
    const utils = mountWalkthrough();
    expect(utils.getByText('Tokens for every win')).toBeTruthy();
    expect(
      utils.getByText('Crack codes faster, earn more. You just earned 50.'),
    ).toBeTruthy();
    // FlatList renders all 3 slides off-screen; the footer button
    // is the source of truth for "which slide is active."
    expect(utils.getByText('Continue →')).toBeTruthy();
  });

  it('pagination dots reflect the current slide after a horizontal scroll settles', () => {
    const utils = mountWalkthrough();
    // Initially dot 0 is selected.
    expect(
      utils.getByTestId('onboarding-token-walkthrough-dot-0').props.accessibilityState.selected,
    ).toBe(true);
    expect(
      utils.getByTestId('onboarding-token-walkthrough-dot-1').props.accessibilityState.selected,
    ).toBe(false);

    // Simulate the user swiping to slide 2 — momentum end fires the
    // state update for the dot a11y and the footer label.
    act(() => {
      fireEvent(utils.getByTestId('onboarding-token-walkthrough-list'), 'momentumScrollEnd', {
        nativeEvent: {
          contentOffset: { x: SCREEN_WIDTH },
          layoutMeasurement: { width: SCREEN_WIDTH, height: 800 },
          contentSize: { width: SCREEN_WIDTH * 3, height: 800 },
        },
      });
    });

    expect(
      utils.getByTestId('onboarding-token-walkthrough-dot-0').props.accessibilityState.selected,
    ).toBe(false);
    expect(
      utils.getByTestId('onboarding-token-walkthrough-dot-1').props.accessibilityState.selected,
    ).toBe(true);
  });

  it('Skip calls completeOnboarding(today) and replaces the stack with Home', () => {
    const utils = mountWalkthrough();

    expect(useUserStore.getState().onboarding.completedAt).toBeNull();

    act(() => {
      fireEvent.press(utils.getByLabelText('Skip onboarding'));
    });

    const post = useUserStore.getState();
    // completeOnboarding stamps today's local-calendar string and
    // flips every onboarding flag to true so no surface re-shows.
    expect(post.onboarding.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(post.onboarding.introSeen).toBe(true);
    expect(post.onboarding.tokenWalkthroughSeen).toBe(true);
    expect(post.onboarding.tutorialMatchCompleted).toBe(true);
    expect(post.onboarding.notificationOptInAsked).toBe(true);
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Home');
  });

  it('Continue on slide 1 advances to slide 2, footer keeps "Continue →"', () => {
    const utils = mountWalkthrough();

    act(() => {
      fireEvent.press(utils.getByText('Continue →'));
    });

    // Slide 2 is also non-last → footer still shows Continue.
    expect(utils.getByText('Continue →')).toBeTruthy();
    expect(utils.queryByText('Start playing →')).toBeNull();
    expect(
      utils.getByTestId('onboarding-token-walkthrough-dot-1').props.accessibilityState.selected,
    ).toBe(true);
  });

  it('Continue on slide 2 advances to slide 3 and the footer becomes "Start playing →"', () => {
    const utils = mountWalkthrough();

    // Two presses to walk from slide 0 → 1 → 2.
    act(() => {
      fireEvent.press(utils.getByText('Continue →'));
    });
    act(() => {
      fireEvent.press(utils.getByText('Continue →'));
    });

    expect(utils.queryByText('Continue →')).toBeNull();
    expect(utils.getByText('Start playing →')).toBeTruthy();
    expect(
      utils.getByTestId('onboarding-token-walkthrough-dot-2').props.accessibilityState.selected,
    ).toBe(true);
  });

  it('Start playing on slide 3 calls markTokenWalkthroughSeen and replaces the stack with Home', () => {
    const utils = mountWalkthrough();
    // Walk to the last slide.
    act(() => {
      fireEvent.press(utils.getByText('Continue →'));
    });
    act(() => {
      fireEvent.press(utils.getByText('Continue →'));
    });

    expect(useUserStore.getState().onboarding.tokenWalkthroughSeen).toBe(false);

    act(() => {
      fireEvent.press(utils.getByText('Start playing →'));
    });

    const post = useUserStore.getState();
    // markTokenWalkthroughSeen flips ONLY tokenWalkthroughSeen — the
    // other onboarding flags stay false so subsequent CP milestones
    // (mode-variety teasers, push opt-in) can still fire.
    expect(post.onboarding.tokenWalkthroughSeen).toBe(true);
    expect(post.onboarding.introSeen).toBe(false);
    expect(post.onboarding.tutorialMatchCompleted).toBe(false);
    expect(post.onboarding.notificationOptInAsked).toBe(false);
    expect(post.onboarding.completedAt).toBeNull();
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Home');
  });

  it('snapshots the initial slide-1 layout', () => {
    const { toJSON } = mountWalkthrough();
    expect(stableTreeForSnapshot(toJSON())).toMatchSnapshot();
  });

  it('exposes accessibility affordances on Skip, the dots tablist, and each slide', () => {
    const utils = mountWalkthrough();
    // Skip button has an explicit a11y label (visible text is just "Skip").
    expect(utils.getByLabelText('Skip onboarding')).toBeTruthy();
    // Each slide carries a composed text label so screen readers
    // announce title + body without relying on visual order.
    expect(
      utils.getByLabelText('Tokens for every win. Crack codes faster, earn more. You just earned 50.'),
    ).toBeTruthy();
    expect(
      utils.getByLabelText(
        "Spend on hints. In real matches, hints aren't free anymore. Reveal a digit (100 tokens) or check one (50). Or earn free hints with daily streaks →",
      ),
    ).toBeTruthy();
    expect(
      utils.getByLabelText(
        'Daily streaks unlock free hints. Play Daily Challenge each day. 7-day streak earns 1 free hint, up to 3.',
      ),
    ).toBeTruthy();
    // All three dots carry tab role + selected state.
    expect(
      utils.getByTestId('onboarding-token-walkthrough-dot-0').props.accessibilityState.selected,
    ).toBe(true);
    expect(
      utils.getByTestId('onboarding-token-walkthrough-dot-2').props.accessibilityState.selected,
    ).toBe(false);
  });
});
