import { Alert } from 'react-native';
import { act, fireEvent } from '@testing-library/react-native';

import { __resetMockUserForTests, mockUser } from '@data/mockUser';
import { MatchScreen } from '../MatchScreen';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';
import { renderWithNavigation, stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';

function renderMatch(modeId: number) {
  return renderWithNavigation(
    'Match',
    {
      Match: MatchScreen,
      MatchResult: RouteStubScreen,
      Home: RouteStubScreen,
    },
    { modeId, opponentId: 'opp-1' },
  );
}

describe('MatchScreen — Modes 1-6', () => {
  beforeEach(() => {
    __resetMockUserForTests();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('snapshots the Mode 1 layout', () => {
    const utils = renderMatch(1);
    expect(stableTreeForSnapshot(utils.toJSON())).toMatchSnapshot();
  });

  it('renders the round label with the catalog name', () => {
    const utils = renderMatch(2);
    expect(utils.queryByText(/HIGH & LOW/)).toBeTruthy();
  });

  it('shows the Blitz clock chip for Mode 4', () => {
    const utils = renderMatch(4);
    expect(utils.queryByText('0:28 · 0:45')).toBeTruthy();
  });

  it('shows the Sudden Death N/5 chip and lives derived from the timeline', () => {
    const utils = renderMatch(6);
    // Mock timeline for Mode 6 has 2 self + 1 opponent guesses → 2/5 · 1/5
    expect(utils.queryByText('2/5 · 1/5')).toBeTruthy();
  });

  it('Guess button is disabled until four digits are entered', () => {
    const utils = renderMatch(1);
    const guess = utils.getByText('Guess');
    act(() => {
      fireEvent.press(guess);
    });
    // Picker did not open — overlay's "Pick a result" headline absent.
    expect(utils.queryByText('Pick a result')).toBeNull();
  });

  it('opens the DevResultPicker when four digits + Guess are entered', () => {
    const utils = renderMatch(1);
    for (const d of [3, 8, 4, 7]) {
      act(() => {
        fireEvent.press(utils.getByLabelText(String(d)));
      });
    }
    act(() => {
      fireEvent.press(utils.getByText('Guess'));
    });
    expect(utils.queryByText('Pick a result')).toBeTruthy();
  });

  it('picking a result replaces into MatchResult with the chosen outcome', () => {
    const utils = renderMatch(1);
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
    const current = utils.navRef.current?.getCurrentRoute();
    expect(current?.name).toBe('MatchResult');
    expect(current?.params).toEqual({ modeId: 1, outcome: 'victory', opponentId: 'opp-1' });
  });

  it('Forfeit Alert → confirm pops to top without re-debiting tokens (stake was debited at createMatch)', () => {
    // Bug 1 wiring: stake is debited inside `matchStore.createMatch`,
    // so forfeit no longer touches tokens — doing so would double-
    // charge. This test renders the mock path (no createMatch call),
    // so tokens stay flat across the forfeit; the engine-path stake
    // bookkeeping is covered in `cp4Flows.test.tsx`.
    const startTokens = mockUser.tokens;
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const forfeit = buttons?.find((b) => b.text === 'Forfeit');
      forfeit?.onPress?.();
    });
    // Boot the navigator from Home and push Match — popToTop must
    // unwind back to Home for this assertion to mean anything.
    const utils = renderWithNavigation('Home', {
      Home: RouteStubScreen,
      Match: MatchScreen,
      MatchResult: RouteStubScreen,
    });
    act(() => {
      utils.navRef.current?.navigate('Match', { modeId: 1, opponentId: 'opp-1' });
    });
    act(() => {
      fireEvent.press(utils.getByLabelText('Forfeit match'));
    });
    expect(mockUser.tokens).toBe(startTokens);
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Home');
  });

  // ── Mode 7 (Mirror) variant ──────────────────────────────
  it('snapshots the Mode 7 Mirror layout', () => {
    const utils = renderMatch(7);
    expect(stableTreeForSnapshot(utils.toJSON())).toMatchSnapshot();
  });

  it('Mode 7 swaps the player pair for the SoloRaceBanner', () => {
    const utils = renderMatch(7);
    expect(utils.queryByText('SOLO RACE')).toBeTruthy();
    expect(utils.queryByText('Both solving the same code')).toBeTruthy();
    // No "VS" rotated separator — that lives only in PlayerCardPair.
    expect(utils.queryByText('VS')).toBeNull();
  });

  it('Mode 7 surfaces the rival meta (name · level · flag)', () => {
    const utils = renderMatch(7);
    // opp-1 = shadowHunter47, level 23, flag 🇩🇪.
    expect(utils.queryByText(/shadowHunter47 · Lv\. 23 · 🇩🇪/)).toBeTruthy();
  });

  it('Mode 7 swaps "YOUR TURN" for "RACING" and uses an "is guessing" verb', () => {
    const utils = renderMatch(7);
    expect(utils.queryByText('RACING')).toBeTruthy();
    expect(utils.queryByText('YOUR TURN')).toBeNull();
    expect(utils.queryByText(/shadowHunter47 is guessing/)).toBeTruthy();
  });

  it('Modes 1-6 keep the "is typing" verb', () => {
    const utils = renderMatch(1);
    expect(utils.queryByText(/shadowHunter47 is typing/)).toBeTruthy();
  });

  it('Forfeit Alert → cancel keeps balance + stays on Match', () => {
    const startTokens = mockUser.tokens;
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const cancel = buttons?.find((b) => b.text === 'Cancel');
      cancel?.onPress?.();
    });
    const utils = renderMatch(1);
    act(() => {
      fireEvent.press(utils.getByLabelText('Forfeit match'));
    });
    expect(mockUser.tokens).toBe(startTokens);
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Match');
  });
});
