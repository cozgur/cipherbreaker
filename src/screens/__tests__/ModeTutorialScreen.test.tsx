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

  it('redirects to Matchmaking when an unsupported modeId is passed (CP5: Modes 5+6+7 still unsupported)', () => {
    // Mode 1 has its own bespoke tutorial (Phase 7A.6 CP3
    // TutorialMatchScreen) — the per-mode scaffold should never
    // render for it. Modes 5-7 have no content yet (CP6 backfills);
    // same defense. Use Mode 5 (Blackout) here since CP5 added
    // Modes 3 + 4 content and they no longer trigger the
    // defensive redirect.
    const utils = mountScreen(5);
    const route = utils.navRef.current?.getCurrentRoute();
    expect(route?.name).toBe('Matchmaking');
    expect((route?.params as { modeId: number }).modeId).toBe(5);
    // Defensive does NOT mark the unseen tutorial as seen — we
    // didn't show the user anything.
    expect(useUserStore.getState().modeTutorialsSeen[5]).toBeUndefined();
  });

  it('routes Mode 3 (Precision) — renders mode3 slide 1 with the corrected +/− mechanic copy', () => {
    const utils = mountScreen(3);
    expect(utils.getByText('PRECISION')).toBeTruthy();
    expect(utils.getByText('Score over speed')).toBeTruthy();
    // Locks the spec correction in place at the routing level
    // too (the dedicated mode3.test.tsx pins it on the slides
    // export; this asserts the scaffold actually mounts the
    // right module).
    expect(utils.getByText('Continue →')).toBeTruthy();
  });

  it('Skip on Mode 3 flips modeTutorialsSeen[3] and replaces into Matchmaking', () => {
    const utils = mountScreen(3);
    expect(useUserStore.getState().modeTutorialsSeen[3]).toBeUndefined();

    act(() => {
      fireEvent.press(utils.getByTestId('mode-tutorial-skip'));
    });

    expect(useUserStore.getState().modeTutorialsSeen[3]).toBe(true);
    const route = utils.navRef.current?.getCurrentRoute();
    expect(route?.name).toBe('Matchmaking');
    expect((route?.params as { modeId: number }).modeId).toBe(3);
  });

  it('routes Mode 4 (Blitz) — renders mode4 slide 1 with the corrected chess-clock copy', () => {
    const utils = mountScreen(4);
    expect(utils.getByText('BLITZ')).toBeTruthy();
    expect(utils.getByText('Beat the clock')).toBeTruthy();
    expect(utils.getByText('Continue →')).toBeTruthy();
  });

  it('Start match on Mode 4 (after walking 3 slides) flips modeTutorialsSeen[4] and replaces into Matchmaking', () => {
    const utils = mountScreen(4);
    act(() => {
      fireEvent.press(utils.getByText('Continue →'));
    });
    act(() => {
      fireEvent.press(utils.getByText('Continue →'));
    });

    expect(useUserStore.getState().modeTutorialsSeen[4]).toBeUndefined();

    act(() => {
      fireEvent.press(utils.getByText('Start match →'));
    });

    expect(useUserStore.getState().modeTutorialsSeen[4]).toBe(true);
    const route = utils.navRef.current?.getCurrentRoute();
    expect(route?.name).toBe('Matchmaking');
    expect((route?.params as { modeId: number }).modeId).toBe(4);
  });
});
