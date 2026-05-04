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
 *
 * `revealedPositions` (Phase 7A.4 CP6 hint system): positions the
 * player has already paid to reveal via the hint mechanic. The hint
 * picker draws from `(0..digits-1) \ revealedPositions ∩ correct
 * positions in the current attempt's most-informative guess set`.
 * `hintsUsed` is the local counter that ends up on the result
 * summary + history entry; the userStore-side `earnedHints` is the
 * separate "free hints remaining" pool.
 */
export interface DailyProbeRecord {
  readonly digit: number;
  readonly exists: boolean;
}

export interface DailyInProgress {
  readonly date: string; // 'YYYY-MM-DD' local-calendar string
  readonly secret: string;
  readonly digits: number;
  readonly turnLimit: number;
  readonly guesses: readonly DailyGuessRecord[];
  /**
   * Phase 7A.4 CP6 — total hint button taps (Hint A + Hint B
   * combined). Drives the post-game "PURE SKILL" badge + the share
   * format. Always strictly increasing per attempt.
   */
  readonly hintsUsed: number;
  /**
   * Hint A green-tier reveals — positions where the player has
   * paid to learn `(position, digit)`. Skipped by the next reveal
   * picker so a second hint surfaces a fresh position.
   */
  readonly revealedPositions: readonly number[];
  /**
   * Hint A yellow-tier reveals — digits the player has paid to
   * confirm exist in the secret (without committing to a position).
   * Each `useHint()` that returns `'yellow'` appends here.
   */
  readonly revealedDigits: readonly number[];
  /**
   * Hint B probe results — every digit the player has interrogated
   * via the probe button, with whether that digit appears in the
   * secret. The keypad reads this list to render existence dots /
   * strikethroughs and the picker disables already-probed digits.
   */
  readonly probedDigits: readonly DailyProbeRecord[];
}

/**
 * One entry in the cap-90 rolling history log (3 months). Slice to
 * cap happens at write time (`recordDailyResult` action in CP4),
 * never at read time — selectors stay O(1).
 *
 * `hintsUsed` (Phase 7A.4 CP6) tags the entry so the share text
 * + DailyResult "PURE SKILL" badge can grade the run. Zero is the
 * common case (no hint button taps).
 */
export interface DailyHistoryEntry {
  readonly date: string;
  readonly digits: number;
  /** Turns used (success path) or `turnLimit` (failure path). */
  readonly turns: number;
  readonly success: boolean;
  readonly hintsUsed: number;
}

/**
 * Snapshot of the just-completed day. Drives the DailyResult screen
 * (CP4) and the share-text generator (CP6). Cleared by
 * `dailyChallengeStore.startToday()` once the user moves to the
 * next day's puzzle, so two consecutive days never overlap on this
 * field.
 *
 * The `secret` is captured here so DailyResult can reveal it on
 * failure (Wordle-faithful — the player who couldn't crack the code
 * sees the answer). On success the field is still populated; the
 * screen just doesn't surface it (the player already cracked it).
 */
export interface DailyResultSummary {
  readonly date: string;
  readonly digits: number;
  readonly turnLimit: number;
  readonly turnsUsed: number;
  readonly success: boolean;
  readonly secret: string;
  /** Full +N/-M trail for the share text and the result reveal. */
  readonly feedbackTrail: readonly DailyGuessRecord[];
  /** Phase 7A.4 CP6 — hint button taps during the attempt. */
  readonly hintsUsed: number;
}

/**
 * Persisted per-user Daily Challenge state — `userStore.dailyChallenge`
 * in schema v3. Migration v2 → v3 (CP3) seeds defaults: empty
 * history, no streak, no last result.
 *
 * Reading A + `effectiveDayOffset` model: streak break increments
 * `effectiveDayOffset` by the **prior** tier's period length (7 for
 * tier-5 break → 4-digit period; 10 for tier-6 break → 5-digit
 * period; 0 at tier-4 floor). `effectiveDay = calendarDay -
 * effectiveDayOffset` feeds the tier-from-day formula.
 *
 * Architectural note (Phase 7A.4 CP4): the in-progress attempt
 * (`DailyInProgress`) was originally forward-declared as a field
 * here, but the matchStore-pattern split lands it in
 * `dailyChallengeStore` instead — that store owns per-attempt
 * lifecycle (parallel to how `matchStore` owns `MatchState` for
 * Modes 1-7). userStore.dailyChallenge stays per-user-durable;
 * dailyChallengeStore stays per-attempt-durable. One source of
 * truth per concept, no cross-store hydration race.
 */
export interface DailyChallengeState {
  readonly lastPlayedDate: string | null;
  readonly currentStreak: number;
  readonly longestStreak: number;
  /** Cumulative regression — see Reading A model above. */
  readonly effectiveDayOffset: number;
  readonly lastResult: DailyResultSummary | null;
  /** Cap 90 — see `DailyHistoryEntry`. */
  readonly history: readonly DailyHistoryEntry[];
  /**
   * Phase 7A.4 CP6 — free hint pool earned from streak milestones.
   * Cap 3. Decrements on each `useHint()`; once empty, hint usage
   * falls back to a 100-token cost. Streak break resets to 0.
   */
  readonly earnedHints: number;
  /**
   * The streak threshold (7, 14, or 21) at which the most-recent
   * earnedHints bump landed. Idempotency guard so a streak of 8, 9,
   * 10... doesn't re-grant the +1 the player already collected at
   * streak 7. `0` means no threshold has been crossed yet.
   */
  readonly lastHintEarnedAtStreak: number;
}
