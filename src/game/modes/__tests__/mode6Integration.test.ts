/**
 * Mode 6 — full-stack integration. The engine layer
 * (turnBasedEngine + checkEndConditions) already shipped the
 * `maxGuessesPerPlayer` plumbing in Phase 2; this suite verifies the
 * Mode 6 mode file actually wires that plumbing through end-to-end:
 *   - guessLimits seeded at createMatch
 *   - decremented on each submitGuess
 *   - both-exhausted → 'stalemate' / 'both_exhausted'
 *   - one-exhausted → loss for the exhausted side
 *   - normal crack still wins
 */

import { __resetRegistryForTests, modeRegistry } from '../../modeRegistry';
import { useMatchStore } from '../../../state/matchStore';
import { mode6SuddenDeath } from '../mode6SuddenDeath';

function pinPhase(phase: 'active_turn_player' | 'active_turn_opponent'): void {
  useMatchStore.setState((s) => ({
    matchState: s.matchState ? { ...s.matchState, phase } : null,
  }));
}

describe('Mode 6 — integration through useMatchStore', () => {
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

    it('player submitGuess decrements playerRemaining only', async () => {
      useMatchStore.getState().createMatch(6, '4321');
      useMatchStore.getState().startMatch();
      pinPhase('active_turn_player');

      await useMatchStore.getState().submitGuess('1234', 'self');
      const state = useMatchStore.getState().matchState!;
      // 4321 vs 1234 has zero greens, so the match is still alive.
      expect(state.guessLimits?.playerRemaining).toBe(4);
      expect(state.guessLimits?.opponentRemaining).toBe(5);
    });
  });

  describe('terminal outcomes', () => {
    it('player cracks the secret → player_won', async () => {
      useMatchStore.getState().createMatch(6, '4321');
      useMatchStore.getState().startMatch();
      const started = useMatchStore.getState().matchState!;
      pinPhase('active_turn_player');

      const out = await useMatchStore.getState().submitGuess(started.opponentSecret, 'self');
      expect(out.error).toBeNull();
      expect(out.feedback?.isWin).toBe(true);

      const final = useMatchStore.getState().matchState!;
      expect(final.phase).toBe('completed');
      expect(final.result?.outcome).toBe('player_won');
      expect(final.result?.reason).toBe('cracked');
    });

    it('both sides exhaust 5 guesses with no crack → stalemate / both_exhausted', async () => {
      useMatchStore.getState().createMatch(6, '4321');
      useMatchStore.getState().startMatch();
      const started = useMatchStore.getState().matchState!;
      // Pick a non-secret losing guess once; we'll use it for every turn.
      const loser = started.opponentSecret === '0000' ? '9999' : '0000';

      // Alternate sides for 10 guesses so neither cracks.
      for (let round = 0; round < 5; round += 1) {
        pinPhase('active_turn_player');
        const playerOut = await useMatchStore.getState().submitGuess(loser, 'self');
        // Defensive: the 1-in-10000 fluke would crack early. Bail loud.
        if (playerOut.feedback?.isWin === true) {
          throw new Error('test fixture cracked early — pick a different loser');
        }
        const afterPlayer = useMatchStore.getState().matchState!;
        if (afterPlayer.phase === 'completed') break;

        pinPhase('active_turn_opponent');
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

    it('player drains 5 guesses with no crack — match continues so opponent gets their final round (SPEC §3.10)', async () => {
      // Single-side exhaustion is not terminal in Mode 6; the match
      // stays alive until both sides hit zero (stalemate) or someone
      // cracks. After a 5-player-guess drain we expect phase to have
      // rotated to opponent's turn, opponentRemaining still 5, and
      // result still null.
      useMatchStore.getState().createMatch(6, '4321');
      useMatchStore.getState().startMatch();
      const started = useMatchStore.getState().matchState!;
      const loser = started.opponentSecret === '0000' ? '9999' : '0000';

      for (let i = 0; i < 5; i += 1) {
        pinPhase('active_turn_player');
        const out = await useMatchStore.getState().submitGuess(loser, 'self');
        if (out.feedback?.isWin === true) {
          throw new Error('test fixture cracked early — pick a different loser');
        }
      }

      const final = useMatchStore.getState().matchState!;
      expect(final.phase).toBe('active_turn_opponent');
      expect(final.guessLimits?.playerRemaining).toBe(0);
      expect(final.guessLimits?.opponentRemaining).toBe(5);
      expect(final.result).toBeNull();
    });
  });
});
