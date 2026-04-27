/**
 * Mode 2 — full-stack integration. Same shape as `mode1Integration.test.ts`.
 * Wires the *real* `mode2HighLow` through `useMatchStore` and asserts
 * the lifecycle: createMatch → startMatch → submitGuess loop → win.
 * Resume identity is exercised by JSON-roundtripping the durable state.
 */

import { __resetRegistryForTests, modeRegistry } from '../../modeRegistry';
import { useMatchStore } from '../../../state/matchStore';
import { mode2HighLow } from '../mode2HighLow';

function pinPhase(phase: 'active_turn_player' | 'active_turn_opponent'): void {
  useMatchStore.setState((s) => ({
    matchState: s.matchState ? { ...s.matchState, phase } : null,
  }));
}

describe('Mode 2 — integration through useMatchStore', () => {
  beforeEach(() => {
    __resetRegistryForTests();
    modeRegistry.register(mode2HighLow);
    useMatchStore.setState({ matchState: null });
  });

  describe('full match lifecycle (createMatch → startMatch → submitGuess → win)', () => {
    it('a player guess matching the opponent secret completes the match with player_won', async () => {
      const created = useMatchStore.getState().createMatch(2, '4321');
      expect(created).toBe(true);

      const initial = useMatchStore.getState().matchState!;
      expect(initial.modeId).toBe(2);
      expect(initial.phase).toBe('setup');
      expect(initial.opponentSecret).toMatch(/^\d{4}$/);

      useMatchStore.getState().startMatch();
      const started = useMatchStore.getState().matchState!;
      expect(['active_turn_player', 'active_turn_opponent']).toContain(started.phase);
      expect(started.solverStates?.opponent?.kind).toBe('directionRange');

      pinPhase('active_turn_player');

      const winningGuess = started.opponentSecret;
      const out = await useMatchStore.getState().submitGuess(winningGuess, 'self');
      expect(out.error).toBeNull();
      expect(out.feedback?.kind).toBe('direction');
      expect(out.feedback?.isWin).toBe(true);

      const final = useMatchStore.getState().matchState!;
      expect(final.phase).toBe('completed');
      expect(final.result?.outcome).toBe('player_won');
      expect(final.result?.reason).toBe('cracked');
      expect(final.playerGuesses).toHaveLength(1);
      expect(final.opponentGuesses).toHaveLength(0);
    });

    it('a multi-turn loop with a real bot turn keeps the match active until a winning guess', async () => {
      useMatchStore.getState().createMatch(2, '4321');
      useMatchStore.getState().startMatch();
      const started = useMatchStore.getState().matchState!;
      const targetSecret = started.opponentSecret;

      // Turn 1 — pick a decoy that is guaranteed not to equal the secret.
      const decoy = targetSecret === '0000' ? '9999' : '0000';
      pinPhase('active_turn_player');
      const decoyOut = await useMatchStore.getState().submitGuess(decoy, 'self');
      expect(decoyOut.error).toBeNull();
      expect(decoyOut.feedback?.kind).toBe('direction');
      expect(decoyOut.feedback?.isWin).toBe(false);

      const afterDecoy = useMatchStore.getState().matchState!;
      expect(afterDecoy.phase).toBe('active_turn_opponent');
      expect(afterDecoy.result).toBeNull();

      // Turn 2 — real bot turn against a directionRange solver. The
      // bot's first guess against the player secret could be anywhere
      // in [0, 9999] and only matches '4321' on a 1-in-10000 fluke.
      const botOut = await useMatchStore.getState().runOpponentTurn();
      expect(botOut.error).toBeNull();
      expect(botOut.feedback?.kind).toBe('direction');
      const afterBot = useMatchStore.getState().matchState!;
      if (afterBot.phase === 'completed') {
        expect(afterBot.result?.outcome).toBe('opponent_won');
        return;
      }
      expect(afterBot.phase).toBe('active_turn_player');
      expect(afterBot.opponentGuesses).toHaveLength(1);
      expect(afterBot.solverStates?.opponent?.kind).toBe('directionRange');

      // Turn 3 — winning player guess closes the match.
      const winOut = await useMatchStore.getState().submitGuess(targetSecret, 'self');
      expect(winOut.error).toBeNull();
      expect(winOut.feedback?.isWin).toBe(true);
      const final = useMatchStore.getState().matchState!;
      expect(final.phase).toBe('completed');
      expect(final.result?.outcome).toBe('player_won');
    });
  });

  describe('JSON round-trip mid-match → resume identity', () => {
    it('opponent turn produces an identical guess + RNG cursor when run from a serialized snapshot', async () => {
      useMatchStore.getState().createMatch(2, '4321');
      useMatchStore.getState().startMatch();

      useMatchStore.setState((s) => ({
        matchState: s.matchState
          ? {
              ...s.matchState,
              phase: 'active_turn_opponent',
              rngState: { seed: 1337, callCount: 0 },
            }
          : null,
      }));
      const live = useMatchStore.getState().matchState!;

      await useMatchStore.getState().runOpponentTurn();
      const liveAfter = useMatchStore.getState().matchState!;

      const restored = JSON.parse(JSON.stringify(live)) as typeof live;
      useMatchStore.setState({ matchState: restored });
      await useMatchStore.getState().runOpponentTurn();
      const restoredAfter = useMatchStore.getState().matchState!;

      expect(restoredAfter.opponentGuesses).toEqual(liveAfter.opponentGuesses);
      expect(restoredAfter.rngState).toEqual(liveAfter.rngState);
      const liveSolver = liveAfter.solverStates?.opponent;
      const restoredSolver = restoredAfter.solverStates?.opponent;
      expect(restoredSolver?.kind).toBe(liveSolver?.kind);
      if (
        liveSolver?.kind === 'directionRange' &&
        restoredSolver?.kind === 'directionRange'
      ) {
        expect(restoredSolver.low).toBe(liveSolver.low);
        expect(restoredSolver.high).toBe(liveSolver.high);
      }
    });
  });
});
