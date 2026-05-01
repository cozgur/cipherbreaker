/**
 * Phase 7A.4 — Daily Challenge domain types.
 *
 * All types live in this single module so the cross-cutting CP3
 * schema migration (userStore v2 → v3) and the CP4 store + screen
 * have one canonical home to import from. Type-only file: zero
 * runtime cost, free to forward-declare CP3+ shapes from CP2.
 *
 * Naming note: `DailyChallenge*` prefix is reserved for the persisted
 * per-user state slice; `Daily*` is for transient runtime values
 * (the active attempt, a single guess record, the result summary).
 */

export type DailyOutcome = 'succeeded' | 'failed';

/**
 * Calendar-driven daily configuration: digit count + turn budget.
 * Computed by `getDailyConfig(date, dailyState)` in CP3 — user-aware
 * because streak breaks regress the effective digit tier (Reading A
 * + `effectiveDayOffset` model — see ARCHITECTURE Phase 7A.4 delta).
 */
export interface DailyChallengeConfig {
  readonly digits: number;
  readonly turnLimit: number;
}

/**
 * A single submitted guess + its evaluated `+N / -M` feedback. The
 * shape mirrors what the share-text generator (CP6) and the
 * DailyResult screen (CP4) consume; it deliberately does NOT carry
 * timestamps because resume identity belongs to the state machine,
 * not to per-row metadata.
 */
export interface DailyGuessRecord {
  readonly guess: string;
  readonly plus: number;
  readonly minus: number;
  readonly isWin: boolean;
}

/**
 * In-progress attempt persisted across app suspend. The player
 * resumes mid-board on relaunch.
 *
 * Cross-midnight policy (`inProgress.date !== today`): silent drop,
 * counts as a missed day, breaks the streak, triggers tier
 * regression. Wordle-faithful — see ARCHITECTURE Phase 7A.4 delta
 * for the rejected alternatives ("you missed yesterday" toast).
 */
export interface DailyInProgress {
  readonly date: string; // 'YYYY-MM-DD' local-calendar string
  readonly secret: string;
  readonly digits: number;
  readonly turnLimit: number;
  readonly guesses: readonly DailyGuessRecord[];
}

/**
 * One entry in the cap-90 rolling history log (3 months). Slice to
 * cap happens at write time (`recordDailyResult` action in CP4),
 * never at read time — selectors stay O(1).
 */
export interface DailyHistoryEntry {
  readonly date: string;
  readonly digits: number;
  /** Turns used (success path) or `turnLimit` (failure path). */
  readonly turns: number;
  readonly success: boolean;
}

/**
 * Snapshot of the just-completed day. Drives the DailyResult screen
 * (CP4) and the share-text generator (CP6). Cleared by
 * `dailyChallengeStore.startToday()` once the user moves to the
 * next day's puzzle, so two consecutive days never overlap on this
 * field.
 */
export interface DailyResultSummary {
  readonly date: string;
  readonly digits: number;
  readonly turnLimit: number;
  readonly turnsUsed: number;
  readonly success: boolean;
  /** Full +N/-M trail for the share text and the result reveal. */
  readonly feedbackTrail: readonly DailyGuessRecord[];
}

/**
 * Persisted per-user Daily Challenge state — `userStore.dailyChallenge`
 * in schema v3. Migration v2 → v3 (CP3) seeds defaults: empty
 * history, no streak, no in-progress attempt, no last result.
 *
 * Reading A + `effectiveDayOffset` model: streak break increments
 * `effectiveDayOffset` by the **prior** tier's period length (7 for
 * tier-5 break → 4-digit period; 10 for tier-6 break → 5-digit
 * period; 0 at tier-4 floor). `effectiveDay = calendarDay -
 * effectiveDayOffset` feeds the tier-from-day formula.
 */
export interface DailyChallengeState {
  readonly lastPlayedDate: string | null;
  readonly currentStreak: number;
  readonly longestStreak: number;
  /** Cumulative regression — see Reading A model above. */
  readonly effectiveDayOffset: number;
  readonly inProgress: DailyInProgress | null;
  readonly lastResult: DailyResultSummary | null;
  /** Cap 90 — see `DailyHistoryEntry`. */
  readonly history: readonly DailyHistoryEntry[];
}
