/**
 * Cross-screen integration flows for Phase 1B Checkpoint 3 — the full
 * match → result loop. Each test boots a slice of the production
 * navigator and drives it through real `replace` / `popToTop`
 * transitions; no per-screen stubs for the components under test.
 */

import { Alert } from 'react-native';
import { act, fireEvent } from '@testing-library/react-native';

import { __resetMockUserForTests, mockUser } from '@data/mockUser';
import { HomeScreen } from '@screens/HomeScreen';
import { MatchResultScreen } from '@screens/MatchResultScreen';
import { MatchScreen } from '@screens/MatchScreen';
import { MatchmakingScreen } from '@screens/MatchmakingScreen';
import { SecretSetupScreen } from '@screens/SecretSetupScreen';
import { renderWithNavigation } from '@/test-utils/renderWithNavigation';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';

const stack = {
  Home: HomeScreen,
  Matchmaking: MatchmakingScreen,
  SecretSetup: SecretSetupScreen,
  Match: MatchScreen,
  MatchResult: MatchResultScreen,
  // Auxiliaries stubbed — these tests only care about the match loop.
  Shop: RouteStubScreen,
  AdWatch: RouteStubScreen,
  InsufficientTokens: RouteStubScreen,
};

function pushIntoMatch(modeId: number) {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0.5);
  const utils = renderWithNavigation('Home', stack);
  act(() => {
    utils.navRef.current?.navigate('Match', { modeId, opponentId: 'opp-1' });
  });
  return utils;
}

describe('CP3 flows', () => {
  beforeEach(() => {
    __resetMockUserForTests();
    mockUser.tokens = 1000;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('Victory loop: Match → Guess → DevPicker → MatchResult → Play again → Matchmaking', () => {
    const before = mockUser.tokens;
    const utils = pushIntoMatch(1);
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Match');

    for (const d of [3, 8, 4, 7]) {
      act(() => {
        fireEvent.press(utils.getByLabelText(String(d)));
      });
    }
    act(() => {
      fireEvent.press(utils.getByText('Guess'));
    });
    act(() => {
      fireEvent.press(utils.getByLabelText('Pick outcome Victory'));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('MatchResult');
    // rewardWin for Mode 1 is 100 tokens.
    expect(mockUser.tokens).toBe(before + 100);

    act(() => {
      fireEvent.press(utils.getByText('Play again'));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Matchmaking');
  });

  it('Defeat loop: balance unchanged, Home button pops to top', () => {
    const before = mockUser.tokens;
    const utils = pushIntoMatch(1);

    for (const d of [3, 8, 4, 7]) {
      act(() => {
        fireEvent.press(utils.getByLabelText(String(d)));
      });
    }
    act(() => {
      fireEvent.press(utils.getByText('Guess'));
    });
    act(() => {
      fireEvent.press(utils.getByLabelText('Pick outcome Defeat'));
    });
    expect(mockUser.tokens).toBe(before);

    act(() => {
      fireEvent.press(utils.getByText('Home'));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Home');
  });

  it('Stalemate loop refunds the entry stake', () => {
    const before = mockUser.tokens;
    const utils = pushIntoMatch(6); // Sudden Death — stake 50

    for (const d of [3, 8, 4, 7]) {
      act(() => {
        fireEvent.press(utils.getByLabelText(String(d)));
      });
    }
    act(() => {
      fireEvent.press(utils.getByText('Guess'));
    });
    act(() => {
      fireEvent.press(utils.getByLabelText('Pick outcome Stalemate'));
    });
    expect(mockUser.tokens).toBe(before + 50);
  });

  it('Mode 7: SoloRaceBanner present + no PlayerCardPair "VS"', () => {
    const utils = pushIntoMatch(7);
    expect(utils.queryByText('SOLO RACE')).toBeTruthy();
    expect(utils.queryByText('VS')).toBeNull();
  });

  it('Forfeit confirm: stake charged + popToTop to Home', () => {
    const before = mockUser.tokens;
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const forfeit = buttons?.find((b) => b.text === 'Forfeit');
      forfeit?.onPress?.();
    });
    const utils = pushIntoMatch(1);
    act(() => {
      fireEvent.press(utils.getByLabelText('Forfeit match'));
    });
    expect(mockUser.tokens).toBe(before - 50);
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Home');
  });
});
