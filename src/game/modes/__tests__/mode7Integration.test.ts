/**
 * Mode 7 — full-stack integration. Phase 6's `parallelEngine` already
 * shipped the parallel state machine + sharedSecret routing in CP1;
 * this suite verifies the Mode 7 façade actually wires the catalog +
 * Mode 1 evaluator/bot through end-to-end:
 *   - createMatch overwrites the caller secret with the engine-
 *     generated one (sharedSecret invariant)
 *   - both sides resolve to the same `targetSecret`
 *   - first-to-crack wins (no draws under serial submission)
 *   - no `guessLimits` (unlimited budget — `flags.suddenDeath` absent)
 *   - JSON round-trip preserves resume identity
 */

import { __resetRegistryForTests, modeRegistry } from '../../modeRegistry';
import type { MatchState } from '../../types';
import { useMatchStore } from '../../../state/matchStore';
import { mode7Mirror } from '../mode7Mirror';

describe('Mode 7 — integration through useMatchStore (parallelEngine + sharedSecret)', () => {
  beforeEach(() => {
    __resetRegistryForTests();
    modeRegistry.register(mode7Mirror);
    useMatchStore.setState({ matchState: null });
  });

  describe('createMatch — sharedSecret invariant', () => {
    it('routes through parallelEngine: phase=setup, no guessLimits (unlimited budget)', () => {
      useMatchStore.getState().createMatch(7, 'IGNORED_BY_MIRROR');
      const state = useMatchStore.getState().matchState!;
      expect(state.modeId).toBe(7);
      expect(state.phase).toBe('setup');
      expect(state.guessLimits).toBeUndefined();
    });

    it('overwrites the caller-provided playerSecret with the engine-generated value', () => {
      useMatchStore.getState().createMatch(7, '1234');
      const state = useMatchStore.getState().matchState!;
      // Mode 7's `sharedSecret` flag forces parallelEngine.createMatch
      // to mirror the generated secret onto playerSecret. The caller
      // string ('1234') must NOT survive, even if it happens to be a
      // valid 4-digit guess.
      expect(state.playerSecret).toBe(state.opponentSecret);
      expect(state.playerSecret).toMatch(/^\d{4}$/);
    });

    it('startMatch advances setup → active_parallel and seeds the opponent solver', () => {
      useMatchStore.getState().createMatch(7, '_');
      useMatchStore.getState().startMatch();
      const state = useMatchStore.getState().matchState!;
      expect(state.phase).toBe('active_parallel');
      expect(state.solverStates?.opponent).toBeDefined();
      const solver = state.solverStates!.opponent!;
      expect(solver.kind).toBe('candidatePool');
      if (solver.kind !== 'candidatePool') return;
      // Mode 1 / Mode 7 candidate pool — duplicates allowed, first digit ≥ 1 → 9 000.
      expect(solver.pool.length).toBe(9_000);
    });
  });

  describe('submitGuess — sharedSecret targetSecret resolution', () => {
    it('player submitting the shared secret cracks it (self → opponentSecret = shared)', async () => {
      useMatchStore.getState().createMatch(7, '_');
      useMatchStore.getState().startMatch();
      const started = useMatchStore.getState().matchState!;
      const out = await useMatchStore.getState().submitGuess(started.opponentSecret, 'self');
      expect(out.error).toBeNull();
      expect(out.feedback?.kind).toBe('colorMatch');
      expect(out.feedback?.isWin).toBe(true);

      const final = useMatchStore.getState().matchState!;
      expect(final.phase).toBe('completed');
      expect(final.result?.outcome).toBe('player_won');
      expect(final.result?.reason).toBe('cracked');
    });

    it('opponent submitting the shared secret also cracks (opponent → playerSecret = shared)', async () => {
      useMatchStore.getState().createMatch(7, '_');
      useMatchStore.getState().startMatch();
      const started = useMatchStore.getState().matchState!;
      // Mode 7 invariant: playerSecret === opponentSecret. Opponent's
      // `targetSecret` resolves to playerSecret, which equals the
      // shared string, so submitting it cracks.
      const out = await useMatchStore.getState().submitGuess(started.playerSecret, 'opponent');
      expect(out.feedback?.isWin).toBe(true);

      const final = useMatchStore.getState().matchState!;
      expect(final.phase).toBe('completed');
      expect(final.result?.outcome).toBe('opponent_won');
      expect(final.result?.reason).toBe('cracked');
    });

    it('non-winning guess keeps phase=active_parallel — both sides remain free to submit', async () => {
      useMatchStore.getState().createMatch(7, '_');
      useMatchStore.getState().startMatch();
      const started = useMatchStore.getState().matchState!;
      // Pick a guess that is provably NOT the secret. The 1-in-9000
      // collision is guarded against by trying a fallback.
      const losingGuess = started.opponentSecret === '0000' ? '9999' : '0000';
      const out = await useMatchStore.getState().submitGuess(losingGuess, 'self');
      if (out.feedback?.isWin === true) {
        throw new Error('test fixture cracked early — pick a different loser');
      }
      const final = useMatchStore.getState().matchState!;
      expect(final.phase).toBe('active_parallel');
      expect(final.result).toBeNull();
      expect(final.playerGuesses).toHaveLength(1);
      expect(final.opponentGuesses).toHaveLength(0);
    });
  });

  describe('first-to-crack wins (serial submission)', () => {
    it('opponent cracks before player → opponent_won, subsequent player submit throws (phase=completed)', async () => {
      useMatchStore.getState().createMatch(7, '_');
      useMatchStore.getState().startMatch();
      const started = useMatchStore.getState().matchState!;
      const oppOut = await useMatchStore.getState().submitGuess(started.opponentSecret, 'opponent');
      expect(oppOut.feedback?.isWin).toBe(true);
      const afterOpp = useMatchStore.getState().matchState!;
      expect(afterOpp.phase).toBe('completed');
      expect(afterOpp.result?.outcome).toBe('opponent_won');

      // matchStore + parallelEngine serialize at the function boundary;
      // a follow-up player submit hits the `'completed'` throw.
      await expect(
        useMatchStore.getState().submitGuess(afterOpp.opponentSecret, 'self'),
      ).rejects.toThrow();
    });

    it('player cracks before opponent → player_won (no draws under serial submission)', async () => {
      useMatchStore.getState().createMatch(7, '_');
      useMatchStore.getState().startMatch();
      const started = useMatchStore.getState().matchState!;
      const playerOut = await useMatchStore.getState().submitGuess(started.opponentSecret, 'self');
      expect(playerOut.feedback?.isWin).toBe(true);
      const final = useMatchStore.getState().matchState!;
      expect(final.phase).toBe('completed');
      expect(final.result?.outcome).toBe('player_won');
      expect(final.result?.reason).toBe('cracked');
    });
  });

  describe('Mode 7 unlimited budget — no guessLimits plumbing', () => {
    it('many non-winning guesses leave phase=active_parallel and never seed guessLimits', async () => {
      useMatchStore.getState().createMatch(7, '_');
      useMatchStore.getState().startMatch();
      const started = useMatchStore.getState().matchState!;
      const losingGuess = started.opponentSecret === '0000' ? '9999' : '0000';
      // 10 player guesses — well past Mode 6's 5-guess cap. Mirror has
      // no budget so phase stays active and `guessLimits` stays absent.
      for (let i = 0; i < 10; i += 1) {
        const out = await useMatchStore.getState().submitGuess(losingGuess, 'self');
        if (out.feedback?.isWin === true) {
          throw new Error('test fixture cracked early — pick a different loser');
        }
      }
      const final = useMatchStore.getState().matchState!;
      expect(final.phase).toBe('active_parallel');
      expect(final.guessLimits).toBeUndefined();
      expect(final.playerGuesses).toHaveLength(10);
    });
  });

  describe('JSON round-trip — resume identity', () => {
    it('serialise + parse a mid-match MatchState produces a deep-equal snapshot', async () => {
      useMatchStore.getState().createMatch(7, '_');
      useMatchStore.getState().startMatch();
      const started = useMatchStore.getState().matchState!;
      const losingGuess = started.opponentSecret === '0000' ? '9999' : '0000';
      const out = await useMatchStore.getState().submitGuess(losingGuess, 'self');
      if (out.feedback?.isWin === true) {
        throw new Error('test fixture cracked early — pick a different loser');
      }
      const live = useMatchStore.getState().matchState!;
      const roundTripped = JSON.parse(JSON.stringify(live)) as MatchState;
      expect(roundTripped).toEqual(live);
      // Sanity: the load-bearing Mode 7 invariants survive serialisation.
      expect(roundTripped.playerSecret).toBe(roundTripped.opponentSecret);
      expect(roundTripped.phase).toBe('active_parallel');
      expect(roundTripped.guessLimits).toBeUndefined();
    });
  });
});
