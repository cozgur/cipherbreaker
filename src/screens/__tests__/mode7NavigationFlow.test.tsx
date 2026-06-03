/**
 * Mode 7 (Mirror) — full navigation flow integration test.
 *
 * Distinct from `mode7Integration.test.ts`, which fills `matchStore`
 * programmatically and exercises engine semantics in isolation. This
 * suite mounts the real screen chain (Matchmaking → Match) so that
 * the bug from Phase 6 — `MatchScreen` falling back to the mock
 * DevResultPicker because nothing seeded the store on the
 * sharedSecret path — would surface here even if the unit test for
 * `MatchmakingScreen` accidentally regressed.
 *
 * The test pins three contract points:
 *   1. After Matchmaking's reveal, navigation lands on `Match` (no
 *      SecretSetup detour) — this was already true pre-fix.
 *   2. `matchStore.matchState` is seeded with `modeId === 7` and a
 *      live phase (`'active_parallel'` for Mirror) — this is the
 *      change.
 *   3. The MatchScreen no longer renders the dev outcome picker —
 *      the surface signal that the engine path is engaged.
 */

import { act } from '@testing-library/react-native';

import { __resetMockUserForTests, mockUser } from '@data/mockUser';
import { modeRegistry } from '@game/modeRegistry';
import { mode7Mirror } from '@game/modes/mode7Mirror';
import { MatchmakingScreen } from '../MatchmakingScreen';
import { MatchScreen } from '../MatchScreen';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';
import { renderWithNavigation } from '@/test-utils/renderWithNavigation';
import { useMatchStore } from '@state/matchStore';

describe('Mode 7 navigation flow — Matchmaking seeds the engine path', () => {
  beforeEach(() => {
    modeRegistry.register(mode7Mirror);
    __resetMockUserForTests();
    useMatchStore.getState().clearMatch();
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    useMatchStore.getState().clearMatch();
  });

  it('Matchmaking → Match real-mount flow seeds matchStore and bypasses DevResultPicker', () => {
    const tokensBefore = mockUser.tokens;

    const utils = renderWithNavigation(
      'Matchmaking',
      {
        // Real screens for the two seams that matter — everything
        // else can be a stub since this test never reaches them.
        Matchmaking: MatchmakingScreen,
        Match: MatchScreen,
        Home: RouteStubScreen,
        MatchResult: RouteStubScreen,
        SecretSetup: RouteStubScreen,
      },
      { modeId: 7 },
    );

    // Search delay (random=0.5 -> pickMatchmakingDuration 6000ms) -> opponent paint.
    act(() => {
      jest.advanceTimersByTime(6000);
    });
    // Reveal window → seed + replace into Match.
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Contract 1 — landed on Match (modeRouter sharedSecret skip).
    const route = utils.navRef.current?.getCurrentRoute();
    expect(route?.name).toBe('Match');
    expect((route?.params as { modeId: number }).modeId).toBe(7);

    // Contract 2 — engine path primed. Without the Phase 6 hookup,
    // matchState would still be null here and MatchScreen would
    // light up its mock branch.
    const matchState = useMatchStore.getState().matchState;
    expect(matchState).not.toBeNull();
    expect(matchState?.modeId).toBe(7);
    // Mode 7 rides parallelEngine → startMatch produces
    // 'active_parallel' (turn-based modes would land in
    // 'active_turn_*' instead).
    expect(matchState?.phase).toBe('active_parallel');
    // Mode 7 invariant: shared secret across both sides.
    expect(matchState?.playerSecret).toBe(matchState?.opponentSecret);
    expect(matchState?.playerSecret).toMatch(/^\d{4}$/);
    // Mode 7 secret follows the SPEC §3 leading-zero constraint —
    // the engine generates via `generateRandomDigits`, so first
    // digit is in 1-9.
    expect(matchState?.playerSecret?.[0]).not.toBe('0');

    // Contract 3 — stake debited at the matchmaking seam (Mode 7
    // commits at reveal because there's no SecretSetup later).
    expect(mockUser.tokens).toBe(tokensBefore - 75);

    // Contract 4 — surface check: DevResultPicker is the bug
    // signature. If MatchScreen took the mock branch, the dev
    // outcome buttons would be in the tree. They are not.
    expect(utils.queryByLabelText('Pick outcome Victory')).toBeNull();
    expect(utils.queryByLabelText('Pick outcome Defeat')).toBeNull();
  });
});
