/**
 * Durable match orchestrator. Wraps `turnBasedEngine` (or the
 * soft-fail `parallelEngine` for Mode 7) and persists the resulting
 * `MatchState` so a backgrounded match resumes exactly where it left
 * off, RNG cursor and all.
 *
 * Frequency rule (ROADMAP §State Ayrımı): only writes here on
 * structural events — guess submission, timeout, phase change. Live
 * clock ticks belong in `liveMatchStore` (transient, no persist).
 *
 * `createMatch` is no-op-guarded: a second call while a match is
 * already in flight returns `false` and does nothing. Prevents a
 * navigation re-entry from clobbering a half-played match.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { createRNG } from '@/lib/random';

import { selectEngine } from '../game/engines';
import { modeRegistry } from '../game/modeRegistry';
import type {
  BotContext,
  ClockSnapshot,
  GuessSide,
  MatchResult,
  MatchState,
  NormalizedFeedback,
  ValidationError,
} from '../game/types';

export interface SubmitGuessOutcome {
  readonly feedback: NormalizedFeedback | null;
  readonly error: ValidationError | null;
}

export interface MatchStoreState {
  readonly matchState: MatchState | null;
}

export interface MatchStoreActions {
  /** No-op (returns false) if an in-progress match exists. */
  createMatch(modeId: number, playerSecret: string): boolean;
  startMatch(): void;
  submitGuess(guess: string, author: GuessSide): Promise<SubmitGuessOutcome>;
  /**
   * Drive one bot turn: build `BotContext` from durable state, call
   * `mode.bot.makeGuess`, then funnel the resulting guess through
   * `engine.submitGuess` using the *same* RNG instance. The single-RNG
   * threading is the resume-identity contract — see ARCHITECTURE
   * §Phase 3. No-op when phase ≠ `'active_turn_opponent'`.
   *
   * The wall-clock thinking delay is a screen concern; this action
   * runs synchronously after the screen's `setTimeout` fires.
   */
  runOpponentTurn(): Promise<SubmitGuessOutcome>;
  applyTimeout(snapshot: ClockSnapshot): void;
  endMatch(result: MatchResult): void;
  clearMatch(): void;
}

const STORE_VERSION = 1;

function isInProgress(state: MatchState | null): boolean {
  return state !== null && state.phase !== 'completed';
}

export const useMatchStore = create<MatchStoreState & MatchStoreActions>()(
  persist(
    (set, get) => ({
      matchState: null,

      createMatch: (modeId, playerSecret) => {
        if (isInProgress(get().matchState)) return false;
        const mode = modeRegistry.get(modeId);
        const engine = selectEngine(mode);
        const rngState = { seed: Date.now() >>> 0, callCount: 0 };
        const next = engine.createMatch(modeId, playerSecret, rngState);
        set({ matchState: next });
        return true;
      },

      startMatch: () => {
        const current = get().matchState;
        if (current === null) return;
        const mode = modeRegistry.get(current.modeId);
        const engine = selectEngine(mode);
        const rng = createRNG(current.rngState);
        set({ matchState: engine.startMatch(current, rng) });
      },

      submitGuess: async (guess, author) => {
        const current = get().matchState;
        if (current === null) {
          return { feedback: null, error: null };
        }
        const mode = modeRegistry.get(current.modeId);
        const engine = selectEngine(mode);
        const rng = createRNG(current.rngState);
        const out = await engine.submitGuess(current, guess, author, rng);
        set({ matchState: out.state });
        return { feedback: out.feedback, error: out.error };
      },

      runOpponentTurn: async () => {
        const current = get().matchState;
        if (current === null || current.phase !== 'active_turn_opponent') {
          return { feedback: null, error: null };
        }
        const mode = modeRegistry.get(current.modeId);
        const engine = selectEngine(mode);

        // ONE RNG instance threads through both `bot.makeGuess` (which
        // may consume from it for selectByDifficulty etc.) and
        // `engine.submitGuess` (which writes the final cursor back to
        // `rngState`). Splitting these into two `createRNG` calls would
        // re-roll the cursor mid-turn and break resume identity.
        const rng = createRNG(current.rngState);
        const solver =
          current.solverStates?.opponent ??
          mode.bot.initSolverState(current.opponentSecret, mode.rules);
        const ctx: BotContext = {
          previousGuesses: current.opponentGuesses,
          mySecret: current.opponentSecret,
          difficulty: current.botDifficulty ?? 'normal',
          turnNumber: current.opponentGuesses.length + 1,
          solverState: solver,
          rng,
        };

        const { guess, newSolverState } = await mode.bot.makeGuess(ctx);

        // Write the new solver state onto the snapshot we hand to the
        // engine — `submitGuess` ignores it but the engine's output
        // state preserves it as a passthrough field, so the resulting
        // `matchState.solverStates.opponent` reflects the post-filter
        // pool the next turn needs.
        const stateWithSolver: MatchState = {
          ...current,
          solverStates: {
            ...(current.solverStates ?? {}),
            opponent: newSolverState,
          },
        };

        const out = await engine.submitGuess(stateWithSolver, guess, 'opponent', rng);
        set({ matchState: out.state });
        return { feedback: out.feedback, error: out.error };
      },

      applyTimeout: (snapshot) => {
        const current = get().matchState;
        if (current === null) return;
        const mode = modeRegistry.get(current.modeId);
        const engine = selectEngine(mode);
        const withSnap = engine.applyClockSnapshot(current, snapshot);
        set({ matchState: engine.applyTimeout(withSnap, mode) });
      },

      endMatch: (result) => {
        const current = get().matchState;
        if (current === null) return;
        set({ matchState: { ...current, phase: 'completed', result } });
      },

      clearMatch: () => set({ matchState: null }),
    }),
    {
      name: 'cipherbreaker.match.v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: STORE_VERSION,
      // Persist *only* the data field — actions are recreated on hydrate.
      partialize: (state) => ({ matchState: state.matchState }),
      migrate: (_persisted, version) => {
        if (version !== STORE_VERSION) {
          return { matchState: null } as MatchStoreState & MatchStoreActions;
        }
        return _persisted as MatchStoreState & MatchStoreActions;
      },
    },
  ),
);
