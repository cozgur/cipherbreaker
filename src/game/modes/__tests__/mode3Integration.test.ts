/**
 * Mode 3 — full-stack integration. Same shape as
 * `mode1Integration.test.ts`. Wires the *real* `mode3Precision`
 * through `useMatchStore` and asserts the lifecycle on a unique-digit
 * secret + chunked-filter bot.
 */

import { __resetRegistryForTests, modeRegistry } from '../../modeRegistry';
import type { GuessEntry } from '../../types';
import { useMatchStore } from '../../../state/matchStore';
import { mode3Precision } from '../mode3Precision';

function pinPhase(phase: 'active_turn_player' | 'active_turn_opponent'): void {
  useMatchStore.setState((s) => ({
    matchState: s.matchState ? { ...s.matchState, phase } : null,
  }));
}

// Wall-clock `createdAt` is stamped per-call by `Date.now()`, so it
// diverges between the live run and the rehydrate-then-replay run.
// Resume identity is about the bot's decision, not the wall clock.
function stripTimestamp({ createdAt: _createdAt, ...rest }: GuessEntry): Omit<GuessEntry, 'createdAt'> {
  return rest;
}

describe('Mode 3 — integration through useMatchStore', () => {
  beforeEach(() => {
    __resetRegistryForTests();
    modeRegistry.register(mode3Precision);
    useMatchStore.setState({ matchState: null });
  });

  describe('full match lifecycle (createMatch → startMatch → submitGuess → win)', () => {
    it('a player guess matching the opponent secret completes the match with player_won', async () => {
      const created = useMatchStore.getState().createMatch(3, '4321');
      expect(created).toBe(true);

      const initial = useMatchStore.getState().matchState!;
      expect(initial.modeId).toBe(3);
      expect(initial.phase).toBe('setup');
      // Mode 3 secrets must have unique digits.
      expect(initial.opponentSecret).toMatch(/^\d{4}$/);
      expect(new Set(initial.opponentSecret.split('')).size).toBe(4);

      useMatchStore.getState().startMatch();
      const started = useMatchStore.getState().matchState!;
      expect(['active_turn_player', 'active_turn_opponent']).toContain(started.phase);
      expect(started.solverStates?.opponent?.kind).toBe('candidatePool');

      pinPhase('active_turn_player');

      const winningGuess = started.opponentSecret;
      const out = await useMatchStore.getState().submitGuess(winningGuess, 'self');
      expect(out.error).toBeNull();
      expect(out.feedback?.kind).toBe('precision');
      expect(out.feedback?.isWin).toBe(true);

      const final = useMatchStore.getState().matchState!;
      expect(final.phase).toBe('completed');
      expect(final.result?.outcome).toBe('player_won');
      expect(final.result?.reason).toBe('cracked');
      expect(final.playerGuesses).toHaveLength(1);
    });

    it('rejects a duplicate-digit guess with NOT_UNIQUE; durable state untouched', async () => {
      useMatchStore.getState().createMatch(3, '4321');
      useMatchStore.getState().startMatch();
      pinPhase('active_turn_player');

      const before = useMatchStore.getState().matchState!;
      const out = await useMatchStore.getState().submitGuess('1122', 'self');
      const after = useMatchStore.getState().matchState!;

      expect(out.error?.code).toBe('NOT_UNIQUE');
      expect(out.feedback).toBeNull();
      expect(after.phase).toBe('active_turn_player');
      expect(after.playerGuesses).toEqual(before.playerGuesses);
      expect(after.rngState).toEqual(before.rngState);
    });

    it('a multi-turn loop with a real bot turn keeps the match active until a winning guess', async () => {
      useMatchStore.getState().createMatch(3, '4321');
      useMatchStore.getState().startMatch();
      const started = useMatchStore.getState().matchState!;
      const targetSecret = started.opponentSecret;

      // Pick a decoy with unique digits that isn't the secret.
      const candidates = ['0123', '5678', '9876'];
      const decoy = candidates.find((c) => c !== targetSecret) ?? '0123';
      pinPhase('active_turn_player');
      const decoyOut = await useMatchStore.getState().submitGuess(decoy, 'self');
      expect(decoyOut.error).toBeNull();
      expect(decoyOut.feedback?.kind).toBe('precision');
      expect(decoyOut.feedback?.isWin).toBe(false);

      const afterDecoy = useMatchStore.getState().matchState!;
      expect(afterDecoy.phase).toBe('active_turn_opponent');

      // Bot turn against the unique-digit pool. Could fluke into a win
      // on a 1-in-5040 chance; guard the assertion.
      const botOut = await useMatchStore.getState().runOpponentTurn();
      expect(botOut.error).toBeNull();
      expect(botOut.feedback?.kind).toBe('precision');
      const afterBot = useMatchStore.getState().matchState!;
      if (afterBot.phase === 'completed') {
        expect(afterBot.result?.outcome).toBe('opponent_won');
        return;
      }
      expect(afterBot.phase).toBe('active_turn_player');
      expect(afterBot.opponentGuesses).toHaveLength(1);
      expect(afterBot.solverStates?.opponent?.kind).toBe('candidatePool');

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
      useMatchStore.getState().createMatch(3, '4321');
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

      expect(restoredAfter.opponentGuesses.map(stripTimestamp)).toEqual(
        liveAfter.opponentGuesses.map(stripTimestamp),
      );
      expect(restoredAfter.rngState).toEqual(liveAfter.rngState);
      const liveSolver = liveAfter.solverStates?.opponent;
      const restoredSolver = restoredAfter.solverStates?.opponent;
      expect(restoredSolver?.kind).toBe(liveSolver?.kind);
      if (
        liveSolver?.kind === 'candidatePool' &&
        restoredSolver?.kind === 'candidatePool'
      ) {
        expect(restoredSolver.pool.length).toBe(liveSolver.pool.length);
      }
    });
  });
});
