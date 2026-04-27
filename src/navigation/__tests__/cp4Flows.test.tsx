/**
 * Cross-screen integration flows for Phase 2 Checkpoint 4 — the full
 * engine-driven match → result loop for Mode 1. Asserts the chain
 * MatchScreen completion → navigation.replace → MatchResultScreen
 * mount delivers reward, XP, and a recorded match into the user
 * store, ending in a +1 on `gamesPlayed`.
 *
 * The CP3 mock-path flows still cover the DevResultPicker variant
 * for unregistered modes (2-7).
 */

import { act } from '@testing-library/react-native';

import { __resetMockUserForTests, mockUser } from '@data/mockUser';
import { __resetRegistryForTests, modeRegistry } from '@game/modeRegistry';
import { mode1ColorMatch } from '@game/modes/mode1ColorMatch';
import type { MatchState } from '@game/types';
import { MatchResultScreen } from '@screens/MatchResultScreen';
import { MatchScreen } from '@screens/MatchScreen';
import { useMatchStore } from '@state/matchStore';
import { renderWithNavigation } from '@/test-utils/renderWithNavigation';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';

const stack = {
  Match: MatchScreen,
  MatchResult: MatchResultScreen,
  Matchmaking: RouteStubScreen,
  Home: RouteStubScreen,
};

function seedActiveMatch(playerSecret: string): MatchState {
  const store = useMatchStore.getState();
  store.clearMatch();
  store.createMatch(1, playerSecret);
  store.startMatch();
  useMatchStore.setState((s) => ({
    matchState: s.matchState
      ? { ...s.matchState, phase: 'active_turn_player' }
      : null,
  }));
  return useMatchStore.getState().matchState!;
}

function completeMatch(
  state: MatchState,
  outcome: 'player_won' | 'opponent_won',
  turns: number,
  opponentSecret = '5731',
): void {
  useMatchStore.setState({
    matchState: {
      ...state,
      opponentSecret,
      phase: 'completed',
      result: { outcome, reason: 'cracked', turns },
    },
  });
}

describe('CP4 engine-path flows', () => {
  beforeEach(() => {
    __resetRegistryForTests();
    modeRegistry.register(mode1ColorMatch);
    __resetMockUserForTests();
  });

  afterEach(() => {
    useMatchStore.getState().clearMatch();
  });

  it('victory grants reward + xp + bumps gamesPlayed by one', () => {
    const beforeTokens = mockUser.tokens;
    const beforeXp = mockUser.currentXP;
    const beforeGames = mockUser.stats.gamesPlayed;

    const state = seedActiveMatch('1234');
    completeMatch(state, 'player_won', 4);

    const utils = renderWithNavigation('Match', stack, {
      modeId: 1,
      opponentId: 'opp-1',
    });
    // The completion useEffect inside MatchScreen replaces into
    // MatchResult on first commit; the result screen's grant effect
    // fires on its own first commit.
    act(() => {});

    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('MatchResult');
    expect(mockUser.tokens).toBe(beforeTokens + 100);
    expect(mockUser.currentXP).toBe(beforeXp + 30);
    expect(mockUser.stats.gamesPlayed).toBe(beforeGames + 1);
  });

  it('defeat grants 0 tokens but +5 xp + bumps gamesPlayed by one', () => {
    const beforeTokens = mockUser.tokens;
    const beforeXp = mockUser.currentXP;
    const beforeGames = mockUser.stats.gamesPlayed;

    const state = seedActiveMatch('1234');
    completeMatch(state, 'opponent_won', 6);

    renderWithNavigation('Match', stack, { modeId: 1, opponentId: 'opp-1' });
    act(() => {});

    expect(mockUser.tokens).toBe(beforeTokens);
    expect(mockUser.currentXP).toBe(beforeXp + 5);
    expect(mockUser.stats.gamesPlayed).toBe(beforeGames + 1);
  });

  it('reveal uses the route-supplied opponent secret, not mockSecretByMode[1]', () => {
    const state = seedActiveMatch('1234');
    completeMatch(state, 'player_won', 4, '9182');

    const utils = renderWithNavigation('Match', stack, {
      modeId: 1,
      opponentId: 'opp-1',
    });
    act(() => {});

    // Mode 1's catalog mock secret is "3847" — none of those digits
    // are 9 or 1 or 8 or 2. If the reveal wired the engine secret in,
    // the result tiles render 9/1/8/2.
    expect(utils.queryByText('9')).toBeTruthy();
    expect(utils.queryByText('1')).toBeTruthy();
    expect(utils.queryByText('8')).toBeTruthy();
    expect(utils.queryByText('2')).toBeTruthy();
  });
});
