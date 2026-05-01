/**
 * Phase 7A.4 CP4 — DailyResultScreen smoke + state-aware render.
 */

import { act, fireEvent } from '@testing-library/react-native';

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
  turnLimit: 6,
  turnsUsed: 3,
  success: true,
  secret: '4321',
  feedbackTrail: [
    { guess: '1234', plus: 1, minus: 1, isWin: false },
    { guess: '5678', plus: 0, minus: 2, isWin: false },
    { guess: '4321', plus: 4, minus: 0, isWin: true },
  ],
};

const failureResult: DailyResultSummary = {
  ...successResult,
  turnsUsed: 6,
  success: false,
  secret: '7382',
  feedbackTrail: Array.from({ length: 6 }, () => ({
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
    expect(utils.getByText('Cracked in 3/6')).toBeTruthy();
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
});
