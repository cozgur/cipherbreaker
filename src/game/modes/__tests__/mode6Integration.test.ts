/**
 * Mode 6 — full-stack integration. After CP3's catalog flag flip,
 * Mode 6 rides `parallelEngine` (no turn rotation), so the
 * `pinPhase` helper now pins to `'active_parallel'` and the suite
 * no longer enforces a player-vs-opponent alternation between
 * submissions. What it still asserts:
 *   - guessLimits seeded at createMatch (5 / 5)
 *   - decremented per submission against the submitting side only
 *   - both-exhausted → 'stalemate' / 'both_exhausted' / turns=5
 *   - one-side exhaustion is non-terminal (SPEC §3.10) — phase stays
 *     `'active_parallel'` so the trailing side keeps submitting
 *   - normal crack still wins
 *
 * Why no alternation enforcement: parallelEngine's `submitGuess`
 * doesn't call `advanceTurn` — both sides can submit in any order.
 * The CP3 parity test (`mode6ParityLegacyVsParallel.test.ts`) pins
 * the cross-engine outcome equivalence using alternating fixtures.
 */

import { __resetRegistryForTests, modeRegistry } from '../../modeRegistry';
import { useMatchStore } from '../../../state/matchStore';
import { mode6SuddenDeath } from '../mode6SuddenDeath';

function pinParallel(): void {
  useMatchStore.setState((s) => ({
    matchState: s.matchState ? { ...s.matchState, phase: 'active_parallel' } : null,
  }));
}

