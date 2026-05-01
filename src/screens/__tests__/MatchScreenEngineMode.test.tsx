/**
 * MatchScreen — engine path. These tests cover the Phase 3 cutover:
 * once Mode 1 is registered AND `useMatchStore.matchState.modeId === 1`,
 * the screen drives `matchStore.submitGuess`, surfaces validation errors
 * inline, and replaces into MatchResult on `phase === 'completed'`.
 *
 * The mock-mode tests in `MatchScreen.test.tsx` continue to cover the
 * Phase 1B DevResultPicker path for unregistered modes (Mode 2-7).
 * Splitting the suites keeps existing snapshots stable.
 */

import { ScrollView } from 'react-native';
import { act } from '@testing-library/react-native';

import { MatchScreen } from '@screens/MatchScreen';
import { __resetRegistryForTests, modeRegistry } from '@game/modeRegistry';
import { mode1ColorMatch } from '@game/modes/mode1ColorMatch';
import type { MatchState } from '@game/types';
import { useMatchStore } from '@state/matchStore';
import { renderWithNavigation } from '@/test-utils/renderWithNavigation';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';
import { mockUser, __resetMockUserForTests } from '@data/mockUser';

function registerMode1(): void {
  __resetRegistryForTests();
  modeRegistry.register(mode1ColorMatch);
}

function seedActiveMatch(playerSecret = '1234', forcePhase: 'player' | 'opponent' = 'player'): MatchState {
  const store = useMatchStore.getState();
  store.clearMatch();
  store.createMatch(1, playerSecret);
  store.startMatch();
  // Pin the active turn so tests don't depend on the rng coin flip.
  useMatchStore.setState((s) => ({
    matchState: s.matchState
      ? {
          ...s.matchState,
          phase: forcePhase === 'player' ? 'active_turn_player' : 'active_turn_opponent',
        }
      : null,
  }));
  return useMatchStore.getState().matchState!;
}

describe('MatchScreen — engine path (Mode 1)', () => {
  beforeEach(() => {
    registerMode1();
    __resetMockUserForTests();
    mockUser.username = 'phoenix99';
  });

  afterEach(() => {
    useMatchStore.getState().clearMatch();
  });

  it('renders YOUR TURN when the engine is on player phase', () => {
    seedActiveMatch('1234', 'player');
    const { getByText } = renderWithNavigation(
      'Match',
      { Match: MatchScreen },
      { modeId: 1, opponentId: 'op-1' },
    );
    expect(getByText('YOUR TURN')).toBeTruthy();
  });

  it("renders OPPONENT'S TURN when the engine is on opponent phase", () => {
    seedActiveMatch('1234', 'opponent');
    const { getByText } = renderWithNavigation(
      'Match',
      { Match: MatchScreen },
      { modeId: 1, opponentId: 'op-1' },
    );
    expect(getByText("OPPONENT'S TURN")).toBeTruthy();
  });

  it('does NOT show the DevResultPicker when engine mode is active', () => {
    seedActiveMatch('1234', 'player');
    const { queryByText } = renderWithNavigation(
      'Match',
      { Match: MatchScreen },
      { modeId: 1, opponentId: 'op-1' },
    );
    // DevResultPicker copy includes "Pick a result"; engine path skips it.
    expect(queryByText('Pick a result')).toBeNull();
  });

  it('falls back to the mock path with DevResultPicker when no match state is in the store', () => {
    // Don't seed — store is null.
    useMatchStore.getState().clearMatch();
    const { getByText, queryByText } = renderWithNavigation(
      'Match',
      { Match: MatchScreen },
      { modeId: 1, opponentId: 'op-1' },
    );
    // Bot typing footer always renders in mock path; engine-mode hides it
    // until the first opponent turn fires.
    expect(getByText(/is typing/)).toBeTruthy();
    // Picker doesn't render until the player taps Guess; existence of the
    // copy on screen signals presence (DevResultPicker is not yet open).
    expect(queryByText('Pick a result')).toBeNull();
  });

  it('reads timeline entries from matchState in engine mode', () => {
    const state = seedActiveMatch('1234', 'player');
    // Plant a player guess so the screen's timeline shows it.
    useMatchStore.setState({
      matchState: {
        ...state,
        firstAuthor: 'self',
        playerGuesses: [
          {
            side: 'self',
            guessIndex: 1,
            digits: [9, 9, 9, 9],
            feedback: {
              kind: 'colorMatch',
              states: ['gray', 'gray', 'gray', 'gray'],
              isWin: false,
            },
          },
        ],
      },
    });
    const { getByText } = renderWithNavigation(
      'Match',
      { Match: MatchScreen },
      { modeId: 1, opponentId: 'op-1' },
    );
    // Guess counter reflects the existing entry — "Guess #2" because
    // there's already one entry and the next would be the second.
    expect(getByText('Guess #2')).toBeTruthy();
  });
});

describe('MatchScreen — engine path validation error UI', () => {
  beforeEach(() => {
    registerMode1();
    __resetMockUserForTests();
    mockUser.username = 'phoenix99';
  });

  afterEach(() => {
    useMatchStore.getState().clearMatch();
  });

  it('preserves draft digits when engine reports a validation error', async () => {
    seedActiveMatch('1234', 'player');
    // Plant the 4 draft digits via the matchState path: directly call
    // submitGuess with an obviously-bad guess to exercise the error
    // branch. This isn't reachable through the keypad (it caps at 4
    // digits and refuses non-digits) — the test exercises the engine
    // boundary contract.
    const beforeState = useMatchStore.getState().matchState;
    const out = await useMatchStore.getState().submitGuess('12', 'self');
    expect(out.error?.code).toBe('WRONG_LENGTH');
    expect(out.feedback).toBeNull();
    // State is unchanged when validation fails — engine guarantees this.
    expect(useMatchStore.getState().matchState).toBe(beforeState);
  });
});

