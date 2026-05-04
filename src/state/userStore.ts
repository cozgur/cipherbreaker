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

import type { DailyChallengeState, DailyResultSummary } from '@game/daily/types';
import { computeNextDailyStreakState } from '@game/daily/streak';
import { calendarDayIndex, effectiveDigitTier, TIER_4_PERIOD, TIER_5_PERIOD } from '@game/daily/dailyConfig';
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
  /**
   * Phase 7A.4 — Daily Challenge per-user persisted state. Streak,
   * regression offset, in-progress attempt, last result, history.
   * Schema landed in v3 migration. See `@game/daily/types`.
   */
  readonly dailyChallenge: DailyChallengeState;
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
  /**
   * Phase 7A.4 — record a completed Daily Challenge attempt. Updates
   * `lastResult`, pushes onto cap-90 `history`, advances streak +
   * regression offset via `computeNextDailyStreakState`, and stamps
   * `lastPlayedDate`. The `dailyChallengeStore` action layer calls
   * this after clearing its own `currentAttempt` — single deterministic
   * sequence (matchStore-pattern).
   */
  recordDailyResult(result: DailyResultSummary): void;
  /**
   * Phase 7A.4 — record a missed day (cross-midnight stale-drop or
   * skipped calendar day). Breaks streak, applies tier regression
   * (`effectiveDayOffset += prior tier period`), stamps
   * `lastPlayedDate`. No history entry — a missed day is absence,
   * not an attempt.
   */
  recordMissedDay(today: string): void;
  /**
   * Phase 7A.4 admin — wipe game-side stats so the user looks like a
   * fresh player. Clears `stats` (gamesPlayed, winRate, streaks,
   * avgTurns, totalTokensEarned, recentMatches), zeroes `perMode`
   * win rates, and resets `dailyChallenge` to defaults. **Keeps**
   * `tokens`, `level`, `currentXP`, `targetXP`, `username`,
   * `hasOnboarded` — economy + identity persist (they're not what
   * "play stats" means here). DEV-only entry point — surfaced on
   * ProfileScreen behind `__DEV__`.
   */
  resetPlayStats(): void;
}

export const DAILY_CHALLENGE_DEFAULTS: DailyChallengeState = {
  lastPlayedDate: null,
  currentStreak: 0,
  longestStreak: 0,
  effectiveDayOffset: 0,
  lastResult: null,
  history: [],
};

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
  dailyChallenge: DAILY_CHALLENGE_DEFAULTS,
};

const STORE_VERSION = 3;

/**
 * Migrate persisted state across `STORE_VERSION` bumps. The persist
 * middleware feeds us whatever was on disk; we map it onto the
 * current `UserStoreState` shape (actions are re-bound by zustand).
 *
 * Chained migration pattern (Phase 7A.4 CP3 advisor discipline): each
 * version step is its own pure function consuming the prior shape and
 * producing the next one. The dispatcher loops until `version ===
 * STORE_VERSION` so a v1 blob lands at v3 by going through v1 → v2 →
 * v3 — no inline-collapsed branches that drift out of sync as new
 * versions land.
 *
 * Step list:
 *   v1 → v2 (Phase 7A.1): rename `stats.tokensEarned` →
 *     `stats.totalTokensEarned`; seed `stats.recentMatches: []`.
 *   v2 → v3 (Phase 7A.4): seed `dailyChallenge` defaults; preserve
 *     every v2 field byte-for-byte (no economy / streak / stats
 *     touched).
 */

// Loose v1 shape — only the fields the v1→v2 mapper inspects.
type V1Stats = Omit<UserStats, 'totalTokensEarned' | 'recentMatches'> & {
  readonly tokensEarned?: number;
};
type V1State = Omit<UserStoreState, 'stats' | 'dailyChallenge'> & {
  readonly stats?: V1Stats;
};

// v2 shape — same as today's UserStoreState minus `dailyChallenge`.
type V2State = Omit<UserStoreState, 'dailyChallenge'>;

