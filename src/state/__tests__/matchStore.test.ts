import { __resetRegistryForTests, modeRegistry } from '../../game/modeRegistry';
import type { ModeDefinition } from '../../game/types';
import { useMatchStore } from '../matchStore';

interface StubOptions {
  alwaysWin?: boolean;
  parallelRace?: boolean;
}

function registerStub(id: number, opts: StubOptions = {}): ModeDefinition {
  const mode: ModeDefinition = {
    id,
    meta: {
      section: 'CLASSIC',
      name: 'STORE STUB',
      shortLabel: 'STUB',
      description: 'fixture',
      stake: 50,
      rewardWin: 100,
      rewardDraw: 50,
      gradient: ['#000', '#fff'],
      iconKey: 'color-match',
    },
    rules: {
      secretLength: 4,
      digitsUnique: false,
      flags: opts.parallelRace ? { parallelRace: true } : {},
    },
    generateSecret: () => '5678',
    validateGuess: () => ({ ok: true }),
    evaluate: () =>
      opts.alwaysWin
        ? { kind: 'colorMatch', states: ['green', 'green', 'green', 'green'], isWin: true }
        : { kind: 'colorMatch', states: ['gray', 'gray', 'gray', 'gray'], isWin: false },
    bot: {
      initSolverState: () => ({ kind: 'candidatePool', pool: [] }),
      makeGuess: async () => ({
        guess: '0000',
        newSolverState: { kind: 'candidatePool', pool: [] },
      }),
      thinkingTime: () => 2000,
    },
  };
  modeRegistry.register(mode);
  return mode;
}

describe('useMatchStore', () => {
  beforeEach(() => {
    __resetRegistryForTests();
    useMatchStore.setState({ matchState: null });
  });

  describe('createMatch — no-op guard', () => {
    it('seeds a match when none is in progress', () => {
      registerStub(1);
      const ok = useMatchStore.getState().createMatch(1, '1234');
      expect(ok).toBe(true);
      expect(useMatchStore.getState().matchState?.modeId).toBe(1);
    });

    it('returns false (no-op) when an active match already exists', () => {
      registerStub(1);
      useMatchStore.getState().createMatch(1, '1234');
      const before = useMatchStore.getState().matchState;
      const second = useMatchStore.getState().createMatch(1, '9999');
      expect(second).toBe(false);
      expect(useMatchStore.getState().matchState).toBe(before);
    });

    it('allows a fresh match after clearMatch', () => {
      registerStub(1);
      useMatchStore.getState().createMatch(1, '1234');
      useMatchStore.getState().clearMatch();
      const second = useMatchStore.getState().createMatch(1, '9999');
      expect(second).toBe(true);
      expect(useMatchStore.getState().matchState?.playerSecret).toBe('9999');
    });

    it('allows a fresh match once the previous one completed', () => {
      registerStub(1);
      useMatchStore.getState().createMatch(1, '1234');
      const current = useMatchStore.getState().matchState!;
      useMatchStore.setState({ matchState: { ...current, phase: 'completed' } });
      const second = useMatchStore.getState().createMatch(1, '4321');
      expect(second).toBe(true);
    });
  });

  describe('submitGuess — outcome assertions (behavior, not internals)', () => {
    it('a winning guess transitions phase=completed with outcome=player_won', async () => {
      registerStub(1, { alwaysWin: true });
      useMatchStore.getState().createMatch(1, '1234');
      useMatchStore.getState().startMatch();
      // Force the active turn to player so the assertion is deterministic.
      useMatchStore.setState((s) => ({
        matchState: s.matchState ? { ...s.matchState, phase: 'active_turn_player' } : null,
      }));
      const out = await useMatchStore.getState().submitGuess('5678', 'self');
      expect(out.feedback?.isWin).toBe(true);
      const state = useMatchStore.getState().matchState!;
      expect(state.phase).toBe('completed');
      expect(state.result?.outcome).toBe('player_won');
      expect(state.result?.reason).toBe('cracked');
    });

    it('a losing guess keeps the match active and rotates the turn', async () => {
      registerStub(1, { alwaysWin: false });
      useMatchStore.getState().createMatch(1, '1234');
      useMatchStore.getState().startMatch();
      useMatchStore.setState((s) => ({
        matchState: s.matchState ? { ...s.matchState, phase: 'active_turn_player' } : null,
      }));
      await useMatchStore.getState().submitGuess('0000', 'self');
      const state = useMatchStore.getState().matchState!;
      expect(state.phase).toBe('active_turn_opponent');
      expect(state.result).toBeNull();
      expect(state.playerGuesses).toHaveLength(1);
    });
  });

  describe('clearMatch', () => {
    it('resets matchState to null', () => {
      registerStub(1);
      useMatchStore.getState().createMatch(1, '1234');
      useMatchStore.getState().clearMatch();
      expect(useMatchStore.getState().matchState).toBeNull();
    });
  });

  describe('endMatch', () => {
    it('marks the current match completed with the supplied result', () => {
      registerStub(1);
      useMatchStore.getState().createMatch(1, '1234');
      useMatchStore.getState().endMatch({
        outcome: 'opponent_won',
        reason: 'player_time_out',
        turns: 0,
      });
      const state = useMatchStore.getState().matchState!;
      expect(state.phase).toBe('completed');
      expect(state.result?.outcome).toBe('opponent_won');
    });
  });

  it('exposes a persist API (durable)', () => {
    expect(useMatchStore.persist).toBeDefined();
  });
});
