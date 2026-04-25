/**
 * Phase 1B → Phase 2 facade. The exported `mockUser` object, the
 * `useMockUser()` hook, and the writer helpers (`grantTokens`,
 * `chargeTokens`, `setUsername`, `toggleSetting`, `markOnboarded`,
 * `__resetMockUserForTests`) keep the *exact* surface Phase 1B
 * screens and tests already depend on. Underneath every read/write
 * is now routed to `useUserStore` + `useSettingsStore`.
 *
 * Why a facade rather than a rip-and-replace:
 *   - Consumers do `mockUser.tokens = 100` (test fixtures), call
 *     `useMockUser()` (screens), and reach into `mockUser.settings.X`
 *     (Profile + reset). All of those work unchanged.
 *   - The facade is the boundary where Phase 1B's mutable mock meets
 *     Phase 2's persisted store; once Phase 7 polishes a real screen
 *     to consume `useUserStore`/`useSettingsStore` directly, the
 *     consumer can drop its `useMockUser()` import without touching
 *     siblings.
 *
 * Implementation rules:
 *   - Top-level data fields: `Object.defineProperty` getters read
 *     `useUserStore.getState()`, setters call `useUserStore.setState`.
 *     Action-named fields (`addTokens`, etc.) live on the store, not
 *     the facade.
 *   - `settings` is a sub-facade — its own object with three
 *     getter/setter pairs routing to `useSettingsStore`. Phase 1B
 *     never replaces the whole `settings` object (verified by grep
 *     before this rewrite), so no full-object setter is needed.
 *   - `stats` and `perMode` are snapshot getters; reads return the
 *     current store value, writes are unsupported (no caller).
 */

import { useMemo } from 'react';

import { SETTINGS_STORE_DEFAULTS, useSettingsStore } from '@state/settingsStore';
import { USER_STORE_DEFAULTS, useUserStore } from '@state/userStore';

// Re-export the Phase 1B types so existing consumers keep working.
export interface MockUserStats {
  readonly gamesPlayed: number;
  readonly winRate: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly avgTurns: number;
  readonly tokensEarned: number;
}

export interface MockUserSettings {
  sound: boolean;
  haptics: boolean;
  hasSeenBlitzTip: boolean;
}

export interface MockUser {
  username: string;
  tokens: number;
  level: number;
  currentXP: number;
  targetXP: number;
  hasOnboarded: boolean;
  stats: MockUserStats;
  perMode: Record<number, { winRate: number }>;
  settings: MockUserSettings;
}

// ─────────────────────────────────────────────────────────────
// settings sub-facade — nested getter/setter routing to settingsStore.
// ─────────────────────────────────────────────────────────────

const settingsFacade = {} as MockUserSettings;
Object.defineProperty(settingsFacade, 'sound', {
  enumerable: true,
  configurable: true,
  get: () => useSettingsStore.getState().sound,
  set: (value: boolean) => {
    useSettingsStore.setState({ sound: value });
  },
});
Object.defineProperty(settingsFacade, 'haptics', {
  enumerable: true,
  configurable: true,
  get: () => useSettingsStore.getState().haptics,
  set: (value: boolean) => {
    useSettingsStore.setState({ haptics: value });
  },
});
Object.defineProperty(settingsFacade, 'hasSeenBlitzTip', {
  enumerable: true,
  configurable: true,
  get: () => useSettingsStore.getState().hasSeenBlitzTip,
  set: (value: boolean) => {
    useSettingsStore.setState({ hasSeenBlitzTip: value });
  },
});

// ─────────────────────────────────────────────────────────────
// top-level facade — routes to userStore.
// ─────────────────────────────────────────────────────────────

export const mockUser = {} as MockUser;

