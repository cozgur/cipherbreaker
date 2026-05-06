import { Alert } from 'react-native';
import { act, fireEvent } from '@testing-library/react-native';

import { __resetMockUserForTests, mockUser } from '@data/mockUser';
import type { MatchResultOutcome } from '@navigation/routes';
import { useUserStore, USER_STORE_DEFAULTS } from '@state/userStore';
import { ProfileScreen } from '../ProfileScreen';
import { ChangeUsernameModal } from '../ChangeUsernameModal';
import { RouteStubScreen } from '@/test-utils/RouteStubScreen';
import { renderWithNavigation, stableTreeForSnapshot } from '@/test-utils/renderWithNavigation';

function setRecentMatches(recent: readonly MatchResultOutcome[]): void {
  useUserStore.setState({
    stats: { ...USER_STORE_DEFAULTS.stats, recentMatches: recent },
  });
}

describe('ProfileScreen', () => {
  beforeEach(() => {
    __resetMockUserForTests();
  });

  it('snapshots the profile layout', () => {
    const { toJSON } = renderWithNavigation('Profile', {
      Profile: ProfileScreen,
    });
    expect(stableTreeForSnapshot(toJSON())).toMatchSnapshot();
  });

  it('shows lifetime stats from the mock user', () => {
    // Phase 7A.6 CP3.1 — fresh-install defaults zeroed. A new user
    // sees 0 across the lifetime grid; previously the Phase 1B
    // mock fixture inflated to 247 / 68% / 12.4K.
    const { getAllByText } = renderWithNavigation('Profile', { Profile: ProfileScreen });
    // Multiple cells render '0' (Games, Streak, Best, Tokens
    // Earned, Avg Turns) — assert there are at least the expected
    // zeroed stats present.
    expect(getAllByText('0').length).toBeGreaterThanOrEqual(4);
    expect(getAllByText('0%').length).toBeGreaterThanOrEqual(1);
  });

  it('lists per-mode win rate for all seven modes', () => {
    const { getAllByText } = renderWithNavigation('Profile', { Profile: ProfileScreen });
    // The "%" suffix is enough to count win-rate cells.
    expect(getAllByText(/\d+%/).length).toBeGreaterThanOrEqual(7);
  });

  describe('Stats / Settings tab toggle', () => {
    it('defaults to the Stats tab — lifetime grid is visible, settings list is not', () => {
      const utils = renderWithNavigation('Profile', { Profile: ProfileScreen });
      expect(utils.getByText('Games Played')).toBeTruthy(); // lifetime games stat
      expect(utils.queryByText('Privacy Policy')).toBeNull();
      expect(utils.queryByText('Terms of Service')).toBeNull();
    });

    it('switching to Settings shows the settings list and hides the stats grid', () => {
      const utils = renderWithNavigation('Profile', { Profile: ProfileScreen });
      act(() => {
        fireEvent.press(utils.getByLabelText('Settings'));
      });
      expect(utils.getByText('Privacy Policy')).toBeTruthy();
      expect(utils.getByText('Terms of Service')).toBeTruthy();
      expect(utils.queryByText('Games Played')).toBeNull(); // lifetime games stat hidden
    });

    it('switching back to Stats restores the stats grid', () => {
      const utils = renderWithNavigation('Profile', { Profile: ProfileScreen });
      act(() => {
        fireEvent.press(utils.getByLabelText('Settings'));
      });
      expect(utils.queryByText('Games Played')).toBeNull();
      act(() => {
        fireEvent.press(utils.getByLabelText('Stats'));
      });
      expect(utils.getByText('Games Played')).toBeTruthy();
    });

    it('exposes the segmented control as a tablist with two tabs', () => {
      const utils = renderWithNavigation('Profile', { Profile: ProfileScreen });
      const tabs = utils.getAllByRole('tab');
      expect(tabs).toHaveLength(2);
      expect(utils.getByLabelText('Stats').props.accessibilityState.selected).toBe(true);
      expect(utils.getByLabelText('Settings').props.accessibilityState.selected).toBe(false);
    });
  });

  describe('Recent matches strip', () => {
    it('renders 10 cells regardless of how many outcomes the player has', () => {
      // Default fixture has `recentMatches: []`; strip should still show 10 slots.
      const utils = renderWithNavigation('Profile', { Profile: ProfileScreen });
      const cells = utils
        .getAllByLabelText(/^Match \d+: /)
        .filter((node) => node.props.accessibilityLabel?.includes('Match '));
      expect(cells).toHaveLength(10);
    });

    it('reads "No matches yet" when the window is empty', () => {
      setRecentMatches([]);
      const utils = renderWithNavigation('Profile', { Profile: ProfileScreen });
      expect(utils.getByText('No matches yet')).toBeTruthy();
    });

    it('captions "Last 3 — 2 wins" for a 2V/1D window and pluralises correctly', () => {
      setRecentMatches(['victory', 'defeat', 'victory']);
      const utils = renderWithNavigation('Profile', { Profile: ProfileScreen });
      expect(utils.getByText('Last 3 — 2 wins')).toBeTruthy();
    });

    it('captions "Last 1 — 1 win" (singular) for a single-victory window', () => {
      setRecentMatches(['victory']);
      const utils = renderWithNavigation('Profile', { Profile: ProfileScreen });
      expect(utils.getByText('Last 1 — 1 win')).toBeTruthy();
    });

    it('marks each outcome with an a11y label that includes the outcome string', () => {
      setRecentMatches(['victory', 'defeat', 'draw', 'stalemate']);
      const utils = renderWithNavigation('Profile', { Profile: ProfileScreen });
      // Slots 7..10 (the trailing four) should carry the supplied outcomes.
      expect(utils.getByLabelText('Match 7: victory')).toBeTruthy();
      expect(utils.getByLabelText('Match 8: defeat')).toBeTruthy();
      expect(utils.getByLabelText('Match 9: draw')).toBeTruthy();
      expect(utils.getByLabelText('Match 10: stalemate')).toBeTruthy();
      // Leading slots stay empty.
      expect(utils.getByLabelText('Match 1: empty slot')).toBeTruthy();
    });
  });

  describe('Per-mode trend caret', () => {
    it('suppresses trend carets when lifetime sample is too small (<21 games)', () => {
      useUserStore.setState({
        stats: { ...USER_STORE_DEFAULTS.stats, gamesPlayed: 14, winRate: 50 },
      });
      const utils = renderWithNavigation('Profile', { Profile: ProfileScreen });
      // No trend SVG should be visible — direction labels are absent.
      expect(utils.queryAllByLabelText('trend up')).toHaveLength(0);
      expect(utils.queryAllByLabelText('trend down')).toHaveLength(0);
    });

    it('surfaces ▲ for modes whose win rate is at least 5pts above lifetime', () => {
      // Default fixture: lifetime winRate 68; perMode 1 = 72 (delta +4 → no caret),
      // mode 4 = 55 (delta -13 → ▼), mode 5 = 49 (delta -19 → ▼). Override one
      // mode high enough to clear the +5 threshold.
      useUserStore.setState({
        stats: { ...USER_STORE_DEFAULTS.stats, gamesPlayed: 100, winRate: 50 },
        perMode: { ...USER_STORE_DEFAULTS.perMode, 1: { winRate: 80 } },
      });
      const utils = renderWithNavigation('Profile', { Profile: ProfileScreen });
      expect(utils.queryAllByLabelText('trend up').length).toBeGreaterThanOrEqual(1);
    });

    it('surfaces ▼ for modes whose win rate is at least 5pts below lifetime', () => {
      useUserStore.setState({
        stats: { ...USER_STORE_DEFAULTS.stats, gamesPlayed: 100, winRate: 80 },
      });
      const utils = renderWithNavigation('Profile', { Profile: ProfileScreen });
      // Multiple modes default below 75 (80 - 5) → multiple down carets.
      expect(utils.queryAllByLabelText('trend down').length).toBeGreaterThanOrEqual(1);
    });

    it('shows neither caret when the mode rate is inside ±5 of lifetime', () => {
      useUserStore.setState({
        stats: { ...USER_STORE_DEFAULTS.stats, gamesPlayed: 100, winRate: 50 },
        perMode: {
          1: { winRate: 50 },
          2: { winRate: 51 },
          3: { winRate: 49 },
          4: { winRate: 54 },
          5: { winRate: 46 },
          6: { winRate: 50 },
          7: { winRate: 50 },
        },
      });
      const utils = renderWithNavigation('Profile', { Profile: ProfileScreen });
      expect(utils.queryAllByLabelText('trend up')).toHaveLength(0);
      expect(utils.queryAllByLabelText('trend down')).toHaveLength(0);
    });
  });

  describe('Admin · DEV — reset play stats', () => {
    it('admin row is visible inside Settings tab (DEV-only — __DEV__ is true in jest)', () => {
      const utils = renderWithNavigation('Profile', { Profile: ProfileScreen });
      act(() => {
        fireEvent.press(utils.getByLabelText('Settings'));
      });
      expect(utils.getByText('ADMIN · DEV')).toBeTruthy();
      expect(utils.getByLabelText('Reset Play Stats')).toBeTruthy();
    });

    it('confirmation flow zeroes stats + perMode + dailyChallenge', () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
        // Auto-press the destructive "Reset" button on the alert
        // dialog to exercise the action without a real prompt.
        const reset = buttons?.find((b) => b.text === 'Reset');
        reset?.onPress?.();
      });

      // Seed real-looking state.
      useUserStore.setState({
        stats: {
          ...USER_STORE_DEFAULTS.stats,
          gamesPlayed: 30,
          winRate: 60,
          recentMatches: ['victory'],
        },
        perMode: { 1: { winRate: 70 } } as typeof USER_STORE_DEFAULTS.perMode,
      });

      const utils = renderWithNavigation('Profile', { Profile: ProfileScreen });
      act(() => {
        fireEvent.press(utils.getByLabelText('Settings'));
      });
      act(() => {
        fireEvent.press(utils.getByLabelText('Reset Play Stats'));
      });

      const next = useUserStore.getState();
      expect(next.stats.gamesPlayed).toBe(0);
      expect(next.stats.winRate).toBe(0);
      expect(next.stats.recentMatches).toEqual([]);
      expect(next.perMode[1]).toEqual({ winRate: 0 });
      // Tokens / level untouched.
      expect(next.tokens).toBe(USER_STORE_DEFAULTS.tokens);
      expect(next.level).toBe(USER_STORE_DEFAULTS.level);

      alertSpy.mockRestore();
    });
  });

  describe('Settings interactions (still work after tab switch)', () => {
    it('toggles the Sound setting in place', () => {
      const utils = renderWithNavigation('Profile', { Profile: ProfileScreen });
      act(() => {
        fireEvent.press(utils.getByLabelText('Settings'));
      });
      expect(mockUser.settings.sound).toBe(true);
      act(() => {
        fireEvent.press(utils.getByLabelText('Sound'));
      });
      expect(mockUser.settings.sound).toBe(false);
    });

    it('Change Username row opens the ChangeUsername route', () => {
      const utils = renderWithNavigation('Profile', {
        Profile: ProfileScreen,
        ChangeUsername: ChangeUsernameModal,
      });
      // The username pencil-row at the top of the screen always works
      // regardless of tab. Use the avatar-adjacent affordance.
      act(() => {
        fireEvent.press(utils.getByLabelText('Change username'));
      });
      expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('ChangeUsername');
    });

    it('TokenBadge opens Shop', () => {
      const utils = renderWithNavigation('Profile', {
        Profile: ProfileScreen,
        Shop: RouteStubScreen,
      });
      act(() => {
        fireEvent.press(utils.getByLabelText('Open shop'));
      });
      expect(utils.navRef.current?.getCurrentRoute()?.name).toBe('Shop');
    });
  });
});
