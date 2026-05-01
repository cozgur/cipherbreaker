/**
 * Durable player profile. Persisted to AsyncStorage so cold starts
 * land on the same balance, level, and per-mode stats. Fields are
 * intentionally a flat shape — `mockUser`'s Phase 1B contract — so
 * the facade in `data/mockUser.ts` routes reads/writes here without
 * any structural translation.
 *
 * Migrations: every shape change bumps `STORE_VERSION` and adds a
 * `migrate` branch; the persist middleware runs the matching branch
 * to map old shapes onto the current one. Phase 7A.1 (v1 → v2)
 * renamed `stats.tokensEarned` → `stats.totalTokensEarned` (now
 * cumulative, was a static placeholder) and added
 * `stats.recentMatches` (rolling window of the last ten outcomes,
 * fed by `recordMatchResult`, consumed by the Phase 7A.2 DDA).
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
  /**
   * Lifetime cumulative reward (tokens earned across every match).
   * Was `tokensEarned` (static placeholder) in v1; renamed and now
   * incremented by `recordMatchResult` each time a positive
   * `tokensEarnedThisMatch` is supplied.
   */
  readonly totalTokensEarned: number;
  /**
   * Rolling window of the last ten match outcomes (most recent
   * last). Fed by every `recordMatchResult` call; consumed by the
   * Phase 7A.2 DDA to bias bot difficulty toward a hidden ~45% win
   * target. Older entries are dropped beyond the cap.
   */
  readonly recentMatches: readonly MatchResultOutcome[];
}

const RECENT_MATCH_WINDOW = 10;

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
  /**
   * Net tokens credited for *this* match (rewardWin / rewardDraw /
   * stake-refund / 0). Optional so legacy callers without economy
   * context still bump stats; defaults to 0 — the lifetime counter
   * only moves when a real reward was granted.
   */
  readonly tokensEarnedThisMatch?: number;
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
   * streak), folds `turns` into the running `avgTurns` mean, nudges
   * `perMode[modeId].winRate` by the same victory rule, pushes the
   * outcome onto the rolling `recentMatches` window (cap 10), and
   * adds `tokensEarnedThisMatch` (when ≥0) onto `totalTokensEarned`.
   *
   * Win counts aren't persisted as a primitive — `winRate * gamesPlayed`
   * is reversed at call time. Phase 7A.2+ will replace the rate-back-
   * to-wins trick once stats are sourced from a server.
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
    totalTokensEarned: 12_400,
    recentMatches: [],
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

const STORE_VERSION = 2;

/**
 * Migrate persisted state across `STORE_VERSION` bumps. The persist
 * middleware feeds us whatever was on disk; we map it onto the
 * current `UserStoreState` shape (actions are re-bound by zustand).
 *
 * v1 → v2: rename `stats.tokensEarned` → `stats.totalTokensEarned`,
 * preserve the prior cumulative value (so the player keeps their
 * lifetime credit), and seed `stats.recentMatches: []`.
 */
function migrateUserStore(persisted: unknown, version: number): UserStoreState {
  if (version === STORE_VERSION) {
    return persisted as UserStoreState;
  }

  if (version === 1) {
    type V1Stats = Omit<UserStats, 'totalTokensEarned' | 'recentMatches'> & {
      readonly tokensEarned?: number;
    };
    type V1State = Omit<UserStoreState, 'stats'> & { readonly stats?: V1Stats };
    const v1 = (persisted ?? {}) as V1State;
    const v1Stats = v1.stats ?? ({} as V1Stats);
    return {
      ...USER_STORE_DEFAULTS,
      ...v1,
      stats: {
        gamesPlayed: v1Stats.gamesPlayed ?? USER_STORE_DEFAULTS.stats.gamesPlayed,
        winRate: v1Stats.winRate ?? USER_STORE_DEFAULTS.stats.winRate,
        currentStreak: v1Stats.currentStreak ?? USER_STORE_DEFAULTS.stats.currentStreak,
        bestStreak: v1Stats.bestStreak ?? USER_STORE_DEFAULTS.stats.bestStreak,
        avgTurns: v1Stats.avgTurns ?? USER_STORE_DEFAULTS.stats.avgTurns,
        totalTokensEarned: v1Stats.tokensEarned ?? USER_STORE_DEFAULTS.stats.totalTokensEarned,
        recentMatches: [],
      },
    };
  }

  // Older / unknown versions — fall back to defaults so the app
  // still boots. The user loses their persisted progress, which is
  // the documented behaviour for an unrecognised version stamp.
  return USER_STORE_DEFAULTS;
}

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

      recordMatchResult: ({ modeId, outcome, turns, tokensEarnedThisMatch = 0 }) => {
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

          // Rolling window — most recent outcome lands at the tail; older
          // entries fall off when the cap is exceeded.
          const nextRecent = [...stats.recentMatches, outcome].slice(-RECENT_MATCH_WINDOW);

          // Lifetime cumulative — only credit the counter when there
          // was real economic gain (negative inputs are clamped to 0).
          const earnedDelta = Math.max(0, tokensEarnedThisMatch);
          const newTotalTokensEarned = stats.totalTokensEarned + earnedDelta;

          return {
            stats: {
              gamesPlayed: newGamesPlayed,
              winRate: newWinRate,
              currentStreak: nextStreak,
              bestStreak: nextBestStreak,
              avgTurns: newAvgTurns,
              totalTokensEarned: newTotalTokensEarned,
              recentMatches: nextRecent,
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
      migrate: (persisted, version) => {
        const next = migrateUserStore(persisted, version);
        return next as UserStoreState & UserStoreActions;
      },
    },
  ),
);

/** Test-only — exported so migration tests can call the pure mapper
 *  without hitting AsyncStorage / zustand internals. */
export const __migrateUserStoreForTests = migrateUserStore;
