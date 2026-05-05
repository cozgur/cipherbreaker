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
  /**
   * Engine selector. When `true`, `selectEngine(mode)` routes to
   * `parallelEngine` (no turn rotation; both sides submit independently;
   * first to crack wins; both-exhausted = stalemate). Phase 6 sets this
   * for Mode 6 (Sudden Death) and Mode 7 (Mirror); turn-based modes
   * leave it absent.
   *
   * `parallelRace` is the **engine** discriminator. The "shared secret /
   * skip SecretSetup" semantic — Mirror-only — lives on its own flag
   * (`sharedSecret`) so Mode 6's parallel migration doesn't accidentally
   * skip the player-set secret stage.
   */
  readonly parallelRace?: boolean;
  /**
   * Mode 7 (Mirror) — both sides race the **same** engine-generated
   * secret. `parallelEngine.createMatch` overwrites the caller-supplied
   * `playerSecret` with the generated value when this flag is set, so
   * `submitGuess`'s `targetSecret` resolution maps both sides to the
   * shared string. `modeRouter.nextRouteAfterMatchmaking` consults this
   * flag to skip SecretSetup (player has nothing to choose).
   */
  readonly sharedSecret?: boolean;
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
      /**
       * Phase 2+ engines set this to `true` when the guess matched the
       * secret exactly. Optional so Phase 1B mock entries (which never
       * win) stay valid without backfilling the field. Helpers must
       * read defensively (`?.isWin === true`).
       */
      readonly isWin?: boolean;
    }
  | {
      /** Mode 2 — is the secret higher or lower than the guess. */
      readonly kind: 'direction';
      readonly dir: 'higher' | 'lower';
      readonly isWin?: boolean;
    }
  | {
      /** Mode 3 — count of right-spot (+) and wrong-spot (−) hits. */
      readonly kind: 'precision';
      readonly plus: number;
      readonly minus: number;
      readonly isWin?: boolean;
    }
  | {
      /** Mode 5 — digits stay blacked out except for locked-in matches. */
      readonly kind: 'blackout';
      readonly states: readonly DigitTileVisualState[];
      readonly locked: number;
      readonly isWin?: boolean;
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
  /**
   * Wall-clock timestamp (`Date.now()`) the engine stamps when the
   * guess is appended. Phase 6 CP5 added this for Mode 6's parallel
   * timeline ordering — both sides may submit out of strict
   * alternation, so `interleaveTimeline({chronological:true})` sorts
   * by this field instead of the round-robin alternation that
   * turn-based modes use.
   *
   * Optional in the type so pre-CP5 persisted states + lightweight
   * test fixtures stay valid; production engines always set it.
   * Mode 7 (Mirror) hides the opponent timeline entirely so this
   * field is unread there even though parallelEngine writes it.
   */
  readonly createdAt?: number;
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

// ─────────────────────────────────────────────────────────────
// Phase 2 — engine + match contracts
// ─────────────────────────────────────────────────────────────

/**
 * Validation outcome returned by `mode.validateGuess(...)`. Per ROADMAP
 * §Hata Stratejisi, *user-facing* failures never throw — they propagate
 * through this discriminated union so the UI can surface a clean
 * message. Architectural failures (unknown mode id, corrupt state) use
 * the typed `Error` subclasses in `errors.ts`.
 */
export type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: ValidationError };

export interface ValidationError {
  readonly code: 'WRONG_LENGTH' | 'NOT_DIGITS' | 'NOT_UNIQUE' | 'OUT_OF_RANGE';
  /** Human-readable, surfaceable in the UI as-is. */
  readonly message: string;
}

/** Phases the match cycles through. `'completed'` is terminal — `result` is non-null. */
export type MatchPhase =
  | 'setup'
  | 'active_turn_player'
  | 'active_turn_opponent'
  | 'active_parallel'
  | 'completed';

/** Discriminated union of every terminal match outcome. */
export type MatchResult =
  | {
      readonly outcome: 'player_won';
      readonly reason: 'cracked' | 'opponent_time_out' | 'opponent_guess_limit';
      readonly turns: number;
    }
  | {
      readonly outcome: 'opponent_won';
      readonly reason: 'cracked' | 'player_time_out' | 'player_guess_limit';
      readonly turns: number;
    }
  | {
      readonly outcome: 'draw';
      readonly reason: 'simultaneous_crack';
      readonly turns: number;
    }
  | {
      readonly outcome: 'stalemate';
      readonly reason: 'both_exhausted';
      readonly turns: number;
    };

