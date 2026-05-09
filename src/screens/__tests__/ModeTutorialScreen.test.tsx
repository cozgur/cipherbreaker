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

  it('redirects to Matchmaking when an unsupported modeId is passed (CP6: all of [2..7] now supported, defense covers Mode 1 + future modeIds)', () => {
    // After CP6 the per-mode scaffold supports modeIds 2-7
    // inclusive. Mode 1 has its own bespoke tutorial
    // (TutorialMatchScreen) and the scaffold should never
    // render for it. The remaining defensive case is any
    // out-of-range modeId — use Mode 8 (which doesn't exist)
    // here as a stand-in for "future deep link / programmer
    // error / corrupt route param."
    const utils = mountScreen(8);
    const route = utils.navRef.current?.getCurrentRoute();
    expect(route?.name).toBe('Matchmaking');
    expect((route?.params as { modeId: number }).modeId).toBe(8);
    // Defensive does NOT mark the unseen tutorial as seen — we
    // didn't show the user anything.
    expect(useUserStore.getState().modeTutorialsSeen[8]).toBeUndefined();
  });

  it('redirects to Matchmaking when modeId=1 is passed (Mode 1 owned by TutorialMatchScreen)', () => {
    const utils = mountScreen(1);
    const route = utils.navRef.current?.getCurrentRoute();
    expect(route?.name).toBe('Matchmaking');
    expect((route?.params as { modeId: number }).modeId).toBe(1);
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

  // ── CP6 — Modes 5 + 6 + 7 routing ──────────────────────────

  it('routes Mode 5 (Blackout) — renders the corrected pure-blackout-count slide 1', () => {
    const utils = mountScreen(5);
    expect(utils.getByText('BLACKOUT')).toBeTruthy();
    expect(utils.getByText("Everything's blacked out")).toBeTruthy();
    expect(utils.getByText('Continue →')).toBeTruthy();
  });

  it('Skip on Mode 5 flips modeTutorialsSeen[5] and replaces into Matchmaking', () => {
    const utils = mountScreen(5);
    expect(useUserStore.getState().modeTutorialsSeen[5]).toBeUndefined();

    act(() => {
      fireEvent.press(utils.getByTestId('mode-tutorial-skip'));
    });

    expect(useUserStore.getState().modeTutorialsSeen[5]).toBe(true);
    const route = utils.navRef.current?.getCurrentRoute();
    expect(route?.name).toBe('Matchmaking');
    expect((route?.params as { modeId: number }).modeId).toBe(5);
  });

  it('routes Mode 6 (Sudden Death) — renders 2 slides with "Five chances" first', () => {
    // Mode 6 is the only 2-slide tutorial in the set
    // (Decision 2). The scaffold reads `slides.length`
    // everywhere so this works without any branching, but
    // pin the 2-vs-3 invariant at the routing level too.
    const utils = mountScreen(6);
    expect(utils.getByText('SUDDEN DEATH')).toBeTruthy();
    expect(utils.getByText('Five chances')).toBeTruthy();
  });

  it('Mode 6 renders exactly 2 pagination dots (NOT 3)', () => {
    const utils = mountScreen(6);
    expect(utils.getByTestId('mode-tutorial-dot-0')).toBeTruthy();
    expect(utils.getByTestId('mode-tutorial-dot-1')).toBeTruthy();
    expect(utils.queryByTestId('mode-tutorial-dot-2')).toBeNull();
  });

  it('Mode 6 reaches "Start match →" after a single Continue (only 2 slides)', () => {
    const utils = mountScreen(6);
    expect(utils.getByText('Continue →')).toBeTruthy();
    act(() => {
      fireEvent.press(utils.getByText('Continue →'));
    });
    // Already at the last slide after one advance.
    expect(utils.queryByText('Continue →')).toBeNull();
    expect(utils.getByText('Start match →')).toBeTruthy();
  });

  it('Skip on Mode 6 flips modeTutorialsSeen[6] and replaces into Matchmaking', () => {
    const utils = mountScreen(6);
    expect(useUserStore.getState().modeTutorialsSeen[6]).toBeUndefined();

    act(() => {
      fireEvent.press(utils.getByTestId('mode-tutorial-skip'));
    });

    expect(useUserStore.getState().modeTutorialsSeen[6]).toBe(true);
    const route = utils.navRef.current?.getCurrentRoute();
    expect(route?.name).toBe('Matchmaking');
    expect((route?.params as { modeId: number }).modeId).toBe(6);
  });

  it('routes Mode 7 (Mirror) — renders "Same code, two minds" + the static rival board', () => {
    const utils = mountScreen(7);
    expect(utils.getByText('MIRROR')).toBeTruthy();
    expect(utils.getByText('Same code, two minds')).toBeTruthy();
    expect(utils.getByText('Continue →')).toBeTruthy();
  });

  it('Start match on Mode 7 (after walking 3 slides) flips modeTutorialsSeen[7] and replaces into Matchmaking', () => {
    const utils = mountScreen(7);
    act(() => {
      fireEvent.press(utils.getByText('Continue →'));
    });
    act(() => {
      fireEvent.press(utils.getByText('Continue →'));
    });

    expect(useUserStore.getState().modeTutorialsSeen[7]).toBeUndefined();

    act(() => {
      fireEvent.press(utils.getByText('Start match →'));
    });

    expect(useUserStore.getState().modeTutorialsSeen[7]).toBe(true);
    const route = utils.navRef.current?.getCurrentRoute();
    expect(route?.name).toBe('Matchmaking');
    expect((route?.params as { modeId: number }).modeId).toBe(7);
  });
});
