/**
 * Phase 7A.8 CP3 — `variant` prop on TutorialToast.
 *
 * Tutorial variant preserves Phase 7A.6 CP3 behaviour (passive
 * render, no internal timer). JIT variant owns its own lifecycle:
 * 5s auto-dismiss + tap-anywhere onDismiss + filled gold styling
 * with no "TUTORIAL" pill.
 */

import { StyleSheet, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TutorialToast } from '../TutorialToast';

const DEFAULT_INSETS = { top: 44, left: 0, right: 0, bottom: 34 };

function renderToast(props: Partial<React.ComponentProps<typeof TutorialToast>> = {}) {
  return render(
    <SafeAreaProvider
      initialMetrics={{ insets: DEFAULT_INSETS, frame: { x: 0, y: 0, width: 390, height: 844 } }}
    >
      <TutorialToast
        visible={props.visible ?? true}
        message={props.message ?? 'Default message'}
        badge={props.badge}
        variant={props.variant}
        icon={props.icon}
        onDismiss={props.onDismiss}
        testID={props.testID ?? 'toast'}
      />
    </SafeAreaProvider>,
  );
}

describe('TutorialToast — variant prop', () => {
  describe("default variant ('tutorial')", () => {
    it('renders with the existing tutorial styling (badge pill visible when supplied)', () => {
      const utils = renderToast({ badge: 'Tutorial', message: 'Tap a peg.' });
      expect(utils.getByText('Tutorial')).toBeTruthy();
      expect(utils.getByText('Tap a peg.')).toBeTruthy();
    });

    it('anchors to the top (insets.top + 56) — preserves Phase 7A.6 placement', () => {
      const utils = renderToast({ message: 'Tap a peg.' });
      const root = utils.getByTestId('toast');
      const flat = StyleSheet.flatten(root.props.style);
      expect(flat.top).toBe(DEFAULT_INSETS.top + 56);
      expect(flat.bottom).toBeUndefined();
    });

    it('does NOT auto-dismiss when no variant is set (legacy passive behaviour)', () => {
      jest.useFakeTimers();
      const onDismiss = jest.fn();
      renderToast({ message: 'Hey', onDismiss });
      act(() => {
        jest.advanceTimersByTime(10_000);
      });
      expect(onDismiss).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe("variant='jit'", () => {
    it('anchors to the bottom (insets.bottom + 96), clearing trigger-screen CTAs', () => {
      const utils = renderToast({ variant: 'jit', message: 'Bottom anchored.' });
      const root = utils.getByTestId('toast');
      const flat = StyleSheet.flatten(root.props.style);
      expect(flat.bottom).toBe(DEFAULT_INSETS.bottom + 96);
      expect(flat.top).toBeUndefined();
    });

    it('renders message without the TUTORIAL badge pill', () => {
      const utils = renderToast({
        variant: 'jit',
        badge: 'Tutorial', // should be ignored in JIT
        message: 'Tokens earned by winning.',
      });
      expect(utils.queryByText('Tutorial')).toBeNull();
      expect(utils.getByText('Tokens earned by winning.')).toBeTruthy();
    });

    it('renders the optional leading icon', () => {
      const utils = renderToast({
        variant: 'jit',
        icon: <Text testID="jit-icon">★</Text>,
      });
      expect(utils.getByTestId('jit-icon')).toBeTruthy();
    });

    it('auto-dismisses after 5s', () => {
      jest.useFakeTimers();
      const onDismiss = jest.fn();
      renderToast({ variant: 'jit', onDismiss });
      expect(onDismiss).not.toHaveBeenCalled();
      act(() => {
        jest.advanceTimersByTime(4_999);
      });
      expect(onDismiss).not.toHaveBeenCalled();
      act(() => {
        jest.advanceTimersByTime(2);
      });
      expect(onDismiss).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });

    it('tap-anywhere fires onDismiss', () => {
      const onDismiss = jest.fn();
      const utils = renderToast({
        variant: 'jit',
        onDismiss,
        testID: 'jit-toast',
      });
      // The Pressable wraps the bubble content; pressing the bubble
      // (which contains the message text) walks up to the handler.
      fireEvent.press(utils.getByText('Default message'));
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('does not fire onDismiss when visible flips false (parent-driven hide)', () => {
      // Parent-driven dismiss (e.g. queue advance) shouldn't double-
      // count onto onDismiss — that path is the consumer of the
      // user dismissing, not a separate event.
      jest.useFakeTimers();
      const onDismiss = jest.fn();
      const utils = renderToast({ variant: 'jit', onDismiss });
      utils.rerender(
        <SafeAreaProvider
          initialMetrics={{
            insets: DEFAULT_INSETS,
            frame: { x: 0, y: 0, width: 390, height: 844 },
          }}
        >
          <TutorialToast
            visible={false}
            variant="jit"
            message="Default message"
            onDismiss={onDismiss}
          />
        </SafeAreaProvider>,
      );
      act(() => {
        jest.advanceTimersByTime(10_000);
      });
      expect(onDismiss).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });
});
