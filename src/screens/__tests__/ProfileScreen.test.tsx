import { act, fireEvent } from '@testing-library/react-native';

import { __resetMockUserForTests, mockUser } from '@data/mockUser';
import { ProfileScreen } from '../ProfileScreen';
import { ChangeUsernameModal } from '../ChangeUsernameModal';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';
import { renderWithNavigation, stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';

describe('ProfileScreen', () => {
  beforeEach(() => {
    __resetMockUserForTests();
  });

  it('snapshots the profile layout', () => {
    const { toJSON } = renderWithNavigation('Profile', {
      Profile: ProfileScreen,
    });
    expect(stableTreeForSnapshot(toJSON())).toMatchSnapshot();
  });

  it('shows lifetime stats from the mock user', () => {
    const { getByText } = renderWithNavigation('Profile', { Profile: ProfileScreen });
    expect(getByText('247')).toBeTruthy();
    expect(getByText('68%')).toBeTruthy();
    expect(getByText('12.4K')).toBeTruthy();
  });

  it('lists per-mode win rate for all seven modes', () => {
    const { getAllByText } = renderWithNavigation('Profile', { Profile: ProfileScreen });
    // The "%" suffix is enough to count win-rate cells.
    expect(getAllByText(/\d+%/).length).toBeGreaterThanOrEqual(7);
  });

  it('toggles the Sound setting in place', () => {
    const utils = renderWithNavigation('Profile', { Profile: ProfileScreen });
    expect(mockUser.settings.sound).toBe(true);
    act(() => {
      fireEvent.press(utils.getByLabelText('Sound'));
    });
    expect(mockUser.settings.sound).toBe(false);
  });

  it('Change Username row opens the ChangeUsername route', () => {
    const utils = renderWithNavigation('Profile', {
      Profile: ProfileScreen,
      ChangeUsername: ChangeUsernameModal,
    });
    act(() => {
      fireEvent.press(utils.getByLabelText('Change username'));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('ChangeUsername');
  });

  it('TokenBadge opens Shop', () => {
    const utils = renderWithNavigation('Profile', {
      Profile: ProfileScreen,
      Shop: RouteStubScreen,
    });
    act(() => {
      fireEvent.press(utils.getByLabelText('Open shop'));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Shop');
  });
});
