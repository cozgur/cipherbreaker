import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BlitzTeaserModal } from '../BlitzTeaserModal';
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

function renderModal(overrides: Partial<React.ComponentProps<typeof BlitzTeaserModal>> = {}) {
  const onClose = overrides.onClose ?? jest.fn();
  const utils = render(
    <SafeAreaProvider
      initialMetrics={{
        insets: DEFAULT_INSETS,
        frame: { x: 0, y: 0, width: 390, height: 844 },
      }}
    >
      <BlitzTeaserModal visible={overrides.visible ?? true} onClose={onClose} />
    </SafeAreaProvider>,
  );
  return Object.assign(utils, { onClose });
}

describe('BlitzTeaserModal', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders title, body, gift line, and CTA when visible', () => {
    const utils = renderModal();
    expect(utils.getByText('Beat the clock')).toBeTruthy();
    expect(
      utils.getByText('60 seconds. Crack the code before time runs out.'),
    ).toBeTruthy();
    expect(utils.getByText("Try it now — we'll cover your first stake.")).toBeTruthy();
    expect(utils.getByText('Try Blitz →')).toBeTruthy();
    expect(utils.getByLabelText('Skip Blitz teaser')).toBeTruthy();
  });

  it('returns null when not visible (component-level early return)', () => {
    const utils = renderModal({ visible: false });
    expect(utils.queryByText('Beat the clock')).toBeNull();
    expect(utils.queryByTestId('blitz-teaser-modal')).toBeNull();
  });

  it('renders the AI hero illustration as the sole hero visual', () => {
    const utils = renderModal();
    expect(utils.getByLabelText('Blitz mode hero illustration')).toBeTruthy();
    // CP4 removed the legacy inline clock + mini-board mockup.
    expect(utils.queryByTestId('blitz-mockup')).toBeNull();
  });

  it('Skip flips blitzTeaserSeen and fires onClose, NO token grant', () => {
    const utils = renderModal();
    const before = useUserStore.getState();
    expect(before.onboarding.blitzTeaserSeen).toBe(false);

    act(() => {
      fireEvent.press(utils.getByLabelText('Skip Blitz teaser'));
    });

    const after = useUserStore.getState();
    expect(after.onboarding.blitzTeaserSeen).toBe(true);
    // Token grant must NOT happen on skip.
    expect(after.tokens).toBe(before.tokens);
    expect(utils.onClose).toHaveBeenCalledTimes(1);
  });

  it('"Try Blitz" CTA grants 50 tokens, flips blitzTeaserSeen, fires onClose', () => {
    const utils = renderModal();
    const before = useUserStore.getState();

    act(() => {
      fireEvent.press(utils.getByText('Try Blitz →'));
    });

    const after = useUserStore.getState();
    expect(after.tokens).toBe(before.tokens + 50);
    expect(after.onboarding.blitzTeaserSeen).toBe(true);
    expect(utils.onClose).toHaveBeenCalledTimes(1);
  });

  it('exposes the modal a11y semantics on the inner card (not the outer wrapper, per CP3 lesson)', () => {
    const utils = renderModal();
    const root = utils.getByTestId('blitz-teaser-modal');
    expect(root.props.accessibilityRole).toBe('alert');
    // accessibilityViewIsModal lives on the inner sheet so siblings
    // (the floating Skip button) stay reachable in testing-library
    // queries — same fix the TutorialOverlay applied in CP3.
    const inner = utils.getByLabelText(
      'Beat the clock. 60 seconds. Crack the code before time runs out.',
    );
    expect(inner.props.accessibilityViewIsModal).toBe(true);
  });

  it('Skip is reachable while the modal is up (renders last in tree, not absorbed by backdrop)', () => {
    const utils = renderModal();
    // No throw → Skip Pressable present in the accessibility tree.
    expect(utils.getByLabelText('Skip Blitz teaser')).toBeTruthy();
  });

  it('matches the visible-state snapshot', () => {
    const utils = renderModal();
    expect(stableTreeForSnapshot(utils.toJSON() as never)).toMatchSnapshot();
  });
});
