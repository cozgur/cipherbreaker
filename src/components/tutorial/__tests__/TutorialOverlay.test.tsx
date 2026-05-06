import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TutorialOverlay } from '../TutorialOverlay';
import { stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';

const DEFAULT_INSETS = { top: 44, left: 0, right: 0, bottom: 34 };

function renderOverlay(props: Partial<React.ComponentProps<typeof TutorialOverlay>> = {}) {
  const onDismiss = props.onDismiss ?? jest.fn();
  const utils = render(
    <SafeAreaProvider
      initialMetrics={{ insets: DEFAULT_INSETS, frame: { x: 0, y: 0, width: 390, height: 844 } }}
    >
      <TutorialOverlay
        visible={props.visible ?? true}
        title={props.title ?? 'Crack the code'}
        body={props.body ?? '4 digits. 0–9. 10 guesses.'}
        ctaLabel={props.ctaLabel ?? 'Start →'}
        onDismiss={onDismiss}
        testID={props.testID ?? 'overlay'}
      />
    </SafeAreaProvider>,
  );
  return Object.assign(utils, { onDismiss });
}

describe('TutorialOverlay', () => {
  it('renders title, body, and CTA when visible', () => {
    const utils = renderOverlay();
    expect(utils.getByText('Crack the code')).toBeTruthy();
    expect(utils.getByText('4 digits. 0–9. 10 guesses.')).toBeTruthy();
    expect(utils.getByText('Start →')).toBeTruthy();
  });

  it('returns null when not visible', () => {
    const utils = renderOverlay({ visible: false });
    expect(utils.queryByText('Crack the code')).toBeNull();
  });

  it('CTA press fires onDismiss', () => {
    const utils = renderOverlay();
    fireEvent.press(utils.getByText('Start →'));
    expect(utils.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('exposes the modal a11y semantics so screen readers treat it as a dialog', () => {
    const utils = renderOverlay();
    const root = utils.getByTestId('overlay');
    expect(root.props.accessibilityRole).toBe('alert');
    // accessibilityViewIsModal lives on the inner sheet (not the outer
    // wrapper) so sibling chrome (the Skip button) stays queryable in
    // testing-library v13+. The sheet carries the visible label.
    const sheet = utils.getByLabelText('Crack the code. 4 digits. 0–9. 10 guesses.');
    expect(sheet.props.accessibilityViewIsModal).toBe(true);
  });

  it('matches the visible-state snapshot', () => {
    const utils = renderOverlay({ testID: 'snap' });
    expect(stableTreeForSnapshot(utils.toJSON() as never)).toMatchSnapshot();
  });
});
