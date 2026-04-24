/**
 * Domain types shared across the game layer.
 *
 * Phase 1A scope: only the metadata + rules descriptions that the UI
 * catalog and primitives need. The runtime `ModeDefinition` (engine
 * dispatch, feedback evaluator, bot strategy) lands in Phase 2 and will
 * reference these same types without requiring a refactor.
 *
 * Convention (ROADMAP-v4 §Catalog): the numeric `id` lives on the
 * catalog entry root. It is NOT duplicated inside `meta` or `rules`.
 */

export type ModeSection = 'CLASSIC' | 'ADVANCED';

/** Keys for the icon dispatch; matches reference/modes.jsx ModeIcon switch. */
export type ModeIconKey =
  | 'color-match'
  | 'high-low'
  | 'precision'
  | 'blitz'
  | 'blackout'
  | 'sudden-death'
  | 'mirror';

/** Optional category tag rendered on the ModeCard (e.g. "PRESTIGE"). */
export interface ModeBadge {
  readonly label: string;
  /** Hex color that paints the tag text + border + wash. */
  readonly color: string;
}

/** Two-stop gradient used for the circular icon badge on ModeCard. */
export type ModeGradient = readonly [string, string];

/**
 * Presentation data for a single mode — what the ModeCard renders and
 * what Home/Secret Setup/Match headers label.
 */
export interface ModeMeta {
  readonly section: ModeSection;
  readonly name: string;
  readonly description: string;
  /** Token stake to enter a match in this mode. */
  readonly stake: number;
  /** Tokens returned on a win. */
  readonly rewardWin: number;
  /** Tokens returned on a draw (may be zero or a partial refund). */
  readonly rewardDraw: number;
  readonly badge?: ModeBadge;
  readonly gradient: ModeGradient;
  readonly iconKey: ModeIconKey;
}

/**
 * Behavioural flags shared across modes. A flag is the sentinel for a
 * rule variation the engine must honour (e.g. blackout hides digits
 * until locked-in). Each flag defaults to `false` when omitted.
 */
export interface ModeRuleFlags {
  /** Mode 5 — guess digits only revealed if they matched in the exact slot. */
  readonly blackoutReveal?: boolean;
  /** Mode 4 — each player has their own chess-clock style countdown. */
  readonly perPlayerClock?: boolean;
  /** Mode 7 — both players race the same secret in parallel, first to crack wins. */
  readonly parallelRace?: boolean;
  /** Mode 6 — sudden-death variant: fixed guess budget, no draws. */
  readonly suddenDeath?: boolean;
}

/**
 * Mode mechanics — enough for the UI to render limit indicators and for
 * the engine (Phase 2) to drive the match.
 */
export interface ModeRules {
  readonly secretLength: number;
  readonly digitsUnique: boolean;
  /** When set, each player can submit at most this many guesses. */
  readonly maxGuessesPerPlayer?: number;
  /** When set, each player gets this many ms of cumulative think time. */
  readonly perPlayerTimeLimitMs?: number;
  readonly flags: ModeRuleFlags;
}

/**
 * A full catalog entry. The numeric `id` is load-bearing — it is the
 * stable handle used by routes, analytics, and match payloads.
 */
export interface ModeCatalogEntry {
  readonly id: number;
  readonly meta: ModeMeta;
  readonly rules: ModeRules;
}
