import { act } from '@testing-library/react-native';

import { __resetMockUserForTests, mockUser } from '@data/mockUser';
import { modeRegistry } from '@game/modeRegistry';
import { mode7Mirror } from '@game/modes/mode7Mirror';
import { MatchmakingScreen } from '../MatchmakingScreen';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';
import { SecretSetupScreen } from '../SecretSetupScreen';
import { renderWithNavigation, stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';
import { useMatchStore } from '@state/matchStore';

function renderMatchmaking(modeId: number) {
  const utils = renderWithNavigation(
    'Matchmaking',
    {
      Matchmaking: MatchmakingScreen,
      SecretSetup: SecretSetupScreen,
      Match: RouteStubScreen,
    },
    { modeId },
  );
  return utils;
}

describe('MatchmakingScreen', () => {
  beforeEach(() => {
    __resetMockUserForTests();
    // Mode 7 hookup test asserts on matchStore state — wipe any
    // residue from a prior test before each case.
    useMatchStore.getState().clearMatch();
    jest.useFakeTimers();
    // Lock random delay to a known value so timing tests are deterministic.
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    useMatchStore.getState().clearMatch();
  });

  it('snapshots the searching state', () => {
    const utils = renderMatchmaking(1);
    expect(stableTreeForSnapshot(utils.toJSON())).toMatchSnapshot();
  });

  it('shows "Searching for opponent" copy initially for non-Mirror modes', () => {
    const utils = renderMatchmaking(1);
    expect(utils.queryByText(/Searching for opponent/)).toBeTruthy();
  });

  it('shows the Mirror-specific copy for Mode 7', () => {
    const utils = renderMatchmaking(7);
    expect(utils.queryByText(/Finding a rival to race/)).toBeTruthy();
  });

  it('reveals an opponent then auto-replaces into SecretSetup (Modes 1-6)', () => {
    const utils = renderMatchmaking(1);
    // Searching state — no "Opponent found".
    expect(utils.queryByText('Opponent found!')).toBeNull();

    // Random=0.5 → search delay 2700ms.
    act(() => {
      jest.advanceTimersByTime(2700);
    });
    expect(utils.queryByText('Opponent found!')).toBeTruthy();

    // 1000ms reveal → SecretSetup.
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    const current = utils.navRef.current?.getCurrentRoute();
    expect(current?.name).toBe('SecretSetup');
    expect((current?.params as { modeId: number }).modeId).toBe(1);
  });

  it('auto-replaces into Match (skipping SecretSetup) for Mode 7 Mirror', () => {
    const utils = renderMatchmaking(7);
    // Search resolves and we paint the opponent.
    act(() => {
      jest.advanceTimersByTime(2700);
    });
    expect(utils.queryByText('Opponent found!')).toBeTruthy();
    // Reveal window elapses → replace into the Match route.
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Match');
  });

  describe('engine seed contract (Phase 6 Mode 7 hookup)', () => {
    // Mode 7 (sharedSecret) skips SecretSetup, so the matchStore seed
    // step that normally lives inside SecretSetup.handleLockIn has to
    // happen here in MatchmakingScreen. Modes 1-6 must NOT seed the
    // store from this screen — that would double-debit the stake when
    // SecretSetup later seeds the same match. Both directions are
    // pinned by tests.

    it('Mode 7 reveal seeds matchStore + debits the stake (sharedSecret path)', () => {
      // Mode 7 must be registered for the seed branch to fire — the
      // top-level `@game/modes/index.ts` does this in production, but
      // jest module isolation means the unit test re-registers.
      modeRegistry.register(mode7Mirror);
      const tokensBefore = mockUser.tokens;

      const utils = renderMatchmaking(7);
      act(() => {
        jest.advanceTimersByTime(2700); // search delay
      });
      act(() => {
        jest.advanceTimersByTime(1000); // reveal window
      });

      // Navigation moved to Match …
      expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Match');
      // … AND the engine path is primed: matchState belongs to mode 7
      // and is past the idle phase (Mode 7 is parallel, so startMatch
      // produces 'active_parallel').
      const matchState = useMatchStore.getState().matchState;
      expect(matchState).not.toBeNull();
      expect(matchState?.modeId).toBe(7);
      expect(matchState?.phase).not.toBe('idle');
      // Stake debit (Mode 7 = 75) lands inside `createMatch`. Without
      // this, MatchScreen's engine gate falls back to DevResultPicker
      // — the very bug this hookup fixes.
      expect(mockUser.tokens).toBe(tokensBefore - 75);
    });

    it('Modes 1-6 reveal does NOT seed matchStore (delegates to SecretSetup) — double-debit regression guard', () => {
      // If Mode 7's hookup ever leaks into the non-Mirror branch,
      // SecretSetup would call `createMatch` again and the stake
      // would debit twice. Pin the boundary: Modes 1-6 reveal leaves
      // matchStore in `idle` (no matchState) and tokens untouched.
      const tokensBefore = mockUser.tokens;

      const utils = renderMatchmaking(1);
      act(() => {
        jest.advanceTimersByTime(2700);
      });
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Navigation went to SecretSetup, not Match.
      expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('SecretSetup');
      // matchStore untouched — SecretSetup is the seam that owns the
      // seed for player-secret modes.
      expect(useMatchStore.getState().matchState).toBeNull();
      expect(mockUser.tokens).toBe(tokensBefore);
    });
  });
});
