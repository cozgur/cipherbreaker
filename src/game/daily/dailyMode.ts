/**
 * Phase 7A.8 CP9 — Daily Challenge mode rotation picker.
 *
 * The Daily alternates between Mode 1 (Color Match) and Mode 3
 * (Precision) on a deterministic per-day basis. Mode 2 (High & Low)
 * is deferred to Phase 9 — it needs a bespoke whole-number bisection
 * board for Daily (not a config swap on the existing Mastermind
 * board). See docs/PHASE-9-BACKLOG.md.
 *
 * Determinism mirrors `getDailySecret`: the day's mode is a pure
 * function of the day index, so the mode is re-derived on render with
 * zero persistence. The attempt stores only `date`; no `DailyInProgress`
 * schema change, no store migration. Phase 7A.8 CP9.1 — the index is
 * now per-user (days since the player's first play), so the epoch is
 * threaded in.
 *
 * `daySeed % 2` yields strict alternation (Mode 1 / 3 / 1 / 3 …)
 * rather than hashed pseudo-randomness — chosen on purpose: it
 * guarantees both modes recur on a tight cadence (no long droughts a
 * hash could produce) and reads naturally. Day 1 (odd) resolves to
 * Mode 3, so every player's first Daily is Precision.
 */

import { findMode } from '@data/modeCatalog';

import { calendarDayIndex } from './dailyConfig';

/** The two modes currently in the Daily rotation. */
export type DailyMode = 1 | 3;

/**
 * Map a day-seed to its Daily mode. Even → Mode 1 (Color Match),
 * odd → Mode 3 (Precision). Pure + deterministic.
 */
export function pickDailyMode(daySeed: number): DailyMode {
  return daySeed % 2 === 0 ? 1 : 3;
}

/**
 * Convenience: the Daily mode for a 'YYYY-MM-DD' calendar date,
 * relative to the player's first-play `epoch` (CP9.1 per-user index).
 */
export function dailyModeForDate(date: string, epoch: string): DailyMode {
  return pickDailyMode(calendarDayIndex(date, epoch));
}

/**
 * Human-facing mode label for the "Daily Challenge — [Mode Name]"
 * header, title-cased from the modeCatalog source of truth
 * ('COLOR MATCH' → 'Color Match'). Single source — no second copy of
 * the mode names to drift out of sync with the catalog.
 */
export function dailyModeLabel(mode: DailyMode): string {
  const name = findMode(mode)?.meta.name ?? '';
  return toTitleCase(name);
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(' ')
    .map((word) => (word.length === 0 ? word : word[0]!.toUpperCase() + word.slice(1)))
    .join(' ');
}
