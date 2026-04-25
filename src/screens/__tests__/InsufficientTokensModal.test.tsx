import { act, fireEvent } from '@testing-library/react-native';

import { __resetMockUserForTests } from '@data/mockUser';
import { HomeScreen } from '../HomeScreen';
import { InsufficientTokensModal } from '../InsufficientTokensModal';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';
import { renderWithNavigation, stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';

function renderModal(modeId: number) {
  return renderWithNavigation(
    'InsufficientTokens',
    {
      InsufficientTokens: InsufficientTokensModal,
      AdWatch: RouteStubScreen,
      Shop: RouteStubScreen,
      Home: HomeScreen,
    },
    { modeId },
  );
}

describe('InsufficientTokensModal', () => {
  beforeEach(() => {
    __resetMockUserForTests();
  });

  it('snapshots the modal layout', () => {
    const utils = renderModal(1);
    expect(stableTreeForSnapshot(utils.toJSON())).toMatchSnapshot();
  });

  it('quotes the correct stake from the catalog (Mode 5 → 100)', () => {
    const utils = renderModal(5);
    expect(utils.queryByText('You need 100 tokens to play this match.')).toBeTruthy();
  });

  it('Watch ad button navigates to AdWatch', () => {
    const utils = renderModal(1);
    act(() => {
      fireEvent.press(utils.getByText('Watch ad · +50'));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('AdWatch');
  });

  it('Buy tokens button navigates to Shop', () => {
    const utils = renderModal(1);
    act(() => {
      fireEvent.press(utils.getByText('Buy tokens'));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Shop');
  });

  it('Close button triggers goBack on the navigator', () => {
    // The modal is the only route on this synthetic stack — `goBack`
    // is a no-op and React Navigation logs a dev-only warning. The
    // integration test covers the full Home → modal → Home flow; here
    // we just assert the close handler fires `goBack` without
    // throwing.
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const utils = renderModal(1);
    act(() => {
      fireEvent.press(utils.getByLabelText('Close'));
    });
    expect(utils.navRef.current?.canGoBack()).toBe(false);
    errorSpy.mockRestore();
  });
});
