/**
 * Phase 7A.4 CP4 — DailyResultScreen smoke + state-aware render.
 */

import { act, fireEvent } from '@testing-library/react-native';
import type * as ReactNative from 'react-native';
import { Share } from 'react-native';

import { formatDailyShare } from '@game/daily/share';
import type { DailyResultSummary } from '@game/daily/types';
import {
  DAILY_CHALLENGE_DEFAULTS,
  USER_STORE_DEFAULTS,
  useUserStore,
} from '@state/userStore';
import { DailyResultScreen } from '../DailyResultScreen';
import { HomeScreen } from '../HomeScreen';
import { renderWithNavigation } from '@/test-utils/renderWithNavigation';

const successResult: DailyResultSummary = {
  date: '2026-05-01',
  digits: 4,
  turnLimit: 10,
  turnsUsed: 3,
  success: true,
  secret: '4321',
  feedbackTrail: [
    { guess: '1234', plus: 1, minus: 1, isWin: false },
    { guess: '5678', plus: 0, minus: 2, isWin: false },
    { guess: '4321', plus: 4, minus: 0, isWin: true },
  ],
  hintsUsed: 0,
};

const failureResult: DailyResultSummary = {
  ...successResult,
  turnsUsed: 10,
  success: false,
  secret: '7382',
  feedbackTrail: Array.from({ length: 10 }, () => ({
    guess: '1111',
    plus: 0,
    minus: 0,
    isWin: false,
  })),
};

function setLastResult(result: DailyResultSummary | null, overrides = {}): void {
  useUserStore.setState({
    dailyChallenge: {
      ...DAILY_CHALLENGE_DEFAULTS,
      lastResult: result,
      ...overrides,
    },
  });
}

