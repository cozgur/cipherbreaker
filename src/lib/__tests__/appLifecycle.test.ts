/**
 * Mode 4 Blitz — AppState lifecycle. The listener pattern is mocked
 * via `jest.spyOn(AppState, 'addEventListener')` (Pattern A from the
 * CP3c plan); fake timers control elapsed time deterministically so
 * the suite isn't 5+ seconds long.
 */

import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';

import { __resetRegistryForTests, modeRegistry } from '../../game/modeRegistry';
import { mode4Blitz } from '../../game/modes/mode4Blitz';
import { mode1ColorMatch } from '../../game/modes/mode1ColorMatch';
import { useLiveMatchStore } from '../../state/liveMatchStore';
import { useMatchStore } from '../../state/matchStore';
import { __resetAppLifecycleForTests, subscribeBlitzLifecycle } from '../appLifecycle';

type Listener = (s: AppStateStatus) => void;

function captureListener(): { fire: Listener; remove: jest.Mock } {
  let captured: Listener | null = null;
  const remove = jest.fn();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_type, listener): NativeEventSubscription => {
      captured = listener as Listener;
      return { remove } as unknown as NativeEventSubscription;
    });
  return {
    fire: (state: AppStateStatus) => {
      if (captured === null) throw new Error('listener was not captured');
      captured(state);
    },
    remove,
  };
}

function seedActiveBlitzMatch(): void {
  __resetRegistryForTests();
  modeRegistry.register(mode4Blitz);
  useMatchStore.getState().clearMatch();
  useLiveMatchStore.getState().clear();
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
}

describe('appLifecycle — Mode 4 Blitz grace period', () => {
  beforeEach(() => {
    __resetAppLifecycleForTests();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    __resetAppLifecycleForTests();
    useMatchStore.getState().clearMatch();
    useLiveMatchStore.getState().clear();
  });

  it('2s background → resume within grace decrements active owner clock by 2000ms', () => {
    seedActiveBlitzMatch();
    const { fire } = captureListener();
    subscribeBlitzLifecycle();

    fire('background');
    jest.advanceTimersByTime(2000);
    fire('active');

    const live = useLiveMatchStore.getState().liveClocks;
    expect(live?.playerMs).toBe(58_000);
    // No forfeit — match still active.
    expect(useMatchStore.getState().matchState?.phase).toBe('active_turn_player');
  });

  it('6s background → grace timer fires applyTimeout (forfeit)', () => {
    seedActiveBlitzMatch();
    const { fire } = captureListener();
    subscribeBlitzLifecycle();

    fire('background');
    jest.advanceTimersByTime(6_000);
    // Timer fires at 5s; the active fire below is the user
    // returning afterwards, expected to be a no-op.
    fire('active');

    const final = useMatchStore.getState().matchState!;
    expect(final.phase).toBe('completed');
    expect(final.result?.outcome).toBe('opponent_won');
    expect(final.result?.reason).toBe('player_time_out');
  });

  it("'inactive' alone (iOS Control Center pull) does not start grace timer", () => {
    seedActiveBlitzMatch();
    const { fire } = captureListener();
    subscribeBlitzLifecycle();

    fire('inactive');
    jest.advanceTimersByTime(10_000);
    fire('active');

    const live = useLiveMatchStore.getState().liveClocks;
    // Clock untouched — no subtract, no forfeit.
    expect(live?.playerMs).toBe(60_000);
    expect(useMatchStore.getState().matchState?.phase).toBe('active_turn_player');
  });

  it('multiple bg/fg cycles stay independent (no accumulation across cycles)', () => {
    seedActiveBlitzMatch();
    const { fire } = captureListener();
    subscribeBlitzLifecycle();

    fire('background');
    jest.advanceTimersByTime(1_000);
    fire('active'); // first cycle: 1s subtract
    fire('background');
    jest.advanceTimersByTime(2_000);
    fire('active'); // second cycle: 2s subtract

    const live = useLiveMatchStore.getState().liveClocks;
    // 60_000 - 1_000 - 2_000 = 57_000. Not 60_000 - 3_000 (same)
    // but importantly not 60_000 - 2*3_000 (accumulator bug).
    expect(live?.playerMs).toBe(57_000);
  });

  it("subtracts from the active owner's clock — bot-turn background hits opponent's clock, not player's", () => {
    seedActiveBlitzMatch();
    // Flip to opponent turn + active owner = opponent.
    useMatchStore.setState((s) => ({
      matchState: s.matchState
        ? {
            ...s.matchState,
            phase: 'active_turn_opponent',
            clockSnapshot: {
              playerMs: 60_000,
              opponentMs: 60_000,
              activeOwner: 'opponent',
              snapshotTimestamp: Date.now(),
            },
          }
        : null,
    }));
    useLiveMatchStore.getState().syncFromMatchState(useMatchStore.getState().matchState);

    const { fire } = captureListener();
    subscribeBlitzLifecycle();

    fire('background');
    jest.advanceTimersByTime(3_000);
    fire('active');

    const live = useLiveMatchStore.getState().liveClocks;
    expect(live?.opponentMs).toBe(57_000);
    expect(live?.playerMs).toBe(60_000);
  });

  it('completed match — listener no-ops on background (defensive isBlitzActive guard)', () => {
    seedActiveBlitzMatch();
    // Externally complete the match.
    useMatchStore.setState((s) => ({
      matchState: s.matchState
        ? {
            ...s.matchState,
            phase: 'completed',
            result: { outcome: 'player_won', reason: 'cracked', turns: 1 },
          }
        : null,
    }));

    const { fire } = captureListener();
    subscribeBlitzLifecycle();

    fire('background');
    jest.advanceTimersByTime(10_000);
    fire('active');

    const final = useMatchStore.getState().matchState!;
    // Outcome unchanged — the listener didn't try to forfeit.
    expect(final.result?.reason).toBe('cracked');
  });

  it('non-Mode-4 match — listener no-ops (background does nothing)', () => {
    __resetRegistryForTests();
    modeRegistry.register(mode1ColorMatch);
    useMatchStore.getState().clearMatch();
    useLiveMatchStore.getState().clear();
    useMatchStore.getState().createMatch(1, '1234');
    useMatchStore.getState().startMatch();

    const { fire } = captureListener();
    subscribeBlitzLifecycle();

    fire('background');
    jest.advanceTimersByTime(10_000);
    fire('active');

    const final = useMatchStore.getState().matchState!;
    expect(final.phase).not.toBe('completed');
    expect(useLiveMatchStore.getState().liveClocks).toBeNull();
  });

  it('unsubscribe removes the listener and clears the pending grace timer', () => {
    seedActiveBlitzMatch();
    const { fire, remove } = captureListener();
    const unsubscribe = subscribeBlitzLifecycle();

    fire('background');
    expect(remove).not.toHaveBeenCalled();

    unsubscribe();
    expect(remove).toHaveBeenCalledTimes(1);

    // Grace timer cleared — advancing past 5s should NOT forfeit.
    jest.advanceTimersByTime(10_000);
    const final = useMatchStore.getState().matchState!;
    expect(final.phase).toBe('active_turn_player');
  });
});
