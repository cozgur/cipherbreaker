/**
 * Phase 7A.7 CP4 — ModeTutorialScreen scaffold tests.
 *
 * Layered around the four screen invariants:
 *   1. Default mount — renders Mode 2 slide 1 + skip + dot 0
 *   2. Skip — flips modeTutorialsSeen[2] + replaces into Matchmaking
 *   3. Continue / Start CTA progression
 *   4. Defensive fallthrough for unsupported modeId (CP4 only ships
 *      Mode 2 content; CP5/CP6 widen the switch)
 */

import { Dimensions } from 'react-native';
import { act, fireEvent } from '@testing-library/react-native';

import { MatchmakingScreen } from '../MatchmakingScreen';
import { ModeTutorialScreen } from '../ModeTutorialScreen';
import { USER_STORE_DEFAULTS, useUserStore } from '@state/userStore';
import { renderWithNavigation } from '@/test-utils/renderWithNavigation';

const SCREEN_WIDTH = Dimensions.get('window').width;

function resetUserStore(): void {
  useUserStore.setState({
    ...USER_STORE_DEFAULTS,
    modeTutorialsSeen: {},
  });
}

function mountScreen(modeId: number) {
  return renderWithNavigation(
    'ModeTutorial',
    {
      ModeTutorial: ModeTutorialScreen,
      Matchmaking: MatchmakingScreen,
    },
    { modeId },
  );
}

describe('ModeTutorialScreen', () => {
  beforeEach(() => {
    resetUserStore();
  });

  it('renders the Mode 2 slide 1 copy and the mode header label', () => {
    const utils = mountScreen(2);
    expect(utils.getByText('HIGH & LOW')).toBeTruthy();
    expect(utils.getByText('One clue per guess')).toBeTruthy();
    // Continue is the footer CTA on slides 1 & 2.
    expect(utils.getByText('Continue →')).toBeTruthy();
  });

  it('Skip flips modeTutorialsSeen[2] and replaces into Matchmaking', () => {
    const utils = mountScreen(2);
    expect(useUserStore.getState().modeTutorialsSeen[2]).toBeUndefined();

    act(() => {
      fireEvent.press(utils.getByTestId('mode-tutorial-skip'));
    });

    expect(useUserStore.getState().modeTutorialsSeen[2]).toBe(true);
    const route = utils.navRef.current?.getCurrentRoute();
    expect(route?.name).toBe('Matchmaking');
    expect((route?.params as { modeId: number }).modeId).toBe(2);
  });

  it('Continue advances slide 1 → 2; footer stays "Continue →"', () => {
    const utils = mountScreen(2);
    act(() => {
      fireEvent.press(utils.getByText('Continue →'));
    });
    expect(utils.getByText('Continue →')).toBeTruthy();
    expect(utils.queryByText('Start match →')).toBeNull();
    expect(
      utils.getByTestId('mode-tutorial-dot-1').props.accessibilityState.selected,
    ).toBe(true);
  });

  it('Continue twice lands on slide 3; footer becomes "Start match →"', () => {
    const utils = mountScreen(2);
    act(() => {
      fireEvent.press(utils.getByText('Continue →'));
    });
    act(() => {
      fireEvent.press(utils.getByText('Continue →'));
    });
    expect(utils.queryByText('Continue →')).toBeNull();
    expect(utils.getByText('Start match →')).toBeTruthy();
    // Slide 3's visual is the interactive DemoBoard.
    expect(utils.getByTestId('mode2-demo-board')).toBeTruthy();
    expect(
      utils.getByTestId('mode-tutorial-dot-2').props.accessibilityState.selected,
    ).toBe(true);
  });

  it('Start match flips modeTutorialsSeen[2] and replaces into Matchmaking', () => {
    const utils = mountScreen(2);
    act(() => {
      fireEvent.press(utils.getByText('Continue →'));
    });
    act(() => {
      fireEvent.press(utils.getByText('Continue →'));
    });

    expect(useUserStore.getState().modeTutorialsSeen[2]).toBeUndefined();

    act(() => {
      fireEvent.press(utils.getByText('Start match →'));
    });

    expect(useUserStore.getState().modeTutorialsSeen[2]).toBe(true);
    const route = utils.navRef.current?.getCurrentRoute();
    expect(route?.name).toBe('Matchmaking');
    expect((route?.params as { modeId: number }).modeId).toBe(2);
  });

  it('pagination dots reflect the current slide after a horizontal scroll settles', () => {
    const utils = mountScreen(2);
    expect(
      utils.getByTestId('mode-tutorial-dot-0').props.accessibilityState.selected,
    ).toBe(true);

    act(() => {
      fireEvent(utils.getByTestId('mode-tutorial-list'), 'momentumScrollEnd', {
        nativeEvent: {
          contentOffset: { x: SCREEN_WIDTH },
          layoutMeasurement: { width: SCREEN_WIDTH, height: 800 },
          contentSize: { width: SCREEN_WIDTH * 3, height: 800 },
        },
      });
    });

    expect(
      utils.getByTestId('mode-tutorial-dot-0').props.accessibilityState.selected,
    ).toBe(false);
    expect(
      utils.getByTestId('mode-tutorial-dot-1').props.accessibilityState.selected,
    ).toBe(true);
  });

  it('exposes accessibility affordances on Skip and each slide', () => {
    const utils = mountScreen(2);
    expect(utils.getByLabelText('Skip HIGH & LOW tutorial')).toBeTruthy();
    // Composed slide labels: title + body, matching the
    // OnboardingTokenWalkthrough convention.
    expect(
      utils.getByLabelText(/^One clue per guess\. After each guess/),
    ).toBeTruthy();
    expect(utils.getByLabelText(/^Bigger or smaller\./)).toBeTruthy();
    expect(utils.getByLabelText(/^Bisect to crack it\./)).toBeTruthy();
  });

  it('redirects to Matchmaking when an unsupported modeId is passed (CP4: only Mode 2 has content)', () => {
    // Mode 1 has its own bespoke tutorial (Phase 7A.6 CP3
    // TutorialMatchScreen) — the per-mode scaffold should never
    // render for it. Mode 3 has no content yet (CP5 backfills);
    // same defense.
    const utils = mountScreen(3);
    const route = utils.navRef.current?.getCurrentRoute();
    expect(route?.name).toBe('Matchmaking');
    expect((route?.params as { modeId: number }).modeId).toBe(3);
    // Defensive does NOT mark the unseen tutorial as seen — we
    // didn't show the user anything.
    expect(useUserStore.getState().modeTutorialsSeen[3]).toBeUndefined();
  });
});
