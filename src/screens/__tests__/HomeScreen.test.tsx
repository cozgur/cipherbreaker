import { act, fireEvent } from '@testing-library/react-native';

import { __resetMockUserForTests, mockUser } from '@data/mockUser';
import type { DailyResultSummary } from '@game/daily/types';
import { DAILY_CHALLENGE_DEFAULTS, useUserStore } from '@state/userStore';
import { HomeScreen } from '../HomeScreen';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';
import { renderWithNavigation, stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';

describe('HomeScreen', () => {
  // Pin Date at the suite level so the daily-banner countdown lands
  // at a deterministic "Resets in 14h 32m" string regardless of when
  // the test runs. Without this, the snapshot drifts every minute.
  let originalDate: typeof Date;

  beforeEach(() => {
    __resetMockUserForTests();
    originalDate = global.Date;
    const fixedTime = new originalDate(2026, 4, 1, 9, 28, 0).getTime();
    function MockDate(this: Date, ...args: unknown[]) {
      if (!new.target) {
        return new (originalDate as DateConstructor)().toString();
      }
      if (args.length === 0) {
        return new (originalDate as DateConstructor)(fixedTime);
      }
      // @ts-expect-error pass-through to native Date constructor
      return new (originalDate as DateConstructor)(...args);
    }
    MockDate.prototype = originalDate.prototype;
    MockDate.now = () => fixedTime;
    MockDate.parse = originalDate.parse.bind(originalDate);
    MockDate.UTC = originalDate.UTC.bind(originalDate);
    // @ts-expect-error mock substitution for global Date
    global.Date = MockDate;
  });

  afterEach(() => {
    global.Date = originalDate;
    useUserStore.setState({ dailyChallenge: DAILY_CHALLENGE_DEFAULTS });
  });

  it('snapshots the seven-mode layout', () => {
    const { toJSON } = renderWithNavigation('Home', {
      Home: HomeScreen,
    });
    expect(stableTreeForSnapshot(toJSON())).toMatchSnapshot();
  });

  it('surfaces both CLASSIC and ADVANCED section labels', () => {
    const { getByText } = renderWithNavigation('Home', { Home: HomeScreen });
    expect(getByText('CLASSIC')).toBeTruthy();
    expect(getByText('ADVANCED')).toBeTruthy();
  });

  it('navigates to Matchmaking when the balance covers the stake', () => {
    mockUser.tokens = 1000;
    const utils = renderWithNavigation('Home', {
      Home: HomeScreen,
      Matchmaking: RouteStubScreen,
      InsufficientTokens: RouteStubScreen,
    });

    // COLOR MATCH stake is 50 → far below 1000 → Matchmaking.
    act(() => {
      fireEvent.press(utils.getByLabelText('COLOR MATCH — 50 tokens'));
    });

    const current = utils.navRef.current?.getCurrentRoute();
    expect(current?.name).toBe('Matchmaking');
    expect(current?.params).toEqual({ modeId: 1 });
  });

  it('opens InsufficientTokens when the balance is below the stake', () => {
    mockUser.tokens = 0;
    const utils = renderWithNavigation('Home', {
      Home: HomeScreen,
      Matchmaking: RouteStubScreen,
      InsufficientTokens: RouteStubScreen,
    });

    act(() => {
      fireEvent.press(utils.getByLabelText('BLACKOUT — 100 tokens'));
    });

    const current = utils.navRef.current?.getCurrentRoute();
    expect(current?.name).toBe('InsufficientTokens');
    expect(current?.params).toEqual({ modeId: 5 });
  });

  it('tapping the avatar opens Profile', () => {
    const utils = renderWithNavigation('Home', {
      Home: HomeScreen,
      Profile: RouteStubScreen,
    });

    act(() => {
      fireEvent.press(utils.getByLabelText('Open profile'));
    });

    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Profile');
  });

  it('tapping the token badge opens Shop', () => {
    const utils = renderWithNavigation('Home', {
      Home: HomeScreen,
      Shop: RouteStubScreen,
    });

    act(() => {
      fireEvent.press(utils.getByLabelText('Open shop'));
    });

    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Shop');
  });

  describe('Daily Challenge banner — Phase 7A.4 CP5', () => {
    // Date is mocked + dailyChallenge state is reset by the suite-
    // level beforeEach/afterEach above. No further setup needed.

    it('fresh state — banner shows the play CTA + Day # + countdown', () => {
      const utils = renderWithNavigation('Home', { Home: HomeScreen });
      expect(utils.getByText("Today's puzzle 🔓")).toBeTruthy();
      // Day 1, 4 digits, "14h 32m" countdown from 09:28.
      expect(utils.getByText(/Day #1/)).toBeTruthy();
      expect(utils.getByText(/4 digits/)).toBeTruthy();
      expect(utils.getByText(/14h 32m/)).toBeTruthy();
    });

    it('cracked state — banner shows turn ratio + streak', () => {
      const cracked: DailyResultSummary = {
        date: '2026-05-01',
        digits: 4,
        turnLimit: 6,
        turnsUsed: 3,
        success: true,
        secret: '4321',
        feedbackTrail: [],
      };
      useUserStore.setState({
        dailyChallenge: { ...DAILY_CHALLENGE_DEFAULTS, lastResult: cracked, currentStreak: 5 },
      });
      const utils = renderWithNavigation('Home', { Home: HomeScreen });
      expect(utils.getByText('✓ Cracked in 3/6')).toBeTruthy();
      expect(utils.getByText(/Streak 5/)).toBeTruthy();
    });

    it('failed state — banner shows day-not-cracked + streak-broken', () => {
      const failed: DailyResultSummary = {
        date: '2026-05-01',
        digits: 4,
        turnLimit: 6,
        turnsUsed: 6,
        success: false,
        secret: '7382',
        feedbackTrail: [],
      };
      useUserStore.setState({
        dailyChallenge: { ...DAILY_CHALLENGE_DEFAULTS, lastResult: failed, currentStreak: 0 },
      });
      const utils = renderWithNavigation('Home', { Home: HomeScreen });
      expect(utils.getByText('Day #1 not cracked')).toBeTruthy();
      expect(utils.getByText(/Streak broken/)).toBeTruthy();
    });

    it('banner tap on fresh state navigates to Daily', () => {
      const utils = renderWithNavigation('Home', {
        Home: HomeScreen,
        Daily: RouteStubScreen,
      });
      act(() => {
        fireEvent.press(utils.getByLabelText(/Daily challenge/));
      });
      expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Daily');
    });

    it('banner tap on cracked state navigates to DailyResult (Wordle no-replay)', () => {
      const cracked: DailyResultSummary = {
        date: '2026-05-01',
        digits: 4,
        turnLimit: 6,
        turnsUsed: 3,
        success: true,
        secret: '4321',
        feedbackTrail: [],
      };
      useUserStore.setState({
        dailyChallenge: { ...DAILY_CHALLENGE_DEFAULTS, lastResult: cracked },
      });
      const utils = renderWithNavigation('Home', {
        Home: HomeScreen,
        DailyResult: RouteStubScreen,
      });
      act(() => {
        fireEvent.press(utils.getByLabelText(/Daily challenge/));
      });
      expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('DailyResult');
    });

    it('banner tap on failed state navigates to DailyResult (no replay either)', () => {
      const failed: DailyResultSummary = {
        date: '2026-05-01',
        digits: 4,
        turnLimit: 6,
        turnsUsed: 6,
        success: false,
        secret: '7382',
        feedbackTrail: [],
      };
      useUserStore.setState({
        dailyChallenge: { ...DAILY_CHALLENGE_DEFAULTS, lastResult: failed },
      });
      const utils = renderWithNavigation('Home', {
        Home: HomeScreen,
        DailyResult: RouteStubScreen,
      });
      act(() => {
        fireEvent.press(utils.getByLabelText(/Daily challenge/));
      });
      expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('DailyResult');
    });
  });
});
