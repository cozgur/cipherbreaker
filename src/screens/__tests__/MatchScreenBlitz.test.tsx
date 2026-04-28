/**
 * MatchScreen — Mode 4 Blitz tick orchestration. These tests cover
 * the Phase 5 CP3b wiring: a 100ms `setInterval` decrements
 * `liveMatchStore` every tick, and when the active side hits zero
 * the screen fires `matchStore.applyTimeout(...)` exactly once,
 * collapsing the match to `'completed' / opponent_won /
 * player_time_out`.
 *
 * Held to fake timers so the test isn't 60 seconds long. The
 * interval guard inside the tick (`phase === 'completed'` short-
 * circuit) is the part the advisor flagged as a footgun; an extra
 * `runOnlyPendingTimers` after completion proves the interval
 * doesn't keep firing `applyTimeout` after the match collapses.
 */

import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import { act } from '@testing-library/react-native';

import { MatchScreen } from '@screens/MatchScreen';
import { __resetRegistryForTests, modeRegistry } from '@game/modeRegistry';
import { mode4Blitz } from '@game/modes/mode4Blitz';
import { useLiveMatchStore } from '@state/liveMatchStore';
import { useMatchStore } from '@state/matchStore';
import { __resetAppLifecycleForTests } from '@/lib/appLifecycle';
import { renderWithNavigation } from '@/test-utils/renderWithNavigation';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';
import { mockUser, __resetMockUserForTests } from '@data/mockUser';

function registerMode4(): void {
  __resetRegistryForTests();
  modeRegistry.register(mode4Blitz);
}

describe('MatchScreen — Mode 4 Blitz clock tick', () => {
  beforeEach(() => {
    registerMode4();
    __resetMockUserForTests();
    mockUser.username = 'phoenix99';
    useMatchStore.getState().clearMatch();
    useLiveMatchStore.getState().clear();
  });

  afterEach(() => {
    useMatchStore.getState().clearMatch();
    useLiveMatchStore.getState().clear();
    jest.useRealTimers();
  });

  it('tick interval drives the live clock to zero and fires applyTimeout exactly once', () => {
    jest.useFakeTimers();
    useMatchStore.getState().createMatch(4, '1234');
    useMatchStore.getState().startMatch();
    // Pin player turn + put the player's clock 250ms from zero so a
    // few ticks expire it. Keep the snapshot mirrored into liveStore
    // so the screen's mount sync sees consistent values.
    useMatchStore.setState((s) => ({
      matchState: s.matchState
        ? {
            ...s.matchState,
            phase: 'active_turn_player',
            clockSnapshot: {
              playerMs: 250,
              opponentMs: 60_000,
              activeOwner: 'player',
              snapshotTimestamp: Date.now(),
            },
          }
        : null,
    }));
    useLiveMatchStore.getState().syncFromMatchState(useMatchStore.getState().matchState);

    renderWithNavigation(
      'Match',
      { Match: MatchScreen, MatchResult: RouteStubScreen },
      { modeId: 4, opponentId: 'op-1' },
    );

    // 3 ticks of 100ms each → playerMs 250 → 150 → 50 → 0; the third
    // tick fires applyTimeout and the match collapses to 'completed'.
    act(() => {
      jest.advanceTimersByTime(300);
    });

    const final = useMatchStore.getState().matchState!;
    expect(final.phase).toBe('completed');
    expect(final.result?.outcome).toBe('opponent_won');
    expect(final.result?.reason).toBe('player_time_out');

    // Defense in depth — the cleanup the advisor flagged. After the
    // match completes, additional fake-timer advances must NOT fire
    // applyTimeout again. We assert it by capturing the result
    // reference and confirming further ticks don't mutate phase.
    const completedResult = final.result;
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    const stillFinal = useMatchStore.getState().matchState!;
    expect(stillFinal.result).toBe(completedResult);
  });

  it('mounting wires the AppState subscription — bg/fg cycle decrements the live clock', () => {
    jest.useFakeTimers();
    let captured: ((s: AppStateStatus) => void) | null = null;
    const removeSpy = jest.fn();
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_t, listener): NativeEventSubscription => {
        captured = listener as (s: AppStateStatus) => void;
        return { remove: removeSpy } as unknown as NativeEventSubscription;
      });
    __resetAppLifecycleForTests();

    useMatchStore.getState().createMatch(4, '1234');
    useMatchStore.getState().startMatch();
    useMatchStore.setState((s) => ({
      matchState: s.matchState
        ? {
            ...s.matchState,
            phase: 'active_turn_player',
            clockSnapshot: {
              playerMs: 60_000,
              opponentMs: 60_000,
              activeOwner: 'player',
              snapshotTimestamp: Date.now(),
            },
          }
        : null,
    }));
    useLiveMatchStore.getState().syncFromMatchState(useMatchStore.getState().matchState);

    renderWithNavigation(
      'Match',
      { Match: MatchScreen, MatchResult: RouteStubScreen },
      { modeId: 4, opponentId: 'op-1' },
    );

    // Mount should have registered the listener.
    expect(captured).not.toBeNull();
    if (captured === null) throw new Error('listener missing');

    act(() => {
      captured!('background');
      jest.advanceTimersByTime(2_000);
      captured!('active');
    });

    // Live clock decremented by the bg duration. (The 100ms tick
    // interval also runs and decrements during the foreground
    // segment of fake-timer advance, so we use a >= bound rather
    // than exact equality to avoid coupling to tick interleavings.)
    const live = useLiveMatchStore.getState().liveClocks;
    expect(live).not.toBeNull();
    expect(live!.playerMs).toBeLessThanOrEqual(58_000);
    expect(live!.playerMs).toBeGreaterThan(50_000);
    expect(useMatchStore.getState().matchState?.phase).toBe('active_turn_player');
  });

  it('non-Blitz modes do not start the tick interval (no clockSnapshot writes)', () => {
    // Register Mode 1 instead — same screen, different mode. Tick
    // effect early-returns on `isBlitzActive=false`. We assert by
    // observing that the live store stays empty and the durable
    // snapshot is never written.
    __resetRegistryForTests();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mode1ColorMatch } = require('@game/modes/mode1ColorMatch');
    modeRegistry.register(mode1ColorMatch);

    jest.useFakeTimers();
    useMatchStore.getState().createMatch(1, '1234');
    useMatchStore.getState().startMatch();
    useMatchStore.setState((s) => ({
      matchState: s.matchState ? { ...s.matchState, phase: 'active_turn_player' } : null,
    }));

    renderWithNavigation(
      'Match',
      { Match: MatchScreen, MatchResult: RouteStubScreen },
      { modeId: 1, opponentId: 'op-1' },
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(useLiveMatchStore.getState().liveClocks).toBeNull();
    const state = useMatchStore.getState().matchState!;
    expect(state.phase).toBe('active_turn_player');
    expect(state.clockSnapshot).toBeUndefined();
  });
});
