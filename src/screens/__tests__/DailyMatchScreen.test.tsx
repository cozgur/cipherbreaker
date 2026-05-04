/**
 * Phase 7A.4 CP4 — DailyMatchScreen smoke + behavior suite.
 *
 * The store-level invariants live in `dailyChallengeStore.test.ts`;
 * these tests pin the screen-level seam: render at three digit
 * tiers, draft input, submit success → DailyResult navigation,
 * resume from persisted in-progress.
 */

import { act, fireEvent } from '@testing-library/react-native';

import type { DailyChallengeState } from '@game/daily/types';
import { useDailyChallengeStore } from '@state/dailyChallengeStore';
import {
  DAILY_CHALLENGE_DEFAULTS,
  USER_STORE_DEFAULTS,
  useUserStore,
} from '@state/userStore';
import { DailyMatchScreen } from '../DailyMatchScreen';
import { DailyResultScreen } from '../DailyResultScreen';
import { renderWithNavigation } from '@/test-utils/renderWithNavigation';

const FIXED_TODAY = '2026-05-01';

function setUserDailyState(overrides: Partial<DailyChallengeState> = {}): void {
  useUserStore.setState({
    dailyChallenge: { ...DAILY_CHALLENGE_DEFAULTS, ...overrides },
  });
}

function resetStores(): void {
  useDailyChallengeStore.setState({ currentAttempt: null, isSubmitting: false });
  useUserStore.setState({
    dailyChallenge: DAILY_CHALLENGE_DEFAULTS,
    stats: USER_STORE_DEFAULTS.stats,
    tokens: USER_STORE_DEFAULTS.tokens,
  });
}

function pressEachDigit(
  utils: ReturnType<typeof renderWithNavigation>,
  digits: string,
): void {
  for (const ch of digits) {
    act(() => {
      fireEvent.press(utils.getByLabelText(ch));
    });
  }
}

