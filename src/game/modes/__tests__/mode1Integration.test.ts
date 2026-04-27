/**
 * Mode 1 — full-stack integration.
 *
 * Unit tests in this folder exercise individual seams (evaluator,
 * validateGuess, bot, store with stub modes). This file wires the *real*
 * `mode1ColorMatch` through `useMatchStore` and asserts the full
 * lifecycle: createMatch → startMatch → submitGuess loop → win, with
 * the same store an actual MatchScreen mounts against. Resume identity
 * is exercised by round-tripping the durable state through JSON
 * (proxying the AsyncStorage hydrate path).
 *
 * Why integration: the matchStore tests use stubs that always-win or
 * always-lose to pin individual behaviours. They would not have caught
 * the bot ↔ engine RNG threading bug or the candidatePool initSolverState
 * shape mismatch — the real Mode 1 file is what crosses every boundary.
 */

import { __resetRegistryForTests, modeRegistry } from '../../modeRegistry';
import { useMatchStore } from '../../../state/matchStore';
import { mode1ColorMatch } from '../mode1ColorMatch';

function pinPhase(phase: 'active_turn_player' | 'active_turn_opponent'): void {
  useMatchStore.setState((s) => ({
    matchState: s.matchState ? { ...s.matchState, phase } : null,
  }));
}

