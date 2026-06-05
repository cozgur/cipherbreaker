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
import {
  analyzeHintCandidates,
  canProbeDigit,
  hintCostForState,
  HINT_PROBE_TOKEN_COST,
  HINT_REVEAL_TOKEN_COST,
  probeResult,
  type HintCandidate,
} from '@game/daily/hint';
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

/**
 * Phase 7A.4 CP6 — outcome of a `useHint()` call (Hint A — Reveal).
 *
 * Discriminator is the hint candidate kind plus the cost path. The
 * UI uses `kind` to render the right reveal surface (green = pos+
 * digit lock, yellow = digit existence, warning = informational
 * "no signal" toast — no charge), and `cost` to update the balance
 * UI / earned-hints display.
 *
 *   no-attempt    — no in-flight currentAttempt (defensive).
 *   green         — position + digit revealed; pool or tokens debited.
 *   yellow        — digit revealed (existence only); pool or tokens debited.
 *   warning       — no informative signal; nothing changes; nothing charged.
 *   unaffordable  — green/yellow available but the player can't pay
 *                   (pool empty AND tokens < HINT_REVEAL_TOKEN_COST).
 */
export type DailyHintResult =
  | { readonly kind: 'no-attempt' }
  | { readonly kind: 'unaffordable' }
  | { readonly kind: 'warning' }
  | {
      readonly kind: 'green';
      readonly position: number;
      readonly digit: string;
      readonly cost: 'earned' | 'tokens';
    }
  | {
      readonly kind: 'yellow';
      readonly digit: number;
      readonly cost: 'earned' | 'tokens';
    };

/**
 * Phase 7A.4 CP6 — outcome of a `useProbe(digit)` call (Hint B).
 *
 *   no-attempt        — no in-flight currentAttempt.
 *   already-probed    — UI guard slipped (button should have been
 *                       disabled); silent no-op + signal.
 *   unaffordable      — pool empty AND tokens < HINT_PROBE_TOKEN_COST.
 *   resolved          — probe ran; `exists` says yes/no; `cost` says
 *                       what got charged.
 */
export type DailyProbeResult =
  | { readonly kind: 'no-attempt' }
  | { readonly kind: 'already-probed' }
  | { readonly kind: 'unaffordable' }
  | {
      readonly kind: 'resolved';
      readonly digit: number;
      readonly exists: boolean;
      readonly cost: 'earned' | 'tokens';
    };

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

  /**
   * Phase 7A.4 CP6 Hint A — pay (earned or tokens) to reveal one
   * positional certainty (green) or one digit existence (yellow),
   * picked by `analyzeHintCandidates(...)`. `'warning'` returns
   * without charging (no information available).
   */
  useHint(): DailyHintResult;

  /**
   * Phase 7A.4 CP6 Hint B — pay (earned or tokens, half the
   * reveal cost) to ask whether `digit` appears in the secret.
   */
  useProbe(digit: number): DailyProbeResult;

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
          hintsUsed: 0,
          revealedPositions: [],
          revealedDigits: [],
          probedDigits: [],
        };
        set({ currentAttempt: fresh, isSubmitting: false });
        // Phase 7A.8 CP9.1 — anchor the per-user Daily epoch on the
        // first ever attempt. Idempotent (set-if-null), so resumes and
        // later days never shift Day 1. Runs after the userStore-side
        // recordMissedDay above (deterministic single-thread order).
        useUserStore.getState().markDailyFirstPlayed(today);
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
            hintsUsed: attempt.hintsUsed,
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

      useHint: () => {
        const attempt = get().currentAttempt;
        if (attempt === null) {
          return { kind: 'no-attempt' };
        }
        const candidate: HintCandidate = analyzeHintCandidates(
          attempt.secret,
          attempt.guesses,
          attempt.revealedPositions,
          attempt.revealedDigits,
        );

        // Warning path — no signal to surface, charge nothing. The
        // hintsUsed counter does NOT increment; this is by design,
        // a warning isn't a hint.
        if (candidate.kind === 'warning') {
          return { kind: 'warning' };
        }

        // Pre-charge gate: if neither pool nor tokens cover Hint A,
        // refuse before mutating. UI should already have disabled
        // the button; this is the back-end guard.
        const userState = useUserStore.getState();
        const cost = hintCostForState(
          userState.dailyChallenge.earnedHints,
          userState.tokens,
          HINT_REVEAL_TOKEN_COST,
        );
        if (cost === 'unaffordable') {
          return { kind: 'unaffordable' };
        }

        // Apply the reveal — own state first (matchStore-pattern
        // deterministic ordering, see file header), then debit user.
        if (candidate.kind === 'green') {
          set({
            currentAttempt: {
              ...attempt,
              hintsUsed: attempt.hintsUsed + 1,
              revealedPositions: [...attempt.revealedPositions, candidate.position],
            },
          });
        } else {
          // yellow
          set({
            currentAttempt: {
              ...attempt,
              hintsUsed: attempt.hintsUsed + 1,
              revealedDigits: [...attempt.revealedDigits, candidate.digit],
            },
          });
        }
        applyHintCharge(cost, HINT_REVEAL_TOKEN_COST);

        if (candidate.kind === 'green') {
          return {
            kind: 'green',
            position: candidate.position,
            digit: candidate.digit,
            cost,
          };
        }
        return { kind: 'yellow', digit: candidate.digit, cost };
      },

      useProbe: (digit) => {
        const attempt = get().currentAttempt;
        if (attempt === null) {
          return { kind: 'no-attempt' };
        }
        if (!canProbeDigit(digit, attempt.probedDigits)) {
          return { kind: 'already-probed' };
        }
        const userState = useUserStore.getState();
        const cost = hintCostForState(
          userState.dailyChallenge.earnedHints,
          userState.tokens,
          HINT_PROBE_TOKEN_COST,
        );
        if (cost === 'unaffordable') {
          return { kind: 'unaffordable' };
        }

        const exists = probeResult(digit, attempt.secret);
        // Own state first — append the probe record + bump
        // hintsUsed (Hint B counts toward the same total Hint A
        // does, per the shared "any hint = any hint" semantics).
        set({
          currentAttempt: {
            ...attempt,
            hintsUsed: attempt.hintsUsed + 1,
            probedDigits: [...attempt.probedDigits, { digit, exists }],
          },
        });
        applyHintCharge(cost, HINT_PROBE_TOKEN_COST);
        return { kind: 'resolved', digit, exists, cost };
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

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

/**
 * Apply the userStore-side debit for a successful hint
 * (`'earned'` decrements the pool; `'tokens'` debits via
 * `subtractTokens`). Never called for `'unaffordable'` — the gate
 * higher up rejects before this runs. Lives at module scope so
 * both `useHint` and `useProbe` share the seam without
 * duplicating the if/else.
 */
function applyHintCharge(cost: 'earned' | 'tokens', tokenCost: number): void {
  if (cost === 'earned') {
    useUserStore.setState((s) => ({
      dailyChallenge: {
        ...s.dailyChallenge,
        earnedHints: Math.max(0, s.dailyChallenge.earnedHints - 1),
      },
    }));
  } else {
    useUserStore.getState().subtractTokens(tokenCost);
  }
}
