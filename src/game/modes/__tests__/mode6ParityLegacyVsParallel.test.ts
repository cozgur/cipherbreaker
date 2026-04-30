/**
 * Phase 6 CP3 — parity gate. Asserts that Mode 6 produces the SAME
 * terminal `MatchResult` (outcome + reason + turns) when its
 * `submitGuess` history is replayed against `turnBasedEngine` vs
 * `parallelEngine`. Lives outside `selectEngine` on purpose: the two
 * engines are imported directly so the comparison is engine-vs-engine,
 * not "engine selected by current catalog flag".
 *
 * Parity check uses ALTERNATING `self/opponent/self/opponent`
 * fixtures because the turn-based engine enforces alternation via
 * `advanceTurn`; the parallel engine accepts any order but, fed the
 * same alternating fixture, must produce the same outcome. This is
 * the smallest fixture shape that exercises both engines without
 * having to parameterise turn rotation.
 *
 * Why this test exists *before* the catalog flag flip: the flip
 * (`parallelRace: true` on Mode 6) changes which engine
 * `selectEngine` picks at runtime. If the two engines disagreed on
 * any of the four scenarios below, the flip would silently change
 * Mode 6 outcomes. Parity green here is the precondition for the
 * flip — see CP3 plan in chat.
 *
 * NOT a parity test:
 *   - RNG cursor identity. `parallelEngine.startMatch` deliberately
 *     skips the "who starts" RNG draw; the two engines are NOT
 *     comparable by `rngState.callCount`. CP1's parallelEngine test
 *     header documents this divergence.
 *   - Bot-driven runs. Both engines route through the same
 *     `mode.bot.makeGuess`, but the turn-rotation difference would
 *     re-order RNG consumption between the bot and the engine.
 *     Fixture-driven comparison sidesteps it.
 */

import { createRNG } from '@/lib/random';

import { __resetRegistryForTests, modeRegistry } from '../../modeRegistry';
import * as parallelEngine from '../../engines/parallelEngine';
import * as turnBasedEngine from '../../engines/turnBasedEngine';
import type { MatchResult, MatchState } from '../../types';
import { mode6SuddenDeath } from '../mode6SuddenDeath';

type Engine = typeof turnBasedEngine;

interface Step {
  readonly author: 'self' | 'opponent';
  readonly guess: string;
}

/**
 * Drive the engine through `setup → started → submit×N` and return
 * the terminal `MatchResult`. The fixture supplies the explicit
 * `playerSecret` + `opponentSecret` because both engines normally
 * generate the opponent secret from the RNG — we want a deterministic
 * shared secret across the engine pair so a winning guess is
 * meaningful.
 */
async function runScenario(
  engine: Engine,
  opts: {
    readonly playerSecret: string;
    readonly opponentSecret: string;
    readonly steps: readonly Step[];
  },
): Promise<MatchResult | null> {
  const created = engine.createMatch(6, opts.playerSecret, { seed: 1, callCount: 0 });
  // Force a fixed `opponentSecret` so the parity comparison is
  // independent of `mode.generateSecret`'s RNG draw schedule.
  const seeded: MatchState = { ...created, opponentSecret: opts.opponentSecret };
  let state = engine.startMatch(seeded, createRNG(seeded.rngState));
  for (const step of opts.steps) {
    if (state.phase === 'completed') break;
    const out = await engine.submitGuess(state, step.guess, step.author, createRNG(state.rngState));
    if (out.error !== null) {
      throw new Error(`fixture step rejected by ${describeEngine(engine)}: ${out.error.code}`);
    }
    state = out.state;
  }
  return state.result;
}

function describeEngine(engine: Engine): string {
  return engine === (parallelEngine as unknown as Engine) ? 'parallelEngine' : 'turnBasedEngine';
}

/**
 * The fixture engine pair. We import both engines directly here
 * (instead of routing through `selectEngine`) so the parity test
 * isn't sensitive to the catalog flag the rest of the suite reads.
 */
const ENGINES: ReadonlyArray<{ readonly name: string; readonly engine: Engine }> = [
  { name: 'turnBasedEngine', engine: turnBasedEngine },
  { name: 'parallelEngine', engine: parallelEngine as unknown as Engine },
];

beforeEach(() => {
  __resetRegistryForTests();
  modeRegistry.register(mode6SuddenDeath);
});