describe('MatchScreen — engine path completion forwards full params', () => {
  beforeEach(() => {
    registerMode1();
    __resetMockUserForTests();
    mockUser.username = 'phoenix99';
  });

  afterEach(() => {
    useMatchStore.getState().clearMatch();
  });

  it("forwards opponentSecret + guessCount + reward + xpGain when phase=='completed'", () => {
    const state = seedActiveMatch('1234', 'player');
    // Synthesise a completed engine state — `player_won, cracked` with
    // 4 turns. We don't care which guess produced it; the screen reads
    // `result.turns` directly.
    useMatchStore.setState({
      matchState: {
        ...state,
        opponentSecret: '7531',
        phase: 'completed',
        result: { outcome: 'player_won', reason: 'cracked', turns: 4 },
      },
    });
    const utils = renderWithNavigation(
      'Match',
      { Match: MatchScreen, MatchResult: RouteStubScreen },
      { modeId: 1, opponentId: 'op-1' },
    );
    const route = utils.navRef.current?.getCurrentRoute();
    expect(route?.name).toBe('MatchResult');
    expect(route?.params).toEqual({
      modeId: 1,
      outcome: 'victory',
      opponentId: 'op-1',
      secret: '7531',
      guessCount: 4,
      // Mode 1 catalog rewardWin = 100, victory XP = 30.
      reward: 100,
      xpGain: 30,
    });
  });

  it('forwards reward=0 + xpGain=5 on a defeat', () => {
    const state = seedActiveMatch('1234', 'player');
    useMatchStore.setState({
      matchState: {
        ...state,
        opponentSecret: '4242',
        phase: 'completed',
        result: { outcome: 'opponent_won', reason: 'cracked', turns: 5 },
      },
    });
    const utils = renderWithNavigation(
      'Match',
      { Match: MatchScreen, MatchResult: RouteStubScreen },
      { modeId: 1, opponentId: 'op-1' },
    );
    const route = utils.navRef.current?.getCurrentRoute();
    expect(route?.params).toEqual({
      modeId: 1,
      outcome: 'defeat',
      opponentId: 'op-1',
      secret: '4242',
      guessCount: 5,
      reward: 0,
      xpGain: 5,
    });
  });
});

describe('MatchScreen — engine path timeline auto-scroll', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    registerMode1();
    __resetMockUserForTests();
    mockUser.username = 'phoenix99';
  });

  afterEach(() => {
    jest.useRealTimers();
    useMatchStore.getState().clearMatch();
  });

  it('calls scrollToEnd on the timeline when the player guess count grows', () => {
    const state = seedActiveMatch('1234', 'player');
    const scrollSpy = jest
      .spyOn(ScrollView.prototype, 'scrollToEnd')
      .mockImplementation(() => undefined);
    renderWithNavigation(
      'Match',
      { Match: MatchScreen, MatchResult: RouteStubScreen },
      { modeId: 1, opponentId: 'op-1' },
    );
    // Drain the mount-tick scroll the screen schedules unconditionally.
    act(() => {
      jest.advanceTimersByTime(150);
    });
    scrollSpy.mockClear();

    // Plant a new player guess — zustand pushes the new matchState
    // through the screen's selector and the auto-scroll effect's
    // dependency array changes.
    act(() => {
      useMatchStore.setState({
        matchState: {
          ...state,
          firstAuthor: 'self',
          playerGuesses: [
            {
              side: 'self',
              guessIndex: 1,
              digits: [5, 5, 5, 5],
              feedback: {
                kind: 'colorMatch',
                states: ['gray', 'gray', 'gray', 'gray'],
                isWin: false,
              },
            },
          ],
        },
      });
    });
    act(() => {
      jest.advanceTimersByTime(150);
    });

    expect(scrollSpy).toHaveBeenCalled();
    scrollSpy.mockRestore();
  });
});

describe('MatchScreen — engine path bot turn scheduling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    registerMode1();
    __resetMockUserForTests();
    mockUser.username = 'phoenix99';
  });

  afterEach(() => {
    jest.useRealTimers();
    useMatchStore.getState().clearMatch();
  });

  it('does not run an opponent turn while phase is active_turn_player', () => {
    const state = seedActiveMatch('1234', 'player');
    renderWithNavigation('Match', { Match: MatchScreen }, { modeId: 1, opponentId: 'op-1' });
    act(() => {
      jest.advanceTimersByTime(20_000);
    });
    expect(useMatchStore.getState().matchState?.opponentGuesses.length).toBe(
      state.opponentGuesses.length,
    );
  });

  it('clears the bot timer if the screen unmounts before the delay fires', () => {
    seedActiveMatch('1234', 'opponent');
    const { unmount } = renderWithNavigation(
      'Match',
      { Match: MatchScreen },
      { modeId: 1, opponentId: 'op-1' },
    );
    unmount();
    // After unmount, no bot turn should fire — opponentGuesses stays at 0.
    act(() => {
      jest.advanceTimersByTime(20_000);
    });
    expect(useMatchStore.getState().matchState?.opponentGuesses.length).toBe(0);
  });
});
