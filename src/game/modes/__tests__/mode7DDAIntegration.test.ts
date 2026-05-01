/**
 * Phase 7A.3 codex-backlog cleanup — concrete end-to-end DDA test.
 *
 * Existing matchStore tests (`src/state/__tests__/matchStore.test.ts`)
 * use a stub mode (`registerStub`) and prove the orchestration wire:
 * `userStore.stats.recentMatches` → `pickDifficultyFromOutcomes` →
 * `state.botDifficulty`. They DON'T prove the propagation chain
 * reaches a real mode's `bot.makeGuess(ctx)` — a future regression
 * where a mode redefines its bot façade and silently drops
 * `ctx.difficulty` would slip past those tests.
 *
 * This file closes that gap on Mode 7 (the most representative path:
 * advanced parallel mode, sharedSecret flag, reuses `mode1/bot.ts`'s
 * `makeGuess`). Mode 7 was chosen over Mode 6 because (a) the
 * sharedSecret invariant adds a second cross-cutting concern that's
 * worth pinning under DDA, and (b) the original Codex review called
 * out Mirror specifically as the marketing differentiator — Mirror's
 * DDA wiring deserves a named guard.
 *
 * Mode 6 reuses the same `mode1/bot.ts` façade and therefore inherits
 * the same `ctx.difficulty` channel; a parallel test for Mode 6 would
 * be redundant. The hidden-invariant CI guard
 * (`src/__tests__/invariants/hiddenDDAInvariant.test.ts`) covers the
 * complementary concern (no UI surface).
 */

import { __resetRegistryForTests, modeRegistry } from '../../modeRegistry';
import { useMatchStore } from '../../../state/matchStore';
import { useUserStore, USER_STORE_DEFAULTS } from '../../../state/userStore';
import type { MatchResultOutcome } from '@navigation/routes';
import { mode7Mirror } from '../mode7Mirror';

const V: MatchResultOutcome = 'victory';
const D: MatchResultOutcome = 'defeat';

const repeat = (outcome: MatchResultOutcome, n: number): MatchResultOutcome[] =>
  Array.from({ length: n }, () => outcome);

function seedRecent(recent: readonly MatchResultOutcome[]): void {
  useUserStore.setState({
    stats: { ...USER_STORE_DEFAULTS.stats, recentMatches: recent },
  });
}

describe('Mode 7 — concrete DDA integration (real mode, real bot)', () => {
  beforeEach(() => {
    __resetRegistryForTests();
    modeRegistry.register(mode7Mirror);
    useMatchStore.setState({ matchState: null });
    useUserStore.setState({
      stats: USER_STORE_DEFAULTS.stats,
      tokens: USER_STORE_DEFAULTS.tokens,
    });
  });

  it('stamps state.botDifficulty=hard when recentMatches signals dominance, and the real bot receives it', async () => {
    seedRecent(repeat(V, 10));
    const makeGuessSpy = jest.spyOn(mode7Mirror.bot, 'makeGuess');

    useMatchStore.getState().createMatch(7, '_');
    expect(useMatchStore.getState().matchState?.botDifficulty).toBe('hard');

    useMatchStore.getState().startMatch();
    await useMatchStore.getState().runOpponentTurn();

    expect(makeGuessSpy).toHaveBeenCalledTimes(1);
    expect(makeGuessSpy.mock.calls[0]?.[0]?.difficulty).toBe('hard');

    makeGuessSpy.mockRestore();
  });

  it('stamps state.botDifficulty=easy when recentMatches signals struggle, and the real bot receives it', async () => {
    seedRecent(repeat(D, 10));
    const makeGuessSpy = jest.spyOn(mode7Mirror.bot, 'makeGuess');

    useMatchStore.getState().createMatch(7, '_');
    expect(useMatchStore.getState().matchState?.botDifficulty).toBe('easy');

    useMatchStore.getState().startMatch();
    await useMatchStore.getState().runOpponentTurn();

    expect(makeGuessSpy.mock.calls[0]?.[0]?.difficulty).toBe('easy');

    makeGuessSpy.mockRestore();
  });

  it('warm-up window stamps normal end-to-end (defaults all the way through to BotContext)', async () => {
    seedRecent([]); // empty window → warm-up → 'normal'
    const makeGuessSpy = jest.spyOn(mode7Mirror.bot, 'makeGuess');

    useMatchStore.getState().createMatch(7, '_');
    expect(useMatchStore.getState().matchState?.botDifficulty).toBe('normal');

    useMatchStore.getState().startMatch();
    await useMatchStore.getState().runOpponentTurn();

    expect(makeGuessSpy.mock.calls[0]?.[0]?.difficulty).toBe('normal');

    makeGuessSpy.mockRestore();
  });

  it('the stamped difficulty survives the createMatch → startMatch → runOpponentTurn chain unchanged', async () => {
    seedRecent(repeat(V, 10));
    const makeGuessSpy = jest.spyOn(mode7Mirror.bot, 'makeGuess');

    useMatchStore.getState().createMatch(7, '_');
    const stampedAtCreate = useMatchStore.getState().matchState?.botDifficulty;

    useMatchStore.getState().startMatch();
    const stampedAtStart = useMatchStore.getState().matchState?.botDifficulty;

    await useMatchStore.getState().runOpponentTurn();
    const stampedAfterTurn = useMatchStore.getState().matchState?.botDifficulty;

    // Three snapshots, one value — the chain must not mutate or drop.
    expect(stampedAtCreate).toBe('hard');
    expect(stampedAtStart).toBe('hard');
    expect(stampedAfterTurn).toBe('hard');
    expect(makeGuessSpy.mock.calls[0]?.[0]?.difficulty).toBe('hard');

    makeGuessSpy.mockRestore();
  });
});