Object.defineProperty(mockUser, 'username', {
  enumerable: true,
  configurable: true,
  get: () => useUserStore.getState().username,
  set: (value: string) => {
    useUserStore.setState({ username: value });
  },
});
Object.defineProperty(mockUser, 'tokens', {
  enumerable: true,
  configurable: true,
  get: () => useUserStore.getState().tokens,
  set: (value: number) => {
    useUserStore.setState({ tokens: value });
  },
});
Object.defineProperty(mockUser, 'level', {
  enumerable: true,
  configurable: true,
  get: () => useUserStore.getState().level,
  set: (value: number) => {
    useUserStore.setState({ level: value });
  },
});
Object.defineProperty(mockUser, 'currentXP', {
  enumerable: true,
  configurable: true,
  get: () => useUserStore.getState().currentXP,
  set: (value: number) => {
    useUserStore.setState({ currentXP: value });
  },
});
Object.defineProperty(mockUser, 'targetXP', {
  enumerable: true,
  configurable: true,
  get: () => useUserStore.getState().targetXP,
  set: (value: number) => {
    useUserStore.setState({ targetXP: value });
  },
});
Object.defineProperty(mockUser, 'hasOnboarded', {
  enumerable: true,
  configurable: true,
  get: () => useUserStore.getState().hasOnboarded,
  set: (value: boolean) => {
    useUserStore.setState({ hasOnboarded: value });
  },
});
Object.defineProperty(mockUser, 'stats', {
  enumerable: true,
  configurable: true,
  get: () => useUserStore.getState().stats,
});
Object.defineProperty(mockUser, 'perMode', {
  enumerable: true,
  configurable: true,
  get: () => useUserStore.getState().perMode,
});
Object.defineProperty(mockUser, 'settings', {
  enumerable: true,
  configurable: true,
  get: () => settingsFacade,
});

// ─────────────────────────────────────────────────────────────
// Hook — combines both stores into the Phase 1B `MockUser` shape.
// ─────────────────────────────────────────────────────────────

/**
 * `useMockUser` — every screen that read the Phase 1B mock keeps
 * working. Subscribes to *both* stores so a settings toggle still
 * triggers a re-render in components that key off `mockUser`.
 */
export function useMockUser(): MockUser {
  const userState = useUserStore();
  const settingsState = useSettingsStore();
  // useMemo keeps reference stable across re-renders that don't
  // change either slice — important for downstream useEffect deps.
  return useMemo<MockUser>(
    () => ({
      username: userState.username,
      tokens: userState.tokens,
      level: userState.level,
      currentXP: userState.currentXP,
      targetXP: userState.targetXP,
      hasOnboarded: userState.hasOnboarded,
      stats: userState.stats,
      perMode: userState.perMode as Record<number, { winRate: number }>,
      settings: {
        sound: settingsState.sound,
        haptics: settingsState.haptics,
        hasSeenBlitzTip: settingsState.hasSeenBlitzTip,
      },
    }),
    [
      userState.username,
      userState.tokens,
      userState.level,
      userState.currentXP,
      userState.targetXP,
      userState.hasOnboarded,
      userState.stats,
      userState.perMode,
      settingsState.sound,
      settingsState.haptics,
      settingsState.hasSeenBlitzTip,
    ],
  );
}

// ─────────────────────────────────────────────────────────────
// Writer helpers — same names as Phase 1B, route to store actions.
// ─────────────────────────────────────────────────────────────

export function grantTokens(amount: number): void {
  useUserStore.getState().addTokens(amount);
}

export function chargeTokens(amount: number): void {
  useUserStore.getState().subtractTokens(amount);
}

export function markOnboarded(): void {
  useUserStore.getState().setHasOnboarded(true);
}

export function setUsername(next: string): void {
  useUserStore.getState().setUsername(next);
}

export function toggleSetting(key: keyof MockUserSettings): void {
  useSettingsStore.getState().toggleSetting(key);
}

/**
 * Test-only — restores both stores to their documented defaults.
 * Used by every Phase 1B test's `beforeEach`. Keeps the exported
 * name so the existing 11 test files import it unchanged.
 */
export function __resetMockUserForTests(): void {
  useUserStore.setState({ ...USER_STORE_DEFAULTS });
  useSettingsStore.setState({ ...SETTINGS_STORE_DEFAULTS });
}
