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

  describe('runOpponentTurn', () => {
    it('no-ops when phase is not active_turn_opponent', async () => {
      registerStub(1);
      useMatchStore.getState().createMatch(1, '1234');
      useMatchStore.getState().startMatch();
      useMatchStore.setState((s) => ({
        matchState: s.matchState ? { ...s.matchState, phase: 'active_turn_player' } : null,
      }));
      const before = useMatchStore.getState().matchState;
      const out = await useMatchStore.getState().runOpponentTurn();
      expect(out.feedback).toBeNull();
      expect(useMatchStore.getState().matchState).toBe(before);
    });

    it('appends an opponent guess and rotates phase back to player', async () => {
      registerStub(1);
      useMatchStore.getState().createMatch(1, '1234');
      useMatchStore.getState().startMatch();
      // Pin phase so the assertion is deterministic regardless of which
      // side `startMatch` randomly chose to start.
      useMatchStore.setState((s) => ({
        matchState: s.matchState ? { ...s.matchState, phase: 'active_turn_opponent' } : null,
      }));
      const out = await useMatchStore.getState().runOpponentTurn();
      expect(out.error).toBeNull();
      expect(out.feedback).not.toBeNull();
      const state = useMatchStore.getState().matchState!;
      expect(state.opponentGuesses).toHaveLength(1);
      expect(state.phase).toBe('active_turn_player');
    });

    it("writes the bot's newSolverState through to matchState.solverStates.opponent", async () => {
      // Stub returns a different solverState shape so we can confirm
      // the writeback path actually touched it.
      registerStub(1);
      const mode = modeRegistry.get(1);
      // Patch the stub bot in place — Jest doesn't run two registers in
      // the same test, so the existing fixture is mutable.
      (mode as { bot: typeof mode.bot }).bot = {
        ...mode.bot,
        makeGuess: async () => ({
          guess: '1234',
          newSolverState: { kind: 'candidatePool', pool: ['1234'] },
        }),
      };
      useMatchStore.getState().createMatch(1, '1234');
      useMatchStore.getState().startMatch();
      useMatchStore.setState((s) => ({
        matchState: s.matchState ? { ...s.matchState, phase: 'active_turn_opponent' } : null,
      }));
      await useMatchStore.getState().runOpponentTurn();
      const state = useMatchStore.getState().matchState!;
      const opp = state.solverStates?.opponent;
      expect(opp?.kind).toBe('candidatePool');
      if (opp?.kind === 'candidatePool') {
        expect(opp.pool).toEqual(['1234']);
      }
    });

    it('produces an identical sequence on a serialized + restored state (resume identity)', async () => {
      // Drives the contract that AsyncStorage hydration ⇒ bit-identical
      // bot continuation. We serialize, set state from JSON, run the
      // turn, and compare to a fresh-from-create run on the same seed.
      registerStub(1);
      useMatchStore.getState().createMatch(1, '1234');
      useMatchStore.getState().startMatch();
      // Force opponent turn from a known seed.
      useMatchStore.setState((s) => ({
        matchState: s.matchState
          ? {
              ...s.matchState,
              phase: 'active_turn_opponent',
              rngState: { seed: 7777, callCount: 0 },
            }
          : null,
      }));
      const liveBefore = useMatchStore.getState().matchState!;

      // Run #1 — direct.
      await useMatchStore.getState().runOpponentTurn();
      const liveAfter = useMatchStore.getState().matchState!;

      // Run #2 — round-trip through JSON to mimic AsyncStorage rehydrate.
      const restored = JSON.parse(JSON.stringify(liveBefore)) as typeof liveBefore;
      useMatchStore.setState({ matchState: restored });
      await useMatchStore.getState().runOpponentTurn();
      const restoredAfter = useMatchStore.getState().matchState!;

      // Same guess + same RNG cursor + same opponent guesses count.
      expect(restoredAfter.opponentGuesses).toEqual(liveAfter.opponentGuesses);
      expect(restoredAfter.rngState).toEqual(liveAfter.rngState);
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
