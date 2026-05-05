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

import { pickDifficultyFromOutcomes } from '../game/dda/pickDifficultyFromOutcomes';
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
import { useLiveMatchStore } from './liveMatchStore';
import { useUserStore } from './userStore';

/**
 * Mode 4 — capture the live tick value as a durable snapshot the
 * engine consumes. Returns the input state untouched for non-Blitz
 * modes (no live clocks → nothing to capture). Lives here, not in
 * the engine, because the live ↔ durable seam is the matchStore's
 * job — the engine stays clock-naïve.
 */
function captureLiveSnapshot(state: MatchState): MatchState {
  const live = useLiveMatchStore.getState().liveClocks;
  if (live === null) return state;
  return {
    ...state,
    clockSnapshot: {
      playerMs: live.playerMs,
      opponentMs: live.opponentMs,
      activeOwner: live.activeOwner,
      snapshotTimestamp: Date.now(),
    },
  };
}

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
  /**
   * Phase 7A.5 CP6 — flip `matchState.doubledReward` after the
   * player redeems the rewarded "Double" CTA on the post-match
   * screen. Idempotency for the Double UI is enforced by the
   * screen reading this flag (button hides when true). No-op if
   * matchState is null. Paired with `userStore.applyRewardedDouble`
   * at the call site (`AdWatchScreen` finish handler in 'double'
   * mode) — own-state-first ordering, see header.
   */
  setDoubledReward(value: boolean): void;
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
        const created = engine.createMatch(modeId, playerSecret, rngState);
        // Phase 7A.2 — DDA freeze point. Picks difficulty from the
        // player's rolling last-10 outcome window the moment stake is
        // committed; engines stay userStore-naïve and pass the stamped
        // value through. Freezing here (not at startMatch) means the
        // player can't game DDA by losing matches between commit and
        // start — there is no such window.
        //
        // Phase 7A.5 fix — opaque per-match id assigned here so
        // applyRewardedDouble(matchId) can verify it's operating on
        // the same match the AdWatch flow was launched from. Composed
        // from `Date.now()` (millisecond) + the seed (uint32) so
        // two near-simultaneous matches on the same device never
        // collide on a shared id.
        const next = {
          ...created,
          id: `${Date.now().toString(36)}-${rngState.seed.toString(36)}`,
          botDifficulty: pickDifficultyFromOutcomes(
            useUserStore.getState().stats.recentMatches,
          ),
        };
        // Stake debit lives here, not in HomeScreen/SecretSetup, so every
        // entry path (turn-based via SecretSetup, parallel via direct
        // navigation) charges exactly once. The in-progress guard above
        // makes this idempotent: a re-entry returns `false` before we
        // reach the debit. `subtractTokens` clamps at zero, so an
        // insufficient balance silently caps — HomeScreen's pre-check
        // is the policy gate; this is the bookkeeping seam. Stalemate
        // refund (MatchResultScreen) and victory reward (engine path)
        // both assume stake was already debited here.
        useUserStore.getState().subtractTokens(mode.meta.stake);
        set({ matchState: next });
        return true;
      },

      startMatch: () => {
        const current = get().matchState;
        if (current === null) return;
        const mode = modeRegistry.get(current.modeId);
        const engine = selectEngine(mode);
        const rng = createRNG(current.rngState);
        const next = engine.startMatch(current, rng);
        set({ matchState: next });
        // Mode 4 — `engine.startMatch` seeds `clockSnapshot`; mirror
        // it into the live store so the screen's tick interval has
        // initial values to read. No-op for modes without a clock.
        useLiveMatchStore.getState().syncFromMatchState(next);
      },

      submitGuess: async (guess, author) => {
        const current = get().matchState;
        if (current === null) {
          return { feedback: null, error: null };
        }
        const mode = modeRegistry.get(current.modeId);
        const engine = selectEngine(mode);
        const rng = createRNG(current.rngState);
        // Mode 4 — capture the live tick onto the durable snapshot
        // before the engine evaluates so `entry.elapsedMs` and the
        // checkEndConditions timeout branch see the same number the
        // player saw on screen. No-op for non-Blitz modes.
        const stateWithSnapshot = captureLiveSnapshot(current);
        const out = await engine.submitGuess(stateWithSnapshot, guess, author, rng);
        set({ matchState: out.state });
        // Sync live clocks against the post-submit snapshot so the
        // tick interval picks up the new active owner immediately.
        useLiveMatchStore.getState().syncFromMatchState(out.state);
        return { feedback: out.feedback, error: out.error };
      },

      runOpponentTurn: async () => {
        const current = get().matchState;
        if (current === null) {
          return { feedback: null, error: null };
        }
        // Phase gate — turn-based modes fire only on opponent's turn;
        // parallel modes (Mode 6 + Mode 7) accept any active_parallel
        // moment because there's no rotation. Anything else (setup /
        // completed / active_turn_player) is a no-op so screens that
        // accidentally fire on stale phases don't double-submit.
        const isOpponentTurn = current.phase === 'active_turn_opponent';
        const isParallelTurn = current.phase === 'active_parallel';
        if (!isOpponentTurn && !isParallelTurn) {
          return { feedback: null, error: null };
        }
        // Parallel-mode budget guard — Mode 6's parallelEngine appends
        // a 6th opponent guess (decrement floors at 0) without
        // terminating, so without this short-circuit the bot would
        // exceed its budget. Mode 7 has no `guessLimits` → falsy
        // optional chain → falls through.
        if (
          isParallelTurn &&
          current.guessLimits !== undefined &&
          current.guessLimits.opponentRemaining <= 0
        ) {
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
        // Mode 4 — capture the live tick onto the durable snapshot
        // before the engine evaluates (same reason as `submitGuess`).
        const stateWithSnapshot = captureLiveSnapshot(stateWithSolver);

        const out = await engine.submitGuess(stateWithSnapshot, guess, 'opponent', rng);
        set({ matchState: out.state });
        useLiveMatchStore.getState().syncFromMatchState(out.state);
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

      setDoubledReward: (value) => {
        const current = get().matchState;
        if (current === null) return;
        set({ matchState: { ...current, doubledReward: value } });
      },
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
