import { act, fireEvent } from '@testing-library/react-native';

import { USER_STORE_DEFAULTS, useUserStore } from '@state/userStore';
import { UnlockModal } from '../UnlockModal';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';
import { renderWithNavigation } from '@/test-utils/renderWithNavigation';

// Render with Home as the root so Cancel/goBack has somewhere to land,
// then push the Unlock modal with the given modeId.
function renderUnlock(modeId: number) {
  const utils = renderWithNavigation('Home', {
    Home: RouteStubScreen,
    Unlock: UnlockModal,
    ModeTutorial: RouteStubScreen,
    Matchmaking: RouteStubScreen,
    InsufficientTokens: RouteStubScreen,
  });
  act(() => {
    utils.navRef.current?.navigate('Unlock', { modeId });
  });
  return utils;
}

function route(utils: ReturnType<typeof renderUnlock>) {
  return utils.navRef.current?.getCurrentRoute();
}

describe('UnlockModal', () => {
  beforeEach(() => {
    // Fresh defaults (Mode 2-7 locked), then per-test token overrides.
    useUserStore.setState({
      ...USER_STORE_DEFAULTS,
      modeUnlocked: { ...USER_STORE_DEFAULTS.modeUnlocked },
      modeTutorialsSeen: {},
    });
  });

  it('renders the mode name, cost chip, and current balance', () => {
    useUserStore.setState({ tokens: 500 });
    const utils = renderUnlock(2); // HIGH & LOW, cost 300

    expect(utils.getByText('HIGH & LOW')).toBeTruthy();
    expect(utils.getByText('300 TOKENS')).toBeTruthy();
    expect(utils.getByText('You have 500 tokens')).toBeTruthy();
  });

  it('shows an enabled UNLOCK button when the balance covers the cost', () => {
    useUserStore.setState({ tokens: 500 });
    const utils = renderUnlock(2); // cost 300
    expect(utils.getByText('Unlock')).toBeTruthy();
    // The shortfall CTA is not present.
    expect(utils.queryByText(/more tokens/)).toBeNull();
  });

  it('shows "Need Y more tokens" when the balance is short', () => {
    useUserStore.setState({ tokens: 100 });
    const utils = renderUnlock(2); // cost 300 → short by 200
    expect(utils.getByText('Need 200 more tokens')).toBeTruthy();
    expect(utils.queryByText('Unlock')).toBeNull();
  });

  it('UNLOCK debits the cost, flips the unlock flag, and routes onward', () => {
    useUserStore.setState({ tokens: 1000, modeTutorialsSeen: { 2: true } });
    const utils = renderUnlock(2); // cost 300, tutorial seen

    act(() => {
      fireEvent.press(utils.getByText('Unlock'));
    });

    const state = useUserStore.getState();
    expect(state.tokens).toBe(700);
    expect(state.modeUnlocked[2]).toBe(true);
    // Tutorial already seen → straight to Matchmaking.
    expect(route(utils)?.name).toBe('Matchmaking');
    expect(route(utils)?.params).toEqual({ modeId: 2 });
  });

  it('post-unlock with an unseen tutorial routes to ModeTutorial', () => {
    useUserStore.setState({ tokens: 1000, modeTutorialsSeen: {} });
    const utils = renderUnlock(3); // cost 500, tutorial unseen

    act(() => {
      fireEvent.press(utils.getByText('Unlock'));
    });

    expect(useUserStore.getState().modeUnlocked[3]).toBe(true);
    expect(route(utils)?.name).toBe('ModeTutorial');
    expect(route(utils)?.params).toEqual({ modeId: 3 });
  });

  it('post-unlock with a seen tutorial routes to Matchmaking', () => {
    useUserStore.setState({ tokens: 5000, modeTutorialsSeen: { 7: true } });
    const utils = renderUnlock(7); // cost 2000, tutorial seen

    act(() => {
      fireEvent.press(utils.getByText('Unlock'));
    });

    expect(route(utils)?.name).toBe('Matchmaking');
    expect(route(utils)?.params).toEqual({ modeId: 7 });
  });

  it('post-unlock with enough for the cost but not the stake routes to InsufficientTokens', () => {
    // 320 tokens: covers Mode 2 unlock cost (300) but leaves 20 <
    // stake (50). The auto-flow must re-check the stake and divert to
    // InsufficientTokens rather than routing into an unaffordable
    // match (createMatch would otherwise clamp the debit at zero).
    useUserStore.setState({ tokens: 320, modeTutorialsSeen: { 2: true } });
    const utils = renderUnlock(2);

    act(() => {
      fireEvent.press(utils.getByText('Unlock'));
    });

    // Unlock still happened (cost spent, flag flipped) …
    const state = useUserStore.getState();
    expect(state.tokens).toBe(20);
    expect(state.modeUnlocked[2]).toBe(true);
    // … but the match is gated behind the stake balance.
    expect(route(utils)?.name).toBe('InsufficientTokens');
    expect(route(utils)?.params).toEqual({ modeId: 2 });
  });

  it('Cancel closes the modal without unlocking or navigating onward', () => {
    useUserStore.setState({ tokens: 1000 });
    const utils = renderUnlock(2);

    act(() => {
      fireEvent.press(utils.getByText('Cancel'));
    });

    // Back to Home; nothing spent, nothing unlocked.
    expect(route(utils)?.name).toBe('Home');
    expect(useUserStore.getState().tokens).toBe(1000);
    expect(useUserStore.getState().modeUnlocked[2]).toBe(false);
  });

  it('"Need Y more tokens" routes to the existing InsufficientTokens modal', () => {
    useUserStore.setState({ tokens: 100 });
    const utils = renderUnlock(2); // cost 300

    act(() => {
      fireEvent.press(utils.getByText('Need 200 more tokens'));
    });

    expect(route(utils)?.name).toBe('InsufficientTokens');
    expect(route(utils)?.params).toEqual({ modeId: 2 });
    // No unlock happened.
    expect(useUserStore.getState().modeUnlocked[2]).toBe(false);
  });
});
