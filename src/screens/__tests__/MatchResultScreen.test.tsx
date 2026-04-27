import { act, fireEvent } from '@testing-library/react-native';

import { __resetMockUserForTests, mockUser } from '@data/mockUser';
import { MatchResultScreen } from '../MatchResultScreen';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';
import { renderWithNavigation, stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';
import type { MatchResultOutcome, RootStackParamList } from '@navigation/routes';

function renderResult(modeId: number, outcome: MatchResultOutcome) {
  return renderWithNavigation(
    'MatchResult',
    {
      MatchResult: MatchResultScreen,
      Matchmaking: RouteStubScreen,
      Home: RouteStubScreen,
    },
    { modeId, outcome },
  );
}

function renderEngineResult(params: RootStackParamList['MatchResult']) {
  return renderWithNavigation(
    'MatchResult',
    {
      MatchResult: MatchResultScreen,
      Matchmaking: RouteStubScreen,
      Home: RouteStubScreen,
    },
    params,
  );
}

describe('MatchResultScreen', () => {
  beforeEach(() => {
    __resetMockUserForTests();
  });

  it.each(['victory', 'defeat', 'draw', 'stalemate'] as const)(
    'snapshots the %s variant',
    (outcome) => {
      const utils = renderResult(1, outcome);
      expect(stableTreeForSnapshot(utils.toJSON())).toMatchSnapshot();
    },
  );

  it('victory grants rewardWin from the catalog and +30 XP label', () => {
    const before = mockUser.tokens;
    const utils = renderResult(1, 'victory');
    expect(mockUser.tokens).toBe(before + 100); // Mode 1 rewardWin
    expect(utils.queryByText('+30')).toBeTruthy();
    expect(utils.queryByText('VICTORY')).toBeTruthy();
  });

  it('defeat does not change the balance and shows +5 XP', () => {
    const before = mockUser.tokens;
    const utils = renderResult(1, 'defeat');
    expect(mockUser.tokens).toBe(before);
    expect(utils.queryByText('+5')).toBeTruthy();
    expect(utils.queryByText('DEFEAT')).toBeTruthy();
  });

  it('draw grants rewardDraw and +15 XP', () => {
    const before = mockUser.tokens;
    const utils = renderResult(1, 'draw');
    expect(mockUser.tokens).toBe(before + 50);
    expect(utils.queryByText('+15')).toBeTruthy();
    // Both the tag pill and the headline show "DRAW".
    expect(utils.queryAllByText('DRAW').length).toBeGreaterThanOrEqual(1);
  });

  it('stalemate refunds the stake and shows +0 XP', () => {
    const before = mockUser.tokens;
    const utils = renderResult(6, 'stalemate'); // Sudden Death stake 50
    expect(mockUser.tokens).toBe(before + 50);
    expect(utils.queryByText('+0')).toBeTruthy();
    expect(utils.queryAllByText('STALEMATE').length).toBeGreaterThanOrEqual(1);
    expect(utils.queryByText('refunded')).toBeTruthy();
  });

  it('reveals the catalog secret for the mode (Mode 7 = 4058)', () => {
    const utils = renderResult(7, 'victory');
    expect(utils.queryByText('4')).toBeTruthy();
    expect(utils.queryByText('0')).toBeTruthy();
    expect(utils.queryByText('5')).toBeTruthy();
    expect(utils.queryByText('8')).toBeTruthy();
  });

  it('Play again replaces into Matchmaking with the same modeId', () => {
    const utils = renderResult(3, 'victory');
    act(() => {
      fireEvent.press(utils.getByText('Play again'));
    });
    const current = utils.navRef.current?.getCurrentRoute();
    expect(current?.name).toBe('Matchmaking');
    expect(current?.params).toEqual({ modeId: 3 });
  });

  it('Home pops the stack to its top', () => {
    const utils = renderWithNavigation('Home', {
      Home: RouteStubScreen,
      MatchResult: MatchResultScreen,
      Matchmaking: RouteStubScreen,
    });
    act(() => {
      utils.navRef.current?.navigate('MatchResult', { modeId: 1, outcome: 'victory' });
    });
    act(() => {
      fireEvent.press(utils.getByText('Home'));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Home');
  });

  it('reward grant fires exactly once per mount (idempotent guard)', () => {
    const before = mockUser.tokens;
    // Two independent mounts grant once each — the *useRef* guard
    // ensures a single mount never doubles. We assert a single mount
    // increments by exactly one rewardWin.
    renderResult(1, 'victory').unmount();
    expect(mockUser.tokens).toBe(before + 100);
  });

  it('mock path (no params) does NOT bump gamesPlayed', () => {
    const before = mockUser.stats.gamesPlayed;
    renderResult(1, 'victory').unmount();
    expect(mockUser.stats.gamesPlayed).toBe(before);
  });
});

describe('MatchResultScreen — engine path (route params)', () => {
  beforeEach(() => {
    __resetMockUserForTests();
  });

  it('renders the route-supplied secret instead of the catalog mock', () => {
    const utils = renderEngineResult({
      modeId: 1,
      outcome: 'victory',
      secret: '5021',
      guessCount: 4,
      reward: 100,
      xpGain: 30,
    });
    // Catalog mock for Mode 1 is "3847" — none of those digits are 5/0/2/1.
    expect(utils.queryByText('5')).toBeTruthy();
    expect(utils.queryByText('0')).toBeTruthy();
    expect(utils.queryByText('2')).toBeTruthy();
    expect(utils.queryByText('1')).toBeTruthy();
    // The mock secret's exclusive digits should not appear as the reveal.
    // (3 and 8 sit only in the mock; if we accidentally fell back, both
    // would render.)
    expect(utils.queryByText('3')).toBeNull();
    expect(utils.queryByText('8')).toBeNull();
  });

  it('uses route.params.guessCount in the headline copy', () => {
    const utils = renderEngineResult({
      modeId: 1,
      outcome: 'victory',
      secret: '1234',
      guessCount: 3,
      reward: 100,
      xpGain: 30,
    });
    expect(utils.queryByText('You cracked the code in 3 guesses')).toBeTruthy();
  });

  it('uses route.params.reward instead of the catalog default', () => {
    const before = mockUser.tokens;
    renderEngineResult({
      modeId: 1,
      outcome: 'victory',
      secret: '1234',
      guessCount: 4,
      reward: 250, // higher than Mode 1's catalog rewardWin (100)
      xpGain: 30,
    }).unmount();
    expect(mockUser.tokens).toBe(before + 250);
  });

  it('uses route.params.xpGain in the chip', () => {
    const utils = renderEngineResult({
      modeId: 1,
      outcome: 'victory',
      secret: '1234',
      guessCount: 4,
      reward: 100,
      xpGain: 42,
    });
    expect(utils.queryByText('+42')).toBeTruthy();
  });

  it('victory grants reward + xp + records the match (gamesPlayed +1)', () => {
    const beforeTokens = mockUser.tokens;
    const beforeXp = mockUser.currentXP;
    const beforeGames = mockUser.stats.gamesPlayed;

    renderEngineResult({
      modeId: 1,
      outcome: 'victory',
      secret: '1234',
      guessCount: 4,
      reward: 100,
      xpGain: 30,
    }).unmount();

    expect(mockUser.tokens).toBe(beforeTokens + 100);
    expect(mockUser.currentXP).toBe(beforeXp + 30);
    expect(mockUser.stats.gamesPlayed).toBe(beforeGames + 1);
  });

  it('defeat grants 0 tokens but +5 xp + records the match', () => {
    const beforeTokens = mockUser.tokens;
    const beforeXp = mockUser.currentXP;
    const beforeGames = mockUser.stats.gamesPlayed;

    renderEngineResult({
      modeId: 1,
      outcome: 'defeat',
      secret: '1234',
      guessCount: 6,
      reward: 0,
      xpGain: 5,
    }).unmount();

    expect(mockUser.tokens).toBe(beforeTokens);
    expect(mockUser.currentXP).toBe(beforeXp + 5);
    expect(mockUser.stats.gamesPlayed).toBe(beforeGames + 1);
  });

  it('engine path is idempotent — a single mount records exactly one match', () => {
    const beforeGames = mockUser.stats.gamesPlayed;
    renderEngineResult({
      modeId: 1,
      outcome: 'victory',
      secret: '1234',
      guessCount: 4,
      reward: 100,
      xpGain: 30,
    }).unmount();
    expect(mockUser.stats.gamesPlayed).toBe(beforeGames + 1);
  });
});
