import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

import { NotificationOptInModal } from '../NotificationOptInModal';
import {
  ONBOARDING_DEFAULTS,
  USER_STORE_DEFAULTS,
  useUserStore,
} from '@state/userStore';
import { stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';

const DEFAULT_INSETS = { top: 44, left: 0, right: 0, bottom: 34 };

const requestPermissionsAsyncMock =
  Notifications.requestPermissionsAsync as jest.MockedFunction<
    typeof Notifications.requestPermissionsAsync
  >;

function resetStore(): void {
  useUserStore.setState({
    ...USER_STORE_DEFAULTS,
    onboarding: { ...ONBOARDING_DEFAULTS },
  });
}

function renderModal(overrides: Partial<React.ComponentProps<typeof NotificationOptInModal>> = {}) {
  const onClose = overrides.onClose ?? jest.fn();
  const utils = render(
    <SafeAreaProvider
      initialMetrics={{
        insets: DEFAULT_INSETS,
        frame: { x: 0, y: 0, width: 390, height: 844 },
      }}
    >
      <NotificationOptInModal visible={overrides.visible ?? true} onClose={onClose} />
    </SafeAreaProvider>,
  );
  return Object.assign(utils, { onClose });
}

describe('NotificationOptInModal', () => {
  beforeEach(() => {
    resetStore();
    requestPermissionsAsyncMock.mockReset();
    requestPermissionsAsyncMock.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    } as Awaited<ReturnType<typeof Notifications.requestPermissionsAsync>>);
  });

  it('renders title, body, CTA, and Not now affordance when visible', () => {
    const utils = renderModal();
    expect(utils.getByText("Don't miss tomorrow's Daily")).toBeTruthy();
    expect(
      utils.getByText("We'll remind you when a new Daily Challenge unlocks."),
    ).toBeTruthy();
    expect(utils.getByText('Turn on reminders')).toBeTruthy();
    expect(utils.getByLabelText('Dismiss notification opt-in')).toBeTruthy();
  });

  it('returns null when not visible', () => {
    const utils = renderModal({ visible: false });
    expect(utils.queryByText("Don't miss tomorrow's Daily")).toBeNull();
    expect(utils.queryByTestId('notification-opt-in-modal')).toBeNull();
  });

  it('renders the iOS-style notification banner mockup', () => {
    const utils = renderModal();
    expect(utils.getByTestId('notification-banner-mockup')).toBeTruthy();
    expect(utils.getByText('CipherBreaker')).toBeTruthy();
    expect(utils.getByText('✨ New Daily Challenge unlocked')).toBeTruthy();
    expect(utils.getByText('now')).toBeTruthy();
  });

  it('"Not now" flips the flag and fires onClose without requesting permission', () => {
    const utils = renderModal();
    expect(useUserStore.getState().onboarding.notificationOptInAsked).toBe(false);

    act(() => {
      fireEvent.press(utils.getByLabelText('Dismiss notification opt-in'));
    });

    expect(useUserStore.getState().onboarding.notificationOptInAsked).toBe(true);
    expect(requestPermissionsAsyncMock).not.toHaveBeenCalled();
    expect(utils.onClose).toHaveBeenCalledTimes(1);
  });

  it('"Turn on reminders" calls requestPermissionsAsync, flips flag (granted), fires onClose', async () => {
    const utils = renderModal();
    expect(useUserStore.getState().onboarding.notificationOptInAsked).toBe(false);

    await act(async () => {
      fireEvent.press(utils.getByText('Turn on reminders'));
    });

    await waitFor(() => {
      expect(requestPermissionsAsyncMock).toHaveBeenCalledTimes(1);
    });
    expect(useUserStore.getState().onboarding.notificationOptInAsked).toBe(true);
    expect(utils.onClose).toHaveBeenCalledTimes(1);
  });

  it('"Turn on reminders" still flips flag + closes when permission is denied (single-shot soft-ask)', async () => {
    requestPermissionsAsyncMock.mockResolvedValueOnce({
      status: 'denied',
      granted: false,
      canAskAgain: false,
      expires: 'never',
    } as Awaited<ReturnType<typeof Notifications.requestPermissionsAsync>>);
    const utils = renderModal();

    await act(async () => {
      fireEvent.press(utils.getByText('Turn on reminders'));
    });

    await waitFor(() => {
      expect(requestPermissionsAsyncMock).toHaveBeenCalledTimes(1);
    });
    // Even on denial, the flag flips — the soft-ask is one-shot.
    // Re-prompts after denial would feel spammy; future re-enable
    // is the (post-CP8) Settings affordance.
    expect(useUserStore.getState().onboarding.notificationOptInAsked).toBe(true);
    expect(utils.onClose).toHaveBeenCalledTimes(1);
  });

  it('"Turn on reminders" still flips flag + closes when requestPermissionsAsync throws', async () => {
    // Simulator / unsupported-platform path: expo-notifications can
    // throw. The user clicked the CTA intentionally; flipping the
    // flag avoids a re-prompt loop.
    requestPermissionsAsyncMock.mockRejectedValueOnce(new Error('simulator'));
    const utils = renderModal();

    await act(async () => {
      fireEvent.press(utils.getByText('Turn on reminders'));
    });

    await waitFor(() => {
      expect(useUserStore.getState().onboarding.notificationOptInAsked).toBe(true);
    });
    expect(utils.onClose).toHaveBeenCalledTimes(1);
  });

  it('exposes the modal a11y semantics on the inner card (per CP3 lesson)', () => {
    const utils = renderModal();
    const root = utils.getByTestId('notification-opt-in-modal');
    expect(root.props.accessibilityRole).toBe('alert');
    const inner = utils.getByLabelText(
      "Don't miss tomorrow's Daily. We'll remind you when a new Daily Challenge unlocks.",
    );
    expect(inner.props.accessibilityViewIsModal).toBe(true);
    // The Not now affordance stays queryable while the modal is up.
    expect(utils.getByLabelText('Dismiss notification opt-in')).toBeTruthy();
  });

  it('matches the visible-state snapshot', () => {
    const utils = renderModal();
    expect(stableTreeForSnapshot(utils.toJSON() as never)).toMatchSnapshot();
  });
});
