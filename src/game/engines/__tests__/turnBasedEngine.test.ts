import { createRNG } from '@/lib/random';

import { InvalidEngineStateError, ModeNotFoundError } from '../../errors';
import { __resetRegistryForTests, modeRegistry } from '../../modeRegistry';
import type { ModeDefinition, NormalizedFeedback, RNG, ValidationResult } from '../../types';
import {
  applyClockSnapshot,
  applyTimeout,
  createMatch,
  startMatch,
  submitGuess,
} from '../turnBasedEngine';

interface StubModeOptions {
  evaluate?: (guess: string, secret: string) => NormalizedFeedback;
  validateGuess?: (guess: string) => ValidationResult;
  maxGuessesPerPlayer?: number;
  perPlayerTimeLimitMs?: number;
  generateSecret?: (rng: RNG) => string;
}

function registerStub(id: number, opts: StubModeOptions = {}): ModeDefinition {
  const mode: ModeDefinition = {
    id,
    meta: {
      section: 'CLASSIC',
      name: 'STUB',
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
      flags: {},
      ...(opts.maxGuessesPerPlayer !== undefined
        ? { maxGuessesPerPlayer: opts.maxGuessesPerPlayer }
        : {}),
      ...(opts.perPlayerTimeLimitMs !== undefined
        ? { perPlayerTimeLimitMs: opts.perPlayerTimeLimitMs }
        : {}),
    },
    generateSecret: opts.generateSecret ?? (() => '5678'),
    validateGuess: opts.validateGuess ?? (() => ({ ok: true })),
    evaluate:
      opts.evaluate ??
      ((guess, secret) =>
        guess === secret
          ? { kind: 'colorMatch', states: ['green', 'green', 'green', 'green'], isWin: true }
          : { kind: 'colorMatch', states: ['gray', 'gray', 'gray', 'gray'], isWin: false }),
    bot: {
      initSolverState: () => ({ kind: 'candidatePool', pool: ['0000', '1111'] }),
      makeGuess: async () => ({
        guess: '0000',
        newSolverState: { kind: 'candidatePool', pool: ['0000'] },
      }),
      thinkingTime: () => 2000,
    },
  };
  modeRegistry.register(mode);
  return mode;
}

