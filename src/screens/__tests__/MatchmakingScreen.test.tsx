import { act } from '@testing-library/react-native';

import { __resetMockUserForTests } from '@data/mockUser';
import { MatchmakingScreen } from '../MatchmakingScreen';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';
import { SecretSetupScreen } from '../SecretSetupScreen';
import { renderWithNavigation, stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';

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
    jest.useFakeTimers();
    // Lock random delay to a known value so timing tests are deterministic.
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
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
});
