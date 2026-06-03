/**
 * Cross-screen integration flows for Phase 1B Checkpoint 2. Each test
 * spins up a slice of the real navigator (no stubs for screens under
 * test) so that `replace`, `popToTop`, and `goBack` semantics are
 * exercised end-to-end.
 */

import { act, fireEvent } from '@testing-library/react-native';

import { __resetMockUserForTests, mockUser } from '@data/mockUser';
import { useUserStore } from '@state/userStore';
import { AdWatchScreen } from '@screens/AdWatchScreen';
import { HomeScreen } from '@screens/HomeScreen';
import { InsufficientTokensModal } from '@screens/InsufficientTokensModal';
import { MatchmakingScreen } from '@screens/MatchmakingScreen';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';
import { SecretSetupScreen } from '@screens/SecretSetupScreen';
import { ShopScreen } from '@screens/ShopScreen';
import { renderWithNavigation } from '@/test-utils/renderWithNavigation';

const fullStack = {
  Home: HomeScreen,
  Matchmaking: MatchmakingScreen,
  SecretSetup: SecretSetupScreen,
  Match: RouteStubScreen,
  Shop: ShopScreen,
  AdWatch: AdWatchScreen,
  InsufficientTokens: InsufficientTokensModal,
};

describe('CP2 flows', () => {
  beforeEach(() => {
    __resetMockUserForTests();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  // 1
  it('Home with zero tokens routes a mode tap to InsufficientTokens', () => {
    mockUser.tokens = 0;
    const utils = renderWithNavigation('Home', fullStack);
    act(() => {
      fireEvent.press(utils.getByLabelText('COLOR MATCH — 50 tokens'));
    });
    const current = utils.navRef.current?.getCurrentRoute();
    expect(current?.name).toBe('InsufficientTokens');
    expect(current?.params).toEqual({ modeId: 1 });
  });

  // 2
  // Phase 7A.5 CP5 reshape — AdWatchScreen now `goBack`s on
  // completion (was `popToTop`) so the InsufficientTokensModal
  // re-evaluates the now-credited balance against the stake. The
  // user can either play (now affordable) or Cancel out to Home.
  it('InsufficientTokens → Watch ad → countdown 0 → returns to modal with +50 tokens', () => {
    mockUser.tokens = 0;
    jest.useFakeTimers();

    const utils = renderWithNavigation('Home', fullStack);

    act(() => {
      fireEvent.press(utils.getByLabelText('COLOR MATCH — 50 tokens'));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('InsufficientTokens');

    act(() => {
      fireEvent.press(utils.getByText('Watch ad · +50'));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('AdWatch');

    // 5-second auto-complete now fires `goBack`, returning to the
    // underlying modal. The wallet credit goes through
    // `watchAdAction(today)` (CP5 rewire), which also stamps the
    // ad-cap counters atomically.
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockUser.tokens).toBe(50);
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('InsufficientTokens');
    // Modal re-evaluates: wallet now exactly matches the 50-token
    // Mode 1 stake, so the body text reflects the new balance.
    expect(utils.queryByText(/You have 50 tokens\. This match costs 50\./)).toBeTruthy();
  });

  // 3
  // Phase 7A.5 CP4 reshape — the InsufficientTokens modal no
  // longer offers a "Buy tokens" path (Q6=A — Cancel returns to
  // Home; Shop is reachable from the home top-bar TokenBadge,
  // covered separately in HomeScreen.test.tsx). The flow asserted
  // here is now: tap mode → modal → Cancel → Home. The Shop modal
  // stack push/pop integration is exercised in
  // `Home → TokenBadge → Shop → close back to Home` below.
  it('InsufficientTokens → Cancel → Home', () => {
    mockUser.tokens = 0;
    const utils = renderWithNavigation('Home', fullStack);

    act(() => {
      fireEvent.press(utils.getByLabelText('COLOR MATCH — 50 tokens'));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('InsufficientTokens');

    act(() => {
      fireEvent.press(utils.getByText('Cancel'));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Home');
  });

  // 3b — Phase 7A.5 CP4 — Shop integration through the home
  // TokenBadge. Replaces the old InsufficientTokens → Buy tokens
  // path (CP4 dropped that affordance from the modal).
  it('Home → TokenBadge → Shop → close back to Home', () => {
    const utils = renderWithNavigation('Home', fullStack);

    act(() => {
      fireEvent.press(utils.getByLabelText('Open shop'));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Shop');

    act(() => {
      fireEvent.press(utils.getByLabelText('Close shop'));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Home');
  });

  // 4
  it('Home → Matchmaking → SecretSetup full flow when stake is covered', () => {
    mockUser.tokens = 1000;
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    const utils = renderWithNavigation('Home', fullStack);
    act(() => {
      fireEvent.press(utils.getByLabelText('COLOR MATCH — 50 tokens'));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Matchmaking');

    // Search 6000ms (random=0.5 -> r<0.6 branch), then 1000ms reveal → SecretSetup.
    act(() => {
      jest.advanceTimersByTime(6000);
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('SecretSetup');
  });

  // 5
  it('SecretSetup → 4 digits + Lock In → Match (replace, no back)', () => {
    mockUser.tokens = 1000;
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    const utils = renderWithNavigation('Home', fullStack);
    act(() => {
      fireEvent.press(utils.getByLabelText('COLOR MATCH — 50 tokens'));
    });
    act(() => {
      jest.advanceTimersByTime(6000);
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('SecretSetup');

    for (const digit of [3, 8, 4, 7]) {
      act(() => {
        fireEvent.press(utils.getByLabelText(String(digit)));
      });
    }
    act(() => {
      fireEvent.press(utils.getByText('Lock In Code'));
    });

    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Match');
    // SecretSetup was replaced — Matchmaking + SecretSetup gone from
    // the stack. Going back lands on Home (the entry route).
    expect(utils.navRef.current?.canGoBack()).toBe(true);
    act(() => {
      utils.navRef.current?.goBack();
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Home');
  });

  // 6
  it('Mode 3 SecretSetup shows the unique-digit error and blocks Lock In', () => {
    // Mode 3 ships with `digitsUnique: true` as of Phase 4 — the catalog
    // is canonical, no per-test patch needed.
    mockUser.tokens = 1000;
    // Phase 7A.7 CP7 — HomeScreen now intercepts Mode 2-7 taps
    // when the per-mode tutorial hasn't been seen, routing to
    // ModeTutorial first. This test predates that interception
    // and isolates the SecretSetup unique-digit flow, so we
    // pre-seed the seen flag to bypass the tutorial gate.
    // Mode 3 must be unlocked (CP7 unlock gate) and tutorial-seen to
    // reach SecretSetup directly.
    useUserStore.setState({ modeTutorialsSeen: { 3: true }, modeUnlocked: { 1: true, 3: true } });
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    const utils = renderWithNavigation('Home', fullStack);
    act(() => {
      fireEvent.press(utils.getByLabelText('PRECISION — 50 tokens'));
    });
    act(() => {
      jest.advanceTimersByTime(6000);
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('SecretSetup');

    for (const digit of [1, 1, 2, 2]) {
      act(() => {
        fireEvent.press(utils.getByLabelText(String(digit)));
      });
    }

    expect(utils.queryByText('All digits must be unique')).toBeTruthy();
    act(() => {
      fireEvent.press(utils.getByText('Lock In Code'));
    });
    // Lock In was disabled → still on SecretSetup.
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('SecretSetup');
  });
});
