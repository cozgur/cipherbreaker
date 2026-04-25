import { act, fireEvent } from '@testing-library/react-native';

import { __resetMockUserForTests, mockUser } from '@data/mockUser';
import { HomeScreen } from '../HomeScreen';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';
import { renderWithNavigation, stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';

describe('HomeScreen', () => {
  beforeEach(() => {
    __resetMockUserForTests();
  });

  it('snapshots the seven-mode layout', () => {
    const { toJSON } = renderWithNavigation('Home', {
      Home: HomeScreen,
    });
    expect(stableTreeForSnapshot(toJSON())).toMatchSnapshot();
  });

  it('surfaces both CLASSIC and ADVANCED section labels', () => {
    const { getByText } = renderWithNavigation('Home', { Home: HomeScreen });
    expect(getByText('CLASSIC')).toBeTruthy();
    expect(getByText('ADVANCED')).toBeTruthy();
  });

  it('navigates to Matchmaking when the balance covers the stake', () => {
    mockUser.tokens = 1000;
    const utils = renderWithNavigation('Home', {
      Home: HomeScreen,
      Matchmaking: RouteStubScreen,
      InsufficientTokens: RouteStubScreen,
    });

    // COLOR MATCH stake is 50 → far below 1000 → Matchmaking.
    act(() => {
      fireEvent.press(utils.getByLabelText('COLOR MATCH — 50 tokens'));
    });

    const current = utils.navRef.current?.getCurrentRoute();
    expect(current?.name).toBe('Matchmaking');
    expect(current?.params).toEqual({ modeId: 1 });
  });

  it('opens InsufficientTokens when the balance is below the stake', () => {
    mockUser.tokens = 0;
    const utils = renderWithNavigation('Home', {
      Home: HomeScreen,
      Matchmaking: RouteStubScreen,
      InsufficientTokens: RouteStubScreen,
    });

    act(() => {
      fireEvent.press(utils.getByLabelText('BLACKOUT — 100 tokens'));
    });

    const current = utils.navRef.current?.getCurrentRoute();
    expect(current?.name).toBe('InsufficientTokens');
    expect(current?.params).toEqual({ modeId: 5 });
  });

  it('tapping the avatar opens Profile', () => {
    const utils = renderWithNavigation('Home', {
      Home: HomeScreen,
      Profile: RouteStubScreen,
    });

    act(() => {
      fireEvent.press(utils.getByLabelText('Open profile'));
    });

    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Profile');
  });

  it('tapping the token badge opens Shop', () => {
    const utils = renderWithNavigation('Home', {
      Home: HomeScreen,
      Shop: RouteStubScreen,
    });

    act(() => {
      fireEvent.press(utils.getByLabelText('Open shop'));
    });

    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Shop');
  });
});