describe('Mode 1 — integration through useMatchStore', () => {
  beforeEach(() => {
    __resetRegistryForTests();
    modeRegistry.register(mode1ColorMatch);
    useMatchStore.setState({ matchState: null });
  });

  describe('full match lifecycle (createMatch → startMatch → submitGuess → win)', () => {
    it('a player guess matching the opponent secret completes the match with player_won', async () => {
      const created = useMatchStore.getState().createMatch(1, '4321');
      expect(created).toBe(true);

      const initial = useMatchStore.getState().matchState!;
      expect(initial.modeId).toBe(1);
      expect(initial.phase).toBe('setup');
      // generateSecret on the real mode → 4 digits, RNG-derived.
      expect(initial.opponentSecret).toMatch(/^\d{4}$/);

      useMatchStore.getState().startMatch();
      const started = useMatchStore.getState().matchState!;
      expect(['active_turn_player', 'active_turn_opponent']).toContain(started.phase);
      expect(started.solverStates?.opponent?.kind).toBe('candidatePool');

      // Force player turn so the lifecycle assertion isn't gated on the
      // RNG roll inside startMatch.
      pinPhase('active_turn_player');

      // Replay the actual generated secret as the player's guess — the
      // engine evaluates this as all-green and flips to completed in the
      // same submitGuess call (Phase 3 invariant: isWin ⇔ completed).
      const winningGuess = started.opponentSecret;
      const out = await useMatchStore.getState().submitGuess(winningGuess, 'self');
      expect(out.error).toBeNull();
      expect(out.feedback?.isWin).toBe(true);

      const final = useMatchStore.getState().matchState!;
      expect(final.phase).toBe('completed');
      expect(final.result?.outcome).toBe('player_won');
      expect(final.result?.reason).toBe('cracked');
      expect(final.playerGuesses).toHaveLength(1);
      expect(final.opponentGuesses).toHaveLength(0);
    });

    it('a multi-turn loop with a real bot turn keeps the match active until a winning guess', async () => {
      useMatchStore.getState().createMatch(1, '4321');
      useMatchStore.getState().startMatch();
      const started = useMatchStore.getState().matchState!;
      const targetSecret = started.opponentSecret;

      // Turn 1 — losing player guess (any 4-digit string that isn't the
      // secret). '0000' very rarely collides with a random 4-digit secret;
      // if it does, swap to '9999' which is guaranteed distinct then.
      const decoy = targetSecret === '0000' ? '9999' : '0000';
      pinPhase('active_turn_player');
      const decoyOut = await useMatchStore.getState().submitGuess(decoy, 'self');
      expect(decoyOut.error).toBeNull();
      expect(decoyOut.feedback?.isWin).toBe(false);

      const afterDecoy = useMatchStore.getState().matchState!;
      expect(afterDecoy.phase).toBe('active_turn_opponent');
      expect(afterDecoy.result).toBeNull();

      // Turn 2 — real bot turn against the real solver pool (10 000
      // candidates). The pool monotonically narrows after the bot's own
      // first feedback round; we just need it to not throw and to rotate
      // the phase back to the player.
      const botOut = await useMatchStore.getState().runOpponentTurn();
      expect(botOut.error).toBeNull();
      expect(botOut.feedback?.kind).toBe('colorMatch');
      const afterBot = useMatchStore.getState().matchState!;
      // The bot's lucky-1-in-10000 first guess is the only way the match
      // could already be over — guard against it so the assertion below is
      // honest.
      if (afterBot.phase === 'completed') {
        expect(afterBot.result?.outcome).toBe('opponent_won');
        return;
      }
      expect(afterBot.phase).toBe('active_turn_player');
      expect(afterBot.opponentGuesses).toHaveLength(1);
      expect(afterBot.solverStates?.opponent?.kind).toBe('candidatePool');

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
      useMatchStore.getState().createMatch(1, '4321');
      useMatchStore.getState().startMatch();

      // Pin the opponent turn AND a known RNG cursor so the bot's draw
      // is deterministic across both runs. This is the same shape the
      // real persist middleware writes after every structural event.
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

      // Run #1 — direct.
      await useMatchStore.getState().runOpponentTurn();
      const liveAfter = useMatchStore.getState().matchState!;

      // Run #2 — round-trip through JSON, then run from the rehydrated
      // copy. Mimics AsyncStorage's serialise/deserialise on cold start.
      const restored = JSON.parse(JSON.stringify(live)) as typeof live;
      useMatchStore.setState({ matchState: restored });
      await useMatchStore.getState().runOpponentTurn();
      const restoredAfter = useMatchStore.getState().matchState!;

      // Same opponent guess (digits + feedback), same rngState cursor,
      // same solver pool size — the resume contract's three load-bearing
      // facts.
      expect(restoredAfter.opponentGuesses).toEqual(liveAfter.opponentGuesses);
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

    it('player guess history survives the round-trip and feeds the next turn unchanged', async () => {
      useMatchStore.getState().createMatch(1, '4321');
      useMatchStore.getState().startMatch();
      pinPhase('active_turn_player');

      await useMatchStore.getState().submitGuess('1234', 'self');
      const before = useMatchStore.getState().matchState!;
      const restored = JSON.parse(JSON.stringify(before)) as typeof before;
      useMatchStore.setState({ matchState: restored });
      const after = useMatchStore.getState().matchState!;

      expect(after.playerGuesses).toEqual(before.playerGuesses);
      expect(after.opponentSecret).toBe(before.opponentSecret);
      expect(after.playerSecret).toBe(before.playerSecret);
      expect(after.firstAuthor).toBe(before.firstAuthor);
      expect(after.botDifficulty).toBe(before.botDifficulty);
    });
  });

  describe('validation error path (user-facing failures stay in-band, never throw)', () => {
    it('non-digit input returns a NOT_DIGITS error with the durable state untouched', async () => {
      useMatchStore.getState().createMatch(1, '4321');
      useMatchStore.getState().startMatch();
      pinPhase('active_turn_player');

      const before = useMatchStore.getState().matchState!;
      const out = await useMatchStore.getState().submitGuess('12a4', 'self');
      const after = useMatchStore.getState().matchState!;

      expect(out.error?.code).toBe('NOT_DIGITS');
      expect(out.feedback).toBeNull();
      expect(after.phase).toBe('active_turn_player');
      expect(after.playerGuesses).toEqual(before.playerGuesses);
      expect(after.rngState).toEqual(before.rngState);
    });

    it('wrong-length input returns a WRONG_LENGTH error and does not advance the turn', async () => {
      useMatchStore.getState().createMatch(1, '4321');
      useMatchStore.getState().startMatch();
      pinPhase('active_turn_player');

      const out = await useMatchStore.getState().submitGuess('123', 'self');
      const after = useMatchStore.getState().matchState!;

      expect(out.error?.code).toBe('WRONG_LENGTH');
      expect(after.phase).toBe('active_turn_player');
      expect(after.playerGuesses).toHaveLength(0);
    });
  });
});
