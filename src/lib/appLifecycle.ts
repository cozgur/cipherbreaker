/**
 * Mode 4 (Blitz) — AppState lifecycle handler. SPEC §3.6 + ROADMAP
 * §App Lifecycle: a Blitz match must keep ticking the active side's
 * clock when the user backgrounds the app, but a 5-second grace
 * period absorbs short interruptions (push notification preview,
 * Control Center, an inadvertent gesture) before the match auto-
 * forfeits.
 *
 * Behaviour:
 *   - On `'background'`: capture `backgroundStartedAt`, schedule a
 *     `BLITZ_GRACE_PERIOD_MS` timer that fires `applyTimeout` if the
 *     user doesn't return in time.
 *   - On `'active'`: clear the timer; if the elapsed bg duration is
 *     within grace, decrement the active owner's clock by the
 *     elapsed time (so cheating-by-backgrounding is bounded). If
 *     somehow we land in active with the timer still pending and
 *     elapsed > grace, the timer's defensive null-check no-ops.
 *   - `'inactive'` is treated as a transient on iOS (Control Center,
 *     push notification banner). We deliberately do NOT start the
 *     grace timer on `'inactive'` — only when state lands at
 *     `'background'` proper. Otherwise transient pulls would burn
 *     the player's clock.
 *
 * Cross-platform note:
 *   - iOS: state sequence is typically `active → inactive →
 *     background` on real backgrounding, and `active → inactive →
 *     active` on transient interruptions. Listening only to
 *     `'background'` filters both correctly.
 *   - Android: `'background'` arrives directly. The OS may kill the
 *     app aggressively in low-memory states; cold-start resume is
 *     a Phase 7B concern, not handled here.
 *
 * Module-level mutable state (`backgroundStartedAt`, `graceTimer`)
 * is intentional — it's lifecycle metadata, not match data, and
 * survives the listener's subscribe/unsubscribe cycle. Tests reset
 * it via `__resetForTests`.
 *
 * Forfeit goes through the existing `matchStore.applyTimeout(...)`
 * with `playerMs: 0` — same code path as a clock-zero detection in
 * the tick interval. No new outcome reason; telemetry stays uniform.
 */

import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';

import { BLITZ_GRACE_PERIOD_MS } from '@game/constants';

import { useLiveMatchStore } from '../state/liveMatchStore';
import { useMatchStore } from '../state/matchStore';

let backgroundStartedAt: number | null = null;
let graceTimer: ReturnType<typeof setTimeout> | null = null;

function isBlitzActive(): boolean {
  const state = useMatchStore.getState().matchState;
  return state !== null && state.modeId === 4 && state.phase !== 'completed';
}

function fireForfeit(): void {
  // Defensive — if the user came back inside grace, the active
  // handler nulled `backgroundStartedAt` before we ran. No-op so
  // a late-firing timer doesn't punish a player who already
  // returned. (Advisor flagged this as the timer-vs-active race.)
  if (backgroundStartedAt === null) return;
  if (!isBlitzActive()) {
    backgroundStartedAt = null;
    graceTimer = null;
    return;
  }
  const live = useLiveMatchStore.getState().liveClocks;
  const opponentMs = live?.opponentMs ?? 0;
  const activeOwner = live?.activeOwner ?? 'player';
  // SPEC: backgrounded forfeit attributes the loss to the player
  // regardless of whose turn was active. We manufacture a
  // playerMs=0 snapshot so `checkEndConditions` resolves to
  // `opponent_won/player_time_out`.
  useMatchStore.getState().applyTimeout({
    playerMs: 0,
    opponentMs,
    activeOwner,
    snapshotTimestamp: Date.now(),
  });
  backgroundStartedAt = null;
  graceTimer = null;
}

function handleStateChange(next: AppStateStatus): void {
  if (next === 'background') {
    if (!isBlitzActive()) return;
    // Reset both fields each time so multiple bg/fg cycles never
    // accumulate — Decision 6 in the CP3c plan.
    backgroundStartedAt = Date.now();
    if (graceTimer !== null) clearTimeout(graceTimer);
    graceTimer = setTimeout(fireForfeit, BLITZ_GRACE_PERIOD_MS);
    return;
  }
  if (next === 'active') {
    if (backgroundStartedAt === null) return;
    const elapsed = Date.now() - backgroundStartedAt;
    if (graceTimer !== null) {
      clearTimeout(graceTimer);
      graceTimer = null;
    }
    backgroundStartedAt = null;
    if (!isBlitzActive()) return;
    if (elapsed <= BLITZ_GRACE_PERIOD_MS) {
      useLiveMatchStore.getState().subtractPlayerTime(elapsed);
      return;
    }
    // elapsed > grace — the timer should have fired. As a defensive
    // fallback (e.g. JS event loop was starved while in bg, the
    // setTimeout never fired), emit the forfeit ourselves.
    fireForfeit();
  }
  // 'inactive', 'unknown', 'extension' — deliberate no-op (see file
  // header).
}

/**
 * Subscribe to AppState changes for the lifetime of an active Mode 4
 * match. Returns an `unsubscribe` function that removes the listener
 * and clears any pending grace timer. Idempotent on the unsubscribe
 * side; subscribe should be called once per MatchScreen mount.
 */
export function subscribeBlitzLifecycle(): () => void {
  const sub: NativeEventSubscription = AppState.addEventListener('change', handleStateChange);
  return () => {
    sub.remove();
    if (graceTimer !== null) {
      clearTimeout(graceTimer);
      graceTimer = null;
    }
    backgroundStartedAt = null;
  };
}

/** Test-only — flushes module-level state between cases. */
export function __resetAppLifecycleForTests(): void {
  if (graceTimer !== null) {
    clearTimeout(graceTimer);
    graceTimer = null;
  }
  backgroundStartedAt = null;
}
