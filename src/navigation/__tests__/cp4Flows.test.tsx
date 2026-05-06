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
import { useUserStore, USER_STORE_DEFAULTS } from '@state/userStore';
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
    // Phase 7A.6 CP3.1 — fresh-install defaults zero gamesPlayed /
    // bestStreak. Post-victory recording bumps gamesPlayed → 1,
    // bestStreak → 1, which would collide with single-digit
    // `queryByText` checks against the secret reveal (e.g. secret
    // '9182' has digit '1', and the StatCard also shows '1').
    // Pin to multi-digit values so single-digit reveals stay
    // unambiguous.
    useUserStore.setState({
      stats: {
        ...USER_STORE_DEFAULTS.stats,
        gamesPlayed: 100,
        winRate: 60,
        bestStreak: 99,
      },
    });
  });

  afterEach(() => {
    useMatchStore.getState().clearMatch();
  });

  // Mode 1 catalog: stake=50, rewardWin=100. Phase 7A.5 CP2 layered
  // a DDA-aware multiplier over the catalog base; the seeded fresh
  // user lands on `'normal'` (warm-up — fewer than 10 recentMatches),
  // so the credited amount is `Math.floor(100 × 1.2) = 120`. Net flow:
  //   victory  → -50 (createMatch debit) +120 (reward) = +70
  //   defeat   → -50 (createMatch debit)               = -50
  //   stalemate→ -50 (createMatch debit) +50 (refund)  =   0
  // Stalemate refund stays raw (no multiplier — refunding the
  // stake, not earning new tokens).
  it('victory grants reward + xp + bumps gamesPlayed by one', () => {
    const state = seedActiveMatch('1234');
    completeMatch(state, 'player_won', 4);
    const beforeTokens = mockUser.tokens;
    const beforeXp = mockUser.currentXP;
    const beforeGames = mockUser.stats.gamesPlayed;

    const utils = renderWithNavigation('Match', stack, {
      modeId: 1,
      opponentId: 'opp-1',
    });
    // The completion useEffect inside MatchScreen replaces into
    // MatchResult on first commit; the result screen's grant effect
    // fires on its own first commit.
    act(() => {});

    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('MatchResult');
    // Mode 1 win × normal = 100 × 1.2 = 120 tokens credited.
    expect(mockUser.tokens).toBe(beforeTokens + 120);
    expect(mockUser.currentXP).toBe(beforeXp + 30);
    expect(mockUser.stats.gamesPlayed).toBe(beforeGames + 1);
  });

  it('defeat grants 0 tokens but +5 xp + bumps gamesPlayed by one', () => {
    const state = seedActiveMatch('1234');
    completeMatch(state, 'opponent_won', 6);
    const beforeTokens = mockUser.tokens;
    const beforeXp = mockUser.currentXP;
    const beforeGames = mockUser.stats.gamesPlayed;

    renderWithNavigation('Match', stack, { modeId: 1, opponentId: 'opp-1' });
    act(() => {});

    expect(mockUser.tokens).toBe(beforeTokens);
    expect(mockUser.currentXP).toBe(beforeXp + 5);
    expect(mockUser.stats.gamesPlayed).toBe(beforeGames + 1);
  });

  it('Bug 1 — createMatch debits the mode stake from the user store', () => {
    const beforeTokens = mockUser.tokens;
    seedActiveMatch('1234');
    // Mode 1 stake is 50 (catalog).
    expect(mockUser.tokens).toBe(beforeTokens - 50);
  });

  it('Bug 1 — net victory token = (rewardWin × DDA multiplier) - stake (+70 net for Mode 1 normal)', () => {
    const beforeTokens = mockUser.tokens;
    const state = seedActiveMatch('1234');
    completeMatch(state, 'player_won', 4);

    renderWithNavigation('Match', stack, { modeId: 1, opponentId: 'opp-1' });
    act(() => {});

    // -50 (stake at createMatch) + 120 (DDA-multiplied reward at
    // MatchResult mount; Mode 1 normal = 100 × 1.2) = +70 net.
    expect(mockUser.tokens).toBe(beforeTokens + 70);
  });

  it('Bug 1 — stalemate refunds the stake (net zero)', () => {
    const beforeTokens = mockUser.tokens;
    const state = seedActiveMatch('1234');
    // Stalemate path — MatchResultScreen's view model returns `c.stake`
    // as the reward, so the user lands net zero relative to pre-match.
    useMatchStore.setState({
      matchState: {
        ...state,
        opponentSecret: '5731',
        phase: 'completed',
        result: { outcome: 'stalemate', reason: 'both_exhausted', turns: 5 },
      },
    });

    renderWithNavigation('Match', stack, { modeId: 1, opponentId: 'opp-1' });
    act(() => {});

    // -50 (stake at createMatch) + 50 (refund at MatchResult mount) = 0.
    expect(mockUser.tokens).toBe(beforeTokens);
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
