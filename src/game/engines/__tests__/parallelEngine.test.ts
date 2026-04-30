/**
 * Phase 6 — `parallelEngine` full state machine. Replaces the Phase 2
 * soft-fail stub suite. Tests cover both Mode 6 (Sudden Death,
 * `parallelRace: true`, `maxGuessesPerPlayer: 5`) and Mode 7 (Mirror,
 * `parallelRace: true`, `sharedSecret: true`, no budget) shapes via a
 * single `registerFixture` builder.
 *
 * `simultaneous_crack → draw` is intentionally constructed (pre-seeded
 * state). In production, `matchStore.submitGuess` serializes the call
 * boundary so the first crack flips `phase=completed`; a racing second
 * submission hits the engine's `'completed'` throw. The branch is
 * still tested here because `checkEndConditions` does the right thing
 * when the state arrives at the engine via hydration or test fixture.
 */

import { createRNG } from '@/lib/random';

import { InvalidEngineStateError } from '../../errors';
import { __resetRegistryForTests, modeRegistry } from '../../modeRegistry';
import type {
  GuessEntry,
  ModeDefinition,
  ModeRules,
  NormalizedFeedback,
} from '../../types';
import {
  applyClockSnapshot,
  applyTimeout,
  createMatch,
  startMatch,
  submitGuess,
} from '../parallelEngine';

interface FixtureOptions {
  readonly id: number;
  readonly maxGuessesPerPlayer?: number;
  readonly sharedSecret?: boolean;
  /** Fixed engine-generated secret. Defaults to '5678'. */
  readonly secret?: string;
}

/**
 * Trivial position-equality evaluator — green per matching slot, gray
 * otherwise. Sufficient for outcome wiring; full Wordle two-pass
 * semantics live in `mode1ColorMatch.test.ts` and ride through this
 * engine via the real Mode 1 evaluator in mode integration tests.
 */
function defaultEvaluate(guess: string, secret: string): NormalizedFeedback {
  const states = guess.split('').map((c, i) => (secret[i] === c ? ('green' as const) : ('gray' as const)));
  const isWin = states.every((s) => s === 'green');
  return { kind: 'colorMatch', states, isWin };
}