/** Mode 6 — remaining guess budget per side (decremented post-evaluate). */
export interface GuessLimits {
  readonly playerRemaining: number;
  readonly opponentRemaining: number;
}

/**
 * Mode 4 — DURABLE clock state, persisted with `MatchState`. Captured
 * at every guess + at app suspend; the live tick value lives in
 * `LiveClockState` (transient store, no AsyncStorage write).
 */
export interface ClockSnapshot {
  readonly playerMs: number;
  readonly opponentMs: number;
  readonly activeOwner: 'player' | 'opponent' | null;
  readonly snapshotTimestamp: number;
}

/**
 * Mode 4 — TRANSIENT live clock owned by `liveMatchStore`. Updated at
 * tick frequency (~10Hz) without persisting; resync from
 * `ClockSnapshot` on hydrate.
 */
export interface LiveClockState {
  readonly playerMs: number;
  readonly opponentMs: number;
  readonly activeOwner: 'player' | 'opponent' | null;
  readonly lastTickAt: number;
}

/**
 * Internal state a bot's solver keeps between turns. Discriminated on
 * `kind` so the engine can `SolverStateMismatchError` if a registered
 * mode hands back a shape that doesn't match what its bot expects.
 *
 * Pool members are 4-character digit strings (`'1234'`) to keep the
 * candidate pool compact (`string` is half the size of `number[]` in
 * memory and identity-comparable). Convert at the boundary via
 * `secretGeneration` / candidate pool helpers.
 *
 * Mode 5 (Blackout) does NOT need a custom variant — the SPEC §3.7
 * feedback is just a count of right-spot hits, so its bot filters a
 * regular `candidatePool` by re-running the evaluator against each
 * candidate and matching the `locked` count. A Phase 2-era stub
 * `blackoutConstraints` variant with `{ position, digit }` records
 * was deleted in Phase 5: the SPEC reveals neither, so the constraint
 * shape was unreachable from feedback alone.
 */
export type SolverState =
  | { readonly kind: 'candidatePool'; readonly pool: readonly string[] }
  | { readonly kind: 'mirror'; readonly pool: readonly string[]; readonly targetTurn: number }
  | {
      /**
       * Mode 2 — bot tracks the binary-search interval `[low, high]`
       * of integers (0..9999) the secret could still be. Each guess+
       * feedback narrows one bound; `pickInRange` chooses the next
       * guess by difficulty (hard → midpoint, normal → uniform, easy
       * → biased toward the edges).
       */
      readonly kind: 'directionRange';
      readonly low: number;
      readonly high: number;
    };

/** Optional per-side solver state — both sides for hint mode / replay. */
export interface SolverStates {
  readonly player?: SolverState;
  readonly opponent?: SolverState;
}

/**
 * Three-tier bot strength used by mode bots (`mode1/bot.ts` etc.) and
 * stamped onto `MatchState` at match creation. Phase 7A.2 ties this to
 * the player's recent outcome window via `pickDifficultyFromOutcomes`
 * — see `src/game/dda/`.
 */
export type BotDifficulty = 'easy' | 'normal' | 'hard';

/** Inputs a mode's `bot.makeGuess` consumes; immutable per turn. */
export interface BotContext {
  readonly previousGuesses: readonly GuessEntry[];
  readonly mySecret: string;
  readonly difficulty: BotDifficulty;
  readonly turnNumber: number;
  readonly solverState: SolverState;
  /**
   * Per-turn RNG handed in by the orchestrator (`matchStore.runOpponentTurn`).
   * The orchestrator passes the *same* instance to `engine.submitGuess`
   * after `makeGuess` returns so the persisted `rngState` reflects every
   * draw the bot made — that's the resume-identity contract.
   *
   * `bot.thinkingTime` deliberately does NOT consume from this RNG —
   * UI delay is not part of resume identity. See ARCHITECTURE §Phase 3.
   */
  readonly rng: RNG;
}

/** Persisted RNG cursor — see `src/lib/random.ts`. */
export interface RNGStateSnapshot {
  readonly seed: number;
  readonly callCount: number;
}