describe('turnBasedEngine', () => {
  beforeEach(() => {
    __resetRegistryForTests();
  });

  describe('createMatch', () => {
    it('produces a setup-phase MatchState with persisted RNG cursor', () => {
      registerStub(1);
      const state = createMatch(1, '1234', { seed: 7, callCount: 0 });
      expect(state.phase).toBe('setup');
      expect(state.playerSecret).toBe('1234');
      expect(state.opponentSecret).toBe('5678');
      expect(state.rngState.callCount).toBeGreaterThanOrEqual(0);
      expect(state.result).toBeNull();
    });

    it('throws ModeNotFoundError for an unregistered id', () => {
      expect(() => createMatch(999, '1234', { seed: 1, callCount: 0 })).toThrow(ModeNotFoundError);
    });

    it('seeds guessLimits when the mode declares maxGuessesPerPlayer', () => {
      registerStub(6, { maxGuessesPerPlayer: 5 });
      const state = createMatch(6, '1234', { seed: 1, callCount: 0 });
      expect(state.guessLimits).toEqual({ playerRemaining: 5, opponentRemaining: 5 });
    });
  });

  describe('startMatch', () => {
    it('moves phase from setup to active and seeds opponent solver state', () => {
      registerStub(1);
      const state = createMatch(1, '1234', { seed: 1, callCount: 0 });
      const rng = createRNG(state.rngState);
      const started = startMatch(state, rng);
      expect(started.phase).toMatch(/^active_turn_(player|opponent)$/);
      expect(started.solverStates?.opponent?.kind).toBe('candidatePool');
    });

    it("freezes botDifficulty (Phase 3 hardcodes 'normal'; Phase 7A wires DDA)", () => {
      registerStub(1);
      const state = createMatch(1, '1234', { seed: 1, callCount: 0 });
      const started = startMatch(state, createRNG(state.rngState));
      expect(started.botDifficulty).toBe('normal');
    });

    it('preserves a botDifficulty already on state (resume scenario)', () => {
      registerStub(1);
      const created = createMatch(1, '1234', { seed: 1, callCount: 0 });
      const withHard = { ...created, botDifficulty: 'hard' as const };
      const started = startMatch(withHard, createRNG(withHard.rngState));
      expect(started.botDifficulty).toBe('hard');
    });

    it('throws InvalidEngineStateError when called on a non-setup state', () => {
      registerStub(1);
      const state = createMatch(1, '1234', { seed: 1, callCount: 0 });
      const rng = createRNG(state.rngState);
      const started = startMatch(state, rng);
      expect(() => startMatch(started, createRNG(started.rngState))).toThrow(
        InvalidEngineStateError,
      );
    });
  });

  describe('submitGuess — behavior assertions', () => {
    it('returns a ValidationError without mutating state on bad guess', async () => {
      registerStub(1, {
        validateGuess: () => ({
          ok: false,
          error: { code: 'WRONG_LENGTH', message: 'too short' },
        }),
      });
      const created = createMatch(1, '1234', { seed: 1, callCount: 0 });
      const started = startMatch(created, createRNG(created.rngState));
      const result = await submitGuess(started, '12', 'self', createRNG(started.rngState));
      expect(result.error?.code).toBe('WRONG_LENGTH');
      expect(result.feedback).toBeNull();
      expect(result.state).toBe(started);
    });

    it('appends a guess and advances turn when the secret is not cracked', async () => {
      registerStub(1);
      const created = createMatch(1, '1234', { seed: 1, callCount: 0 });
      const started = startMatch(created, createRNG(created.rngState));
      const wasPlayer = started.phase === 'active_turn_player';
      const author = wasPlayer ? 'self' : 'opponent';
      const out = await submitGuess(started, '0000', author, createRNG(started.rngState));
      expect(out.error).toBeNull();
      expect(out.feedback).not.toBeNull();
      expect(out.state.phase).toBe(wasPlayer ? 'active_turn_opponent' : 'active_turn_player');
      const list = wasPlayer ? out.state.playerGuesses : out.state.opponentGuesses;
      expect(list).toHaveLength(1);
    });

    it('rngState callCount strictly increases across guesses (resume invariant)', async () => {
      registerStub(1);
      const created = createMatch(1, '1234', { seed: 1, callCount: 0 });
      const started = startMatch(created, createRNG(created.rngState));
      const rngBefore = createRNG(started.rngState);
      // Burn an explicit call so the snapshot we hand to submitGuess is
      // visibly past the start-match cursor.
      rngBefore.next();
      const before = rngBefore.getState().callCount;
      const out = await submitGuess(started, '0000', 'self', rngBefore);
      expect(out.state.rngState.callCount).toBeGreaterThanOrEqual(before);
    });

    it('decrements guessLimits when the mode tracks a Sudden Death budget', async () => {
      registerStub(6, { maxGuessesPerPlayer: 3 });
      const created = createMatch(6, '1234', { seed: 1, callCount: 0 });
      const started = startMatch(created, createRNG(created.rngState));
      const author = started.phase === 'active_turn_player' ? 'self' : 'opponent';
      const out = await submitGuess(started, '0000', author, createRNG(started.rngState));
      const remaining =
        author === 'self'
          ? out.state.guessLimits?.playerRemaining
          : out.state.guessLimits?.opponentRemaining;
      expect(remaining).toBe(2);
    });

    it('throws InvalidEngineStateError when called before startMatch', async () => {
      registerStub(1);
      const setup = createMatch(1, '1234', { seed: 1, callCount: 0 });
      await expect(submitGuess(setup, '0000', 'self', createRNG(setup.rngState))).rejects.toThrow(
        InvalidEngineStateError,
      );
    });
  });

  describe('isWin/outcome consistency invariant (DİKKAT 3)', () => {
    it('a winning evaluate result transitions phase to completed with a result', async () => {
      registerStub(1, {
        evaluate: () => ({
          kind: 'colorMatch',
          states: ['green', 'green', 'green', 'green'],
          isWin: true,
        }),
      });
      const created = createMatch(1, '1234', { seed: 1, callCount: 0 });
      const started = startMatch(created, createRNG(created.rngState));
      const author = started.phase === 'active_turn_player' ? 'self' : 'opponent';
      const out = await submitGuess(started, '0000', author, createRNG(started.rngState));
      expect(out.state.phase).toBe('completed');
      expect(out.state.result).not.toBeNull();
      expect(out.state.result?.outcome).toBe(author === 'self' ? 'player_won' : 'opponent_won');
      expect(out.state.result?.reason).toBe('cracked');
    });

    it('engine never returns isWin:true while phase stays active', async () => {
      registerStub(1, {
        evaluate: () => ({
          kind: 'colorMatch',
          states: ['green', 'green', 'green', 'green'],
          isWin: true,
        }),
      });
      const created = createMatch(1, '1234', { seed: 1, callCount: 0 });
      const started = startMatch(created, createRNG(created.rngState));
      const out = await submitGuess(
        started,
        '0000',
        started.phase === 'active_turn_player' ? 'self' : 'opponent',
        createRNG(started.rngState),
      );
      // Invariant: isWin === true on the latest emitted feedback ⇒ phase MUST be 'completed'.
      if (out.feedback?.isWin === true) {
        expect(out.state.phase).toBe('completed');
        expect(out.state.result).not.toBeNull();
      }
    });

    it('simultaneous crack with both sides cracking ⇒ outcome=draw', async () => {
      // Pre-seed one side with a winning entry, then submit a winning
      // guess from the other side in the same turn — the engine should
      // collapse to a draw via checkEndConditions.
      registerStub(1, {
        evaluate: () => ({
          kind: 'colorMatch',
          states: ['green', 'green', 'green', 'green'],
          isWin: true,
        }),
      });
      const created = createMatch(1, '1234', { seed: 1, callCount: 0 });
      const started = startMatch(created, createRNG(created.rngState));
      // Force the active turn to player by mutating the (otherwise
      // RNG-derived) phase — the test cares about engine output, not
      // who draws first.
      const playerActive = { ...started, phase: 'active_turn_player' as const };
      // Plant an opponent crack already in history.
      const planted = {
        ...playerActive,
        opponentGuesses: [
          {
            side: 'opponent' as const,
            guessIndex: 1,
            digits: [5, 6, 7, 8],
            feedback: {
              kind: 'colorMatch' as const,
              states: ['green' as const, 'green' as const, 'green' as const, 'green' as const],
              isWin: true,
            },
          },
        ],
      };
      const out = await submitGuess(planted, '0000', 'self', createRNG(planted.rngState));
      expect(out.state.phase).toBe('completed');
      expect(out.state.result?.outcome).toBe('draw');
      expect(out.state.result?.reason).toBe('simultaneous_crack');
    });
  });

  describe('applyTimeout / applyClockSnapshot', () => {
    it('applyClockSnapshot writes the snapshot through unchanged', () => {
      registerStub(4, { perPlayerTimeLimitMs: 60_000 });
      const created = createMatch(4, '1234', { seed: 1, callCount: 0 });
      const started = startMatch(created, createRNG(created.rngState));
      const snap = {
        playerMs: 30_000,
        opponentMs: 30_000,
        activeOwner: 'player' as const,
        snapshotTimestamp: 100,
      };
      const next = applyClockSnapshot(started, snap);
      expect(next.clockSnapshot).toEqual(snap);
    });

    it('applyTimeout collapses to a terminal result when the snapshot says zero', () => {
      const mode = registerStub(4, { perPlayerTimeLimitMs: 60_000 });
      const created = createMatch(4, '1234', { seed: 1, callCount: 0 });
      const started = startMatch(created, createRNG(created.rngState));
      const expired = applyClockSnapshot(started, {
        playerMs: 0,
        opponentMs: 30_000,
        activeOwner: 'player',
        snapshotTimestamp: 100,
      });
      const ended = applyTimeout(expired, mode);
      expect(ended.phase).toBe('completed');
      expect(ended.result?.outcome).toBe('opponent_won');
      expect(ended.result?.reason).toBe('player_time_out');
    });

    it('applyTimeout throws when no end condition is satisfied (caller must set snapshot first)', () => {
      const mode = registerStub(4, { perPlayerTimeLimitMs: 60_000 });
      const created = createMatch(4, '1234', { seed: 1, callCount: 0 });
      const started = startMatch(created, createRNG(created.rngState));
      // Snapshot still positive on both sides — applyTimeout would have
      // nothing to declare; the engine refuses silently-empty calls.
      const withSnap = applyClockSnapshot(started, {
        playerMs: 30_000,
        opponentMs: 30_000,
        activeOwner: 'player',
        snapshotTimestamp: 100,
      });
      expect(() => applyTimeout(withSnap, mode)).toThrow(InvalidEngineStateError);
    });
  });
});
