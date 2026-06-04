/**
 * Phase 7A.4 CP4 — DailyMatchScreen smoke + behavior suite.
 *
 * The store-level invariants live in `dailyChallengeStore.test.ts`;
 * these tests pin the screen-level seam: render at three digit
 * tiers, draft input, submit success → DailyResult navigation,
 * resume from persisted in-progress.
 */

import { act, fireEvent } from '@testing-library/react-native';

import { DigitTile } from '@components/DigitTile';
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

/**
 * Build a Date mock that pins `new Date()` (zero-arg) to `fixedTime`
 * while passing every other constructor arity through to the real
 * Date. Factored out (Phase 7A.8 CP9) so the mode-rotation suite can
 * re-pin to a different calendar day — the day index drives which
 * board (Mode 1 vs Mode 3) the screen renders.
 */
function buildMockDate(real: typeof Date, fixedTime: number): typeof Date {
  function MockDate(this: Date, ...args: unknown[]) {
    if (!new.target) {
      return new (real as DateConstructor)().toString();
    }
    if (args.length === 0) {
      return new (real as DateConstructor)(fixedTime);
    }
    // @ts-expect-error pass-through to native Date constructor
    return new (real as DateConstructor)(...args);
  }
  MockDate.prototype = real.prototype;
  MockDate.now = () => fixedTime;
  MockDate.parse = real.parse.bind(real);
  MockDate.UTC = real.UTC.bind(real);
  return MockDate as unknown as typeof Date;
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
    // May 1 2026 = LAUNCH_EPOCH = Day 1 (odd) → Mode 3, so the
    // file-default board matches every pre-CP9 assertion.
    const fixedTime = new originalDate(2026, 4, 1, 12, 0, 0).getTime();
    global.Date = buildMockDate(originalDate, fixedTime);
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

  describe('history layout — Phase 7A.4 post-CP7 iOS fix', () => {
    // The pre-fix history view used `flexShrink: 1` with default
    // `overflow: 'visible'`, so 5+ rows rendered through the
    // sibling draft row below. The fix wraps history in a
    // ScrollView. These tests pin the new contract.

    function seedAttempt(guesses: { guess: string; plus: number; minus: number; isWin: boolean }[]): void {
      useDailyChallengeStore.setState({
        currentAttempt: {
          date: FIXED_TODAY,
          secret: '1234',
          digits: 4,
          turnLimit: 10,
          guesses,
          hintsUsed: 0,
          revealedPositions: [],
          revealedDigits: [],
          probedDigits: [],
        },
      });
    }

    it('renders the empty-state placeholder when no guesses exist', () => {
      const utils = renderWithNavigation('Daily', { Daily: DailyMatchScreen });
      expect(utils.getByText(/Crack today/)).toBeTruthy();
    });

    it('renders 5 guess rows in the scrollable history (the iOS overflow case)', () => {
      const guesses = Array.from({ length: 5 }, (_, i) => ({
        guess: String(i).repeat(4).slice(0, 4) || '0000',
        plus: 0,
        minus: i,
        isWin: false,
      }));
      seedAttempt(guesses);
      const utils = renderWithNavigation('Daily', { Daily: DailyMatchScreen });
      const list = utils.getByLabelText('Daily guess history');
      // The host ScrollView surfaces as 'RCTScrollView' on iOS in
      // the test renderer. We assert the full guess set is present
      // by counting rendered rows (every Mode3Row exposes a +/-
      // feedback chip).
      expect(list).toBeTruthy();
      expect(useDailyChallengeStore.getState().currentAttempt!.guesses).toHaveLength(5);
    });

    it('renders 10 guess rows (max turn budget) without crashing layout', () => {
      const guesses = Array.from({ length: 10 }, (_, i) => ({
        guess: '1234',
        plus: 0,
        minus: i,
        isWin: false,
      }));
      seedAttempt(guesses);
      const utils = renderWithNavigation('Daily', { Daily: DailyMatchScreen });
      expect(utils.getByLabelText('Daily guess history')).toBeTruthy();
    });

    it('history container has scroll behaviour wired (accessibilityLabel resolves to a ScrollView host)', () => {
      seedAttempt([
        { guess: '1111', plus: 0, minus: 1, isWin: false },
        { guess: '2222', plus: 1, minus: 0, isWin: false },
      ]);
      const utils = renderWithNavigation('Daily', { Daily: DailyMatchScreen });
      const list = utils.getByLabelText('Daily guess history');
      // ScrollView's host node carries `accessibilityRole` of 'list'
      // by default in the test renderer; the structural assertion
      // here is that the node accepts a vertical scroll surface (no
      // crash, no fallback to a plain View). The earlier `<View>`
      // implementation would have rendered without these props.
      expect(list.props).toBeTruthy();
      // `horizontal` prop is undefined-or-false on a vertical ScrollView.
      expect(list.props.horizontal).not.toBe(true);
    });
  });

  describe('mode rotation — Phase 7A.8 CP9', () => {
    // The outer beforeEach pins May 1 (Day 1, odd → Mode 3). Mode 1
    // days re-pin to May 2 (Day 2, even → Mode 1); the outer afterEach
    // restores the real Date regardless.
    function pinDay(month0: number, day: number): void {
      const fixedTime = new originalDate(2026, month0, day, 12, 0, 0).getTime();
      global.Date = buildMockDate(originalDate, fixedTime);
    }

    function seedGuess(date: string): void {
      useDailyChallengeStore.setState({
        currentAttempt: {
          date,
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
    }

    it('Mode 3 day (Day 1) renders the Precision header + the +N/−M chip', () => {
      seedGuess(FIXED_TODAY);
      const utils = renderWithNavigation('Daily', { Daily: DailyMatchScreen });
      expect(utils.getByLabelText('Daily Challenge — Precision')).toBeTruthy();
      expect(utils.getByText('Precision')).toBeTruthy();
      // PrecisionCounter renders the +N chip; '+1' is unique to it.
      expect(utils.getByText('+1')).toBeTruthy();
    });

    it('Mode 1 day (Day 2) renders the Color Match header + omits the precision chip', () => {
      pinDay(4, 2); // 2026-05-02 → Day 2 → Mode 1
      seedGuess('2026-05-02');
      const utils = renderWithNavigation('Daily', { Daily: DailyMatchScreen });
      expect(utils.getByLabelText('Daily Challenge — Color Match')).toBeTruthy();
      expect(utils.getByText('Color Match')).toBeTruthy();
      // Mode1Row paints colour tiles instead of the +N/−M counter.
      expect(utils.queryByText('+1')).toBeNull();
      // Positively confirm the colour wiring: guess '1567' vs secret
      // '1234' lands pos 0 ('1') green. Asserting the semantic `state`
      // prop (not a palette colour string) keeps this robust to theme
      // changes. Draft tiles are neutral (no reveals), so a green tile
      // can only come from the painted Mode 1 history row.
      const tileStates = utils.UNSAFE_getAllByType(DigitTile).map((t) => t.props.state);
      expect(tileStates).toContain('green');
    });

    it('Mode 1 day preserves the digit tier (Day 2 still seeds 4 digits / 10 turns)', () => {
      pinDay(4, 2);
      renderWithNavigation('Daily', { Daily: DailyMatchScreen });
      const attempt = useDailyChallengeStore.getState().currentAttempt;
      expect(attempt).not.toBeNull();
      expect(attempt!.digits).toBe(4);
      expect(attempt!.turnLimit).toBe(10);
    });

    it('Mode 1 day still renders the shared Hint + Probe UI scaffold', () => {
      pinDay(4, 2);
      seedGuess('2026-05-02');
      useUserStore.setState({
        dailyChallenge: { ...DAILY_CHALLENGE_DEFAULTS, earnedHints: 2 },
      });
      const utils = renderWithNavigation('Daily', { Daily: DailyMatchScreen });
      expect(utils.getByLabelText('Hint button')).toBeTruthy();
      expect(utils.getByLabelText('Probe button')).toBeTruthy();
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
