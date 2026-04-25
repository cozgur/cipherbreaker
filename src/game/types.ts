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
  /**
   * Single-word abbreviation for tight surfaces (Profile BY MODE grid,
   * future Match header chips). The full `name` (`"SUDDEN DEATH"`)
   * truncates with an ellipsis in narrow tiles; `shortLabel`
   * (`"SUDDEN"`) always fits.
   */
  readonly shortLabel: string;
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

// ─────────────────────────────────────────────────────────────
// Guess feedback + timeline shapes (Phase 1B; finalised in Phase 2)
// ─────────────────────────────────────────────────────────────

/**
 * Which side of the timeline a guess belongs to. `self` = local player,
 * `opponent` = remote. UI converts this to `'left' | 'right'` via the
 * adaptor so the component layer stays free of player-identity logic.
 */
export type GuessSide = 'self' | 'opponent';

/** Per-position digit paint states the `DigitTile` primitive understands. */
export type DigitTileVisualState = 'neutral' | 'green' | 'yellow' | 'gray' | 'violet' | 'blackout';

/**
 * Mode-agnostic feedback shape produced by engines (Phase 2+) and
 * consumed by per-mode row components. Discriminated on `kind` so each
 * renderer can do an exhaustive switch — `noFallthroughCasesInSwitch`
 * (ARCHITECTURE §Phase 0) turns a missed branch into a compile error.
 *
 * Phase 1B mock history produces these shapes directly. Phase 2
 * engines will produce the *same* shapes — no adaptor refactor.
 */
export type NormalizedFeedback =
  | {
      /** Modes 1, 4, 6, 7 — per-position Wordle-style colouring. */
      readonly kind: 'colorMatch';
      readonly states: readonly DigitTileVisualState[];
    }
  | {
      /** Mode 2 — is the secret higher or lower than the guess. */
      readonly kind: 'direction';
      readonly dir: 'higher' | 'lower';
    }
  | {
      /** Mode 3 — count of right-spot (+) and wrong-spot (−) hits. */
      readonly kind: 'precision';
      readonly plus: number;
      readonly minus: number;
    }
  | {
      /** Mode 5 — digits stay blacked out except for locked-in matches. */
      readonly kind: 'blackout';
      readonly states: readonly DigitTileVisualState[];
      readonly locked: number;
    };

/**
 * Single entry in a match timeline. `guessIndex` is 1-based so Mode 6
 * can render "3/5" directly; `elapsedMs` is the Blitz clock delta the
 * Mode 4 row surfaces as a monospace extra label.
 *
 * Phase 2 engines produce `GuessEntry[]` on every `submitGuess`.
 * Phase 1B mocks produce the same shape so the MatchScreen consumer
 * path is identical.
 */
export interface GuessEntry {
  readonly side: GuessSide;
  readonly guessIndex: number;
  readonly digits: readonly number[];
  readonly feedback: NormalizedFeedback;
  /** Mode 4 — time the guess took. Omitted for non-Blitz modes. */
  readonly elapsedMs?: number;
}

/**
 * Context the adaptor needs to turn a `GuessEntry` into row props:
 * which avatar to paint per side, and which mode the row belongs to
 * (Mode 6 surfaces `guessIndex/totalGuesses` as the `extra` chip).
 */
export interface GuessRowAdaptorContext {
  readonly selfAvatar: string;
  readonly opponentAvatar: string;
  readonly modeId: number;
}

/**
 * Props consumed by every per-mode row component in
 * `src/components/game/rows/*`. Intentionally mode-agnostic at the
 * type level — each row casts `feedback.kind` and handles what it
 * cares about. `extra` is a pre-formatted mode-specific sublabel
 * (e.g. `"0:08s"` for Blitz, `"3/5"` for Sudden Death) so the row
 * component never formats time or counts itself.
 */
export interface GuessRowProps {
  readonly side: 'left' | 'right';
  readonly avatar: string;
  readonly digits: ReadonlyArray<{ val: number; state: DigitTileVisualState }>;
  readonly feedback?: NormalizedFeedback;
  readonly extra?: string;
}
