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

import type { MatchResultOutcome } from '@navigation/routes';

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

export interface RecordMatchResultInput {
  readonly modeId: number;
  readonly outcome: MatchResultOutcome;
  readonly turns: number;
}

export interface UserStoreActions {
  /** Positive-only — Shop, ad reward, match win. */
  addTokens(amount: number): void;
  /** Clamps at zero, ignores ≤0 — forfeit penalty + future stake debit. */
  subtractTokens(amount: number): void;
  setHasOnboarded(value: boolean): void;
  /** Trims; rejects empty strings (matches Phase 1B mock contract). */
  setUsername(next: string): void;
  /**
   * Per-mount, per-completed-match. Increments `gamesPlayed`, recomputes
   * `winRate` (treating only `'victory'` as a win), updates the streak
   * pair (victory → +1; defeat → reset to 0; draw/stalemate keep the
   * streak), folds `turns` into the running `avgTurns` mean, and nudges
   * `perMode[modeId].winRate` by the same victory rule.
   *
   * Win counts aren't persisted as a primitive — `winRate * gamesPlayed`
   * is reversed at call time. Phase 7A will replace this with a real
   * record once stats are sourced from the server.
   */
  recordMatchResult(input: RecordMatchResultInput): void;
  /** Positive-only. Raw counter — Phase 7A wires the level-up rollover. */
  addXp(amount: number): void;
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

      recordMatchResult: ({ modeId, outcome, turns }) => {
        set((s) => {
          const stats = s.stats;
          const isWin = outcome === 'victory';
          const isLoss = outcome === 'defeat';

          const wins = Math.round((stats.winRate / 100) * stats.gamesPlayed);
          const newWins = isWin ? wins + 1 : wins;
          const newGamesPlayed = stats.gamesPlayed + 1;
          const newWinRate = Math.round((newWins / newGamesPlayed) * 100);

          const nextStreak = isWin
            ? stats.currentStreak + 1
            : isLoss
              ? 0
              : stats.currentStreak;
          const nextBestStreak = Math.max(stats.bestStreak, nextStreak);

          // Running mean — exact for the new sample, rounded to 1 decimal
          // to match the Profile screen's display fidelity.
          const newAvgTurnsRaw =
            (stats.avgTurns * stats.gamesPlayed + turns) / newGamesPlayed;
          const newAvgTurns = Math.round(newAvgTurnsRaw * 10) / 10;

          // perMode shares the same wins-from-rate trick. We don't track
          // games-per-mode yet, so estimate from the totals; Phase 7A
          // replaces this once the backend supplies authoritative counts.
          const modeEntry = s.perMode[modeId] ?? { winRate: 50 };
          const estModeGames = Math.max(1, Math.round(stats.gamesPlayed / 7));
          const modeWins = Math.round((modeEntry.winRate / 100) * estModeGames);
          const newModeWins = isWin ? modeWins + 1 : modeWins;
          const newModeGames = estModeGames + 1;
          const newModeWinRate = Math.round((newModeWins / newModeGames) * 100);

          return {
            stats: {
              gamesPlayed: newGamesPlayed,
              winRate: newWinRate,
              currentStreak: nextStreak,
              bestStreak: nextBestStreak,
              avgTurns: newAvgTurns,
              tokensEarned: stats.tokensEarned,
            },
            perMode: { ...s.perMode, [modeId]: { winRate: newModeWinRate } },
          };
        });
      },

      addXp: (amount) => {
        if (amount <= 0) return;
        set((s) => ({ currentXP: s.currentXP + amount }));
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
