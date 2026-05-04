import { __resetRegistryForTests, modeRegistry } from '../../game/modeRegistry';
import type { GuessEntry, ModeDefinition } from '../../game/types';
import { useLiveMatchStore } from '../liveMatchStore';
import { useMatchStore } from '../matchStore';
import { useUserStore, USER_STORE_DEFAULTS } from '../userStore';

// Wall-clock isn't part of resume identity (see ARCHITECTURE
// "stripTimestamp helper — wall-clock isn't part of resume identity").
// Two runOpponentTurn calls a millisecond apart can land different
// `createdAt` values; the test compares the bot-deterministic
// content, not the timestamp.
function stripTimestamp({ createdAt: _createdAt, ...rest }: GuessEntry): Omit<GuessEntry, 'createdAt'> {
  return rest;
}

interface StubOptions {
  alwaysWin?: boolean;
  parallelRace?: boolean;
  perPlayerTimeLimitMs?: number;
  maxGuessesPerPlayer?: number;
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
      ...(opts.perPlayerTimeLimitMs !== undefined
        ? { perPlayerTimeLimitMs: opts.perPlayerTimeLimitMs }
        : {}),
      ...(opts.maxGuessesPerPlayer !== undefined
        ? { maxGuessesPerPlayer: opts.maxGuessesPerPlayer }
        : {}),
      flags: {
        ...(opts.parallelRace ? { parallelRace: true } : {}),
        ...(opts.perPlayerTimeLimitMs !== undefined ? { perPlayerClock: true } : {}),
      },
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
    // Bug 1 — stake debit hits userStore from createMatch. Reset to
    // a known balance so per-test arithmetic is independent.
    useUserStore.setState({ tokens: USER_STORE_DEFAULTS.tokens });
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

    it('Bug 1 — debits the mode stake from userStore on first call', () => {
      registerStub(1);
      const before = useUserStore.getState().tokens;
      useMatchStore.getState().createMatch(1, '1234');
      // Stub catalog stake is 50 (see registerStub fixture).
      expect(useUserStore.getState().tokens).toBe(before - 50);
    });

    it('Bug 1 — does NOT debit when the no-op guard rejects a re-entry', () => {
      registerStub(1);
      useMatchStore.getState().createMatch(1, '1234');
      const afterFirst = useUserStore.getState().tokens;
      // Second call hits the in-progress guard before the debit.
      useMatchStore.getState().createMatch(1, '9999');
      expect(useUserStore.getState().tokens).toBe(afterFirst);
    });

