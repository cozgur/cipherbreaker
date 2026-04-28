/**
 * Mode 5 — full-stack integration. Mirrors mode3Integration:
 * createMatch → startMatch → submitGuess → win, plus a duplicate-
 * digit rejection path (catalog now enforces digitsUnique=true).
 */

import { __resetRegistryForTests, modeRegistry } from '../../modeRegistry';
import { useMatchStore } from '../../../state/matchStore';
import { mode5Blackout } from '../mode5Blackout';

function pinPhase(phase: 'active_turn_player' | 'active_turn_opponent'): void {
  useMatchStore.setState((s) => ({
    matchState: s.matchState ? { ...s.matchState, phase } : null,
  }));
}

describe('Mode 5 — integration through useMatchStore', () => {
  beforeEach(() => {
    __resetRegistryForTests();
    modeRegistry.register(mode5Blackout);
    useMatchStore.setState({ matchState: null });
  });

  describe('full match lifecycle', () => {
    it('a player guess matching the secret completes with player_won', async () => {
      useMatchStore.getState().createMatch(5, '4321');
      const initial = useMatchStore.getState().matchState!;
      // Mode 5 secrets must have unique digits.
      expect(new Set(initial.opponentSecret.split('')).size).toBe(4);

      useMatchStore.getState().startMatch();
      const started = useMatchStore.getState().matchState!;
      expect(started.solverStates?.opponent?.kind).toBe('candidatePool');

      pinPhase('active_turn_player');

      const out = await useMatchStore.getState().submitGuess(started.opponentSecret, 'self');
      expect(out.error).toBeNull();
      expect(out.feedback?.kind).toBe('blackout');
      expect(out.feedback?.isWin).toBe(true);
      // SPEC §3.7 — even a winning feedback only reports the count, never
      // per-position info to the player.
      if (out.feedback?.kind === 'blackout') {
        expect(out.feedback.locked).toBe(4);
        expect(out.feedback.states).toEqual(['blackout', 'blackout', 'blackout', 'blackout']);
      }

      const final = useMatchStore.getState().matchState!;
      expect(final.phase).toBe('completed');
      expect(final.result?.outcome).toBe('player_won');
    });

    it('rejects a duplicate-digit guess with NOT_UNIQUE; durable state untouched', async () => {
      useMatchStore.getState().createMatch(5, '4321');
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
  });

  describe('JSON round-trip mid-match → resume identity', () => {
    it('opponent turn produces an identical guess + RNG cursor when run from a serialized snapshot', async () => {
      useMatchStore.getState().createMatch(5, '4321');
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
    });
  });
});
