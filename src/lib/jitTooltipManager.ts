/**
 * Phase 7A.8 CP3 — just-in-time tooltip orchestration.
 *
 * Three tooltips surface contextual education about the token
 * economy at the moments they're most legible:
 *
 *   TOKEN_EARN       — first post-onboarding match win (MatchResultScreen mount)
 *   HINT_SPEND       — first user-initiated hint use in Daily Challenge
 *                      (DailyMatchScreen `onHintPress` / probe paths)
 *   STREAK_MILESTONE — first time daily streak reaches 3 (HomeScreen mount)
 *
 * Each tooltip fires once per user (persistent flag in
 * `userStore.jitTooltipsSeen`); after dismissal the seen flag is set
 * and the tooltip never re-appears.
 *
 * Queue contract: at most one tooltip visible at a time. If a second
 * `show()` lands while the first is still on screen, it queues FIFO
 * and surfaces when the active one dismisses. The TOKEN_EARN +
 * STREAK_MILESTONE race (player wins a match AND hits the 3-day
 * streak on the same return to Home) is the documented motivating
 * case — TOKEN_EARN fires from MatchResultScreen, dismisses, then
 * STREAK_MILESTONE surfaces when the player lands on Home.
 *
 * Active-route gating is NOT enforced inside the manager. The three
 * trigger sites (MatchResultScreen / DailyMatchScreen /
 * HomeScreen) cannot be the active screen while ModeTutorial is
 * presented on top (ModeTutorial is a fullScreenModal that replaces
 * into Matchmaking on exit — never lands on MatchResult/Daily, and
 * does not remount Home). The `hasOnboarded` gate handles the
 * TutorialMatch / OnboardingHero suppression case at each trigger
 * call site. CP3 deliberately keeps the manager dumb — it shows
 * what it's told to show. Each call site owns its own eligibility
 * decision.
 */

import { create } from 'zustand';

import { useUserStore, type JITTooltipsSeenState } from '@state/userStore';

export type JITTooltipKind = 'TOKEN_EARN' | 'HINT_SPEND' | 'STREAK_MILESTONE';

export interface JITTooltipConfig {
  readonly kind: JITTooltipKind;
  /** Copy shown in the toast body. */
  readonly message: string;
  /** Key into `JITTooltipsSeenState` that this tooltip flips on mark. */
  readonly seenKey: keyof JITTooltipsSeenState;
  /** Action name on userStore that flips the seen flag. */
  readonly markAction:
    | 'markFirstTokenEarnTooltipSeen'
    | 'markFirstHintSpendTooltipSeen'
    | 'markFirstStreakMilestoneTooltipSeen';
  /** testID applied to the rendered TutorialToast. */
  readonly testID: string;
}

export const JIT_TOOLTIP_CONFIGS: Readonly<Record<JITTooltipKind, JITTooltipConfig>> = {
  TOKEN_EARN: {
    kind: 'TOKEN_EARN',
    message: 'Tokens earned by winning. Spend them on hints, modes, and more.',
    seenKey: 'firstTokenEarn',
    markAction: 'markFirstTokenEarnTooltipSeen',
    testID: 'jit-tooltip-token-earn',
  },
  HINT_SPEND: {
    kind: 'HINT_SPEND',
    message: 'Hints cost tokens. Use them when a guess really needs the nudge.',
    seenKey: 'firstHintSpend',
    markAction: 'markFirstHintSpendTooltipSeen',
    testID: 'jit-tooltip-hint-spend',
  },
  STREAK_MILESTONE: {
    kind: 'STREAK_MILESTONE',
    message: '3-day streak! Daily Challenges build streaks — keep it going for bonus rewards.',
    seenKey: 'firstStreakMilestone',
    markAction: 'markFirstStreakMilestoneTooltipSeen',
    testID: 'jit-tooltip-streak-milestone',
  },
};