describe('Mode 6 — integration through useMatchStore (post-flip: parallelEngine)', () => {
  beforeEach(() => {
    __resetRegistryForTests();
    modeRegistry.register(mode6SuddenDeath);
    useMatchStore.setState({ matchState: null });
  });

  describe('guess-limit lifecycle', () => {
    it('createMatch seeds guessLimits.{playerRemaining,opponentRemaining} = 5', () => {
      useMatchStore.getState().createMatch(6, '4321');
      const state = useMatchStore.getState().matchState!;
      expect(state.guessLimits?.playerRemaining).toBe(5);
      expect(state.guessLimits?.opponentRemaining).toBe(5);
    });

    it('startMatch lands on active_parallel (no turn rotation)', () => {
      useMatchStore.getState().createMatch(6, '4321');
      useMatchStore.getState().startMatch();
      const state = useMatchStore.getState().matchState!;
      expect(state.phase).toBe('active_parallel');
    });

    it('player submitGuess decrements playerRemaining only', async () => {
      useMatchStore.getState().createMatch(6, '4321');
      useMatchStore.getState().startMatch();

      await useMatchStore.getState().submitGuess('1234', 'self');
      const state = useMatchStore.getState().matchState!;
      // 4321 vs 1234 has zero greens, so the match is still alive.
      expect(state.guessLimits?.playerRemaining).toBe(4);
      expect(state.guessLimits?.opponentRemaining).toBe(5);
      // Phase stays parallel — `submitGuess` does not advance.
      expect(state.phase).toBe('active_parallel');
    });

    it('opponent submitGuess decrements opponentRemaining only (no alternation enforced)', async () => {
      useMatchStore.getState().createMatch(6, '4321');
      useMatchStore.getState().startMatch();

      // Opponent submits first — legal in parallelEngine. The Phase 5
      // turn-based suite would have rejected this; CP3 explicitly
      // drops that constraint.
      await useMatchStore.getState().submitGuess('1234', 'opponent');
      const state = useMatchStore.getState().matchState!;
      expect(state.guessLimits?.playerRemaining).toBe(5);
      expect(state.guessLimits?.opponentRemaining).toBe(4);
      expect(state.phase).toBe('active_parallel');
    });
  });

  describe('terminal outcomes', () => {
    it('player cracks the secret → player_won', async () => {
      useMatchStore.getState().createMatch(6, '4321');
      useMatchStore.getState().startMatch();
      const started = useMatchStore.getState().matchState!;

      const out = await useMatchStore.getState().submitGuess(started.opponentSecret, 'self');
      expect(out.error).toBeNull();
      expect(out.feedback?.isWin).toBe(true);

      const final = useMatchStore.getState().matchState!;
      expect(final.phase).toBe('completed');
      expect(final.result?.outcome).toBe('player_won');
      expect(final.result?.reason).toBe('cracked');
    });

    it('opponent cracks the secret → opponent_won', async () => {
      useMatchStore.getState().createMatch(6, '4321');
      useMatchStore.getState().startMatch();

      // Opponent's `targetSecret` resolves to playerSecret ('4321').
      const out = await useMatchStore.getState().submitGuess('4321', 'opponent');
      expect(out.feedback?.isWin).toBe(true);

      const final = useMatchStore.getState().matchState!;
      expect(final.phase).toBe('completed');
      expect(final.result?.outcome).toBe('opponent_won');
      expect(final.result?.reason).toBe('cracked');
    });

    it('both sides exhaust 5 guesses with no crack → stalemate / both_exhausted', async () => {
      useMatchStore.getState().createMatch(6, '4321');
      useMatchStore.getState().startMatch();
      const started = useMatchStore.getState().matchState!;
      // Pick a non-secret losing guess once; we'll use it for every turn.
      const loser = started.opponentSecret === '0000' ? '9999' : '0000';

      // Alternate sides for 10 guesses so neither cracks. Alternation
      // here is a fixture choice (mirrors the parity test), not an
      // engine constraint — `parallelEngine` would accept any order.
      for (let round = 0; round < 5; round += 1) {
        pinParallel();
        const playerOut = await useMatchStore.getState().submitGuess(loser, 'self');
        if (playerOut.feedback?.isWin === true) {
          throw new Error('test fixture cracked early — pick a different loser');
        }
        if (useMatchStore.getState().matchState!.phase === 'completed') break;

        pinParallel();
        const oppOut = await useMatchStore.getState().submitGuess(loser, 'opponent');
        if (oppOut.feedback?.isWin === true) {
          throw new Error('test fixture cracked early — pick a different loser');
        }
        if (useMatchStore.getState().matchState!.phase === 'completed') break;
      }

      const final = useMatchStore.getState().matchState!;
      expect(final.phase).toBe('completed');
      expect(final.guessLimits?.playerRemaining).toBe(0);
      expect(final.guessLimits?.opponentRemaining).toBe(0);
      expect(final.result?.outcome).toBe('stalemate');
      expect(final.result?.reason).toBe('both_exhausted');
      expect(final.result?.turns).toBe(5);
    });

    it('player drains 5 guesses with no crack — match continues so opponent gets their full budget (SPEC §3.10)', async () => {
      // Single-side exhaustion is not terminal in Mode 6; the match
      // stays alive until both sides hit zero (stalemate) or someone
      // cracks. After a 5-player-guess drain on parallelEngine we
      // expect phase to stay `'active_parallel'` (no rotation),
      // opponentRemaining still 5, and result still null.
      useMatchStore.getState().createMatch(6, '4321');
      useMatchStore.getState().startMatch();
      const started = useMatchStore.getState().matchState!;
      const loser = started.opponentSecret === '0000' ? '9999' : '0000';

      for (let i = 0; i < 5; i += 1) {
        const out = await useMatchStore.getState().submitGuess(loser, 'self');
        if (out.feedback?.isWin === true) {
          throw new Error('test fixture cracked early — pick a different loser');
        }
      }

      const final = useMatchStore.getState().matchState!;
      expect(final.phase).toBe('active_parallel');
      expect(final.guessLimits?.playerRemaining).toBe(0);
      expect(final.guessLimits?.opponentRemaining).toBe(5);
      expect(final.result).toBeNull();
    });
  });
});
