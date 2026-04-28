/**
 * TRANSIENT live-tick store for the Mode 4 Blitz clock. Updated at
 * ~10Hz during play; intentionally **not** persisted to AsyncStorage
 * (ROADMAP §State Ayrımı — durable persists drop frames at clock
 * frequency). Cold-start hydration reads the durable
 * `MatchState.clockSnapshot` and resyncs.
 *
 * The `.persist` field is missing on purpose — `liveMatchStore.test.ts`
 * asserts `useLiveMatchStore.persist === undefined` so a future change
 * that wraps this store in `persist(...)` fails CI loudly.
 */

import { create } from 'zustand';

import type { LiveClockState, MatchState } from '../game/types';

export interface LiveMatchStoreState {
  readonly liveClocks: LiveClockState | null;
}

export interface LiveMatchStoreActions {
  syncFromMatchState(matchState: MatchState | null): void;
  /** `deltaMs` is positive — the active owner's remaining time decrements by it. */
  tickClock(deltaMs: number): void;
  /**
   * Catch-up subtraction after the screen returns from background.
   * Decrements the *active owner's* clock by `ms` (the literal name
   * comes from ROADMAP §App Lifecycle; semantically it's owner-aware
   * so a bot-turn background fires against the bot's clock — see
   * Phase 5 ARCHITECTURE for the rationale). Identical mechanics to
   * `tickClock`; aliased for call-site readability.
   */
  subtractPlayerTime(ms: number): void;
  clear(): void;
}

export const useLiveMatchStore = create<LiveMatchStoreState & LiveMatchStoreActions>()(
  (set, get) => ({
    liveClocks: null,

    syncFromMatchState: (matchState) => {
      if (matchState === null || matchState.clockSnapshot === undefined) {
        set({ liveClocks: null });
        return;
      }
      const snap = matchState.clockSnapshot;
      set({
        liveClocks: {
          playerMs: snap.playerMs,
          opponentMs: snap.opponentMs,
          activeOwner: snap.activeOwner,
          lastTickAt: Date.now(),
        },
      });
    },

    tickClock: (deltaMs) => {
      const current = get().liveClocks;
      if (current === null || current.activeOwner === null) return;
      if (deltaMs <= 0) return;
      const decremented =
        current.activeOwner === 'player'
          ? { playerMs: Math.max(0, current.playerMs - deltaMs) }
          : { opponentMs: Math.max(0, current.opponentMs - deltaMs) };
      set({
        liveClocks: {
          ...current,
          ...decremented,
          lastTickAt: Date.now(),
        },
      });
    },

    subtractPlayerTime: (ms) => get().tickClock(ms),

    clear: () => set({ liveClocks: null }),
  }),
);