function migrateV1ToV2(persisted: unknown): V2State {
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

function migrateV2ToV3(persisted: unknown): UserStoreState {
  const v2 = (persisted ?? {}) as V2State;
  return {
    ...v2,
    dailyChallenge: DAILY_CHALLENGE_DEFAULTS,
  };
}

function migrateUserStore(persisted: unknown, version: number): UserStoreState {
  if (version === STORE_VERSION) {
    return persisted as UserStoreState;
  }
  // Future / corrupt version stamps fall through to defaults rather
  // than attempting a downgrade — losing persisted progress is the
  // documented behaviour for an unrecognised version. (We can't
  // safely synthesise a downgrade because the future shape might
  // contain fields the current code doesn't understand.)
  if (version < 1 || version > STORE_VERSION) {
    return USER_STORE_DEFAULTS;
  }
  let current: unknown = persisted;
  let v = version;
  while (v < STORE_VERSION) {
    if (v === 1) {
      current = migrateV1ToV2(current);
      v = 2;
    } else if (v === 2) {
      current = migrateV2ToV3(current);
      v = 3;
    } else {
      // Defensive — the bounds check above should prevent reaching
      // this branch, but it keeps the loop total in case the bound
      // check is ever loosened.
      return USER_STORE_DEFAULTS;
    }
  }
  return current as UserStoreState;
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

      recordDailyResult: (result) => {
        set((s) => {
          const prev = s.dailyChallenge;
          const streakUpdate = computeNextDailyStreakState(prev, result.date, result);
          const historyEntry = {
            date: result.date,
            digits: result.digits,
            turns: result.turnsUsed,
            success: result.success,
          };
          // Cap 90 — slice at write time so selectors stay O(1) and
          // a one-shot 91-entry blob can't sneak in via direct setState.
          const nextHistory = [...prev.history, historyEntry].slice(-90);
          return {
            dailyChallenge: {
              ...prev,
              lastPlayedDate: result.date,
              currentStreak: streakUpdate.currentStreak,
              longestStreak: streakUpdate.longestStreak,
              effectiveDayOffset: streakUpdate.effectiveDayOffset,
              lastResult: result,
              history: nextHistory,
            },
          };
        });
      },

      resetPlayStats: () => {
        set(() => ({
          stats: {
            gamesPlayed: 0,
            winRate: 0,
            currentStreak: 0,
            bestStreak: 0,
            avgTurns: 0,
            totalTokensEarned: 0,
            recentMatches: [],
          },
          perMode: {
            1: { winRate: 0 },
            2: { winRate: 0 },
            3: { winRate: 0 },
            4: { winRate: 0 },
            5: { winRate: 0 },
            6: { winRate: 0 },
            7: { winRate: 0 },
          },
          dailyChallenge: DAILY_CHALLENGE_DEFAULTS,
        }));
      },

      recordMissedDay: (today) => {
        set((s) => {
          const prev = s.dailyChallenge;
          // Cross-midnight stale-drop semantics: streak breaks,
          // regression applies based on the prior tier (computed off
          // `lastPlayedDate` and the existing offset). Inline rather
          // than via `computeNextDailyStreakState({result:null})` so
          // the regression delta is auditable here, where the only
          // call site lives.
          if (prev.lastPlayedDate === null) {
            // First-ever interaction is a "missed day" — no prior
            // tier to regress from. Stamp the date so the next play
            // sees a sensible gap; leave streak/offset at zero.
            return {
              dailyChallenge: { ...prev, lastPlayedDate: today },
            };
          }
          const lastTierEffectiveDay =
            calendarDayIndex(prev.lastPlayedDate) - prev.effectiveDayOffset;
          const lastTier = effectiveDigitTier(lastTierEffectiveDay);
          let regressionDelta = 0;
          if (lastTier.digits === 6) regressionDelta = TIER_5_PERIOD;
          else if (lastTier.digits === 5) regressionDelta = TIER_4_PERIOD;
          // tier-4 floor: regressionDelta stays 0.
          return {
            dailyChallenge: {
              ...prev,
              lastPlayedDate: today,
              currentStreak: 0,
              effectiveDayOffset: prev.effectiveDayOffset + regressionDelta,
            },
          };
        });
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
