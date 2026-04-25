/**
 * Durable player profile. Persisted to AsyncStorage so cold starts
 * land on the same balance, level, and per-mode stats. Fields are
 * intentionally a flat shape — `mockUser`'s Phase 1B contract — so
 * the facade in `data/mockUser.ts` routes reads/writes here without
 * any structural translation.
 *
 * Migrations: every shape change bumps `STORE_VERSION` and adds a
 * `migrate` branch; the persist middleware drops anything older
 * than the current migration table can handle.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface UserStats {
  readonly gamesPlayed: number;
  readonly winRate: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly avgTurns: number;
  readonly tokensEarned: number;
}

export interface UserStoreState {
  readonly username: string;
  readonly tokens: number;
  readonly level: number;
  readonly currentXP: number;
  readonly targetXP: number;
  readonly hasOnboarded: boolean;
  readonly stats: UserStats;
  readonly perMode: Readonly<Record<number, { readonly winRate: number }>>;
}

export interface UserStoreActions {
  /** Positive-only — Shop, ad reward, match win. */
  addTokens(amount: number): void;
  /** Clamps at zero, ignores ≤0 — forfeit penalty + future stake debit. */
  subtractTokens(amount: number): void;
  setHasOnboarded(value: boolean): void;
  /** Trims; rejects empty strings (matches Phase 1B mock contract). */
  setUsername(next: string): void;
}

export const USER_STORE_DEFAULTS: UserStoreState = {
  username: 'nova_code',
  tokens: 1840,
  level: 12,
  currentXP: 2340,
  targetXP: 3200,
  hasOnboarded: true,
  stats: {
    gamesPlayed: 247,
    winRate: 68,
    currentStreak: 4,
    bestStreak: 11,
    avgTurns: 5.3,
    tokensEarned: 12_400,
  },
  perMode: {
    1: { winRate: 72 },
    2: { winRate: 64 },
    3: { winRate: 58 },
    4: { winRate: 55 },
    5: { winRate: 49 },
    6: { winRate: 61 },
    7: { winRate: 52 },
  },
};

const STORE_VERSION = 1;

export const useUserStore = create<UserStoreState & UserStoreActions>()(
  persist(
    (set) => ({
      ...USER_STORE_DEFAULTS,

      addTokens: (amount) => {
        if (amount <= 0) return;
        set((s) => ({ tokens: s.tokens + amount }));
      },

      subtractTokens: (amount) => {
        if (amount <= 0) return;
        set((s) => ({ tokens: Math.max(0, s.tokens - amount) }));
      },

      setHasOnboarded: (value) => set({ hasOnboarded: value }),

      setUsername: (next) => {
        const trimmed = next.trim();
        if (trimmed.length === 0) return;
        set({ username: trimmed });
      },
    }),
    {
      name: 'cipherbreaker.user.v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: STORE_VERSION,
      // Stub migrate handler — there's only v1, but the entry point
      // exists so future bumps don't have to retrofit the persist call.
      migrate: (persisted, version) => {
        if (version !== STORE_VERSION) {
          return USER_STORE_DEFAULTS as UserStoreState & UserStoreActions;
        }
        return persisted as UserStoreState & UserStoreActions;
      },
    },
  ),
);