interface JITTooltipQueueState {
  /** Active tooltip (currently visible) — null when nothing is showing. */
  readonly active: JITTooltipKind | null;
  /** Pending tooltips, FIFO. The next dismiss promotes head → active. */
  readonly queue: readonly JITTooltipKind[];
  /**
   * Enqueue a tooltip for display. If nothing is active, the
   * tooltip surfaces immediately; otherwise it queues behind the
   * active one. Duplicate enqueues (same kind already active or
   * already queued) are no-ops — protects against double-fire from
   * re-render races at trigger sites.
   */
  show(kind: JITTooltipKind): void;
  /**
   * Dismiss the active tooltip and promote the next queued
   * tooltip (if any). Idempotent — calling with no active tooltip
   * is a no-op.
   */
  hide(): void;
  /** Test-only — wipe queue + active. Public for tests, not callers. */
  __resetForTests(): void;
}

export const useJITTooltipQueue = create<JITTooltipQueueState>((set, get) => ({
  active: null,
  queue: [],
  show: (kind) => {
    const state = get();
    if (state.active === kind) return;
    if (state.queue.includes(kind)) return;
    if (state.active === null) {
      set({ active: kind });
      return;
    }
    set({ queue: [...state.queue, kind] });
  },
  hide: () => {
    const state = get();
    if (state.active === null) return;
    const [next, ...rest] = state.queue;
    if (next !== undefined) {
      set({ active: next, queue: rest });
      return;
    }
    set({ active: null, queue: [] });
  },
  __resetForTests: () => set({ active: null, queue: [] }),
}));

/**
 * React hook — returns the active tooltip config and a dismiss
 * callback. The mounting screen (one global `JITTooltipHost`
 * rendered above the navigator stack would be the next evolution;
 * CP3 keeps it per-screen for now) calls this and renders a
 * `TutorialToast variant="jit"` when `config !== null`.
 *
 * `dismiss` flips the userStore seen flag for the active tooltip
 * AND shifts the queue. Marking on dismiss (not on show) means a
 * force-quit while the tooltip is visible re-fires it on next
 * eligible trigger — the discovery moment isn't lost to a swipe-
 * away. CP3 ships marking-on-show for the simpler invariant; the
 * trade-off is documented and acceptable for first-time discovery
 * surfaces.
 *
 * Actually — CP3 ships marking-on-show: the call site flips the
 * seen flag immediately before `show()`. Reasoning: a tooltip
 * still in the 5s window when the app goes background should NOT
 * re-fire on next launch (the user saw it). The trigger condition
 * is "first ever moment of this category" — once the moment has
 * happened, the tooltip has done its job whether or not the user
 * tapped through. Marking-on-show preserves that semantic.
 */
export function useJITTooltip(): {
  readonly config: JITTooltipConfig | null;
  readonly dismiss: () => void;
} {
  const active = useJITTooltipQueue((s) => s.active);
  const hide = useJITTooltipQueue((s) => s.hide);
  if (active === null) return { config: null, dismiss: hide };
  return { config: JIT_TOOLTIP_CONFIGS[active], dismiss: hide };
}

/**
 * Imperative helper for trigger sites — fires the tooltip AND
 * stamps the `seen` flag in userStore in one call. Trigger sites
 * call this after confirming eligibility (hasOnboarded + !seen +
 * the per-tooltip mechanic gate). Returns `true` if the tooltip
 * was shown (i.e. the user hadn't already seen it), `false` if
 * the call was a no-op because the seen flag was already set —
 * call sites can use the return value to chain analytics or
 * skip follow-up effects.
 */
export function fireJITTooltip(kind: JITTooltipKind): boolean {
  const seen = useUserStore.getState().jitTooltipsSeen;
  const config = JIT_TOOLTIP_CONFIGS[kind];
  if (seen[config.seenKey]) return false;
  // Stamp the flag BEFORE showing so a re-render race at the
  // trigger site (e.g. MatchResultScreen mount effect firing twice
  // under Strict Mode) can't double-enqueue. The queue's own
  // duplicate-suppression also handles this — belt and braces.
  useUserStore.getState()[config.markAction]();
  useJITTooltipQueue.getState().show(kind);
  return true;
}
