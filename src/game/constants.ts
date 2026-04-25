/**
 * Mode-agnostic numeric constants. Centralised so tweaks (Blitz time,
 * Sudden Death budget, ad reward) are a one-line change instead of a
 * multi-file grep, and so the engine layer never carries magic numbers
 * that drift from the SPEC.
 *
 * Values trace back to:
 *   - SECRET_LENGTH, BOT_THINK_*, BLITZ_*, SUDDEN_DEATH_*  → SPEC §6
 *   - DAILY_AD_*  → SPEC §7.1 (economy)
 *   - FILTER_CHUNK_SIZE  → ROADMAP §Heavy Filtering (yieldToUI cadence)
 *   - AD_COOLDOWN_MS  → reserved for Phase 7B (currently unused)
 */

export const SECRET_LENGTH = 4 as const;

/** Lower bound on bot "thinking" delay; below this the UI feels robotic. */
export const BOT_THINK_MIN_MS = 2000;
/** Upper bound; above this the UI feels frozen. */
export const BOT_THINK_MAX_MS = 12_000;

/** Mode 4 — total wall-clock per player. */
export const BLITZ_TIME_LIMIT_MS = 60_000;
/** Mode 4 — UX grace before declaring time-out (network/animation jitter). */
export const BLITZ_GRACE_PERIOD_MS = 5_000;

/** Mode 6 — guesses each side gets before stalemate kicks in. */
export const SUDDEN_DEATH_MAX_GUESSES = 5;

/** SPEC §7.1 — ad watch ceiling per UTC day. */
export const DAILY_AD_LIMIT = 10;
/** SPEC §7.1 — tokens granted per ad watch. */
export const DAILY_AD_REWARD = 50;

/**
 * `filterByFeedbackChunked` slice size. ~500 entries × ~0.04ms predicate
 * = 20ms per chunk, comfortably under a 60fps frame budget.
 */
export const FILTER_CHUNK_SIZE = 500;

/** Reserved for Phase 7B ad cooldown enforcement. */
export const AD_COOLDOWN_MS = 300_000;