describe('DailyResultScreen', () => {
  beforeEach(() => {
    useUserStore.setState({
      dailyChallenge: DAILY_CHALLENGE_DEFAULTS,
      stats: USER_STORE_DEFAULTS.stats,
    });
  });

  it('renders the success headline with turns used / turn limit', () => {
    setLastResult(successResult, { currentStreak: 3, longestStreak: 7 });
    const utils = renderWithNavigation('DailyResult', { DailyResult: DailyResultScreen });
    expect(utils.getByText('Cracked in 3/10')).toBeTruthy();
  });

  it('renders the failure headline when the day was not cracked', () => {
    setLastResult(failureResult);
    const utils = renderWithNavigation('DailyResult', { DailyResult: DailyResultScreen });
    expect(utils.getByText('Day not cracked')).toBeTruthy();
  });

  it('shows the streak + best streak', () => {
    setLastResult(successResult, { currentStreak: 12, longestStreak: 21 });
    const utils = renderWithNavigation('DailyResult', { DailyResult: DailyResultScreen });
    expect(utils.getByText('12 days')).toBeTruthy();
    expect(utils.getByText('21 days')).toBeTruthy();
  });

  it('singular pluralisation — "1 day" vs "0 days"', () => {
    setLastResult(successResult, { currentStreak: 1, longestStreak: 0 });
    const utils = renderWithNavigation('DailyResult', { DailyResult: DailyResultScreen });
    expect(utils.getByText('1 day')).toBeTruthy();
    expect(utils.getByText('0 days')).toBeTruthy();
  });

  it('HOME button navigates to Home', () => {
    setLastResult(successResult);
    const utils = renderWithNavigation('DailyResult', {
      DailyResult: DailyResultScreen,
      Home: HomeScreen,
    });
    act(() => {
      fireEvent.press(utils.getByLabelText('HOME'));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Home');
  });

  it('shows the DAY # badge keyed off the recorded result date', () => {
    setLastResult(successResult);
    const utils = renderWithNavigation('DailyResult', { DailyResult: DailyResultScreen });
    // 2026-05-01 = LAUNCH_EPOCH = Day 1.
    expect(utils.getByText('DAY #1')).toBeTruthy();
  });

  it('falls back to a friendly empty state when no result is recorded', () => {
    setLastResult(null);
    const utils = renderWithNavigation('DailyResult', { DailyResult: DailyResultScreen });
    expect(utils.getByText('No daily result yet')).toBeTruthy();
  });

  describe('SHARE button — Phase 7A.4 CP7 native Share API hookup', () => {
    let shareSpy: jest.SpyInstance;

    beforeEach(() => {
      // Spy locally rather than through jest.setup.js — keeps the
      // assertion explicit + avoids global side effects on tests
      // that don't tap SHARE.
      shareSpy = jest
        .spyOn(Share, 'share')
        .mockResolvedValue({ action: 'sharedAction' } as unknown as Awaited<
          ReturnType<typeof Share.share>
        >);
    });

    afterEach(() => {
      shareSpy.mockRestore();
    });

    it('SHARE press calls Share.share with the formatted share text', () => {
      setLastResult(successResult);
      const utils = renderWithNavigation('DailyResult', { DailyResult: DailyResultScreen });
      act(() => {
        fireEvent.press(utils.getByLabelText('SHARE'));
      });
      expect(shareSpy).toHaveBeenCalledTimes(1);
      const arg = shareSpy.mock.calls[0]?.[0] as { message?: string } | undefined;
      // CP9.1 — no firstPlayedDate stamped in this fixture, so the
      // screen coalesces the epoch to the result date (→ Day 1).
      expect(arg?.message).toBe(formatDailyShare(successResult, successResult.date));
    });

    it('SHARE swallows a Share.share rejection (iOS user-cancel path)', async () => {
      shareSpy.mockReset();
      shareSpy.mockRejectedValue(new Error('User cancelled'));
      setLastResult(successResult);
      const utils = renderWithNavigation('DailyResult', { DailyResult: DailyResultScreen });
      // The press itself must not throw; a rejected Share is the
      // documented iOS cancel path and surfaces no error to the user.
      expect(() => {
        act(() => {
          fireEvent.press(utils.getByLabelText('SHARE'));
        });
      }).not.toThrow();
      // Drain the pending microtask so the .catch handler runs and
      // the unhandled-rejection guard reports clean.
      await Promise.resolve();
      expect(shareSpy).toHaveBeenCalledTimes(1);
    });

    it('SHARE swallows a non-cancel native error without showing an Alert', async () => {
      // Post-CP7 iOS test feedback: an Alert was appearing instead
      // of the native share sheet. Root cause was a stale Metro
      // bundle (the source had already migrated to Share.share).
      // To make a regression structural: an iOS-layer error must
      // never resurface as an Alert.alert popup. We rely on the
      // import surface — if Alert was being called, the spy here
      // would catch it.
      const RN = jest.requireActual('react-native') as typeof ReactNative;
      const alertSpy = jest.spyOn(RN.Alert, 'alert');
      shareSpy.mockReset();
      shareSpy.mockRejectedValue(new Error('Native module bridge failure'));
      setLastResult(successResult);
      const utils = renderWithNavigation('DailyResult', { DailyResult: DailyResultScreen });
      act(() => {
        fireEvent.press(utils.getByLabelText('SHARE'));
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(shareSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    it('SHARE on a failure result still emits the same share format', () => {
      setLastResult(failureResult);
      const utils = renderWithNavigation('DailyResult', { DailyResult: DailyResultScreen });
      act(() => {
        fireEvent.press(utils.getByLabelText('SHARE'));
      });
      const arg = shareSpy.mock.calls[0]?.[0] as { message?: string } | undefined;
      expect(arg?.message).toBe(formatDailyShare(failureResult, failureResult.date));
      expect(arg?.message).toContain('10/10');
    });

    it('SHARE button is not surfaced when no result is recorded', () => {
      setLastResult(null);
      const utils = renderWithNavigation('DailyResult', { DailyResult: DailyResultScreen });
      // The empty state renders the HOME button but no SHARE button.
      // Looking it up by label asserts the intended UX — SHARE is
      // not surfaced when there is nothing to share.
      expect(utils.queryByLabelText('SHARE')).toBeNull();
      expect(shareSpy).not.toHaveBeenCalled();
    });
  });

  describe('Phase 7A.5 CP6 — Daily ad-free invariant (no rewarded Double UI)', () => {
    it('a Daily win NEVER surfaces the "Double with ad?" affordance (Q7=B — Daily is ad-free)', () => {
      // The Double UI lives exclusively on MatchResultScreen for
      // Mode 1-7 wins. DailyResultScreen is a different surface
      // and does not consume `applyRewardedDouble`. Pinned by
      // searching the rendered output for the canonical CTA copy.
      setLastResult(successResult);
      const utils = renderWithNavigation('DailyResult', { DailyResult: DailyResultScreen });
      expect(utils.queryByText('Double with ad?')).toBeNull();
    });
  });

  describe('hint badge — Phase 7A.4 CP6 PURE SKILL surface', () => {
    it('zero hints used shows the gold "PURE SKILL" badge', () => {
      setLastResult({ ...successResult, hintsUsed: 0 });
      const utils = renderWithNavigation('DailyResult', { DailyResult: DailyResultScreen });
      expect(utils.getByText('🎯 PURE SKILL')).toBeTruthy();
    });

    it('one hint used shows singular phrasing', () => {
      setLastResult({ ...successResult, hintsUsed: 1 });
      const utils = renderWithNavigation('DailyResult', { DailyResult: DailyResultScreen });
      expect(utils.getByText('Used 1 hint')).toBeTruthy();
    });

    it('multiple hints used shows plural phrasing', () => {
      setLastResult({ ...successResult, hintsUsed: 3 });
      const utils = renderWithNavigation('DailyResult', { DailyResult: DailyResultScreen });
      expect(utils.getByText('Used 3 hints')).toBeTruthy();
    });
  });

  describe('Notification opt-in modal — Phase 7A.6 CP6', () => {
    function setOptInAsked(value: boolean): void {
      useUserStore.setState((s) => ({
        onboarding: { ...s.onboarding, notificationOptInAsked: value },
      }));
    }

    it('opens on Daily WIN when notificationOptInAsked === false', () => {
      setOptInAsked(false);
      setLastResult(successResult);
      const utils = renderWithNavigation('DailyResult', { DailyResult: DailyResultScreen });
      expect(utils.queryByTestId('notification-opt-in-modal')).toBeTruthy();
      expect(utils.queryByText("Don't miss tomorrow's Daily")).toBeTruthy();
    });

    it('does NOT open on Daily LOSE (win-only trigger)', () => {
      setOptInAsked(false);
      setLastResult(failureResult);
      const utils = renderWithNavigation('DailyResult', { DailyResult: DailyResultScreen });
      expect(utils.queryByTestId('notification-opt-in-modal')).toBeNull();
    });

    it('does NOT open when notificationOptInAsked === true (single-shot)', () => {
      setOptInAsked(true);
      setLastResult(successResult);
      const utils = renderWithNavigation('DailyResult', { DailyResult: DailyResultScreen });
      expect(utils.queryByTestId('notification-opt-in-modal')).toBeNull();
    });

    it('does NOT open when there is no recorded result', () => {
      setOptInAsked(false);
      setLastResult(null);
      const utils = renderWithNavigation('DailyResult', { DailyResult: DailyResultScreen });
      expect(utils.queryByTestId('notification-opt-in-modal')).toBeNull();
    });

    it('"Not now" tap unmounts the modal via the seen-flag flip', () => {
      setOptInAsked(false);
      setLastResult(successResult);
      const utils = renderWithNavigation('DailyResult', { DailyResult: DailyResultScreen });
      expect(utils.queryByTestId('notification-opt-in-modal')).toBeTruthy();

      act(() => {
        fireEvent.press(utils.getByLabelText('Dismiss notification opt-in'));
      });

      // Flag flip → derived `showNotificationOptIn` is now false → modal
      // unmounts on next render.
      expect(useUserStore.getState().onboarding.notificationOptInAsked).toBe(true);
      expect(utils.queryByTestId('notification-opt-in-modal')).toBeNull();
    });
  });
});
