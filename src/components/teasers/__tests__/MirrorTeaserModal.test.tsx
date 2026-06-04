import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MirrorTeaserModal } from '../MirrorTeaserModal';
import {
  ONBOARDING_DEFAULTS,
  USER_STORE_DEFAULTS,
  useUserStore,
} from '@state/userStore';
import { stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';

const DEFAULT_INSETS = { top: 44, left: 0, right: 0, bottom: 34 };

function resetStore(): void {
  useUserStore.setState({
    ...USER_STORE_DEFAULTS,
    onboarding: { ...ONBOARDING_DEFAULTS },
    matchesCompletedSinceOnboarding: 0,
    tokens: 100,
  });
}

function renderModal(overrides: Partial<React.ComponentProps<typeof MirrorTeaserModal>> = {}) {
  const onClose = overrides.onClose ?? jest.fn();
  const onTry = overrides.onTry ?? jest.fn();
  const utils = render(
    <SafeAreaProvider
      initialMetrics={{
        insets: DEFAULT_INSETS,
        frame: { x: 0, y: 0, width: 390, height: 844 },
      }}
    >
      <MirrorTeaserModal visible={overrides.visible ?? true} onClose={onClose} onTry={onTry} />
    </SafeAreaProvider>,
  );
  return Object.assign(utils, { onClose, onTry });
}

describe('MirrorTeaserModal', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders title, body, gift line, and CTA when visible', () => {
    const utils = renderModal();
    expect(utils.getByText('Same code. Solo race.')).toBeTruthy();
    expect(
      utils.getByText('First to crack wins. Speed matters more than precision.'),
    ).toBeTruthy();
    expect(utils.getByText("Try it now — we've got 50 tokens for you.")).toBeTruthy();
    expect(utils.getByText('Try Mirror →')).toBeTruthy();
    expect(utils.getByLabelText('Skip Mirror teaser')).toBeTruthy();
  });

  it('returns null when not visible', () => {
    const utils = renderModal({ visible: false });
    expect(utils.queryByText('Same code. Solo race.')).toBeNull();
    expect(utils.queryByTestId('mirror-teaser-modal')).toBeNull();
  });

  it('renders the AI hero illustration as the sole hero visual', () => {
    const utils = renderModal();
    expect(utils.getByLabelText('Mirror mode hero illustration')).toBeTruthy();
    // CP4 removed the legacy inline split-board mockup.
    expect(utils.queryByTestId('mirror-mockup')).toBeNull();
  });

  it('Skip flips mirrorTeaserSeen and fires onClose, NO token grant or unlock', () => {
    const utils = renderModal();
    const before = useUserStore.getState();
    expect(before.onboarding.mirrorTeaserSeen).toBe(false);

    act(() => {
      fireEvent.press(utils.getByLabelText('Skip Mirror teaser'));
    });

    const after = useUserStore.getState();
    expect(after.onboarding.mirrorTeaserSeen).toBe(true);
    expect(after.tokens).toBe(before.tokens);
    expect(after.modeUnlocked[7]).toBe(false);
    expect(utils.onClose).toHaveBeenCalledTimes(1);
    expect(utils.onTry).not.toHaveBeenCalled();
  });

  it('"Try Mirror" CTA promotionally unlocks Mode 7, grants 50 tokens, flips seen, fires onTry (CP8)', () => {
    const utils = renderModal();
    const before = useUserStore.getState();
    expect(before.modeUnlocked[7]).toBe(false);

    act(() => {
      fireEvent.press(utils.getByText('Try Mirror →'));
    });

    const after = useUserStore.getState();
    expect(after.modeUnlocked[7]).toBe(true);
    expect(after.tokens).toBe(before.tokens + 50);
    expect(after.onboarding.mirrorTeaserSeen).toBe(true);
    expect(utils.onTry).toHaveBeenCalledTimes(1);
    expect(utils.onClose).not.toHaveBeenCalled();
  });

  it('"Try Mirror" is defensive — already-unlocked Mode 7 still grants 50 + fires onTry', () => {
    useUserStore.setState({ modeUnlocked: { ...USER_STORE_DEFAULTS.modeUnlocked, 7: true } });
    const utils = renderModal();
    const before = useUserStore.getState();

    act(() => {
      fireEvent.press(utils.getByText('Try Mirror →'));
    });

    const after = useUserStore.getState();
    expect(after.modeUnlocked[7]).toBe(true);
    expect(after.tokens).toBe(before.tokens + 50);
    expect(utils.onTry).toHaveBeenCalledTimes(1);
  });

  it('exposes the modal a11y semantics on the inner card', () => {
    const utils = renderModal();
    const root = utils.getByTestId('mirror-teaser-modal');
    expect(root.props.accessibilityRole).toBe('alert');
    const inner = utils.getByLabelText(
      'Same code. Solo race. First to crack wins. Speed matters more than precision.',
    );
    expect(inner.props.accessibilityViewIsModal).toBe(true);
  });

  it('Skip is reachable while the modal is up', () => {
    const utils = renderModal();
    expect(utils.getByLabelText('Skip Mirror teaser')).toBeTruthy();
  });

  it('matches the visible-state snapshot', () => {
    const utils = renderModal();
    expect(stableTreeForSnapshot(utils.toJSON() as never)).toMatchSnapshot();
  });
});