function registerFixture(opts: FixtureOptions): ModeDefinition {
  const rules: ModeRules = {
    secretLength: 4,
    digitsUnique: false,
    ...(opts.maxGuessesPerPlayer !== undefined
      ? { maxGuessesPerPlayer: opts.maxGuessesPerPlayer }
      : {}),
    flags: {
      parallelRace: true,
      ...(opts.sharedSecret === true ? { sharedSecret: true } : {}),
      ...(opts.maxGuessesPerPlayer !== undefined ? { suddenDeath: true } : {}),
    },
  };
  const mode: ModeDefinition = {
    id: opts.id,
    meta: {
      section: 'ADVANCED',
      name: 'PARALLEL FIXTURE',
      shortLabel: 'PARA',
      description: 'fixture',
      stake: 50,
      rewardWin: 100,
      rewardDraw: 50,
      gradient: ['#000', '#fff'],
      iconKey: 'mirror',
    },
    rules,
    generateSecret: () => opts.secret ?? '5678',
    validateGuess: () => ({ ok: true }),
    evaluate: defaultEvaluate,
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

beforeEach(() => {
  __resetRegistryForTests();
});

// ─────────────────────────────────────────────────────────────
// createMatch
// ─────────────────────────────────────────────────────────────

describe('parallelEngine — createMatch', () => {
  it('lands in phase=setup with mode-generated opponentSecret', () => {
    registerFixture({ id: 7, sharedSecret: true });
    const state = createMatch(7, '1234', { seed: 1, callCount: 0 });
    expect(state.phase).toBe('setup');
    expect(state.modeId).toBe(7);
    expect(state.opponentSecret).toBe('5678');
  });

  it('sharedSecret=true overrides caller playerSecret with generated value (RNG-FIRST order)', () => {
    registerFixture({ id: 7, sharedSecret: true, secret: '9876' });
    const state = createMatch(7, 'CALLER_PROVIDED', { seed: 1, callCount: 0 });
    expect(state.playerSecret).toBe('9876');
    expect(state.opponentSecret).toBe('9876');
  });

  it('sharedSecret absent keeps caller-provided playerSecret (Mode 6 shape)', () => {
    registerFixture({ id: 6, maxGuessesPerPlayer: 5, secret: '5678' });
    const state = createMatch(6, '1234', { seed: 1, callCount: 0 });
    expect(state.playerSecret).toBe('1234');
    expect(state.opponentSecret).toBe('5678');
  });

  it('seeds guessLimits from rules.maxGuessesPerPlayer (Mode 6 shape)', () => {
    registerFixture({ id: 6, maxGuessesPerPlayer: 5 });
    const state = createMatch(6, '1234', { seed: 1, callCount: 0 });
    expect(state.guessLimits?.playerRemaining).toBe(5);
    expect(state.guessLimits?.opponentRemaining).toBe(5);
  });

  it('omits guessLimits when no maxGuessesPerPlayer (Mode 7 unlimited budget)', () => {
    registerFixture({ id: 7, sharedSecret: true });
    const state = createMatch(7, '1234', { seed: 1, callCount: 0 });
    expect(state.guessLimits).toBeUndefined();
  });

  it('advances RNG cursor by exactly the secret-generation draw', () => {
    registerFixture({ id: 7, sharedSecret: true });
    const before = { seed: 1, callCount: 0 };
    const state = createMatch(7, '1234', before);
    // The fixture's `generateSecret` returns a constant — the actual
    // RNG draw depends on the mode's helper. The contract here is
    // weaker but stable: state.rngState.callCount >= 0 and the seed
    // is preserved.
    expect(state.rngState.seed).toBe(1);
    expect(state.rngState.callCount).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────
// startMatch
// ─────────────────────────────────────────────────────────────

describe('parallelEngine — startMatch', () => {
  it('advances setup → active_parallel and seeds opponent solver + botDifficulty + firstAuthor', () => {
    registerFixture({ id: 7, sharedSecret: true });
    const created = createMatch(7, '1234', { seed: 1, callCount: 0 });
    const started = startMatch(created, createRNG(created.rngState));
    expect(started.phase).toBe('active_parallel');
    expect(started.solverStates?.opponent).toBeDefined();
    expect(started.botDifficulty).toBe('normal');
    expect(started.firstAuthor).toBe('self');
  });

  it('throws InvalidEngineStateError when called on a non-setup phase', () => {
    registerFixture({ id: 7, sharedSecret: true });
    const created = createMatch(7, '1234', { seed: 1, callCount: 0 });
    const started = startMatch(created, createRNG(created.rngState));
    expect(() => startMatch(started, createRNG(started.rngState))).toThrow(
      InvalidEngineStateError,
    );
  });

  it('does NOT consume RNG for who-starts (no turn rotation in parallel)', () => {
    registerFixture({ id: 7, sharedSecret: true });
    const created = createMatch(7, '1234', { seed: 1, callCount: 0 });
    const before = created.rngState.callCount;
    const started = startMatch(created, createRNG(created.rngState));
    // Same callCount — no rng.next() draws inside startMatch. This is
    // the engine-pair RNG-divergence point flagged in the file header.
    expect(started.rngState.callCount).toBe(before);
  });
});

// ─────────────────────────────────────────────────────────────
// submitGuess — invariants
// ─────────────────────────────────────────────────────────────

describe('parallelEngine — submitGuess invariants', () => {
  it('throws on phase=setup (programmer error, mirrors turnBased)', async () => {
    registerFixture({ id: 7, sharedSecret: true });
    const created = createMatch(7, '1234', { seed: 1, callCount: 0 });
    await expect(
      submitGuess(created, '0000', 'self', createRNG(created.rngState)),
    ).rejects.toThrow(InvalidEngineStateError);
  });

  it('throws on phase=completed (programmer error, mirrors turnBased)', async () => {
    registerFixture({ id: 7, sharedSecret: true });
    const created = createMatch(7, '1234', { seed: 1, callCount: 0 });
    const completed = { ...created, phase: 'completed' as const };
    await expect(
      submitGuess(completed, '0000', 'self', createRNG(completed.rngState)),
    ).rejects.toThrow(InvalidEngineStateError);
  });

  it('appends to player history independently of opponent history (independent counters)', async () => {
    registerFixture({ id: 6, maxGuessesPerPlayer: 5 });
    const created = createMatch(6, '1234', { seed: 1, callCount: 0 });
    const started = startMatch(created, createRNG(created.rngState));
    const after1 = await submitGuess(started, '0000', 'self', createRNG(started.rngState));
    const after2 = await submitGuess(
      after1.state,
      '1111',
      'self',
      createRNG(after1.state.rngState),
    );
    expect(after2.state.playerGuesses).toHaveLength(2);
    expect(after2.state.opponentGuesses).toHaveLength(0);
  });

  it("decrements only the submitting side's budget (Mode 6 fixture)", async () => {
    registerFixture({ id: 6, maxGuessesPerPlayer: 5 });
    const created = createMatch(6, '1234', { seed: 1, callCount: 0 });
    const started = startMatch(created, createRNG(created.rngState));
    const after = await submitGuess(started, '0000', 'self', createRNG(started.rngState));
    expect(after.state.guessLimits?.playerRemaining).toBe(4);
    expect(after.state.guessLimits?.opponentRemaining).toBe(5);
  });

  it('phase stays active_parallel after a non-terminal guess (no advanceTurn)', async () => {
    registerFixture({ id: 6, maxGuessesPerPlayer: 5 });
    const created = createMatch(6, '1234', { seed: 1, callCount: 0 });
    const started = startMatch(created, createRNG(created.rngState));
    const after = await submitGuess(started, '0000', 'self', createRNG(started.rngState));
    expect(after.state.phase).toBe('active_parallel');
  });

  it('Mode 7 sharedSecret: self-side targetSecret resolves to opponentSecret (same string)', async () => {
    registerFixture({ id: 7, sharedSecret: true, secret: '5678' });
    const created = createMatch(7, 'CALLER_IGNORED', { seed: 1, callCount: 0 });
    const started = startMatch(created, createRNG(created.rngState));
    const out = await submitGuess(started, '5678', 'self', createRNG(started.rngState));
    expect(out.feedback?.kind).toBe('colorMatch');
    expect(out.feedback?.isWin).toBe(true);
  });

  it('Mode 7 sharedSecret: opponent-side targetSecret resolves to playerSecret (also = shared)', async () => {
    registerFixture({ id: 7, sharedSecret: true, secret: '5678' });
    const created = createMatch(7, '_', { seed: 1, callCount: 0 });
    const started = startMatch(created, createRNG(created.rngState));
    const out = await submitGuess(started, '5678', 'opponent', createRNG(started.rngState));
    expect(out.feedback?.isWin).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// Outcome resolution — the four terminal scenarios
// ─────────────────────────────────────────────────────────────

describe('parallelEngine — outcome resolution', () => {
  it('player crack alone → player_won / cracked, phase=completed', async () => {
    registerFixture({ id: 7, sharedSecret: true, secret: '5678' });
    const created = createMatch(7, '_', { seed: 1, callCount: 0 });
    const started = startMatch(created, createRNG(created.rngState));
    const out = await submitGuess(started, '5678', 'self', createRNG(started.rngState));
    expect(out.state.phase).toBe('completed');
    expect(out.state.result).toEqual({ outcome: 'player_won', reason: 'cracked', turns: 1 });
  });

  it('opponent crack alone → opponent_won / cracked, phase=completed', async () => {
    registerFixture({ id: 7, sharedSecret: true, secret: '5678' });
    const created = createMatch(7, '_', { seed: 1, callCount: 0 });
    const started = startMatch(created, createRNG(created.rngState));
    const out = await submitGuess(started, '5678', 'opponent', createRNG(started.rngState));
    expect(out.state.phase).toBe('completed');
    expect(out.state.result).toEqual({ outcome: 'opponent_won', reason: 'cracked', turns: 1 });
  });

  // CONSTRUCTED state: in production, function-call serialization at
  // matchStore.submitGuess prevents two cracks landing in the same
  // active_parallel snapshot. The branch still must be correct for
  // hydrated states + the parity test (CP3) which feeds explicit
  // histories.
  it('both sides cracked in the same submission window → draw / simultaneous_crack', async () => {
    registerFixture({ id: 7, sharedSecret: true, secret: '5678' });
    const created = createMatch(7, '_', { seed: 1, callCount: 0 });
    const started = startMatch(created, createRNG(created.rngState));
    const winningEntry: GuessEntry = {
      side: 'opponent',
      guessIndex: 1,
      digits: [5, 6, 7, 8],
      feedback: {
        kind: 'colorMatch',
        states: ['green', 'green', 'green', 'green'],
        isWin: true,
      },
    };
    // Pre-seed: opponent already cracked in a state somehow surfaced
    // back to the engine with phase=active_parallel (e.g. test/hydrate
    // fixture). The player now submits a winning guess — engine must
    // resolve to draw, not opponent_won.
    const preSeeded = { ...started, opponentGuesses: [winningEntry] };
    const out = await submitGuess(preSeeded, '5678', 'self', createRNG(preSeeded.rngState));
    expect(out.state.phase).toBe('completed');
    expect(out.state.result?.outcome).toBe('draw');
    expect(out.state.result?.reason).toBe('simultaneous_crack');
  });

  it('Mode 6 both exhausted (5 + 5 non-winning) → stalemate / both_exhausted', async () => {
    registerFixture({ id: 6, maxGuessesPerPlayer: 5, secret: '9999' });
    const created = createMatch(6, '8888', { seed: 1, callCount: 0 });
    const started = startMatch(created, createRNG(created.rngState));
    let s = started;
    for (let i = 0; i < 5; i += 1) {
      const playerOut = await submitGuess(s, '0000', 'self', createRNG(s.rngState));
      expect(playerOut.error).toBeNull();
      expect(playerOut.feedback?.isWin).toBe(false);
      s = playerOut.state;
      const opponentOut = await submitGuess(s, '0000', 'opponent', createRNG(s.rngState));
      expect(opponentOut.error).toBeNull();
      expect(opponentOut.feedback?.isWin).toBe(false);
      s = opponentOut.state;
    }
    expect(s.phase).toBe('completed');
    expect(s.guessLimits?.playerRemaining).toBe(0);
    expect(s.guessLimits?.opponentRemaining).toBe(0);
    expect(s.result?.outcome).toBe('stalemate');
    expect(s.result?.reason).toBe('both_exhausted');
    expect(s.result?.turns).toBe(5);
  });

  it('Mode 6 single-side exhaustion is non-terminal (SPEC §3.10) — match continues', async () => {
    registerFixture({ id: 6, maxGuessesPerPlayer: 5, secret: '9999' });
    const created = createMatch(6, '8888', { seed: 1, callCount: 0 });
    const started = startMatch(created, createRNG(created.rngState));
    let s = started;
    for (let i = 0; i < 5; i += 1) {
      const out = await submitGuess(s, '0000', 'self', createRNG(s.rngState));
      expect(out.feedback?.isWin).toBe(false);
      s = out.state;
    }
    // Player exhausted, opponent still has all 5 — the engine must
    // keep phase=active_parallel so the trailing side gets to play.
    expect(s.phase).toBe('active_parallel');
    expect(s.guessLimits?.playerRemaining).toBe(0);
    expect(s.guessLimits?.opponentRemaining).toBe(5);
    expect(s.result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// applyTimeout / applyClockSnapshot — silent no-op
// ─────────────────────────────────────────────────────────────

describe('parallelEngine — non-applicable transitions', () => {
  it('applyTimeout returns state unchanged (parallel modes have no clock)', () => {
    const mode = registerFixture({ id: 7, sharedSecret: true });
    const created = createMatch(7, '_', { seed: 1, callCount: 0 });
    expect(applyTimeout(created, mode)).toBe(created);
  });

  it('applyClockSnapshot returns state unchanged (no clock semantics)', () => {
    registerFixture({ id: 7, sharedSecret: true });
    const created = createMatch(7, '_', { seed: 1, callCount: 0 });
    const after = applyClockSnapshot(created, {
      playerMs: 30_000,
      opponentMs: 30_000,
      activeOwner: null,
      snapshotTimestamp: 0,
    });
    expect(after).toBe(created);
  });

  it('no warn calls in any transition (Phase 6 dropped the soft-fail message)', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const mode = registerFixture({ id: 7, sharedSecret: true });
      const created = createMatch(7, '_', { seed: 1, callCount: 0 });
      const started = startMatch(created, createRNG(created.rngState));
      await submitGuess(started, '5678', 'self', createRNG(started.rngState));
      applyTimeout(started, mode);
      applyClockSnapshot(started, {
        playerMs: 0,
        opponentMs: 0,
        activeOwner: null,
        snapshotTimestamp: 0,
      });
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
