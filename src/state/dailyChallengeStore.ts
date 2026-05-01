/**
 * Phase 7A.4 CP4 — Daily Challenge per-attempt state machine.
 *
 * Owns the in-flight Daily Challenge attempt, parallel to how
 * `matchStore` owns `MatchState` for Modes 1-7. Persisted under its
 * own key so a backgrounded mid-puzzle session resumes board-intact
 * on relaunch (Wordle parity — the half-played row stays where you
 * left it).
 *
 * Cross-store coordination:
 *   - dailyChallengeStore owns `currentAttempt`. Reads / writes here.
 *   - userStore.dailyChallenge owns `lastPlayedDate`, streak,
 *     `effectiveDayOffset`, `history`, `lastResult`.
 *   - dailyChallengeStore actions call `useUserStore.getState()` to
 *     trigger `recordDailyResult` / `recordMissedDay` at the right
 *     lifecycle moment. Same pattern matchStore.createMatch already
 *     uses for the stake debit.
 *   - **No** matchStore import (advisor discipline — keep helpers
 *     un-shared until a real DRY case appears).
 *
 * Cross-midnight stale-drop policy (advisor + Wordle pattern):
 *   `currentAttempt.date !== today` at `startToday` → silent drop +
 *   `userStore.recordMissedDay(today)` so the streak breaks and the
 *   tier regression lands. No toast. The puzzle the user missed is
 *   gone; tomorrow's puzzle is the new attempt.
 *
 * Action ordering (matchStore-pattern reference):
 *   For every action that touches both stores, the dailyChallengeStore
 *   side updates FIRST, then the userStore side runs. JS is
 *   single-threaded so no race exists, but the deterministic order is
 *   recorded here so a future "let me reorder these for atomicity"
 *   refactor knows what the current contract actually is.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { evaluateDailyGuess } from '@game/daily/evaluate';
import { getDailySecret } from '@game/daily/dailySeed';
import type {
  DailyChallengeConfig,
  DailyGuessRecord,
  DailyInProgress,
  DailyResultSummary,
} from '@game/daily/types';
import { validateDailyGuess } from '@game/daily/validation';
import type { ValidationError } from '@game/types';

import { useUserStore } from './userStore';

export interface DailyChallengeStoreState {
  readonly currentAttempt: DailyInProgress | null;
  readonly isSubmitting: boolean;
}

export interface DailySubmitResult {
  /** Validation failure — state untouched, UI surfaces the message. */
  readonly error: ValidationError | null;
  /**
   * Newly-appended row; `null` when the submit failed validation.
   * Surfaces feedback to the screen for inline-row paint without a
   * second store read.
   */
  readonly record: DailyGuessRecord | null;
  /** Set when this guess closed the attempt (win or turn-limit). */
  readonly summary: DailyResultSummary | null;
}

export interface DailyChallengeStoreActions {
  /**
   * Begin or resume today's attempt. Returns `true` if a fresh
   * attempt was seeded, `false` if the existing in-progress attempt
   * is for the same date (resume — UI shows the persisted board).
   *
   * Cross-midnight stale: silent drop + recordMissedDay. The drop is
   * a side effect; the return value still reflects what happens to
   * `currentAttempt` after the call (i.e., a fresh attempt was seeded).
   */
  startToday(today: string, config: DailyChallengeConfig): boolean;

  submitGuess(guess: string): DailySubmitResult;

  clearAttempt(): void;
}

const STORE_VERSION = 1;

export const useDailyChallengeStore = create<
  DailyChallengeStoreState & DailyChallengeStoreActions
>()(
  persist(
    (set, get) => ({
      currentAttempt: null,
      isSubmitting: false,

      startToday: (today, config) => {
        const existing = get().currentAttempt;

        // Resume path — same calendar day, persisted board still
        // valid. UI hydrates in place; no streak side effects.
        if (existing !== null && existing.date === today) {
          return false;
        }

        // Stale path — yesterday's (or older) attempt left mid-board.
        // Silent drop, missed-day side effect on userStore.
        if (existing !== null && existing.date !== today) {
          useUserStore.getState().recordMissedDay(today);
        }

        const secret = getDailySecret(today, config.digits);
        const fresh: DailyInProgress = {
          date: today,
          secret,
          digits: config.digits,
          turnLimit: config.turnLimit,
          guesses: [],
        };
        set({ currentAttempt: fresh, isSubmitting: false });
        return true;
      },

      submitGuess: (guess) => {
        const attempt = get().currentAttempt;
        if (attempt === null) {
          // No in-flight attempt — defensive identity. UI should
          // never call submit from a stale screen.
          return { error: null, record: null, summary: null };
        }

        const validation = validateDailyGuess(guess, attempt.digits);
        if (!validation.ok) {
          return { error: validation.error, record: null, summary: null };
        }

        const feedback = evaluateDailyGuess(guess, attempt.secret);
        if (feedback.kind !== 'precision') {
          // Defensive — `evaluateDailyGuess` always returns
          // 'precision'. Surface as a programmer error rather than
          // silently corrupting the store.
          throw new Error(
            `submitGuess: unexpected feedback kind '${feedback.kind}' (expected 'precision')`,
          );
        }

        const record: DailyGuessRecord = {
          guess,
          plus: feedback.plus,
          minus: feedback.minus,
          // `NormalizedFeedback.isWin` is optional in the shared type;
          // `evaluateDailyGuess` always sets it (`plus === length`),
          // but the conservative coalesce here keeps the DailyGuessRecord
          // contract strict.
          isWin: feedback.isWin === true,
        };
        const nextGuesses = [...attempt.guesses, record];
        const turnsUsed = nextGuesses.length;
        const exhausted = turnsUsed >= attempt.turnLimit;
        const success = record.isWin;

        if (success || exhausted) {
          const summary: DailyResultSummary = {
            date: attempt.date,
            digits: attempt.digits,
            turnLimit: attempt.turnLimit,
            turnsUsed,
            success,
            secret: attempt.secret,
            feedbackTrail: nextGuesses,
          };
          // Step 1: clear our own state. Step 2: hand the result to
          // userStore (streak / history / lastResult). Order keeps
          // selectors that read both stores consistent — no window
          // where currentAttempt and userStore.lastResult both name
          // the same date.
          set({ currentAttempt: null, isSubmitting: false });
          useUserStore.getState().recordDailyResult(summary);
          return { error: null, record, summary };
        }

        set({
          currentAttempt: { ...attempt, guesses: nextGuesses },
        });
        return { error: null, record, summary: null };
      },

      clearAttempt: () => {
        set({ currentAttempt: null, isSubmitting: false });
      },
    }),
    {
      name: 'cipherbreaker.daily.v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: STORE_VERSION,
      partialize: (state) => ({
        currentAttempt: state.currentAttempt,
        isSubmitting: false,
      }),
      migrate: (_persisted, version) => {
        // First-ever schema — anything not at v1 is an unrecognised
        // / corrupt blob. Reset to fresh; the user loses the
        // half-played board, which is rare and acceptable.
        if (version !== STORE_VERSION) {
          return { currentAttempt: null, isSubmitting: false } as DailyChallengeStoreState &
            DailyChallengeStoreActions;
        }
        return _persisted as DailyChallengeStoreState & DailyChallengeStoreActions;
      },
    },
  ),
);
