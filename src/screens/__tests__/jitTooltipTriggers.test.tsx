/**
 * Phase 7A.8 CP3 — integration tests for the three JIT tooltip
 * trigger sites:
 *
 *   - MatchResultScreen: first post-onboarding engine-path win
 *     fires TOKEN_EARN ~500ms after mount.
 *   - HomeScreen: first time `dailyChallenge.currentStreak >= 3`
 *     lands on mount fires STREAK_MILESTONE.
 *   - DailyMatchScreen hint spend is covered separately via the
 *     trigger helper and the queue/manager test (the Alert.alert
 *     OK-callback path is awkward to mount through, and the
 *     marker action + queue interaction is the load-bearing
 *     contract we want to pin).
 *
 * Each trigger is also pinned for its negative gates:
 *   - Suppressed when `hasOnboarded === false`.
 *   - Does not re-fire when the seen flag is already true.
 *   - Does not fire when the per-trigger mechanic gate is false
 *     (no reward; streak < 3).
 */

import { act } from '@testing-library/react-native';

import { __resetMockUserForTests, mockUser } from '@data/mockUser';
import type { RootStackParamList } from '@navigation/routes';
import { HomeScreen } from '../HomeScreen';
import { MatchResultScreen } from '../MatchResultScreen';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';
import { renderWithNavigation } from '@/test-utils/renderWithNavigation';
import {
  DAILY_CHALLENGE_DEFAULTS,
  JIT_TOOLTIPS_SEEN_DEFAULTS,
  USER_STORE_DEFAULTS,
  useUserStore,
} from '@state/userStore';
import { useJITTooltipQueue } from '@/lib/jitTooltipManager';

function renderMatchResult(params: RootStackParamList['MatchResult']) {
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

function renderHome() {
  return renderWithNavigation('Home', { Home: HomeScreen });
}

describe('JIT tooltip triggers (Phase 7A.8 CP3)', () => {
  // Modern jest fake timers handle Date for us (`now()` is pinned by
  // `jest.setSystemTime`), so we don't layer a separate MockDate
  // here — combining the two breaks jest's timer installation.
  beforeEach(() => {
    __resetMockUserForTests();
    useUserStore.setState({ ...USER_STORE_DEFAULTS, hasOnboarded: true });
    useJITTooltipQueue.getState().__resetForTests();
    jest.useFakeTimers();
    // Pin the system clock so the HomeScreen Daily-banner countdown
    // ticks land at a deterministic minute. The 9:28 timestamp
    // mirrors the existing HomeScreen.test.tsx fixture.
    jest.setSystemTime(new Date(2026, 4, 1, 9, 28, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('TOKEN_EARN trigger (MatchResultScreen)', () => {
    it('fires after the 500ms delay on a post-onboarding engine-path win', () => {
      mockUser.tokens = 1000;
      renderMatchResult({
        modeId: 1,
        outcome: 'victory',
        opponentId: 'opp-1',
        secret: '1234',
        guessCount: 4,
        reward: 100,
        xpGain: 30,
      });
      expect(useJITTooltipQueue.getState().active).toBeNull();
      act(() => {
        jest.advanceTimersByTime(500);
      });
      expect(useJITTooltipQueue.getState().active).toBe('TOKEN_EARN');
      expect(useUserStore.getState().jitTooltipsSeen.firstTokenEarn).toBe(true);
    });

    it('does not re-fire when the seen flag is already true', () => {
      useUserStore.setState({
        hasOnboarded: true,
        jitTooltipsSeen: { ...JIT_TOOLTIPS_SEEN_DEFAULTS, firstTokenEarn: true },
      });
      renderMatchResult({
        modeId: 1,
        outcome: 'victory',
        opponentId: 'opp-1',
        secret: '1234',
        guessCount: 4,
        reward: 100,
        xpGain: 30,
      });
      act(() => {
        jest.advanceTimersByTime(2_000);
      });
      expect(useJITTooltipQueue.getState().active).toBeNull();
    });

    it('is suppressed while onboarding is still incomplete', () => {
      useUserStore.setState({ hasOnboarded: false });
      renderMatchResult({
        modeId: 1,
        outcome: 'victory',
        opponentId: 'opp-1',
        secret: '1234',
        guessCount: 4,
        reward: 100,
        xpGain: 30,
      });
      act(() => {
        jest.advanceTimersByTime(2_000);
      });
      expect(useJITTooltipQueue.getState().active).toBeNull();
    });

    it('does not fire on a defeat (no reward, no tooltip)', () => {
      renderMatchResult({
        modeId: 1,
        outcome: 'defeat',
        opponentId: 'opp-1',
        secret: '1234',
        guessCount: 6,
        reward: 0,
        xpGain: 5,
      });
      act(() => {
        jest.advanceTimersByTime(2_000);
      });
      expect(useJITTooltipQueue.getState().active).toBeNull();
    });

    it('does not fire on the mock dev-picker path (no engine-path reward)', () => {
      // No `guessCount` route param → mock path. CP3 trigger is
      // gated on isEnginePath, which is `route.params.guessCount
      // !== undefined`.
      renderMatchResult({
        modeId: 1,
        outcome: 'victory',
        opponentId: 'opp-1',
      });
      act(() => {
        jest.advanceTimersByTime(2_000);
      });
      expect(useJITTooltipQueue.getState().active).toBeNull();
    });
  });

  describe('STREAK_MILESTONE trigger (HomeScreen)', () => {
    it('fires after the 500ms delay when dailyStreak hits 3 + post-onboarding', () => {
      useUserStore.setState({
        hasOnboarded: true,
        dailyChallenge: { ...DAILY_CHALLENGE_DEFAULTS, currentStreak: 3 },
      });
      renderHome();
      expect(useJITTooltipQueue.getState().active).toBeNull();
      act(() => {
        jest.advanceTimersByTime(500);
      });
      expect(useJITTooltipQueue.getState().active).toBe('STREAK_MILESTONE');
      expect(useUserStore.getState().jitTooltipsSeen.firstStreakMilestone).toBe(true);
    });

    it('does not re-fire on subsequent mounts after the seen flag is set', () => {
      useUserStore.setState({
        hasOnboarded: true,
        dailyChallenge: { ...DAILY_CHALLENGE_DEFAULTS, currentStreak: 5 },
        jitTooltipsSeen: { ...JIT_TOOLTIPS_SEEN_DEFAULTS, firstStreakMilestone: true },
      });
      renderHome();
      act(() => {
        jest.advanceTimersByTime(2_000);
      });
      expect(useJITTooltipQueue.getState().active).toBeNull();
    });

    it('does not fire when streak is below the threshold', () => {
      useUserStore.setState({
        hasOnboarded: true,
        dailyChallenge: { ...DAILY_CHALLENGE_DEFAULTS, currentStreak: 2 },
      });
      renderHome();
      act(() => {
        jest.advanceTimersByTime(2_000);
      });
      expect(useJITTooltipQueue.getState().active).toBeNull();
    });

    it('is suppressed while onboarding is incomplete (hasOnboarded false)', () => {
      useUserStore.setState({
        hasOnboarded: false,
        dailyChallenge: { ...DAILY_CHALLENGE_DEFAULTS, currentStreak: 7 },
      });
      renderHome();
      act(() => {
        jest.advanceTimersByTime(2_000);
      });
      expect(useJITTooltipQueue.getState().active).toBeNull();
    });
  });
});
