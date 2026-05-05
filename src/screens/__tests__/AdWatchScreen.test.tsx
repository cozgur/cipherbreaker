import { act, fireEvent } from '@testing-library/react-native';

import { __resetMockUserForTests, mockUser } from '@data/mockUser';
import { AD_CAP_PER_DAY, AD_REWARD_TOKENS } from '@game/economy/constants';
import { useUserStore } from '@state/userStore';
import { AdWatchScreen } from '../AdWatchScreen';
import { HomeScreen } from '../HomeScreen';
import { InsufficientTokensModal } from '../InsufficientTokensModal';
import { renderWithNavigation, stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';

describe('AdWatchScreen', () => {
  beforeEach(() => {
    __resetMockUserForTests();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('snapshots the initial countdown frame', () => {
    const { toJSON } = renderWithNavigation('AdWatch', { AdWatch: AdWatchScreen });
    expect(stableTreeForSnapshot(toJSON())).toMatchSnapshot();
  });

  it('starts at "Skip in 3" and counts down each second', () => {
    const utils = renderWithNavigation('AdWatch', { AdWatch: AdWatchScreen });
    expect(utils.queryByText('Skip in 3')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(utils.queryByText('Skip in 2')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(utils.queryByText('Skip in 1')).toBeTruthy();
  });

  it('Skip button arms when two seconds remain and grants the reward when tapped', () => {
    const before = mockUser.tokens;
    const utils = renderWithNavigation('AdWatch', {
      AdWatch: AdWatchScreen,
      Home: HomeScreen,
    });
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    // Now at 2 seconds left → label flips to plain "Skip" + button armed.
    const skip = utils.getByText('Skip');
    expect(skip).toBeTruthy();

    act(() => {
      fireEvent.press(skip);
    });
    expect(mockUser.tokens).toBe(before + 50);
  });

  it('auto-completes after 5 seconds and pops to the top of the stack', () => {
    const before = mockUser.tokens;
    const utils = renderWithNavigation('AdWatch', {
      AdWatch: AdWatchScreen,
      Home: HomeScreen,
    });
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(mockUser.tokens).toBe(before + 50);
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('AdWatch');
    // popToTop fires on the same tick as the reward grant.
    act(() => {
      jest.advanceTimersByTime(0);
    });
  });

  it('logs an analytics line on completion', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    renderWithNavigation('AdWatch', {
      AdWatch: AdWatchScreen,
      Home: HomeScreen,
    });
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    // Phase 7A.5 CP5 — analytics payload now includes the action's
    // success flag so a future provider can split rewarded vs.
    // cap-blocked completions in the funnel.
    expect(logSpy).toHaveBeenCalledWith(
      '[analytics] ad_watch_completed',
      expect.objectContaining({ tokens: AD_REWARD_TOKENS, reason: 'completed', success: true }),
    );
  });

  describe('Phase 7A.5 CP5 — watchAdAction integration', () => {
    it('completion stamps the ad-cap counter (1 watch today after a fresh start)', () => {
      useUserStore.setState({ adsWatchedToday: 0, adsWatchedLastDate: null });
      renderWithNavigation('AdWatch', { AdWatch: AdWatchScreen, Home: HomeScreen });
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      const state = useUserStore.getState();
      expect(state.adsWatchedToday).toBe(1);
      expect(state.adsWatchedLastDate).not.toBeNull();
    });

    it('cross-midnight: stale lastDate at cap → fresh quota, watch credits +50', () => {
      // Pin "today" to a known calendar string so the stale-day
      // path is exercised regardless of when the test runs.
      const originalDate = global.Date;
      const fixedTime = new originalDate(2026, 4, 5, 12, 0, 0).getTime();
      function MockDate(this: Date, ...args: unknown[]) {
        if (!new.target) return new (originalDate as DateConstructor)().toString();
        if (args.length === 0) return new (originalDate as DateConstructor)(fixedTime);
        // @ts-expect-error pass-through to native Date constructor
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
          adsWatchedToday: AD_CAP_PER_DAY,
          adsWatchedLastDate: '2026-05-04', // yesterday — stale
          tokens: 0,
        });
        renderWithNavigation('AdWatch', { AdWatch: AdWatchScreen, Home: HomeScreen });
        act(() => {
          jest.advanceTimersByTime(5000);
        });
        const state = useUserStore.getState();
        // Stale day reset: counter back to 1, today's date stamped.
        expect(state.adsWatchedToday).toBe(1);
        expect(state.adsWatchedLastDate).toBe('2026-05-05');
        // Wallet credited.
        expect(state.tokens).toBe(AD_REWARD_TOKENS);
      } finally {
        global.Date = originalDate;
      }
    });

    it('cap-reached defensive: screen mounted past the gate does NOT double-credit', () => {
      // Production surfaces (modal + toast) prevent this state
      // from reaching AdWatchScreen at all. The defensive test
      // pins what happens if the gate is somehow bypassed: no
      // crash, no extra tokens.
      const originalDate = global.Date;
      const fixedTime = new originalDate(2026, 4, 5, 12, 0, 0).getTime();
      function MockDate(this: Date, ...args: unknown[]) {
        if (!new.target) return new (originalDate as DateConstructor)().toString();
        if (args.length === 0) return new (originalDate as DateConstructor)(fixedTime);
        // @ts-expect-error pass-through to native Date constructor
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
          adsWatchedToday: AD_CAP_PER_DAY,
          adsWatchedLastDate: '2026-05-05',
          tokens: 100,
        });
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        renderWithNavigation('AdWatch', { AdWatch: AdWatchScreen, Home: HomeScreen });
        act(() => {
          jest.advanceTimersByTime(5000);
        });
        const state = useUserStore.getState();
        // No credit, counter unchanged.
        expect(state.tokens).toBe(100);
        expect(state.adsWatchedToday).toBe(AD_CAP_PER_DAY);
        // Analytics payload reflects the refusal so a real provider
        // can distinguish cap-blocked from rewarded watches.
        expect(logSpy).toHaveBeenCalledWith(
          '[analytics] ad_watch_completed',
          expect.objectContaining({ tokens: 0, success: false }),
        );
        logSpy.mockRestore();
      } finally {
        global.Date = originalDate;
      }
    });
  });

  describe('Phase 7A.5 CP5 — InsufficientTokensModal integration loop', () => {
    it('Modal → AdWatch → reward → Modal stake re-evaluation: balance covers stake after one watch', () => {
      mockUser.tokens = 0;
      const utils = renderWithNavigation('InsufficientTokens', {
        InsufficientTokens: InsufficientTokensModal,
        AdWatch: AdWatchScreen,
        Home: HomeScreen,
      }, { modeId: 1 });
      // Initial: zero tokens, can't afford the 50-token Mode 1 stake.
      expect(utils.queryByText(/You have 0 tokens\. This match costs 50\./)).toBeTruthy();
      // Tap Watch ad → AdWatch.
      act(() => {
        fireEvent.press(utils.getByText('Watch ad · +50'));
      });
      expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('AdWatch');
      // Drain countdown.
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      // Back on the modal with the new balance reflected.
      expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('InsufficientTokens');
      expect(useUserStore.getState().tokens).toBe(50);
      expect(utils.queryByText(/You have 50 tokens\. This match costs 50\./)).toBeTruthy();
    });
  });

  describe('Phase 7A.5 CP5 — HomeScreen LowBalanceToast integration loop', () => {
    it('LowBalanceToast → AdWatch → reward → toast hides when wallet crosses threshold', () => {
      mockUser.tokens = 50; // below LOW_BALANCE_THRESHOLD (100)
      const utils = renderWithNavigation('Home', {
        Home: HomeScreen,
        AdWatch: AdWatchScreen,
      });
      // Toast visible at 50 tokens.
      expect(utils.queryByLabelText('Low balance')).toBeTruthy();
      // Tap Watch Ad CTA.
      act(() => {
        fireEvent.press(utils.getByLabelText('Watch ad'));
      });
      expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('AdWatch');
      // Drain countdown.
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      // Back on Home, wallet now at 100 (50 + 50 reward), toast
      // hidden because the threshold gate is `< 100` (strictly).
      expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Home');
      expect(useUserStore.getState().tokens).toBe(100);
      expect(utils.queryByLabelText('Low balance')).toBeNull();
    });

    it('LowBalanceToast → AdWatch → reward → toast still visible when balance stays under threshold', () => {
      mockUser.tokens = 25; // below threshold
      const utils = renderWithNavigation('Home', {
        Home: HomeScreen,
        AdWatch: AdWatchScreen,
      });
      expect(utils.queryByLabelText('Low balance')).toBeTruthy();
      act(() => {
        fireEvent.press(utils.getByLabelText('Watch ad'));
      });
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      // 25 + 50 = 75, still under 100 — toast still visible.
      expect(useUserStore.getState().tokens).toBe(75);
      expect(utils.queryByLabelText('Low balance')).toBeTruthy();
    });
  });
});
