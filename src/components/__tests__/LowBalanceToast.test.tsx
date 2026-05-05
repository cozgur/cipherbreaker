/**
 * Phase 7A.5 CP4 — LowBalanceToast smoke + interaction suite.
 *
 * The component is presentational — visibility / dismiss state is
 * owned by the parent (HomeScreen). These tests pin the action
 * callbacks and the accessibility surface; HomeScreen-level
 * visibility is exercised in `HomeScreen.test.tsx`.
 */

import { act, fireEvent } from '@testing-library/react-native';
import { render } from '@testing-library/react-native';

import { LowBalanceToast } from '../LowBalanceToast';

describe('LowBalanceToast', () => {
  it('renders the headline + sub copy', () => {
    const utils = render(
      <LowBalanceToast onWatchAd={() => undefined} onDismiss={() => undefined} />,
    );
    expect(utils.queryByText('Low on tokens?')).toBeTruthy();
    expect(utils.queryByText('Watch a quick ad to earn 50.')).toBeTruthy();
  });

  it('Watch Ad CTA fires the onWatchAd callback', () => {
    const onWatchAd = jest.fn();
    const utils = render(
      <LowBalanceToast onWatchAd={onWatchAd} onDismiss={() => undefined} />,
    );
    act(() => {
      fireEvent.press(utils.getByLabelText('Watch ad'));
    });
    expect(onWatchAd).toHaveBeenCalledTimes(1);
  });

  it('close (X) chip fires the onDismiss callback', () => {
    const onDismiss = jest.fn();
    const utils = render(
      <LowBalanceToast onWatchAd={() => undefined} onDismiss={onDismiss} />,
    );
    act(() => {
      fireEvent.press(utils.getByLabelText('Dismiss low balance toast'));
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('the toast surface itself carries the "Low balance" alert role', () => {
    const utils = render(
      <LowBalanceToast onWatchAd={() => undefined} onDismiss={() => undefined} />,
    );
    expect(utils.getByLabelText('Low balance')).toBeTruthy();
  });
});
