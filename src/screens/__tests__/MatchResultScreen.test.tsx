import { act, fireEvent } from '@testing-library/react-native';

import { __resetMockUserForTests, mockUser } from '@data/mockUser';
import { MatchResultScreen } from '../MatchResultScreen';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';
import { renderWithNavigation, stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';
import type { MatchResultOutcome, RootStackParamList } from '@navigation/routes';
import { useMatchStore } from '@state/matchStore';
import { useUserStore } from '@state/userStore';

function renderResult(modeId: number, outcome: MatchResultOutcome) {
  return renderWithNavigation(
    'MatchResult',
    {
      MatchResult: MatchResultScreen,
      Matchmaking: RouteStubScreen,
      Home: RouteStubScreen,
    },
    // 'opp-1' (shadowHunter47) is the default fixture for the result-
    // screen tests so snapshots stay stable. The opponentId chain (Phase
    // 7A.1, KI #2) is exercised end-to-end in cp4Flows.test.tsx.
    { modeId, outcome, opponentId: 'opp-1' },
  );
}

function renderEngineResult(
  params: Omit<RootStackParamList['MatchResult'], 'opponentId'> &
    Partial<Pick<RootStackParamList['MatchResult'], 'opponentId'>>,
) {
  return renderWithNavigation(
    'MatchResult',
    {
      MatchResult: MatchResultScreen,
      Matchmaking: RouteStubScreen,
      Home: RouteStubScreen,
    },
    // Default to 'opp-1' (shadowHunter47) so existing engine-path
    // fixtures don't have to thread opponentId through; tests that
    // care about a specific opponent override explicitly.
    { opponentId: 'opp-1', ...params },
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
      utils.navRef.current?.navigate('MatchResult', { modeId: 1, outcome: 'victory', opponentId: 'opp-1' });
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

describe('MatchResultScreen — Phase 7A.5 CP3 interstitial counter + trigger', () => {
  beforeEach(() => {
    __resetMockUserForTests();
    jest.useFakeTimers();
    useUserStore.setState({
      matchesSinceLastInterstitial: 0,
      adsRemoved: false,
      adsWatchedToday: 0,
      adsWatchedLastDate: null,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function renderEngineResultWithInterstitialRoute(
    outcome: MatchResultOutcome = 'victory',
  ): ReturnType<typeof renderWithNavigation> {
    return renderWithNavigation(
      'MatchResult',
      {
        MatchResult: MatchResultScreen,
        Matchmaking: RouteStubScreen,
        Home: RouteStubScreen,
        InterstitialAd: RouteStubScreen,
      },
      {
        modeId: 1,
        outcome,
        opponentId: 'opp-1',
        secret: '1234',
        guessCount: 4,
        reward: 120,
        xpGain: outcome === 'victory' ? 30 : 5,
      },
    );
  }

  it('engine-path mount increments matchesSinceLastInterstitial by 1', () => {
    expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(0);
    renderEngineResultWithInterstitialRoute('victory').unmount();
    expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(1);
  });

  it('mock path (no engine route params) does NOT increment the counter', () => {
    const before = useUserStore.getState().matchesSinceLastInterstitial;
    renderResult(1, 'victory').unmount();
    expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(before);
  });

  it('counter increments on every Mode 1-7 outcome (victory / defeat / draw / stalemate)', () => {
    for (const outcome of ['victory', 'defeat', 'draw', 'stalemate'] as const) {
      useUserStore.setState({ matchesSinceLastInterstitial: 0 });
      renderEngineResultWithInterstitialRoute(outcome).unmount();
      expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(1);
    }
  });

  it('counter at 2 after this match (2→3 transition is the trigger boundary): no nav to InterstitialAd', () => {
    useUserStore.setState({ matchesSinceLastInterstitial: 1 });
    const utils = renderEngineResultWithInterstitialRoute('victory');
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    // Counter advanced to 2; threshold is 3; no interstitial fires.
    expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(2);
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('MatchResult');
    utils.unmount();
  });

  it('counter at 3 after this match: navigates to InterstitialAd after the 1.5s grace + resets to 0', () => {
    useUserStore.setState({ matchesSinceLastInterstitial: 2 });
    const utils = renderEngineResultWithInterstitialRoute('victory');
    expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(3);
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('MatchResult');
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('InterstitialAd');
    expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(0);
    utils.unmount();
  });

  it('adsRemoved=true short-circuits the interstitial (counter still advances for state correctness)', () => {
    useUserStore.setState({ matchesSinceLastInterstitial: 2, adsRemoved: true });
    const utils = renderEngineResultWithInterstitialRoute('victory');
    // Counter still advanced — if the IAP gets revoked, the gate
    // re-opens with the correct accumulated count.
    expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(3);
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    // Stayed on MatchResult — adsRemoved shut the door before nav.
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('MatchResult');
    utils.unmount();
  });

  it('ad cap reached short-circuits the interstitial (counter still advances)', () => {
    useUserStore.setState({
      matchesSinceLastInterstitial: 2,
      adsWatchedToday: 10,
      adsWatchedLastDate: '2099-01-01', // any non-null lastDate to keep the cap "today"
    });
    // Pin "today" to that date by mocking new Date()'s zero-arg form.
    const originalDate = global.Date;
    const fixedTime = new originalDate(2099, 0, 1, 12, 0, 0).getTime();
    function MockDate(this: Date, ...args: unknown[]) {
      if (!new.target) return new (originalDate as DateConstructor)().toString();
      if (args.length === 0) return new (originalDate as DateConstructor)(fixedTime);
      // @ts-expect-error pass-through
      return new (originalDate as DateConstructor)(...args);
    }
    MockDate.prototype = originalDate.prototype;
    MockDate.now = () => fixedTime;
    MockDate.parse = originalDate.parse.bind(originalDate);
    MockDate.UTC = originalDate.UTC.bind(originalDate);
    // @ts-expect-error mock substitution for Date
    global.Date = MockDate;

    try {
      const utils = renderEngineResultWithInterstitialRoute('victory');
      expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(3);
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('MatchResult');
      utils.unmount();
    } finally {
      global.Date = originalDate;
    }
  });

  it('multi-match cadence: every 3rd match fires the interstitial, counter cycles 0-1-2-3-0-1-2-3-...', () => {
    // Simulate four sequential matches by mounting and unmounting
    // the screen four times. Phase 1: counter goes 0 → 1 → 2 → 3
    // (trigger + reset on the 3rd) → 1 (4th match restarts the cycle).
    // We assert each transition; the timer needs to fire between
    // mounts so the reset lands.

    const expectations = [1, 2, 0, 1]; // post-mount + post-trigger counter readings
    for (let i = 0; i < 4; i += 1) {
      const utils = renderEngineResultWithInterstitialRoute('victory');
      act(() => {
        jest.advanceTimersByTime(1500);
      });
      expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(expectations[i]);
      utils.unmount();
    }
  });

  it('interstitial trigger is idempotent — a re-mount under the same params does not double-fire', () => {
    useUserStore.setState({ matchesSinceLastInterstitial: 2 });
    const utils = renderEngineResultWithInterstitialRoute('victory');
    expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(3);
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('InterstitialAd');
    expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(0);
    utils.unmount();
    // Second mount should NOT increment again (the screen instance
    // is gone; a separate match completion would create a new
    // route with a fresh grantedRef).
    expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(0);
  });
});

describe('MatchResultScreen — Phase 7A.5 CP6 rewarded double UI', () => {
  beforeEach(() => {
    __resetMockUserForTests();
    jest.useFakeTimers();
    useUserStore.setState({
      matchesSinceLastInterstitial: 0,
      adsRemoved: false,
      adsWatchedToday: 0,
      adsWatchedLastDate: null,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function renderWinForDouble(
    overrides: Partial<RootStackParamList['MatchResult']> = {},
  ): ReturnType<typeof renderWithNavigation> {
    return renderWithNavigation(
      'MatchResult',
      {
        MatchResult: MatchResultScreen,
        Matchmaking: RouteStubScreen,
        Home: RouteStubScreen,
        AdWatch: RouteStubScreen,
        InterstitialAd: RouteStubScreen,
      },
      {
        modeId: 1,
        outcome: 'victory',
        opponentId: 'opp-1',
        secret: '1234',
        guessCount: 4,
        reward: 120,
        xpGain: 30,
        ...overrides,
      },
    );
  }

  it('shows the Double + Skip buttons on a win path with positive reward', () => {
    const utils = renderWinForDouble();
    expect(utils.queryByText('Double with ad?')).toBeTruthy();
    // The "Skip" label here is the new CP6 button. The legacy
    // AdWatchScreen "Skip in N" is on a different screen.
    expect(utils.queryAllByText('Skip').length).toBeGreaterThan(0);
  });

  it('hides the Double UI on a defeat (no reward to double)', () => {
    const utils = renderWinForDouble({ outcome: 'defeat', reward: 0, xpGain: 5 });
    expect(utils.queryByText('Double with ad?')).toBeNull();
  });

  it('hides the Double UI on a stalemate (refund is the original transaction, not earned)', () => {
    const utils = renderWinForDouble({ outcome: 'stalemate', reward: 50, xpGain: 0 });
    expect(utils.queryByText('Double with ad?')).toBeNull();
  });

  it('hides the Double UI when adsRemoved is true (Remove Ads IAP active)', () => {
    useUserStore.setState({ adsRemoved: true });
    const utils = renderWinForDouble();
    expect(utils.queryByText('Double with ad?')).toBeNull();
  });

  it('hides the Double UI when ad cap is reached for today', () => {
    const originalDate = global.Date;
    const fixedTime = new originalDate(2026, 4, 5, 12, 0, 0).getTime();
    function MockDate(this: Date, ...args: unknown[]) {
      if (!new.target) return new (originalDate as DateConstructor)().toString();
      if (args.length === 0) return new (originalDate as DateConstructor)(fixedTime);
      // @ts-expect-error pass-through
      return new (originalDate as DateConstructor)(...args);
    }
    MockDate.prototype = originalDate.prototype;
    MockDate.now = () => fixedTime;
    MockDate.parse = originalDate.parse.bind(originalDate);
    MockDate.UTC = originalDate.UTC.bind(originalDate);
    // @ts-expect-error mock substitution for Date
    global.Date = MockDate;

    try {
      useUserStore.setState({
        adsWatchedToday: 10,
        adsWatchedLastDate: '2026-05-05',
      });
      const utils = renderWinForDouble();
      expect(utils.queryByText('Double with ad?')).toBeNull();
    } finally {
      global.Date = originalDate;
    }
  });

  it('hides the Double UI when matchState.doubledReward is already true (idempotency)', () => {
    useMatchStore.setState({
      matchState: {
        modeId: 1,
        playerSecret: '1234',
        opponentSecret: '5678',
        playerGuesses: [],
        opponentGuesses: [],
        rngState: { seed: 1, callCount: 0 },
        phase: 'completed',
        result: { outcome: 'player_won', reason: 'cracked', turns: 4 },
        doubledReward: true,
      } as never,
    });
    const utils = renderWinForDouble();
    expect(utils.queryByText('Double with ad?')).toBeNull();
  });

  it('hides the Double UI on the mock dev-picker path (no engine route params)', () => {
    const utils = renderWithNavigation(
      'MatchResult',
      {
        MatchResult: MatchResultScreen,
        Matchmaking: RouteStubScreen,
        Home: RouteStubScreen,
      },
      // No reward / guessCount / xpGain → mock path.
      { modeId: 1, outcome: 'victory', opponentId: 'opp-1' },
    );
    expect(utils.queryByText('Double with ad?')).toBeNull();
  });

  it('Double tap navigates to AdWatch with mode="double" + extraReward = match reward', () => {
    const utils = renderWinForDouble({ reward: 180 });
    act(() => {
      fireEvent.press(utils.getByText('Double with ad?'));
    });
    const route = utils.navRef.current?.getCurrentRoute();
    expect(route?.name).toBe('AdWatch');
    expect(route?.params).toEqual({ mode: 'double', extraReward: 180 });
  });

  it('Skip tap hides the Double UI without firing the interstitial', () => {
    const utils = renderWinForDouble();
    expect(utils.queryByText('Double with ad?')).toBeTruthy();
    // Find the CP6 Skip button — it sits next to "Double with ad?".
    // queryAllByText('Skip') may also match countdown labels in
    // other screens, but we're only on MatchResult here.
    act(() => {
      fireEvent.press(utils.getAllByText('Skip')[0]!);
    });
    expect(utils.queryByText('Double with ad?')).toBeNull();
    // Stayed on MatchResult — no auto-trigger to InterstitialAd
    // (counter is at 1 in this scenario, below the threshold).
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('MatchResult');
  });

  describe('Q9 priority — Double > Interstitial mutex', () => {
    it('Double tap at counter=3 cancels the pending interstitial timer', () => {
      // Set counter so the mount effect schedules the 1.5s
      // interstitial timer.
      useUserStore.setState({ matchesSinceLastInterstitial: 2 });
      const utils = renderWinForDouble();
      // Counter advanced to 3 on mount; timer is pending.
      expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(3);
      // Tap Double BEFORE the 1.5s timer fires.
      act(() => {
        fireEvent.press(utils.getByText('Double with ad?'));
      });
      // Now on AdWatch. Advance past where the interstitial timer
      // would have fired.
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      // We should still be on AdWatch — NOT navigated to InterstitialAd.
      expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('AdWatch');
    });

    it('Skip tap at counter=3 lets the interstitial fire normally (counter stays at 3)', () => {
      useUserStore.setState({ matchesSinceLastInterstitial: 2 });
      const utils = renderWinForDouble();
      expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(3);
      act(() => {
        fireEvent.press(utils.getAllByText('Skip')[0]!);
      });
      // Skip just hides the Double UI. The 1.5s timer (set on
      // mount, before Skip tap) still fires.
      act(() => {
        jest.advanceTimersByTime(1500);
      });
      expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('InterstitialAd');
    });

    it('counter=2 (below threshold) + Double tap: no interstitial trigger anyway', () => {
      useUserStore.setState({ matchesSinceLastInterstitial: 1 });
      const utils = renderWinForDouble();
      expect(useUserStore.getState().matchesSinceLastInterstitial).toBe(2);
      act(() => {
        fireEvent.press(utils.getByText('Double with ad?'));
      });
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      // No interstitial — counter never reached threshold.
      expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('AdWatch');
    });
  });

  it('analytics: rewarded_double_offered fires once when the UI renders', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    renderWinForDouble({ reward: 180 });
    expect(logSpy).toHaveBeenCalledWith(
      '[analytics] rewarded_double_offered',
      expect.objectContaining({ modeId: 1, outcome: 'victory', reward: 180 }),
    );
    logSpy.mockRestore();
  });

  it('analytics: rewarded_double_skipped fires on Skip tap', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const utils = renderWinForDouble();
    act(() => {
      fireEvent.press(utils.getAllByText('Skip')[0]!);
    });
    expect(logSpy).toHaveBeenCalledWith(
      '[analytics] rewarded_double_skipped',
      expect.objectContaining({ modeId: 1, outcome: 'victory' }),
    );
    logSpy.mockRestore();
  });
});
