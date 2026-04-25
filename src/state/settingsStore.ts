/**
 * Durable user settings. Toggles flip with `toggleSetting(key)`; the
 * store backs the `mockUser.settings` facade so Phase 1B screens (and
 * tests reading `mockUser.settings.sound`) keep working post-migration.
 *
 * Phase 7B will likely add `devMode` and notifications keys; the shape
 * is open by design so additions don't churn the schema version.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface SettingsStoreState {
  readonly sound: boolean;
  readonly haptics: boolean;
  /** Phase 7A onboarding — Blitz tip shown once per install. */
  readonly hasSeenBlitzTip: boolean;
}

export interface SettingsStoreActions {
  toggleSetting(key: keyof SettingsStoreState): void;
}

export const SETTINGS_STORE_DEFAULTS: SettingsStoreState = {
  sound: true,
  haptics: true,
  hasSeenBlitzTip: false,
};

const STORE_VERSION = 1;

export const useSettingsStore = create<SettingsStoreState & SettingsStoreActions>()(
  persist(
    (set, get) => ({
      ...SETTINGS_STORE_DEFAULTS,

      toggleSetting: (key) => {
        const current = get()[key];
        set({ [key]: !current } as Partial<SettingsStoreState>);
      },
    }),
    {
      name: 'cipherbreaker.settings.v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: STORE_VERSION,
      migrate: (persisted, version) => {
        if (version !== STORE_VERSION) {
          return SETTINGS_STORE_DEFAULTS as SettingsStoreState & SettingsStoreActions;
        }
        return persisted as SettingsStoreState & SettingsStoreActions;
      },
    },
  ),
);
