import { act, fireEvent } from '@testing-library/react-native';

import { __resetMockUserForTests, mockUser } from '@data/mockUser';
import type { DailyResultSummary } from '@game/daily/types';
import { DAILY_CHALLENGE_DEFAULTS, USER_STORE_DEFAULTS, useUserStore } from '@state/userStore';
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
    // Reset slices that individual tests mutate (the suite doesn't do
    // a full store reset). modeUnlocked is reset so a test that
    // unlocks modes doesn't leak into the next.
    useUserStore.setState({
      dailyChallenge: DAILY_CHALLENGE_DEFAULTS,
      modeUnlocked: { ...USER_STORE_DEFAULTS.modeUnlocked },
    });
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
    // Mode 5 unlocked so the tap clears the CP7 unlock gate and
    // reaches the stake-balance check.
    useUserStore.setState({ modeUnlocked: { 1: true, 5: true } });
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

  // ── Phase 7A.7 CP7 — per-mode tutorial interception ──────────

  describe('per-mode tutorial interception (CP7)', () => {
    type ModeFixture = {
      readonly modeId: number;
      readonly label: string;
    };

    const MODE_2_TO_7: readonly ModeFixture[] = [
      { modeId: 2, label: 'HIGH & LOW — 50 tokens' },
      { modeId: 3, label: 'PRECISION — 50 tokens' },
      { modeId: 4, label: 'BLITZ — 50 tokens' },
      { modeId: 5, label: 'BLACKOUT — 100 tokens' },
      { modeId: 6, label: 'SUDDEN DEATH — 50 tokens' },
      { modeId: 7, label: 'MIRROR — 75 tokens' },
    ];

    it('Mode 1 is exempt — taps Color Match always go to Matchmaking, even if modeTutorialsSeen[1] is somehow false', () => {
      // Mode 1's mechanic is covered by Phase 7A.6 CP3
      // `TutorialMatchScreen` during the linear onboarding
      // flow. By the time the user reaches Home, Mode 1 is
      // already taught. The CP7 interception explicitly
      // skips Mode 1 so a user who never opens the per-mode
      // tutorial system doesn't get re-taught.
      mockUser.tokens = 1000;
      // Defensive: even if the modeTutorialsSeen map were
      // somehow set with `[1]: false`, the interception
      // must NOT route Mode 1 to ModeTutorial.
      useUserStore.setState({ modeTutorialsSeen: { 1: false } });

      const utils = renderWithNavigation('Home', {
        Home: HomeScreen,
        Matchmaking: RouteStubScreen,
        ModeTutorial: RouteStubScreen,
      });

      act(() => {
        fireEvent.press(utils.getByLabelText('COLOR MATCH — 50 tokens'));
      });

      const current = utils.navRef.current?.getCurrentRoute();
      expect(current?.name).toBe('Matchmaking');
      expect(current?.params).toEqual({ modeId: 1 });
    });

    it.each(MODE_2_TO_7)(
      'Mode $modeId first tap (modeTutorialsSeen[$modeId] unset) → ModeTutorial',
      ({ modeId, label }) => {
        mockUser.tokens = 1000;
        // Unlocked (CP7 gate) so the tap reaches the tutorial gate.
        useUserStore.setState({ modeTutorialsSeen: {}, modeUnlocked: { 1: true, [modeId]: true } });

        const utils = renderWithNavigation('Home', {
          Home: HomeScreen,
          Matchmaking: RouteStubScreen,
          ModeTutorial: RouteStubScreen,
        });

        act(() => {
          fireEvent.press(utils.getByLabelText(label));
        });

        const current = utils.navRef.current?.getCurrentRoute();
        expect(current?.name).toBe('ModeTutorial');
        expect(current?.params).toEqual({ modeId });
      },
    );

    it.each(MODE_2_TO_7)(
      'Mode $modeId post-tutorial tap (modeTutorialsSeen[$modeId] = true) → Matchmaking directly',
      ({ modeId, label }) => {
        mockUser.tokens = 1000;
        useUserStore.setState({
          modeTutorialsSeen: { [modeId]: true },
          modeUnlocked: { 1: true, [modeId]: true },
        });

        const utils = renderWithNavigation('Home', {
          Home: HomeScreen,
          Matchmaking: RouteStubScreen,
          ModeTutorial: RouteStubScreen,
        });

        act(() => {
          fireEvent.press(utils.getByLabelText(label));
        });

        const current = utils.navRef.current?.getCurrentRoute();
        expect(current?.name).toBe('Matchmaking');
        expect(current?.params).toEqual({ modeId });
      },
    );

    it('balance gate fires before tutorial gate — insufficient balance + unseen tutorial → InsufficientTokens (NOT ModeTutorial)', () => {
      // Tutorial CTA at the end of ModeTutorial routes to
      // Matchmaking, which would dead-end at InsufficientTokens
      // anyway. Showing the modal first lets the user resolve
      // balance; the next tap then takes the tutorial path.
      mockUser.tokens = 0;
      // Mode 5 unlocked so the unlock gate passes and the balance
      // gate (not the tutorial gate) is what fires.
      useUserStore.setState({ modeTutorialsSeen: {}, modeUnlocked: { 1: true, 5: true } });

      const utils = renderWithNavigation('Home', {
        Home: HomeScreen,
        Matchmaking: RouteStubScreen,
        ModeTutorial: RouteStubScreen,
        InsufficientTokens: RouteStubScreen,
      });

      act(() => {
        fireEvent.press(utils.getByLabelText('BLACKOUT — 100 tokens'));
      });

      const current = utils.navRef.current?.getCurrentRoute();
      expect(current?.name).toBe('InsufficientTokens');
      expect(current?.params).toEqual({ modeId: 5 });
    });
  });

  // ── Phase 7A.8 CP7 — mode unlock gate ────────────────────────

  describe('mode unlock gate (CP7)', () => {
    it('locked Mode 2-7 render a lock overlay with the correct cost badge', () => {
      // Fresh-install defaults: Mode 1 unlocked, 2-7 locked.
      useUserStore.setState({ modeUnlocked: { ...USER_STORE_DEFAULTS.modeUnlocked } });
      const utils = renderWithNavigation('Home', { Home: HomeScreen });

      // Mode 2 (HIGH & LOW) cost 300; Mode 7 (MIRROR) cost 2000.
      expect(utils.getByText('UNLOCK FOR 300 TOKENS')).toBeTruthy();
      expect(utils.getByText('UNLOCK FOR 2000 TOKENS')).toBeTruthy();
      // Locked cards expose the lock state in their a11y label.
      expect(utils.getByLabelText('HIGH & LOW — locked, unlock for 300 tokens')).toBeTruthy();
      // Mode 1 is never locked — its label stays the plain stake form.
      expect(utils.getByLabelText('COLOR MATCH — 50 tokens')).toBeTruthy();
    });

    it('tapping a locked mode opens the UnlockModal (before the balance check)', () => {
      mockUser.tokens = 0; // even broke, the unlock gate wins over balance
      useUserStore.setState({ modeUnlocked: { ...USER_STORE_DEFAULTS.modeUnlocked } });
      const utils = renderWithNavigation('Home', {
        Home: HomeScreen,
        Unlock: RouteStubScreen,
        InsufficientTokens: RouteStubScreen,
      });

      act(() => {
        fireEvent.press(utils.getByLabelText('HIGH & LOW — locked, unlock for 300 tokens'));
      });

      const current = utils.navRef.current?.getCurrentRoute();
      expect(current?.name).toBe('Unlock');
      expect(current?.params).toEqual({ modeId: 2 });
    });

    it('unlock gate fires before the tutorial gate — locked + tutorial seen still opens UnlockModal', () => {
      mockUser.tokens = 1000;
      useUserStore.setState({
        modeUnlocked: { ...USER_STORE_DEFAULTS.modeUnlocked },
        modeTutorialsSeen: { 2: true },
      });
      const utils = renderWithNavigation('Home', {
        Home: HomeScreen,
        Unlock: RouteStubScreen,
        ModeTutorial: RouteStubScreen,
        Matchmaking: RouteStubScreen,
      });

      act(() => {
        fireEvent.press(utils.getByLabelText('HIGH & LOW — locked, unlock for 300 tokens'));
      });

      expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Unlock');
    });

    it('Mode 1 hard-skip — never opens UnlockModal even if modeUnlocked[1] is somehow false', () => {
      mockUser.tokens = 1000;
      // Defensive corruption: Mode 1 marked locked. The id !== 1 guard
      // must still bypass the unlock gate.
      useUserStore.setState({ modeUnlocked: { 1: false } });
      const utils = renderWithNavigation('Home', {
        Home: HomeScreen,
        Unlock: RouteStubScreen,
        Matchmaking: RouteStubScreen,
      });

      act(() => {
        fireEvent.press(utils.getByLabelText('COLOR MATCH — 50 tokens'));
      });

      expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Matchmaking');
    });
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
        turnLimit: 10,
        turnsUsed: 3,
        success: true,
        secret: '4321',
        feedbackTrail: [],
        hintsUsed: 0,
      };
      useUserStore.setState({
        dailyChallenge: { ...DAILY_CHALLENGE_DEFAULTS, lastResult: cracked, currentStreak: 5 },
      });
      const utils = renderWithNavigation('Home', { Home: HomeScreen });
      expect(utils.getByText('✓ Cracked in 3/10')).toBeTruthy();
      expect(utils.getByText(/Streak 5/)).toBeTruthy();
    });

    it('failed state — banner shows day-not-cracked + streak-broken', () => {
      const failed: DailyResultSummary = {
        date: '2026-05-01',
        digits: 4,
        turnLimit: 10,
        turnsUsed: 10,
        success: false,
        secret: '7382',
        feedbackTrail: [],
        hintsUsed: 0,
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
        turnLimit: 10,
        turnsUsed: 3,
        success: true,
        secret: '4321',
        feedbackTrail: [],
        hintsUsed: 0,
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
        turnLimit: 10,
        turnsUsed: 10,
        success: false,
        secret: '7382',
        feedbackTrail: [],
        hintsUsed: 0,
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

  describe('Cross-midnight refresh — Phase 7A.5 Codex finding 3 fix', () => {
    // Pre-fix `today` was captured once at mount via useState
    // initializer, so a player who left the app open across
    // midnight (or backgrounded past midnight) saw stale banner
    // state. The fix re-evaluates `today` on the 60s tick AND on
    // AppState 'active'.

    function applyMockDate(year: number, month: number, day: number, hour = 12, minute = 0): typeof Date {
      const original = global.Date;
      const fixedTime = new original(year, month, day, hour, minute, 0).getTime();
      function MockDate(this: Date, ...args: unknown[]) {
        if (!new.target) return new (original as DateConstructor)().toString();
        if (args.length === 0) return new (original as DateConstructor)(fixedTime);
        // @ts-expect-error pass-through
        return new (original as DateConstructor)(...args);
      }
      MockDate.prototype = original.prototype;
      MockDate.now = () => fixedTime;
      MockDate.parse = original.parse.bind(original);
      MockDate.UTC = original.UTC.bind(original);
      // @ts-expect-error mock substitution
      global.Date = MockDate;
      return original;
    }

    it('60s tick re-evaluates today; banner state recomputes when calendar string flips', () => {
      jest.useFakeTimers();
      // Mount on May 1 — banner shows Day #1.
      const original = applyMockDate(2026, 4, 1, 23, 59);
      try {
        const utils = renderWithNavigation('Home', { Home: HomeScreen });
        expect(utils.queryByText(/Day #1/)).toBeTruthy();

        // Advance to May 2 BEFORE the 60s tick fires — set the new
        // mocked Date AND advance fake timers so the screen's
        // setInterval callback runs on the new clock.
        global.Date = original;
        applyMockDate(2026, 4, 2, 0, 0);
        act(() => {
          jest.advanceTimersByTime(60_000);
        });
        // Banner should now reflect Day #2 (May 2 is calendar day 2
        // relative to LAUNCH_EPOCH 2026-05-01).
        expect(utils.queryByText(/Day #2/)).toBeTruthy();
      } finally {
        global.Date = original;
        jest.useRealTimers();
      }
    });

    it('today refresh is idempotent when calendar string has not flipped', () => {
      jest.useFakeTimers();
      const original = applyMockDate(2026, 4, 1, 12, 0);
      try {
        const utils = renderWithNavigation('Home', { Home: HomeScreen });
        const headlineBefore = utils.queryByText(/Day #1/);
        expect(headlineBefore).toBeTruthy();
        // Advance one tick on the SAME calendar day.
        act(() => {
          jest.advanceTimersByTime(60_000);
        });
        // Still Day #1 — no spurious re-render flip.
        expect(utils.queryByText(/Day #1/)).toBeTruthy();
      } finally {
        global.Date = original;
        jest.useRealTimers();
      }
    });
  });

  describe('Low Balance Toast — Phase 7A.5 CP4', () => {
    it('hidden when wallet balance is at or above LOW_BALANCE_THRESHOLD (default 100, exactly at threshold)', () => {
      const utils = renderWithNavigation('Home', { Home: HomeScreen });
      expect(utils.queryByLabelText('Low balance')).toBeNull();
    });

    it('hidden when wallet exactly equals the threshold (100 — gate is strictly less-than)', () => {
      mockUser.tokens = 100;
      const utils = renderWithNavigation('Home', { Home: HomeScreen });
      expect(utils.queryByLabelText('Low balance')).toBeNull();
    });

    it('visible when wallet drops below 100', () => {
      mockUser.tokens = 75;
      const utils = renderWithNavigation('Home', { Home: HomeScreen });
      expect(utils.queryByLabelText('Low balance')).toBeTruthy();
      expect(utils.queryByText('Low on tokens?')).toBeTruthy();
      expect(utils.queryByText('Watch a quick ad to earn 50.')).toBeTruthy();
    });

    it('visible at 0 tokens (the worst-case recovery prompt)', () => {
      mockUser.tokens = 0;
      const utils = renderWithNavigation('Home', { Home: HomeScreen });
      expect(utils.queryByLabelText('Low balance')).toBeTruthy();
    });

    it('Watch Ad CTA navigates to AdWatch', () => {
      mockUser.tokens = 25;
      const utils = renderWithNavigation('Home', {
        Home: HomeScreen,
        AdWatch: RouteStubScreen,
      });
      act(() => {
        fireEvent.press(utils.getByLabelText('Watch ad'));
      });
      expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('AdWatch');
    });

    it('Dismiss (X) hides the toast for the rest of the session', () => {
      mockUser.tokens = 25;
      const utils = renderWithNavigation('Home', { Home: HomeScreen });
      expect(utils.queryByLabelText('Low balance')).toBeTruthy();
      act(() => {
        fireEvent.press(utils.getByLabelText('Dismiss low balance toast'));
      });
      expect(utils.queryByLabelText('Low balance')).toBeNull();
    });

    it('once dismissed, a balance change does NOT re-show within the same mount (session-scoped)', () => {
      mockUser.tokens = 25;
      const utils = renderWithNavigation('Home', { Home: HomeScreen });
      act(() => {
        fireEvent.press(utils.getByLabelText('Dismiss low balance toast'));
      });
      // Even at 0 tokens after a dismiss, the toast stays hidden
      // until next mount. The screen-local dismiss flag is the
      // brainstorm-decided "session" granularity.
      mockUser.tokens = 0;
      expect(utils.queryByLabelText('Low balance')).toBeNull();
    });
  });

  describe('Mode variety teasers — Phase 7A.6 CP5', () => {
    it('Blitz teaser opens at matchesCompletedSinceOnboarding === 3 when blitzTeaserSeen === false', () => {
      useUserStore.setState({ matchesCompletedSinceOnboarding: 3 });
      const utils = renderWithNavigation('Home', { Home: HomeScreen });
      expect(utils.queryByTestId('blitz-teaser-modal')).toBeTruthy();
      expect(utils.queryByText('Beat the clock')).toBeTruthy();
    });

    it('Blitz teaser does NOT open at counter === 2 (strict equality on the threshold)', () => {
      useUserStore.setState({ matchesCompletedSinceOnboarding: 2 });
      const utils = renderWithNavigation('Home', { Home: HomeScreen });
      expect(utils.queryByTestId('blitz-teaser-modal')).toBeNull();
    });

    it('Blitz teaser does NOT open at counter === 4 (strict equality, missed window)', () => {
      // Edge case: data import / migration leaves counter at 4 with
      // blitzTeaserSeen still false. Strict-equality trigger means
      // the teaser is skipped — alternative `>=` would re-fire
      // every Home mount and drive users away.
      useUserStore.setState({ matchesCompletedSinceOnboarding: 4 });
      const utils = renderWithNavigation('Home', { Home: HomeScreen });
      expect(utils.queryByTestId('blitz-teaser-modal')).toBeNull();
    });

    it('Blitz teaser does NOT open when blitzTeaserSeen === true', () => {
      useUserStore.setState((s) => ({
        matchesCompletedSinceOnboarding: 3,
        onboarding: { ...s.onboarding, blitzTeaserSeen: true },
      }));
      const utils = renderWithNavigation('Home', { Home: HomeScreen });
      expect(utils.queryByTestId('blitz-teaser-modal')).toBeNull();
    });

    it('Mirror teaser opens at counter === 5 when mirrorTeaserSeen === false', () => {
      useUserStore.setState({ matchesCompletedSinceOnboarding: 5 });
      const utils = renderWithNavigation('Home', { Home: HomeScreen });
      expect(utils.queryByTestId('mirror-teaser-modal')).toBeTruthy();
      expect(utils.queryByText('Same code. Solo race.')).toBeTruthy();
    });

    it('Mirror teaser does NOT open at counter === 4', () => {
      useUserStore.setState({ matchesCompletedSinceOnboarding: 4 });
      const utils = renderWithNavigation('Home', { Home: HomeScreen });
      expect(utils.queryByTestId('mirror-teaser-modal')).toBeNull();
    });

    it('Mirror teaser does NOT open when mirrorTeaserSeen === true', () => {
      useUserStore.setState((s) => ({
        matchesCompletedSinceOnboarding: 5,
        onboarding: { ...s.onboarding, mirrorTeaserSeen: true },
      }));
      const utils = renderWithNavigation('Home', { Home: HomeScreen });
      expect(utils.queryByTestId('mirror-teaser-modal')).toBeNull();
    });

    it('Blitz teaser CTA grants 50 tokens and unmounts via the seen-flag flip', () => {
      useUserStore.setState({ matchesCompletedSinceOnboarding: 3, tokens: 100 });
      const utils = renderWithNavigation('Home', { Home: HomeScreen });
      expect(utils.queryByTestId('blitz-teaser-modal')).toBeTruthy();

      act(() => {
        fireEvent.press(utils.getByText('Try Blitz →'));
      });

      // Flag flip → derived `showBlitzTeaser` is now false → modal
      // unmounts on next render. Tokens credited.
      const after = useUserStore.getState();
      expect(after.tokens).toBe(150);
      expect(after.onboarding.blitzTeaserSeen).toBe(true);
      expect(utils.queryByTestId('blitz-teaser-modal')).toBeNull();
    });

    it('counter === 5 with blitzTeaserSeen === false does NOT stack both teasers (strict equality on counter)', () => {
      // Edge case: user somehow reaches 5 without dismissing Blitz at 3
      // (e.g., dev seeded state). Strict-equality on counter means
      // Blitz `=== 3` is false at counter=5, so only Mirror fires.
      // Counter monotonicity in normal play guarantees this is unreachable
      // organically — Blitz fires AT 3 and is dismissed before counter
      // ticks to 4.
      useUserStore.setState({ matchesCompletedSinceOnboarding: 5 });
      const utils = renderWithNavigation('Home', { Home: HomeScreen });
      expect(utils.queryByTestId('blitz-teaser-modal')).toBeNull();
      expect(utils.queryByTestId('mirror-teaser-modal')).toBeTruthy();
    });
  });
});