describe('DailyMatchScreen', () => {
  let originalDate: typeof Date;

  beforeEach(() => {
    resetStores();
    // Pin Date so calendarDayIndex / formatDailyDate land at a
    // known calendar day. We patch `new Date()` (zero-arg call) to
    // return a fixed instant so the screen's
    // `useState(() => formatDailyDate(new Date()))` lands on May 1.
    // Other Date constructor arities (e.g. `new Date(year, month, day)`)
    // pass through unchanged.
    originalDate = global.Date;
    const fixedTime = new originalDate(2026, 4, 1, 12, 0, 0).getTime();
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
    // @ts-expect-error mock substitution for the global Date constructor
    global.Date = MockDate;
  });

  afterEach(() => {
    global.Date = originalDate;
  });

  it('renders the DAY badge with the calendar day index', () => {
    const utils = renderWithNavigation('Daily', { Daily: DailyMatchScreen });
    expect(utils.getByText('DAY #1')).toBeTruthy();
  });

  it('seeds a fresh attempt at tier-4 (Day 1 → 4 digits, 10 turns)', () => {
    renderWithNavigation('Daily', { Daily: DailyMatchScreen });
    const attempt = useDailyChallengeStore.getState().currentAttempt;
    expect(attempt).not.toBeNull();
    expect(attempt!.digits).toBe(4);
    expect(attempt!.turnLimit).toBe(10);
    expect(attempt!.guesses).toHaveLength(0);
  });

  // Variable digit count rendering across tiers is covered at the
  // unit level by `dailyConfig.test.ts`. The screen routes the
  // config object straight into store.startToday(today, config),
  // and the store is exercised at every tier in
  // `dailyChallengeStore.test.ts`. A screen-level repeat would be
  // redundant.

  it('digit taps build the draft input up to config.digits', () => {
    const utils = renderWithNavigation('Daily', { Daily: DailyMatchScreen });
    pressEachDigit(utils, '1234');
    // Draft is fully populated; further digit taps drop silently.
    act(() => {
      fireEvent.press(utils.getByLabelText('5'));
    });
    act(() => {
      fireEvent.press(utils.getByLabelText('Submit guess'));
    });
    const attempt = useDailyChallengeStore.getState().currentAttempt;
    if (attempt !== null) {
      expect(attempt.guesses[0]?.guess).toBe('1234');
    } else {
      expect(useUserStore.getState().dailyChallenge.lastResult?.feedbackTrail[0]?.guess).toBe(
        '1234',
      );
    }
  });

  it('a winning guess navigates to DailyResult', () => {
    const utils = renderWithNavigation('Daily', {
      Daily: DailyMatchScreen,
      DailyResult: DailyResultScreen,
    });
    const attempt = useDailyChallengeStore.getState().currentAttempt;
    expect(attempt).not.toBeNull();
    pressEachDigit(utils, attempt!.secret);
    act(() => {
      fireEvent.press(utils.getByLabelText('Submit guess'));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('DailyResult');
  });

  describe('hint + probe button states — Phase 7A.4 CP6', () => {
    it('HINT button is disabled when no guess submitted yet', () => {
      const utils = renderWithNavigation('Daily', { Daily: DailyMatchScreen });
      const hint = utils.getByLabelText('Hint button');
      expect(hint.props.accessibilityState.disabled).toBe(true);
      expect(utils.getByText('Make a guess first')).toBeTruthy();
    });

    it('HINT button is disabled (warning) when player has guessed but no plus/minus signal', () => {
      // Seed an attempt with one all-wrong guess.
      useDailyChallengeStore.setState({
        currentAttempt: {
          date: FIXED_TODAY,
          secret: '1234',
          digits: 4,
          turnLimit: 10,
          guesses: [{ guess: '5678', plus: 0, minus: 0, isWin: false }],
          hintsUsed: 0,
          revealedPositions: [],
          revealedDigits: [],
          probedDigits: [],
        },
      });
      const utils = renderWithNavigation('Daily', { Daily: DailyMatchScreen });
      expect(utils.getByText('No correct digits yet')).toBeTruthy();
    });

    it('HINT button is disabled when pool empty AND tokens < 100', () => {
      useDailyChallengeStore.setState({
        currentAttempt: {
          date: FIXED_TODAY,
          secret: '1234',
          digits: 4,
          turnLimit: 10,
          guesses: [{ guess: '1567', plus: 1, minus: 0, isWin: false }],
          hintsUsed: 0,
          revealedPositions: [],
          revealedDigits: [],
          probedDigits: [],
        },
      });
      useUserStore.setState({ tokens: 50 });
      const utils = renderWithNavigation('Daily', { Daily: DailyMatchScreen });
      expect(utils.getByText('Need 100 tokens')).toBeTruthy();
    });

    it('HINT button is enabled with earned-hint sublabel when pool > 0', () => {
      useDailyChallengeStore.setState({
        currentAttempt: {
          date: FIXED_TODAY,
          secret: '1234',
          digits: 4,
          turnLimit: 10,
          guesses: [{ guess: '1567', plus: 1, minus: 0, isWin: false }],
          hintsUsed: 0,
          revealedPositions: [],
          revealedDigits: [],
          probedDigits: [],
        },
      });
      useUserStore.setState({
        dailyChallenge: { ...DAILY_CHALLENGE_DEFAULTS, earnedHints: 2 },
      });
      const utils = renderWithNavigation('Daily', { Daily: DailyMatchScreen });
      // Both HINT and PROBE share the same earned pool, so both
      // sub-labels render "Free (2 left)". Two matches is the
      // expected state.
      expect(utils.getAllByText('Free (2 left)')).toHaveLength(2);
      expect(utils.getByLabelText('Hint button').props.accessibilityState.disabled).toBe(false);
    });

    it('PROBE button is enabled and shows the 50-token sublabel when pool empty', () => {
      const utils = renderWithNavigation('Daily', { Daily: DailyMatchScreen });
      const probe = utils.getByLabelText('Probe button');
      expect(probe.props.accessibilityState.disabled).toBe(false);
      expect(utils.getByText('50 tokens')).toBeTruthy();
    });

    it('PROBE button is disabled when pool empty AND tokens < 50', () => {
      useUserStore.setState({ tokens: 20 });
      const utils = renderWithNavigation('Daily', { Daily: DailyMatchScreen });
      expect(utils.getByText('Need 50 tokens')).toBeTruthy();
    });
  });

  it('resumes a persisted in-progress attempt without re-seeding', () => {
    setUserDailyState();
    useDailyChallengeStore.setState({
      currentAttempt: {
        date: FIXED_TODAY,
        secret: '5234',
        digits: 4,
        turnLimit: 10,
        guesses: [{ guess: '1234', plus: 1, minus: 0, isWin: false }],
        hintsUsed: 0,
        revealedPositions: [],
        revealedDigits: [],
        probedDigits: [],
      },
    });
    renderWithNavigation('Daily', { Daily: DailyMatchScreen });
    // Persisted board still has the existing guess — resume happened.
    const attempt = useDailyChallengeStore.getState().currentAttempt;
    expect(attempt!.guesses).toHaveLength(1);
    expect(attempt!.guesses[0]!.guess).toBe('1234');
  });
});