describe('Mode 6 — engine parity (turnBased vs parallel)', () => {
  it('Scenario A — player cracks early → player_won/cracked, identical turns', async () => {
    const opts = {
      playerSecret: '4321',
      opponentSecret: '5678',
      steps: [
        // Player cracks on their second guess; alternating fixture
        // keeps turn-based happy.
        { author: 'self', guess: '0000' },
        { author: 'opponent', guess: '1111' },
        { author: 'self', guess: '5678' },
      ] as const,
    };
    const [a, b] = await Promise.all(ENGINES.map(({ engine }) => runScenario(engine, opts)));
    expect(a).toEqual({ outcome: 'player_won', reason: 'cracked', turns: 2 });
    expect(b).toEqual(a);
  });

  it('Scenario B — opponent cracks first → opponent_won/cracked, identical turns', async () => {
    const opts = {
      playerSecret: '4321',
      opponentSecret: '5678',
      steps: [
        { author: 'self', guess: '0000' },
        { author: 'opponent', guess: '4321' },
      ] as const,
    };
    const [a, b] = await Promise.all(ENGINES.map(({ engine }) => runScenario(engine, opts)));
    expect(a).toEqual({ outcome: 'opponent_won', reason: 'cracked', turns: 1 });
    expect(b).toEqual(a);
  });

  it('Scenario C — both exhaust 5 guesses with no crack → stalemate/both_exhausted, turns=5', async () => {
    const opts = {
      playerSecret: '4321',
      opponentSecret: '5678',
      // 10 alternating losing guesses (5 per side). Neither '0000'
      // nor '1111' can crack '5678' or '4321', so the only terminal
      // state is `both_exhausted`.
      steps: [
        { author: 'self', guess: '0000' },
        { author: 'opponent', guess: '1111' },
        { author: 'self', guess: '0000' },
        { author: 'opponent', guess: '1111' },
        { author: 'self', guess: '0000' },
        { author: 'opponent', guess: '1111' },
        { author: 'self', guess: '0000' },
        { author: 'opponent', guess: '1111' },
        { author: 'self', guess: '0000' },
        { author: 'opponent', guess: '1111' },
      ] as const,
    };
    const [a, b] = await Promise.all(ENGINES.map(({ engine }) => runScenario(engine, opts)));
    expect(a).toEqual({ outcome: 'stalemate', reason: 'both_exhausted', turns: 5 });
    expect(b).toEqual(a);
  });

  it('Scenario D — player cracks on their 5th (final) guess → player_won/cracked, turns=5', async () => {
    const opts = {
      playerSecret: '4321',
      opponentSecret: '5678',
      // 9 losing guesses + winning player guess on the very last
      // attempt. Tests the boundary where `guessLimits.playerRemaining`
      // hits zero in the SAME submission that produces `isWin=true`.
      // Per `checkEndConditions` decision order, crack beats budget
      // exhaustion → player_won.
      steps: [
        { author: 'self', guess: '0000' },
        { author: 'opponent', guess: '1111' },
        { author: 'self', guess: '0000' },
        { author: 'opponent', guess: '1111' },
        { author: 'self', guess: '0000' },
        { author: 'opponent', guess: '1111' },
        { author: 'self', guess: '0000' },
        { author: 'opponent', guess: '1111' },
        { author: 'self', guess: '5678' }, // crack on final guess
      ] as const,
    };
    const [a, b] = await Promise.all(ENGINES.map(({ engine }) => runScenario(engine, opts)));
    expect(a).toEqual({ outcome: 'player_won', reason: 'cracked', turns: 5 });
    expect(b).toEqual(a);
  });
});

describe('Mode 6 — engine parity invariants on terminal state shape', () => {
  it('terminal `phase` is "completed" in both engines (no engine ends in active_*)', async () => {
    const opts = {
      playerSecret: '4321',
      opponentSecret: '5678',
      steps: [{ author: 'self', guess: '5678' }] as const,
    };
    for (const { engine } of ENGINES) {
      const created = engine.createMatch(6, opts.playerSecret, { seed: 1, callCount: 0 });
      const seeded: MatchState = { ...created, opponentSecret: opts.opponentSecret };
      let state = engine.startMatch(seeded, createRNG(seeded.rngState));
      for (const step of opts.steps) {
        const out = await engine.submitGuess(state, step.guess, step.author, createRNG(state.rngState));
        state = out.state;
      }
      expect(state.phase).toBe('completed');
    }
  });

  it('guessLimits decrements identically across engines after one player guess', async () => {
    const opts = {
      playerSecret: '4321',
      opponentSecret: '5678',
      steps: [{ author: 'self', guess: '0000' }] as const,
    };
    const limits = await Promise.all(
      ENGINES.map(async ({ engine }) => {
        const created = engine.createMatch(6, opts.playerSecret, { seed: 1, callCount: 0 });
        const seeded: MatchState = { ...created, opponentSecret: opts.opponentSecret };
        let state = engine.startMatch(seeded, createRNG(seeded.rngState));
        for (const step of opts.steps) {
          const out = await engine.submitGuess(
            state,
            step.guess,
            step.author,
            createRNG(state.rngState),
          );
          state = out.state;
        }
        return state.guessLimits;
      }),
    );
    expect(limits[0]).toEqual({ playerRemaining: 4, opponentRemaining: 5 });
    expect(limits[1]).toEqual(limits[0]);
  });
});