/**
 * The full durable match shape. Everything bot-resume-relevant lives
 * here so AsyncStorage hydration on cold-start is a single deserialise.
 * Live-tick fields (clock display) live in `LiveClockState`.
 */
export interface MatchState {
  readonly modeId: number;
  readonly playerSecret: string;
  readonly opponentSecret: string;
  readonly playerGuesses: readonly GuessEntry[];
  readonly opponentGuesses: readonly GuessEntry[];

  readonly phase: MatchPhase;
  readonly result: MatchResult | null;

  readonly guessLimits?: GuessLimits;
  readonly solverStates?: SolverStates;

  /**
   * Bot difficulty stamped on `createMatch` and frozen for the lifetime
   * of the match — must be durable so resume produces the same bot
   * behaviour. Phase 7A.2 wires SPEC §5.5 hidden DDA at
   * `matchStore.createMatch` (see `pickDifficultyFromOutcomes`); the
   * engines stay userStore-naïve and pass this field through.
   *
   * Optional: pre-Phase-3 persisted match states hydrate with
   * `botDifficulty=undefined`, which the engines fall back to
   * `'normal'` for — no persist version bump needed.
   */
  readonly botDifficulty?: BotDifficulty;

  /**
   * Phase 7A.5 CP6 — set when the player has redeemed the
   * rewarded "Double your tokens" CTA on the post-match screen.
   * Idempotency guard for the Double UI (the button hides when
   * this flag is true) and an audit trail for analytics. Pre-CP6
   * persisted matches hydrate with `undefined`, treated as not
   * doubled — same optional-field pattern `botDifficulty` uses to
   * avoid a persist version bump.
   *
   * Daily Challenge (`dailyChallengeStore.currentAttempt`) does
   * NOT use this field — Daily is ad-free by design (Q7=B). The
   * Double UI never reaches DailyResultScreen.
   */
  readonly doubledReward?: boolean;

  /**
   * Side that took the very first turn — used by the UI to interleave
   * `playerGuesses` and `opponentGuesses` into a chronological timeline
   * for the MatchScreen scrollback. Set by `startMatch` from the same
   * RNG roll that picks the initial phase.
   *
   * Optional: pre-Phase-3 persisted states hydrate with `undefined`,
   * which the UI helper treats as "self" (the safe Mode 1 default —
   * Phase 3 is the first phase that surfaces this field).
   */
  readonly firstAuthor?: GuessSide;

  /** Always reflects the cursor *after* the last RNG-consuming step. */
  readonly rngState: RNGStateSnapshot;

  /** Mode 4 only — last persisted clock reading (live values are transient). */
  readonly clockSnapshot?: ClockSnapshot;

  readonly startedAt: number;
  readonly lastUpdatedAt: number;
}

/**
 * Forward declaration of the RNG interface so `ModeDefinition` can
 * reference it without `src/game/*` importing `src/lib/random.ts`
 * (kept domain-pure: `lib/` is the boundary). The concrete impl is in
 * `src/lib/random.ts`; see ROADMAP §RNG State for the contract.
 */
export interface RNG {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: readonly T[]): T[];
  weightedPick<T extends string>(weights: Readonly<Record<T, number>>): T;
  getState(): RNGStateSnapshot;
}

/**
 * The plug-in mode contract. Each mode file in `src/game/modes/`
 * exports a single `ModeDefinition`, which the registry indexes by
 * `id`. *No checkWinCondition* — `feedback.isWin` is the single
 * source of truth, evaluated by the engine (not the mode).
 */
export interface ModeDefinition {
  readonly id: number;
  readonly meta: ModeMeta;
  readonly rules: ModeRules;

  generateSecret(rng: RNG): string;
  validateGuess(guess: string): ValidationResult;
  evaluate(guess: string, secret: string): NormalizedFeedback;

  readonly bot: {
    initSolverState(secret: string, rules: ModeRules): SolverState;
    /**
     * Phase 2 leaves this returning a `Promise` so heavy modes (Mode 3,
     * Mode 5) can chunk their candidate filtering with `yieldToUI()`
     * without an interface refactor.
     */
    makeGuess(context: BotContext): Promise<{ guess: string; newSolverState: SolverState }>;
    thinkingTime(context: BotContext): number;
  };
}
