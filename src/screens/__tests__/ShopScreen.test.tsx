import { Alert } from 'react-native';
import { act, fireEvent } from '@testing-library/react-native';

import { __resetMockUserForTests, mockUser } from '@data/mockUser';
import { ShopScreen } from '../ShopScreen';
import { renderWithNavigation, stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';

describe('ShopScreen', () => {
  beforeEach(() => {
    __resetMockUserForTests();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('snapshots the four-pack layout', () => {
    const { toJSON } = renderWithNavigation('Shop', { Shop: ShopScreen });
    expect(stableTreeForSnapshot(toJSON())).toMatchSnapshot();
  });

  it('shows ribbons on the popular and best-value tiers', () => {
    const { getByText } = renderWithNavigation('Shop', { Shop: ShopScreen });
    expect(getByText('MOST POPULAR')).toBeTruthy();
    expect(getByText('BEST VALUE')).toBeTruthy();
  });

  it('renders the disclaimer footer', () => {
    const { getByText } = renderWithNavigation('Shop', { Shop: ShopScreen });
    expect(getByText(/All purchases are final/)).toBeTruthy();
  });

  it('opens a confirm-style alert in __DEV__ and grants tokens on confirm', () => {
    const before = mockUser.tokens;
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      // `buttons` shape: [{ text: 'Cancel', ... }, { text: 'Add tokens', onPress }]
      const confirm = buttons?.find((b) => b.text === 'Add tokens');
      confirm?.onPress?.();
    });

    const utils = renderWithNavigation('Shop', { Shop: ShopScreen });
    act(() => {
      fireEvent.press(utils.getByLabelText('Buy 1,500 tokens for $2.99'));
    });

    expect(alertSpy).toHaveBeenCalled();
    expect(mockUser.tokens).toBe(before + 1500);
  });

  it('Cancel keeps the balance unchanged', () => {
    const before = mockUser.tokens;
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const cancel = buttons?.find((b) => b.text === 'Cancel');
      cancel?.onPress?.();
    });
    const utils = renderWithNavigation('Shop', { Shop: ShopScreen });
    act(() => {
      fireEvent.press(utils.getByLabelText('Buy 500 tokens for $0.99'));
    });
    expect(mockUser.tokens).toBe(before);
  });
});
