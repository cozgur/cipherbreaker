import { act, fireEvent } from '@testing-library/react-native';

import { __resetMockUserForTests } from '@data/mockUser';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';
import { SecretSetupScreen } from '../SecretSetupScreen';
import { renderWithNavigation, stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';

function renderSecretSetup(modeId: number) {
  return renderWithNavigation(
    'SecretSetup',
    {
      SecretSetup: SecretSetupScreen,
      Match: RouteStubScreen,
      Home: RouteStubScreen,
    },
    { modeId, opponentId: 'opp-1' },
  );
}

function pressDigits(utils: ReturnType<typeof renderSecretSetup>, sequence: readonly number[]) {
  for (const digit of sequence) {
    act(() => {
      fireEvent.press(utils.getByLabelText(String(digit)));
    });
  }
}

describe('SecretSetupScreen', () => {
  beforeEach(() => {
    __resetMockUserForTests();
  });

  it('snapshots the empty Mode 1 layout', () => {
    const utils = renderSecretSetup(1);
    expect(stableTreeForSnapshot(utils.toJSON())).toMatchSnapshot();
  });

  it('renders the mode tag with the catalog name', () => {
    const utils = renderSecretSetup(4);
    expect(utils.queryByText(/MODE 4 · BLITZ/)).toBeTruthy();
  });

  it('Lock In Code is disabled until four digits are entered', () => {
    const utils = renderSecretSetup(1);
    pressDigits(utils, [1, 2, 3]);
    // Three digits — button still disabled. Pressing it must not navigate.
    act(() => {
      fireEvent.press(utils.getByText('Lock In Code'));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('SecretSetup');
  });

  it('replaces into Match once a valid code is locked in', () => {
    const utils = renderSecretSetup(1);
    pressDigits(utils, [3, 8, 4, 7]);
    act(() => {
      fireEvent.press(utils.getByText('Lock In Code'));
    });
    const current = utils.navRef.current?.getCurrentRoute();
    expect(current?.name).toBe('Match');
    expect(current?.params).toEqual({ modeId: 1, opponentId: 'opp-1' });
    // `replace` semantics — Match is now the only route on the stack
    // for this navigator surface. canGoBack returns false.
    expect(utils.navRef.current?.canGoBack()).toBe(false);
  });

  it('Backspace clears the most recently entered digit', () => {
    const utils = renderSecretSetup(1);
    pressDigits(utils, [1, 2, 3, 4]);
    act(() => {
      fireEvent.press(utils.getByLabelText('Delete digit'));
    });
    // Only three digits remain → Lock In Code does nothing.
    act(() => {
      fireEvent.press(utils.getByText('Lock In Code'));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('SecretSetup');
  });

  // Mode 3 ships with `digitsUnique: true` as of Phase 4 — the catalog
  // is now the source of truth and SecretSetup reads it directly.
  it('shows the unique-digit error for repeats and blocks Lock In', () => {
    const utils = renderSecretSetup(3);
    pressDigits(utils, [1, 1, 2, 2]);
    expect(utils.queryByText('All digits must be unique')).toBeTruthy();
    act(() => {
      fireEvent.press(utils.getByText('Lock In Code'));
    });
    // Lock In disabled — still on SecretSetup.
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('SecretSetup');
  });

  it('hides the unique-digit error when all four digits differ', () => {
    const utils = renderSecretSetup(3);
    pressDigits(utils, [3, 8, 4, 7]);
    expect(utils.queryByText('All digits must be unique')).toBeNull();
  });
});
