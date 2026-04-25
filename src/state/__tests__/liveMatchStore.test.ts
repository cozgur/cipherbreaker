import type { MatchState } from '../../game/types';
import { useLiveMatchStore } from '../liveMatchStore';

function makeMatchState(overrides: Partial<MatchState> = {}): MatchState {
  return {
    modeId: 4,
    playerSecret: '1234',
    opponentSecret: '5678',
    playerGuesses: [],
    opponentGuesses: [],
    phase: 'active_turn_player',
    result: null,
    rngState: { seed: 1, callCount: 0 },
    startedAt: 0,
    lastUpdatedAt: 0,
    ...overrides,
  };
}

describe('useLiveMatchStore', () => {
  beforeEach(() => {
    useLiveMatchStore.setState({ liveClocks: null });
  });

  it('does NOT expose a persist field — guard against future regressions', () => {
    // The crucial invariant: this store is transient, ticking ~10Hz
    // would burn AsyncStorage I/O if it were persisted.
    expect((useLiveMatchStore as { persist?: unknown }).persist).toBeUndefined();
  });

  it('syncFromMatchState populates clocks from a valid snapshot', () => {
    const state = makeMatchState({
      clockSnapshot: {
        playerMs: 30_000,
        opponentMs: 20_000,
        activeOwner: 'player',
        snapshotTimestamp: 0,
      },
    });
    useLiveMatchStore.getState().syncFromMatchState(state);
    const live = useLiveMatchStore.getState().liveClocks;
    expect(live).not.toBeNull();
    expect(live?.playerMs).toBe(30_000);
    expect(live?.opponentMs).toBe(20_000);
    expect(live?.activeOwner).toBe('player');
  });

  it('syncFromMatchState clears when no snapshot is present', () => {
    useLiveMatchStore.setState({
      liveClocks: { playerMs: 100, opponentMs: 100, activeOwner: 'player', lastTickAt: 0 },
    });
    useLiveMatchStore.getState().syncFromMatchState(makeMatchState());
    expect(useLiveMatchStore.getState().liveClocks).toBeNull();
  });

  it('syncFromMatchState clears when called with null', () => {
    useLiveMatchStore.setState({
      liveClocks: { playerMs: 100, opponentMs: 100, activeOwner: 'player', lastTickAt: 0 },
    });
    useLiveMatchStore.getState().syncFromMatchState(null);
    expect(useLiveMatchStore.getState().liveClocks).toBeNull();
  });

  it('tickClock decrements the active owner only', () => {
    useLiveMatchStore.setState({
      liveClocks: { playerMs: 1000, opponentMs: 2000, activeOwner: 'player', lastTickAt: 0 },
    });
    useLiveMatchStore.getState().tickClock(250);
    const live = useLiveMatchStore.getState().liveClocks;
    expect(live?.playerMs).toBe(750);
    expect(live?.opponentMs).toBe(2000);
  });

  it('tickClock clamps at zero', () => {
    useLiveMatchStore.setState({
      liveClocks: { playerMs: 100, opponentMs: 2000, activeOwner: 'player', lastTickAt: 0 },
    });
    useLiveMatchStore.getState().tickClock(500);
    expect(useLiveMatchStore.getState().liveClocks?.playerMs).toBe(0);
  });

  it('tickClock is a no-op when there are no clocks', () => {
    useLiveMatchStore.getState().tickClock(100);
    expect(useLiveMatchStore.getState().liveClocks).toBeNull();
  });

  it('tickClock ignores zero / negative deltas', () => {
    useLiveMatchStore.setState({
      liveClocks: { playerMs: 100, opponentMs: 200, activeOwner: 'player', lastTickAt: 0 },
    });
    useLiveMatchStore.getState().tickClock(0);
    useLiveMatchStore.getState().tickClock(-50);
    expect(useLiveMatchStore.getState().liveClocks?.playerMs).toBe(100);
  });

  it('clear nulls out liveClocks', () => {
    useLiveMatchStore.setState({
      liveClocks: { playerMs: 100, opponentMs: 200, activeOwner: 'player', lastTickAt: 0 },
    });
    useLiveMatchStore.getState().clear();
    expect(useLiveMatchStore.getState().liveClocks).toBeNull();
  });
});
