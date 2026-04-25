/**
 * Cross-screen integration flows for Phase 1B Checkpoint 2. Each test
 * spins up a slice of the real navigator (no stubs for screens under
 * test) so that `replace`, `popToTop`, and `goBack` semantics are
 * exercised end-to-end.
 */

import { act, fireEvent } from '@testing-library/react-native';

import { modeCatalog } from '@data/modeCatalog';
import { __resetMockUserForTests, mockUser } from '@data/mockUser';
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
  it('InsufficientTokens → Watch ad → countdown 0 → popToTop to Home with +50 tokens', () => {
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

    // 5-second auto-complete fires popToTop.
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockUser.tokens).toBe(50);
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Home');
  });

  // 3
  it('InsufficientTokens → Buy tokens → Shop → close back to Home', () => {
    mockUser.tokens = 0;
    const utils = renderWithNavigation('Home', fullStack);

    act(() => {
      fireEvent.press(utils.getByLabelText('COLOR MATCH — 50 tokens'));
    });
    act(() => {
      fireEvent.press(utils.getByText('Buy tokens'));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Shop');

    // Close shop returns to InsufficientTokens (still on the stack).
    act(() => {
      fireEvent.press(utils.getByLabelText('Close shop'));
    });
    expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('InsufficientTokens');

    // Close modal lands back on Home.
    act(() => {
      fireEvent.press(utils.getByLabelText('Close'));
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

    // Search 2700ms, then 1000ms reveal → SecretSetup.
    act(() => {
      jest.advanceTimersByTime(2700);
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
      jest.advanceTimersByTime(2700);
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
    // Force Mode 3's digitsUnique on for this assertion (Phase 1B
    // catalog still ships it false; Phase 2 makes it canonical).
    const mode3Rules = modeCatalog[2]?.rules as { digitsUnique: boolean } | undefined;
    if (mode3Rules == null) throw new Error('mode 3 missing from catalog');
    const original = mode3Rules.digitsUnique;
    mode3Rules.digitsUnique = true;

    try {
      mockUser.tokens = 1000;
      jest.useFakeTimers();
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const utils = renderWithNavigation('Home', fullStack);
      act(() => {
        fireEvent.press(utils.getByLabelText('PRECISION — 50 tokens'));
      });
      act(() => {
        jest.advanceTimersByTime(2700);
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
    } finally {
      mode3Rules.digitsUnique = original;
    }
  });
});
