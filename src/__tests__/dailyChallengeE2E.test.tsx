/**
 * Phase 7A.4 CP7 — Daily Challenge end-to-end user journey.
 *
 * One test, one render: HomeScreen banner tap → DailyMatchScreen
 * with the seeded secret → win → DailyResultScreen → SHARE press
 * (verify Share.share was called with the canonical share text) →
 * HOME → assert HomeScreen banner repaints in the `cracked` state.
 *
 * The store-level invariants (streak, regression, hint pool, history
 * cap, cross-store ordering) live in `dailyChallengeSimulation.test.ts`
 * + `dailyChallengeStore.test.ts` + `streak.test.ts`. The screen-level
 * behaviours live in `DailyMatchScreen.test.tsx` +
 * `DailyResultScreen.test.tsx` + `HomeScreen.test.tsx`. This file
 * verifies the seam: the user can complete a real attempt, see the
 * result surface, share it, navigate home, and find the home banner
 * reflecting today's win — no broken nav contract along the way.
 */

import { act, fireEvent } from '@testing-library/react-native';
import { Share } from 'react-native';

import { __resetMockUserForTests } from '@data/mockUser';
import { formatDailyShare } from '@game/daily/share';
import { useDailyChallengeStore } from '@state/dailyChallengeStore';
import {
  DAILY_CHALLENGE_DEFAULTS,
  USER_STORE_DEFAULTS,
  useUserStore,
} from '@state/userStore';
import { DailyMatchScreen } from '@/screens/DailyMatchScreen';
import { DailyResultScreen } from '@/screens/DailyResultScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { renderWithNavigation } from '@/test-utils/renderWithNavigation';

describe('Daily Challenge E2E — banner → match → win → share → home', () => {
  let originalDate: typeof Date;
  let shareSpy: jest.SpyInstance;

  beforeEach(() => {
    __resetMockUserForTests();
    useDailyChallengeStore.setState({ currentAttempt: null, isSubmitting: false });
    useUserStore.setState({
      dailyChallenge: DAILY_CHALLENGE_DEFAULTS,
      stats: USER_STORE_DEFAULTS.stats,
      tokens: USER_STORE_DEFAULTS.tokens,
    });

    // Pin Date to LAUNCH_EPOCH 09:28 — same fixture window the
    // HomeScreen test uses so the banner copy is deterministic
    // ("Resets in 14h 32m"). Both screens (Home + DailyMatch) call
    // `formatDailyDate(new Date())` on mount, so the mock has to
    // cover the zero-arg constructor.
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

    shareSpy = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction' } as unknown as Awaited<
        ReturnType<typeof Share.share>
      >);
  });

  afterEach(() => {
    global.Date = originalDate;
    shareSpy.mockRestore();
  });

  it('full happy path: tap banner → enter secret → win → share → home → banner shows cracked', () => {
    const utils = renderWithNavigation('Home', {
      Home: HomeScreen,
      Daily: DailyMatchScreen,
      DailyResult: DailyResultScreen,
    });

    // 1. HomeScreen: banner is in fresh state, copy reflects Day 1.
    expect(utils.getByText("Today's puzzle 🔓")).toBeTruthy();
    expect(utils.getByText(/Day #1/)).toBeTruthy();

    // 2. Tap the banner — navigation guard routes fresh → Daily.
    act(() => {
      fireEvent.press(utils.getByLabelText(/Daily challenge/));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Daily');

    // 3. The screen mount fires startToday(today, config). Read
    //    the seeded secret off the store and tap the keypad keys
    //    for each digit, then SUBMIT.
    const seeded = useDailyChallengeStore.getState().currentAttempt;
    expect(seeded).not.toBeNull();
    expect(seeded!.date).toBe('2026-05-01');
    expect(seeded!.digits).toBe(4);
    for (const ch of seeded!.secret) {
      act(() => {
        fireEvent.press(utils.getByLabelText(ch));
      });
    }
    act(() => {
      fireEvent.press(utils.getByLabelText('Submit guess'));
    });

    // 4. The win path replaces the route with DailyResult.
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('DailyResult');
    // Result surface shows the cracked headline + PURE SKILL badge.
    expect(utils.getByText(/Cracked in 1\/10/)).toBeTruthy();
    expect(utils.getByText('🎯 PURE SKILL')).toBeTruthy();

    // 5. Cross-store assertion — userStore.lastResult was stamped,
    //    streak became 1, history grew, currentAttempt cleared.
    const lastResult = useUserStore.getState().dailyChallenge.lastResult;
    expect(lastResult).not.toBeNull();
    expect(lastResult!.success).toBe(true);
    expect(lastResult!.turnsUsed).toBe(1);
    expect(useUserStore.getState().dailyChallenge.currentStreak).toBe(1);
    expect(useUserStore.getState().dailyChallenge.history).toHaveLength(1);
    expect(useDailyChallengeStore.getState().currentAttempt).toBeNull();

    // 6. Tap SHARE — verify the native Share.share() received the
    //    canonical share-text payload (not an Alert preview).
    act(() => {
      fireEvent.press(utils.getByLabelText('SHARE'));
    });
    expect(shareSpy).toHaveBeenCalledTimes(1);
    const arg = shareSpy.mock.calls[0]?.[0] as { message?: string } | undefined;
    expect(arg?.message).toBe(formatDailyShare(lastResult!));
    // Spot-check the format — Day #1, 1/10, pure skill, share URL.
    expect(arg?.message).toContain('CipherBreaker Day #1');
    expect(arg?.message).toContain('1/10');
    expect(arg?.message).toContain('✨ pure skill');
    expect(arg?.message).toContain('cipherbreaker.app');

    // 7. Tap HOME — navigation lands back at Home with the banner
    //    in cracked state (today's lastResult is on userStore).
    act(() => {
      fireEvent.press(utils.getByLabelText('HOME'));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Home');
    // Banner now reads "Cracked in 1/10" + streak.
    expect(utils.getByText('✓ Cracked in 1/10')).toBeTruthy();
    expect(utils.getByText(/Streak 1/)).toBeTruthy();
  });

  it('post-win banner tap routes to DailyResult, not Daily (no replay)', () => {
    const utils = renderWithNavigation('Home', {
      Home: HomeScreen,
      Daily: DailyMatchScreen,
      DailyResult: DailyResultScreen,
    });

    // Drive a quick win via the same flow, then come home.
    act(() => {
      fireEvent.press(utils.getByLabelText(/Daily challenge/));
    });
    const seeded = useDailyChallengeStore.getState().currentAttempt;
    for (const ch of seeded!.secret) {
      act(() => {
        fireEvent.press(utils.getByLabelText(ch));
      });
    }
    act(() => {
      fireEvent.press(utils.getByLabelText('Submit guess'));
    });
    act(() => {
      fireEvent.press(utils.getByLabelText('HOME'));
    });

    // Now tap the banner again — Wordle no-replay rule sends the
    // user to DailyResult, not back into a fresh attempt.
    act(() => {
      fireEvent.press(utils.getByLabelText(/Daily challenge/));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('DailyResult');
  });
});
