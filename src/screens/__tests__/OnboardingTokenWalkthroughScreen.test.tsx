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
      utils.getByText('Win matches, earn tokens. Faster wins earn more.'),
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

  it('Start playing on slide 3 stamps onboarding done but keeps CP5/CP6 gates open (CP7.1)', () => {
    // Phase 7A.6 CP7.1 — linear-completion endpoint:
    //   markTokenWalkthroughSeen() + stampOnboardingComplete(today)
    // (NOT completeOnboarding, which would also silence the
    // teaser/notification flags). The intent: linearly-completing
    // users still see CP5 mode teasers (matches #3 / #5) and CP6
    // push opt-in on first Daily win — those are post-onboarding
    // contextual nudges, not part of the core walkthrough.
    const utils = mountWalkthrough();
    act(() => {
      fireEvent.press(utils.getByText('Continue →'));
    });
    act(() => {
      fireEvent.press(utils.getByText('Continue →'));
    });

    const before = useUserStore.getState();
    expect(before.onboarding.tokenWalkthroughSeen).toBe(false);
    expect(before.hasOnboarded).toBe(false);

    act(() => {
      fireEvent.press(utils.getByText('Start playing →'));
    });

    const post = useUserStore.getState();
    // Master gate engaged: hasOnboarded + completedAt set.
    expect(post.hasOnboarded).toBe(true);
    expect(post.onboarding.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Walkthrough's own flag flipped.
    expect(post.onboarding.tokenWalkthroughSeen).toBe(true);
    // Other walked-step flags untouched (this test starts at the
    // CP4 screen with prior steps' flags at default false; the
    // markTokenWalkthroughSeen call only touches the CP4 flag).
    expect(post.onboarding.introSeen).toBe(false);
    expect(post.onboarding.tutorialMatchCompleted).toBe(false);
    // CRITICAL: CP5 / CP6 trigger gates stay OPEN. This is the
    // CP7.1 fix — linear completion no longer silences future
    // teasers and push opt-in.
    expect(post.onboarding.blitzTeaserSeen).toBe(false);
    expect(post.onboarding.mirrorTeaserSeen).toBe(false);
    expect(post.onboarding.notificationOptInAsked).toBe(false);
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
      utils.getByLabelText(
        'Tokens for every win. Win matches, earn tokens. Faster wins earn more.',
      ),
    ).toBeTruthy();
    expect(
      utils.getByLabelText(
        'Spend on hints. Stuck? Spend tokens for hints. Or earn them free through daily streaks →',
      ),
    ).toBeTruthy();
    expect(
      utils.getByLabelText(
        'Daily streaks unlock free hints. Play Daily Challenge each day. Every 7-day streak earns a free hint.',
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
