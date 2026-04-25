import { act, fireEvent } from '@testing-library/react-native';

import { __resetMockUserForTests, mockUser } from '@data/mockUser';
import { ChangeUsernameModal } from '../ChangeUsernameModal';
import { ProfileScreen } from '../ProfileScreen';
import { renderWithNavigation } from '@/test-utils/renderWithNavigation';

describe('ChangeUsernameModal', () => {
  beforeEach(() => {
    __resetMockUserForTests();
  });

  it('Save commits a new trimmed username and closes the modal', () => {
    const utils = renderWithNavigation('Profile', {
      Profile: ProfileScreen,
      ChangeUsername: ChangeUsernameModal,
    });
    act(() => {
      fireEvent.press(utils.getByLabelText('Change username'));
    });
    const input = utils.getByLabelText('Username');
    fireEvent.changeText(input, '  zero_cool ');
    act(() => {
      fireEvent.press(utils.getByText('Save'));
    });
    expect(mockUser.username).toBe('zero_cool');
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Profile');
  });

  it('Cancel discards changes', () => {
    const utils = renderWithNavigation('Profile', {
      Profile: ProfileScreen,
      ChangeUsername: ChangeUsernameModal,
    });
    act(() => {
      fireEvent.press(utils.getByLabelText('Change username'));
    });
    const input = utils.getByLabelText('Username');
    fireEvent.changeText(input, 'something_new');
    act(() => {
      fireEvent.press(utils.getByLabelText('Cancel'));
    });
    expect(mockUser.username).toBe('nova_code');
  });

  it('Save is a no-op when the trimmed value matches the current username', () => {
    const utils = renderWithNavigation('Profile', {
      Profile: ProfileScreen,
      ChangeUsername: ChangeUsernameModal,
    });
    act(() => {
      fireEvent.press(utils.getByLabelText('Change username'));
    });
    const input = utils.getByLabelText('Username');
    // Whitespace padding around the existing name still counts as "no
    // change" — the trimmed value equals the current username.
    fireEvent.changeText(input, '  nova_code  ');
    act(() => {
      fireEvent.press(utils.getByText('Save'));
    });
    // Username unchanged, modal still open (Save was disabled).
    expect(mockUser.username).toBe('nova_code');
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('ChangeUsername');
  });

  it('Save is blocked when the trimmed value is empty', () => {
    const utils = renderWithNavigation('Profile', {
      Profile: ProfileScreen,
      ChangeUsername: ChangeUsernameModal,
    });
    act(() => {
      fireEvent.press(utils.getByLabelText('Change username'));
    });
    const input = utils.getByLabelText('Username');
    fireEvent.changeText(input, '   ');
    // Save remains disabled — pressing it does nothing.
    act(() => {
      fireEvent.press(utils.getByText('Save'));
    });
    expect(mockUser.username).toBe('nova_code');
  });
});