    it('Bug 1 — debits exactly once per fresh match across clearMatch', () => {
      registerStub(1);
      const before = useUserStore.getState().tokens;
      useMatchStore.getState().createMatch(1, '1234');
      useMatchStore.getState().clearMatch();
      useMatchStore.getState().createMatch(1, '4321');
      // Two stakes for two matches.
      expect(useUserStore.getState().tokens).toBe(before - 100);
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

    it('CP4 — fires on active_parallel for parallel-engine modes (Mode 6 / Mode 7)', async () => {
      registerStub(7, { parallelRace: true });
      useMatchStore.getState().createMatch(7, '1234');
      useMatchStore.getState().startMatch();
      // parallelEngine.startMatch already lands on active_parallel,
      // so no pin needed — but assert it explicitly so the test
      // doesn't silently regress if startMatch ever changes.
      expect(useMatchStore.getState().matchState!.phase).toBe('active_parallel');
      const out = await useMatchStore.getState().runOpponentTurn();
      expect(out.error).toBeNull();
      expect(out.feedback).not.toBeNull();
      const state = useMatchStore.getState().matchState!;
      expect(state.opponentGuesses).toHaveLength(1);
      // Phase stays parallel — no advanceTurn for parallel modes.
      expect(state.phase).toBe('active_parallel');
    });

    it('CP4 — short-circuits when opponent budget hits 0 (Mode 6 parallel exhaustion)', async () => {
      registerStub(6, { parallelRace: true, maxGuessesPerPlayer: 5 });
      useMatchStore.getState().createMatch(6, '1234');
      useMatchStore.getState().startMatch();
      // Force the opponent budget to zero — engine would otherwise
      // accept a 6th guess and append it (decrement floors at 0)
      // because Mode 6 single-side exhaustion is non-terminal.
      useMatchStore.setState((s) => ({
        matchState: s.matchState
          ? {
              ...s.matchState,
              guessLimits: { playerRemaining: 5, opponentRemaining: 0 },
            }
          : null,
      }));
      const before = useMatchStore.getState().matchState;
      const out = await useMatchStore.getState().runOpponentTurn();
      expect(out.feedback).toBeNull();
      expect(useMatchStore.getState().matchState).toBe(before);
    });

    it('CP4 — non-parallel + active_parallel phase is still a no-op (defensive)', async () => {
      // Non-parallel mode in active_parallel phase is impossible in
      // production but should fail safe rather than throw — covers
      // hand-edited state / future engine swaps.
      registerStub(1);
      useMatchStore.getState().createMatch(1, '1234');
      useMatchStore.getState().startMatch();
      useMatchStore.setState((s) => ({
        matchState: s.matchState ? { ...s.matchState, phase: 'active_parallel' } : null,
      }));
      const before = useMatchStore.getState().matchState;
      const out = await useMatchStore.getState().runOpponentTurn();
      expect(out.error).toBeNull();
      // Submission attempts on a non-parallel-registered mode in an
      // active_parallel phase pass through — turnBasedEngine will
      // accept the guess. The contract is "don't throw on stale
      // phase"; behavior beyond that is mode-specific and tested
      // elsewhere. Don't over-pin.
      expect(useMatchStore.getState().matchState).not.toBe(before);
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
      // Strip `createdAt` (wall-clock, not part of resume identity).
      expect(restoredAfter.opponentGuesses.map(stripTimestamp)).toEqual(
        liveAfter.opponentGuesses.map(stripTimestamp),
      );
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

  // Phase 5 — Mode 4 Blitz: matchStore is the cross-store seam between
  // the transient `liveMatchStore` (10Hz tick) and the durable
  // `matchState.clockSnapshot` the engine reads. `submitGuess` and
  // `runOpponentTurn` capture the live tick value as a snapshot
  // before handing off to the engine; `startMatch` mirrors the
  // engine-seeded snapshot back into the live store so the screen's
  // tick interval has initial values to read.
  describe('Mode 4 — live↔durable clock seam', () => {
    beforeEach(() => {
      useLiveMatchStore.getState().clear();
    });

    it('startMatch mirrors the engine-seeded clockSnapshot into liveMatchStore', () => {
      registerStub(4, { perPlayerTimeLimitMs: 60_000 });
      useMatchStore.getState().createMatch(4, '1234');
      useMatchStore.getState().startMatch();
      const live = useLiveMatchStore.getState().liveClocks;
      expect(live).not.toBeNull();
      expect(live?.playerMs).toBe(60_000);
      expect(live?.opponentMs).toBe(60_000);
      expect(live?.activeOwner === 'player' || live?.activeOwner === 'opponent').toBe(true);
    });

    it('submitGuess captures the live tick onto the durable snapshot before evaluating', async () => {
      registerStub(4, { perPlayerTimeLimitMs: 60_000 });
      useMatchStore.getState().createMatch(4, '1234');
      useMatchStore.getState().startMatch();
      // Pin player turn + simulate the live tick having decremented
      // 8 seconds off the player's side.
      useMatchStore.setState((s) => ({
        matchState: s.matchState
          ? { ...s.matchState, phase: 'active_turn_player' }
          : null,
      }));
      useLiveMatchStore.setState({
        liveClocks: {
          playerMs: 52_000,
          opponentMs: 60_000,
          activeOwner: 'player',
          lastTickAt: Date.now(),
        },
      });
      await useMatchStore.getState().submitGuess('5555', 'self');
      const state = useMatchStore.getState().matchState!;
      // Durable snapshot reflects the live-ticked value, and the
      // entry's elapsedMs is the (limit - remaining) delta the
      // engine derived.
      expect(state.clockSnapshot?.playerMs).toBe(52_000);
      const lastEntry = state.playerGuesses[state.playerGuesses.length - 1];
      expect(lastEntry?.elapsedMs).toBe(8_000);
    });

    it('non-Blitz modes never write a clockSnapshot (live store stays empty)', async () => {
      registerStub(1);
      useMatchStore.getState().createMatch(1, '1234');
      useMatchStore.getState().startMatch();
      const live = useLiveMatchStore.getState().liveClocks;
      expect(live).toBeNull();
      const state = useMatchStore.getState().matchState!;
      expect(state.clockSnapshot).toBeUndefined();
    });
  });

  describe('createMatch — Phase 7A.2 DDA wiring', () => {
    // Reset `stats` (specifically `recentMatches`) so tests don't bleed
    // into each other through the persisted userStore singleton.
    beforeEach(() => {
      useUserStore.setState({ stats: USER_STORE_DEFAULTS.stats });
    });

    it('warm-up (empty recentMatches) stamps botDifficulty=normal', () => {
      registerStub(1);
      useUserStore.setState({
        stats: { ...USER_STORE_DEFAULTS.stats, recentMatches: [] },
      });
      useMatchStore.getState().createMatch(1, '1234');
      expect(useMatchStore.getState().matchState?.botDifficulty).toBe('normal');
    });

    it('10 victories in the rolling window stamps botDifficulty=hard', () => {
      registerStub(1);
      useUserStore.setState({
        stats: {
          ...USER_STORE_DEFAULTS.stats,
          recentMatches: Array.from({ length: 10 }, () => 'victory' as const),
        },
      });
      useMatchStore.getState().createMatch(1, '1234');
      expect(useMatchStore.getState().matchState?.botDifficulty).toBe('hard');
    });

    it('10 defeats in the rolling window stamps botDifficulty=easy', () => {
      registerStub(1);
      useUserStore.setState({
        stats: {
          ...USER_STORE_DEFAULTS.stats,
          recentMatches: Array.from({ length: 10 }, () => 'defeat' as const),
        },
      });
      useMatchStore.getState().createMatch(1, '1234');
      expect(useMatchStore.getState().matchState?.botDifficulty).toBe('easy');
    });

    it('5V + 5D in the rolling window stamps botDifficulty=normal', () => {
      registerStub(1);
      useUserStore.setState({
        stats: {
          ...USER_STORE_DEFAULTS.stats,
          recentMatches: [
            'victory', 'defeat', 'victory', 'defeat', 'victory',
            'defeat', 'victory', 'defeat', 'victory', 'defeat',
          ],
        },
      });
      useMatchStore.getState().createMatch(1, '1234');
      expect(useMatchStore.getState().matchState?.botDifficulty).toBe('normal');
    });

    it('parallel-engine modes get the same DDA stamp (mode-agnostic)', () => {
      registerStub(1, { parallelRace: true });
      useUserStore.setState({
        stats: {
          ...USER_STORE_DEFAULTS.stats,
          recentMatches: Array.from({ length: 10 }, () => 'victory' as const),
        },
      });
      useMatchStore.getState().createMatch(1, '1234');
      expect(useMatchStore.getState().matchState?.botDifficulty).toBe('hard');
    });

    it('freezes difficulty for the match lifetime — recentMatches changes do not retroactively shift the active match', () => {
      registerStub(1);
      useUserStore.setState({
        stats: { ...USER_STORE_DEFAULTS.stats, recentMatches: [] },
      });
      useMatchStore.getState().createMatch(1, '1234');
      const stamped = useMatchStore.getState().matchState?.botDifficulty;
      expect(stamped).toBe('normal');
      // Player wins 10 in a row mid-match — the active match's stamp
      // must not move; the next createMatch picks up the new state.
      useUserStore.setState({
        stats: {
          ...USER_STORE_DEFAULTS.stats,
          recentMatches: Array.from({ length: 10 }, () => 'victory' as const),
        },
      });
      useMatchStore.getState().startMatch();
      expect(useMatchStore.getState().matchState?.botDifficulty).toBe('normal');
    });
  });
});
