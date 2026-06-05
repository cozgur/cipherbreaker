/**
 * Durable player profile. Persisted to AsyncStorage so cold starts
 * land on the same balance, level, and per-mode stats. Fields are
 * intentionally a flat shape — `mockUser`'s Phase 1B contract — so
 * the facade in `data/mockUser.ts` routes reads/writes here without
 * any structural translation.
 *
 * Migrations: every shape change bumps `STORE_VERSION` and adds a
 * `migrate` branch; the persist middleware runs the matching branch
 * to map old shapes onto the current one. Phase 7A.1 (v1 → v2)
 * renamed `stats.tokensEarned` → `stats.totalTokensEarned` (now
 * cumulative, was a static placeholder) and added
 * `stats.recentMatches` (rolling window of the last ten outcomes,
 * fed by `recordMatchResult`, consumed by the Phase 7A.2 DDA).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { generateUsername } from '@lib/usernameGen';

import type { DailyChallengeState, DailyResultSummary } from '@game/daily/types';
import { computeEarnedHints } from '@game/daily/hint';
import { computeNextDailyStreakState } from '@game/daily/streak';
import { calendarDayIndex, effectiveDigitTier, TIER_4_PERIOD, TIER_5_PERIOD } from '@game/daily/dailyConfig';
import { formatDailyDate } from '@game/daily/dailyDate';
import { applyAdWatched, canWatchAd } from '@game/economy/adCap';
import { AD_REWARD_TOKENS } from '@game/economy/constants';
import { rewardForCompletedMatch } from '@game/economy/matchReward';
import { modeRegistry } from '@game/modeRegistry';
import { MODE_UNLOCK_COSTS } from '@data/modeCatalog';
import type { MatchResultOutcome } from '@navigation/routes';
import { useMatchStore } from './matchStore';

export interface UserStats {
  readonly gamesPlayed: number;
  readonly winRate: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly avgTurns: number;
  /**
   * Lifetime cumulative reward (tokens earned across every match).
   * Was `tokensEarned` (static placeholder) in v1; renamed and now
   * incremented by `recordMatchResult` each time a positive
   * `tokensEarnedThisMatch` is supplied.
   */
  readonly totalTokensEarned: number;
  /**
   * Rolling window of the last ten match outcomes (most recent
   * last). Fed by every `recordMatchResult` call; consumed by the
   * Phase 7A.2 DDA to bias bot difficulty toward a hidden ~45% win
   * target. Older entries are dropped beyond the cap.
   */
  readonly recentMatches: readonly MatchResultOutcome[];
}

const RECENT_MATCH_WINDOW = 10;

export interface UserStoreState {
  readonly username: string;
  readonly tokens: number;
  readonly level: number;
  readonly currentXP: number;
  readonly targetXP: number;
  readonly hasOnboarded: boolean;
  readonly stats: UserStats;
  readonly perMode: Readonly<Record<number, { readonly winRate: number }>>;
  /**
   * Phase 7A.4 — Daily Challenge per-user persisted state. Streak,
   * regression offset, in-progress attempt, last result, history.
   * Schema landed in v3 migration. See `@game/daily/types`.
   */
  readonly dailyChallenge: DailyChallengeState;
  /**
   * Phase 7A.5 CP1 — ad-watch counter, used for the daily cap
   * (`AD_CAP_PER_DAY` from `@game/economy/constants`). Cross-midnight
   * reset is implicit: the cap module compares `adsWatchedLastDate`
   * against today's local-calendar string and treats a stale date
   * as a fresh quota. `null` = first-ever interaction (player has
   * not watched any ad yet on this device).
   */
  readonly adsWatchedToday: number;
  readonly adsWatchedLastDate: string | null;
  /**
   * Phase 7A.5 CP1 — counter for the periodic interstitial
   * (`INTERSTITIAL_MATCH_THRESHOLD` from `@game/economy/constants`).
   * Increments on every Mode 1–7 match completion (CP3 wires the
   * call site); resets to 0 when the interstitial fires. Daily
   * Challenge does NOT touch this counter — pinned by invariant
   * test.
   */
  readonly matchesSinceLastInterstitial: number;
  /**
   * Phase 7A.5 CP1 — Remove Ads IAP flag. `true` iff the player
   * has purchased the non-consumable `IAP_REMOVE_ADS_PRODUCT_ID`.
   * Removes only the forced interstitial layer (CP3); rewarded
   * paths (need-driven AdWatchScreen + double-token CTA) stay
   * available. Wired by RevenueCat in production; toggled via a
   * `__DEV__` Settings switch in dev/staging.
   */
  readonly adsRemoved: boolean;
  /**
   * Phase 7A.6 CP1 — onboarding flag bag. Tracks which onboarding
   * surfaces the player has seen so the flow can resume mid-step
   * across cold starts and so screens can avoid re-showing
   * surfaces that have already landed. Defaults are all `false` /
   * `null`; the v4 → v5 migration sets `introSeen: true` for
   * upgrade users with `gamesPlayed > 0` (they've earned the
   * right to skip the intro by actually playing).
   */
  readonly onboarding: OnboardingState;
  /**
   * Phase 7A.6 CP1 — counter incremented on every Mode 1–7 match
   * completion (engine path only). Drives the post-onboarding
   * mode-variety teasers (3 matches → Blitz teaser, 5 matches →
   * Mirror teaser). Daily Challenge does NOT touch this counter
   * — same ad-free-Daily pattern Phase 7A.5's
   * `matchesSinceLastInterstitial` follows. Pinned by an
   * invariant test: `recordDailyResult` and `recordMissedDay`
   * never mutate this field.
   */
  readonly matchesCompletedSinceOnboarding: number;
  /**
   * Phase 7A.7 CP3 — per-mode tutorial seen flags. CP4-CP7 will
   * gate first-time mode tutorials on this map (e.g.
   * `!modeTutorialsSeen[2]` triggers the Mode 2 High/Low tutorial
   * the first time a player taps the Mode 2 ModeCard from
   * HomeScreen). Sparse `Record<number, boolean>` — entries are
   * only set to `true` once the tutorial fires; absent keys read
   * as `undefined` under `noUncheckedIndexedAccess` and the
   * caller treats `undefined` as "not seen".
   *
   * Mode 1 is intentionally NOT in this map — its tutorial
   * (Phase 7A.6 CP3 `TutorialMatchScreen`) is owned by
   * `onboarding.tutorialMatchCompleted` instead. Two sources of
   * truth for the same boolean would invite drift.
   *
   * v5 → v6 migration applies a paternalistic-skip heuristic
   * (see `migrateV5ToV6`): existing players with
   * `stats.gamesPlayed > 0` get all Mode 2-7 marked seen on
   * upgrade — they've earned the right to skip tutorials by
   * having actually played matches. Fresh installs and admin-
   * reset users land on an empty map.
   */
  readonly modeTutorialsSeen: Readonly<Record<number, boolean>>;
  /**
   * Phase 7A.8 CP3 — just-in-time tooltip seen flags. Each tooltip
   * fires exactly once per user at its respective trigger:
   *   - `firstTokenEarn`: first post-onboarding win that grants
   *     tokens (MatchResultScreen mount).
   *   - `firstHintSpend`: first user-initiated hint use in Daily
   *     Challenge (DailyMatchScreen `onHintPress` / probe path).
   *     Auto-hints in TutorialMatchScreen do NOT route through
   *     this flag — they're purely local component state and
   *     never call `useDailyChallengeStore.useHint()`.
   *   - `firstStreakMilestone`: first time
   *     `dailyChallenge.currentStreak >= 3` lands on HomeScreen
   *     mount. Persistent — if the user breaks the streak and
   *     rebuilds it, the tooltip does not re-fire (semantic is
   *     "discovery moment for the streak mechanic," not "every
   *     time the streak hits 3").
   *
   * No schema version bump in CP3 — the three fields are read with
   * optional-chained access at trigger sites so a v6 legacy blob
   * that omits the namespace reads as "not seen" and the tooltips
   * fire on their next eligible trigger. CP6 mode unlock will
   * batch a v6 → v7 migration that locks the field shape in.
   */
  readonly jitTooltipsSeen: JITTooltipsSeenState;
  /**
   * Phase 7A.8 CP6 — per-mode unlock flags. Mode 1 is free
   * (always `true`); modes 2-7 are bought once via `unlockMode`
   * (token-spend, cost from `MODE_UNLOCK_COSTS`) and stay unlocked.
   * Dense `Record<number, boolean>` keyed 1-7 — every mode has an
   * explicit entry so `isModeUnlocked` never depends on an absent
   * key. Seeded by the v6 → v7 migration with defaults only (no
   * retroactive unlock from play history — there's no per-mode play
   * counter to honour, and no production cohort predates the
   * economy). CP7 wires the HomeScreen lock UI + UnlockModal that
   * consume this; CP6 ships state only.
   */
  readonly modeUnlocked: Readonly<Record<number, boolean>>;
}

/**
 * Phase 7A.8 CP3 — namespace for the three just-in-time tooltip
 * seen flags. Nested rather than flat to mirror the `onboarding`
 * pattern: related one-shot booleans live together so the schema
 * surface stays organised as more discovery aids land.
 */
export interface JITTooltipsSeenState {
  readonly firstTokenEarn: boolean;
  readonly firstHintSpend: boolean;
  readonly firstStreakMilestone: boolean;
}

export interface OnboardingState {
  readonly introSeen: boolean;
  readonly tutorialMatchCompleted: boolean;
  readonly blitzTeaserSeen: boolean;
  readonly mirrorTeaserSeen: boolean;
  readonly notificationOptInAsked: boolean;
  /** ISO 'YYYY-MM-DD' date stamped when the player either
   *  finishes the full flow or taps Skip All. */
  readonly completedAt: string | null;
}

export interface RecordMatchResultInput {
  readonly modeId: number;
  readonly outcome: MatchResultOutcome;
  readonly turns: number;
  /**
   * Net tokens credited for *this* match (rewardWin / rewardDraw /
   * stake-refund / 0). Optional so legacy callers without economy
   * context still bump stats; defaults to 0 — the lifetime counter
   * only moves when a real reward was granted.
   */
  readonly tokensEarnedThisMatch?: number;
}

export interface UserStoreActions {
  /**
   * Positive-only — Shop, ad reward, match win, tutorial completion.
   *
   * Phase 7A.6 CP3 — `source` is an optional intent tag preserved
   * for future analytics. The action does not consume it today
   * (no logging side-effect, no field mutation); it exists so call
   * sites can document *why* a credit happened (e.g. the tutorial
   * win passes `'tutorial_match_complete'` to distinguish it from
   * a Mode 1 win in a later analytics pass). Existing callers
   * continue to call `addTokens(amount)` unchanged.
   */
  addTokens(amount: number, source?: string): void;
  /** Clamps at zero, ignores ≤0 — forfeit penalty + future stake debit. */
  subtractTokens(amount: number): void;
  setHasOnboarded(value: boolean): void;
  /** Trims; rejects empty strings (matches Phase 1B mock contract). */
  setUsername(next: string): void;
  /**
   * Per-mount, per-completed-match. Increments `gamesPlayed`, recomputes
   * `winRate` (treating only `'victory'` as a win), updates the streak
   * pair (victory → +1; defeat → reset to 0; draw/stalemate keep the
   * streak), folds `turns` into the running `avgTurns` mean, nudges
   * `perMode[modeId].winRate` by the same victory rule, pushes the
   * outcome onto the rolling `recentMatches` window (cap 10), and
   * adds `tokensEarnedThisMatch` (when ≥0) onto `totalTokensEarned`.
   *
   * Win counts aren't persisted as a primitive — `winRate * gamesPlayed`
   * is reversed at call time. Phase 7A.2+ will replace the rate-back-
   * to-wins trick once stats are sourced from a server.
   */
  recordMatchResult(input: RecordMatchResultInput): void;
  /** Positive-only. Raw counter — Phase 7A wires the level-up rollover. */
  addXp(amount: number): void;
  /**
   * Phase 7A.4 — record a completed Daily Challenge attempt. Updates
   * `lastResult`, pushes onto cap-90 `history`, advances streak +
   * regression offset via `computeNextDailyStreakState`, and stamps
   * `lastPlayedDate`. The `dailyChallengeStore` action layer calls
   * this after clearing its own `currentAttempt` — single deterministic
   * sequence (matchStore-pattern).
   */
  recordDailyResult(result: DailyResultSummary): void;
  /**
   * Phase 7A.4 — record a missed day (cross-midnight stale-drop or
   * skipped calendar day). Breaks streak, applies tier regression
   * (`effectiveDayOffset += prior tier period`), stamps
   * `lastPlayedDate`. No history entry — a missed day is absence,
   * not an attempt.
   */
  recordMissedDay(today: string): void;
  /**
   * Phase 7A.8 CP9.1 — stamp the per-user Daily epoch on first play.
   * Idempotent: sets `dailyChallenge.firstPlayedDate` to `date` only
   * when it is currently null, so Day 1 anchors to the player's very
   * first `startToday`. Called by `dailyChallengeStore.startToday`
   * when a fresh attempt is seeded.
   */
  markDailyFirstPlayed(date: string): void;
  /**
   * Phase 7A.4 admin — wipe game-side stats so the user looks like a
   * fresh player. Clears `stats` (gamesPlayed, winRate, streaks,
   * avgTurns, totalTokensEarned, recentMatches), zeroes `perMode`
   * win rates, and resets `dailyChallenge` to defaults. **Keeps**
   * `tokens`, `level`, `currentXP`, `targetXP`, `username`,
   * `hasOnboarded` — economy + identity persist (they're not what
   * "play stats" means here). DEV-only entry point — surfaced on
   * ProfileScreen behind `__DEV__`.
   */
  resetPlayStats(): void;
  /**
   * Phase 7A.5 CP1 — gated ad-watch reward. Pre-flight guard via
   * `canWatchAd(state, today)`: cap-reached returns
   * `{ success: false, reward: 0 }` without mutating state.
   * Otherwise applies the watch (counter increment + date stamp)
   * via `applyAdWatched`, credits `AD_REWARD_TOKENS`, and returns
   * `{ success: true, reward: AD_REWARD_TOKENS }` so the caller
   * can surface the credit UI without re-reading the store.
   *
   * `today` is a 'YYYY-MM-DD' local-calendar string the call site
   * derives via `formatDailyDate(new Date())` — passed in rather
   * than computed here so tests can pin the day deterministically
   * (mirrors the `dailyChallengeStore.startToday(today, …)`
   * pattern).
   */
  watchAdAction(today: string): { readonly success: boolean; readonly reward: number };
  /**
   * Phase 7A.5 CP6 + Codex finding 1 (HIGH) fix — rewarded
   * "Double" path. Identifies the match by `matchId`, validates
   * the active matchState matches, and computes the doubled
   * amount internally from the catalog + DDA stamp. The user
   * cannot supply or influence the credit amount — that was the
   * pre-fix exploit (a manipulated route param could mint
   * arbitrary tokens).
   *
   * Validation chain (each step short-circuits with a typed error):
   *   - `no_match` — matchStore.matchState is null.
   *   - `wrong_id` — matchState.id does not equal the supplied matchId.
   *   - `not_completed` — matchState.phase is not 'completed'.
   *   - `wrong_outcome` — outcome is not 'player_won' or 'draw'.
   *   - `already_doubled` — matchState.doubledReward is true (idempotency).
   *   - `cap_reached` — adsWatchedToday >= AD_CAP_PER_DAY for today.
   *
   * On success: credits the doubled amount (computed via
   * `rewardForCompletedMatch`), stamps an ad-cap watch (cross-
   * midnight reset via applyAdWatched), resets
   * `matchesSinceLastInterstitial` (Q9 priority — Double consumes
   * the cadence slot; the forced interstitial does not also fire).
   *
   * Tests pin every reject path so a future PR cannot loosen the
   * gate by accident.
   */
  applyRewardedDouble(matchId: string): {
    readonly success: boolean;
    readonly doubledAmount?: number;
    readonly error?:
      | 'no_match'
      | 'wrong_id'
      | 'not_completed'
      | 'wrong_outcome'
      | 'already_doubled'
      | 'cap_reached';
  };
  /**
   * Phase 7A.5 CP1 — bump the periodic-interstitial counter. Wired
   * by CP3 from the Mode 1–7 match-completion seam
   * (`MatchResultScreen`). Daily Challenge does NOT call this —
   * Daily ad-free invariant pinned by test.
   */
  incrementMatchCounter(): void;
  /**
   * Phase 7A.5 CP1 — reset the counter after the interstitial
   * fires. Called from CP3's `InterstitialAdScreen` completion
   * path so the next 3-match window starts cleanly.
   */
  resetMatchCounter(): void;
  /**
   * Phase 7A.5 CP1 — flip the Remove Ads IAP flag. Production
   * caller is the RevenueCat verified-purchase callback; dev /
   * staging caller is the `__DEV__`-gated Settings toggle.
   * Boolean-only — no token-grant side effect (Q12: ad-removal
   * is the value prop, no bonus).
   */
  setAdsRemoved(value: boolean): void;
  /**
   * Phase 7A.6 CP1 — flip the corresponding onboarding flag to
   * `true`. Each is a one-shot record of "the player has seen
   * this surface"; the flow never un-sets a flag (a Replay
   * Tutorial entry point on Settings is a separate future
   * affordance that will clear flags then). Idempotent — calling
   * twice is a no-op.
   */
  markIntroSeen(): void;
  markTutorialMatchCompleted(): void;
  markBlitzTeaserSeen(): void;
  markMirrorTeaserSeen(): void;
  markNotificationOptInAsked(): void;
  /**
   * Phase 7A.6 CP7.1 — minimal "I finished onboarding linearly"
   * stamp. Flips top-level `hasOnboarded` and `onboarding.completedAt`
   * only; the 6 per-step flags (introSeen / tutorialMatchCompleted /
   * tokenWalkthroughSeen / blitzTeaserSeen / mirrorTeaserSeen /
   * notificationOptInAsked) are left untouched so trigger-based
   * post-onboarding nudges (CP5 mode teasers, CP6 push opt-in) can
   * still fire when the user reaches their respective milestones.
   *
   * Idempotent on `completedAt` — same pattern as
   * `completeOnboarding` so a re-render race during the screen-side
   * navigation can't double-stamp.
   *
   * Per-step flags remain the responsibility of `mark*Seen` /
   * `mark*Completed` actions called immediately before this stamp
   * by the screen handler (CP4 Start Playing:
   * `markTokenWalkthroughSeen()` then
   * `stampOnboardingComplete(today)`).
   *
   * CP7.2 caveat — if you hit
   * `[TypeError: stampOnboardingComplete is not a function]`
   * (or the equivalent for any new action added to this store)
   * during local dev: it's almost certainly a stale Zustand store
   * instance held by Fast Refresh across module swaps, NOT a code
   * bug. Run `npx expo start --clear` to nuke Metro caches and
   * force a clean store re-instantiation. The persist-hydration
   * regression test (`cp72PersistRehydration.test.ts`) catches the
   * other failure mode (real action loss during rehydrate).
   */
  stampOnboardingComplete(today: string): void;
  /**
   * Phase 7A.6 CP1 — bump the post-onboarding Mode 1–7 match
   * counter that drives the variety teasers (3 matches → Blitz,
   * 5 matches → Mirror). Wired by the match-completion seam
   * (`MatchResultScreen` mount effect) in a later CP; CP1 ships
   * only the primitive. Daily Challenge does NOT call this —
   * mirrors Phase 7A.5's `incrementMatchCounter` ad-free Daily
   * invariant. Pinned by regression tests.
   */
  incrementMatchesSinceOnboarding(): void;
  /**
   * Phase 7A.7 CP3 — flip `modeTutorialsSeen[modeId]` to `true`.
   * Idempotent (`true` once is `true`; subsequent calls don't
   * mutate). No `modeId` validation — caller (CP7's HomeScreen
   * ModeCard tap interception) only passes 2-7 from real
   * production paths. CP3 ships the action only; trigger sites
   * land in CP7.
   */
  markModeTutorialSeen(modeId: number): void;
  /**
   * Phase 7A.8 CP3 — flip the corresponding `jitTooltipsSeen` flag
   * to `true`. Idempotent — once `true`, subsequent calls do not
   * mutate. Called at the trigger site immediately after the
   * tooltip is shown (NOT after dismiss) so a force-quit during
   * the 5s display window does not re-fire the tooltip on next
   * launch.
   */
  markFirstTokenEarnTooltipSeen(): void;
  markFirstHintSpendTooltipSeen(): void;
  markFirstStreakMilestoneTooltipSeen(): void;
  /**
   * Phase 7A.8 CP6 — one-time mode purchase. Atomically debits the
   * `MODE_UNLOCK_COSTS[modeId]` token cost and flips
   * `modeUnlocked[modeId]` to `true` in a single `set`. Returns a
   * result object (the store's established pattern, cf.
   * `watchAdAction` / `applyRewardedDouble`) so the CP7 UI can surface
   * the outcome without re-reading the store. Never silently fails:
   *   - `invalid_mode`        — modeId not an integer in [1, 7].
   *   - `already_unlocked`    — mode is already unlocked (includes the
   *                             always-free Mode 1, which can't be
   *                             "purchased").
   *   - `insufficient_balance`— wallet < cost; NO state mutation.
   * Idempotent on the failure paths (no mutation); success flips the
   * flag exactly once.
   *
   * Phase 7A.8 CP10 — optional `cost` override for the teaser
   * promotional discount (e.g. Blitz 1000 → 300). When omitted the
   * regular `MODE_UNLOCK_COSTS[modeId]` applies. A negative / non-finite
   * override is ignored (falls back to the regular cost) so a bad param
   * can never mint a free or negative-priced unlock.
   */
  unlockMode(
    modeId: number,
    options?: { readonly cost?: number },
  ): {
    readonly success: boolean;
    readonly error?: 'invalid_mode' | 'already_unlocked' | 'insufficient_balance';
  };
  /**
   * Phase 7A.8 CP6 — read whether a mode is unlocked. Mode 1 is always
   * unlocked. Unknown ids read `false` (defensive — the dense 1-7 map
   * means real modes always have an entry).
   */
  isModeUnlocked(modeId: number): boolean;
  /**
   * Phase 7A.8 CP8 — promotional (cost-free) unlock. Flips
   * `modeUnlocked[modeId]` to `true` WITHOUT spending tokens —
   * distinct from `unlockMode`, whose balance/spend semantics stay
   * clean. For marketing/teaser grants (the CP5 "Try Blitz/Mirror"
   * CTAs) where reaching the teaser is itself the price paid.
   *   - `invalid_mode` — modeId not an integer in [2, 7]. Mode 1 is
   *     always unlocked, so there's nothing to promotionally grant.
   *   - otherwise success; `alreadyUnlocked` reports whether the flag
   *     was already set (the call is then a no-op — the caller still
   *     grants its separate token gift for consistency).
   */
  grantModeUnlock(modeId: number): {
    readonly success: boolean;
    readonly alreadyUnlocked?: boolean;
    readonly error?: 'invalid_mode';
  };
}

export const DAILY_CHALLENGE_DEFAULTS: DailyChallengeState = {
  firstPlayedDate: null,
  lastPlayedDate: null,
  currentStreak: 0,
  longestStreak: 0,
  effectiveDayOffset: 0,
  lastResult: null,
  history: [],
  earnedHints: 0,
  lastHintEarnedAtStreak: 0,
};

/** Phase 7A.8 CP3 — fresh-install defaults for the JIT tooltip
 *  namespace. All three flags start `false` so a new user sees each
 *  tooltip exactly once on its respective first trigger. Legacy v6
 *  blobs that omit the namespace pick this up via zustand's shallow
 *  merge (initial state spreads under persisted state). */
export const JIT_TOOLTIPS_SEEN_DEFAULTS: JITTooltipsSeenState = {
  firstTokenEarn: false,
  firstHintSpend: false,
  firstStreakMilestone: false,
};

export const ONBOARDING_DEFAULTS: OnboardingState = {
  introSeen: false,
  tutorialMatchCompleted: false,
  blitzTeaserSeen: false,
  mirrorTeaserSeen: false,
  notificationOptInAsked: false,
  completedAt: null,
};

/**
 * Phase 7A.8 CP6 — fresh-install mode-unlock defaults. Mode 1 free,
 * 2-7 locked. Shared by `USER_STORE_DEFAULTS` and the v6 → v7
 * migration so both seed the identical shape. A fresh spread is taken
 * at each use site (the values are primitives, but a shared mutable
 * object reference across the store and every migrated blob would be
 * a latent aliasing trap).
 */
export const MODE_UNLOCKED_DEFAULTS: Readonly<Record<number, boolean>> = {
  1: true,
  2: false,
  3: false,
  4: false,
  5: false,
  6: false,
  7: false,
};

/**
 * Phase 7A.6 CP3.1 — fresh-install defaults sweep.
 *
 * Pre-CP3.1, `USER_STORE_DEFAULTS` was a Phase 1B mock fixture: every
 * fresh install inherited a level-12 / 247-games / 68%-win-rate /
 * 1,840-tokens / pre-onboarded / `'nova_code'`-named profile. That
 * was fine for hand-driving Phase 1B prototype screens; it's wrong
 * for real users.
 *
 * The fix zeroes every fixture-tinged field, so a fresh install
 * starts as a real new user:
 *   - `hasOnboarded: false` — without this, RootNavigator skips the
 *     entire onboarding flow on fresh installs.
 *   - `username` — random `player_<hex4>` per `generateUsername()`.
 *     Tests run with a globally-mocked `'nova_code'` so existing
 *     assertions stay deterministic.
 *   - `tokens: 100` — covers 2× the lowest competitive stake
 *     (Mode 1/2/3/4/6) OR 1× Mode 5 stake OR 1× Hint A. Meaningful
 *     starter, not generous.
 *   - `targetXP: 100` — placeholder until Phase 7A's level-up curve
 *     lands (`getTargetXpForLevel` does not exist yet — flagged in
 *     CP3.1 pre-impl).
 *
 * Existing users keep their balance — every migration step spreads
 * persisted state on top of these defaults, so v1-v5 upgrades are
 * unaffected. Pinned by the migration test suite.
 */
export const USER_STORE_DEFAULTS: UserStoreState = {
  username: generateUsername(),
  tokens: 100,
  level: 1,
  currentXP: 0,
  // Placeholder — Phase 7A's level-up rollover will replace this
  // with a real progression curve. Kept low so the level-1 → 2
  // arc is fast (~one match's XP gain).
  targetXP: 100,
  hasOnboarded: false,
  stats: {
    gamesPlayed: 0,
    winRate: 0,
    currentStreak: 0,
    bestStreak: 0,
    avgTurns: 0,
    totalTokensEarned: 0,
    recentMatches: [],
  },
  perMode: {
    1: { winRate: 0 },
    2: { winRate: 0 },
    3: { winRate: 0 },
    4: { winRate: 0 },
    5: { winRate: 0 },
    6: { winRate: 0 },
    7: { winRate: 0 },
  },
  dailyChallenge: DAILY_CHALLENGE_DEFAULTS,
  adsWatchedToday: 0,
  adsWatchedLastDate: null,
  matchesSinceLastInterstitial: 0,
  adsRemoved: false,
  onboarding: ONBOARDING_DEFAULTS,
  matchesCompletedSinceOnboarding: 0,
  // Phase 7A.7 CP3 — fresh-install: no Mode 2-7 tutorials seen.
  // Sparse Record; absent keys read as `undefined` and CP4-CP7
  // gating treats undefined as "not seen". Mode 1 deliberately
  // not in the map (covered by `onboarding.tutorialMatchCompleted`).
  modeTutorialsSeen: {},
  // Phase 7A.8 CP3 — fresh-install: no JIT tooltips seen.
  jitTooltipsSeen: JIT_TOOLTIPS_SEEN_DEFAULTS,
  // Phase 7A.8 CP6 — fresh-install: Mode 1 free, 2-7 locked.
  modeUnlocked: { ...MODE_UNLOCKED_DEFAULTS },
};

const STORE_VERSION = 8;

/**
 * Migrate persisted state across `STORE_VERSION` bumps. The persist
 * middleware feeds us whatever was on disk; we map it onto the
 * current `UserStoreState` shape (actions are re-bound by zustand).
 *
 * Chained migration pattern (Phase 7A.4 CP3 advisor discipline): each
 * version step is its own pure function consuming the prior shape and
 * producing the next one. The dispatcher loops until `version ===
 * STORE_VERSION` so a v1 blob lands at v3 by going through v1 → v2 →
 * v3 — no inline-collapsed branches that drift out of sync as new
 * versions land.
 *
 * Step list:
 *   v1 → v2 (Phase 7A.1): rename `stats.tokensEarned` →
 *     `stats.totalTokensEarned`; seed `stats.recentMatches: []`.
 *   v2 → v3 (Phase 7A.4): seed `dailyChallenge` defaults; preserve
 *     every v2 field byte-for-byte (no economy / streak / stats
 *     touched).
 *   v3 → v4 (Phase 7A.5 CP1): seed four new fields atomically —
 *     `adsWatchedToday: 0`, `adsWatchedLastDate: null` (ad cap
 *     state, "first-ever" for pre-7A.5 players),
 *     `matchesSinceLastInterstitial: 0` (CP3 frequency-cap
 *     counter), `adsRemoved: false` (Remove Ads IAP flag). Single
 *     migration step covers all four — keeps the upgrade atomic
 *     and avoids per-field sub-versions for what is conceptually
 *     one "Phase 7A.5 economy schema bump."
 *   v4 → v5 (Phase 7A.6 CP1): seed `onboarding` flags +
 *     `matchesCompletedSinceOnboarding: 0`. Existing-user
 *     heuristic: stamp `onboarding.introSeen: true` only when
 *     `stats.gamesPlayed > 0` — the player has actually played
 *     at least one match on a v4 build. resetPlayStats clears
 *     `gamesPlayed` → 0, so a reset-then-upgrade user is treated
 *     as starting over and sees the intro again (matches the
 *     reset semantics). Fresh installs (no prior persist) never
 *     run this migration; they get `introSeen: false` from
 *     `ONBOARDING_DEFAULTS` and see the full flow. The remaining
 *     onboarding surfaces (tutorial match, token walkthrough,
 *     mode-variety teasers, push opt-in) stay false so the
 *     post-onboarding milestones can still fire if/when those
 *     moments arrive.
 *   v5 → v6 (Phase 7A.7 CP3): seed `modeTutorialsSeen` with the
 *     `gamesPlayed > 0` paternalistic-skip heuristic (see
 *     `migrateV5ToV6`).
 *   v6 → v7 (Phase 7A.8 CP6): seed `modeUnlocked` with fresh-install
 *     defaults (Mode 1 free, 2-7 locked — NO retroactive unlock) and
 *     strip the dead `onboarding.tokenWalkthroughSeen` field (see
 *     `migrateV6ToV7`).
 *   v7 → v8 (Phase 7A.8 CP9.1): backfill `dailyChallenge.firstPlayedDate`
 *     (per-user Daily epoch). Earliest known date wins —
 *     `history[0]?.date ?? lastPlayedDate ?? null` — so an existing
 *     player's tier/streak don't snap back to Day 1 on upgrade. Fresh
 *     installs never run this; they get `null` from defaults and Day 1
 *     anchors on their first play (see `migrateV7ToV8`).
 */

// Loose v1 shape — only the fields the v1→v2 mapper inspects.
type V1Stats = Omit<UserStats, 'totalTokensEarned' | 'recentMatches'> & {
  readonly tokensEarned?: number;
};
type V7A5Fields = 'adsWatchedToday' | 'adsWatchedLastDate' | 'matchesSinceLastInterstitial' | 'adsRemoved';
type V7A6Fields = 'onboarding' | 'matchesCompletedSinceOnboarding';
type V7A7Fields = 'modeTutorialsSeen';
type V7A8Fields = 'modeUnlocked';
type V1State = Omit<
  UserStoreState,
  'stats' | 'dailyChallenge' | V7A5Fields | V7A6Fields | V7A7Fields | V7A8Fields
> & {
  readonly stats?: V1Stats;
};

// v2 shape — UserStoreState minus dailyChallenge + every later-phase field.
type V2State = Omit<UserStoreState, 'dailyChallenge' | V7A5Fields | V7A6Fields | V7A7Fields | V7A8Fields>;

// v3 shape — UserStoreState minus the Phase 7A.5 / 7A.6 / 7A.7 / 7A.8 fields.
type V3State = Omit<UserStoreState, V7A5Fields | V7A6Fields | V7A7Fields | V7A8Fields>;

// v4 shape — UserStoreState minus the Phase 7A.6 / 7A.7 / 7A.8 fields.
type V4State = Omit<UserStoreState, V7A6Fields | V7A7Fields | V7A8Fields>;

// v5 shape — UserStoreState minus the Phase 7A.7 / 7A.8 fields.
type V5State = Omit<UserStoreState, V7A7Fields | V7A8Fields>;

// v6 shape — UserStoreState minus the Phase 7A.8 mode-unlock field.
// NB: the v6 `onboarding` blob on disk also carries the now-removed
// `tokenWalkthroughSeen`; it's stripped during the v6 → v7 mapper
// rather than reflected in this alias (the alias uses the current,
// already-cleaned `OnboardingState`).
type V6State = Omit<UserStoreState, V7A8Fields>;

// v7 shape — the full current UserStoreState, except the persisted
// `dailyChallenge` predates the CP9.1 `firstPlayedDate` field (it's
// optional on disk; the v7 → v8 mapper backfills it).
type V7DailyChallenge = Omit<DailyChallengeState, 'firstPlayedDate'> & {
  readonly firstPlayedDate?: string | null;
};
type V7State = Omit<UserStoreState, 'dailyChallenge'> & {
  readonly dailyChallenge: V7DailyChallenge;
};

function migrateV1ToV2(persisted: unknown): V2State {
  const v1 = (persisted ?? {}) as V1State;
  const v1Stats = v1.stats ?? ({} as V1Stats);
  return {
    ...USER_STORE_DEFAULTS,
    ...v1,
    stats: {
      gamesPlayed: v1Stats.gamesPlayed ?? USER_STORE_DEFAULTS.stats.gamesPlayed,
      winRate: v1Stats.winRate ?? USER_STORE_DEFAULTS.stats.winRate,
      currentStreak: v1Stats.currentStreak ?? USER_STORE_DEFAULTS.stats.currentStreak,
      bestStreak: v1Stats.bestStreak ?? USER_STORE_DEFAULTS.stats.bestStreak,
      avgTurns: v1Stats.avgTurns ?? USER_STORE_DEFAULTS.stats.avgTurns,
      totalTokensEarned: v1Stats.tokensEarned ?? USER_STORE_DEFAULTS.stats.totalTokensEarned,
      recentMatches: [],
    },
  };
}

function migrateV2ToV3(persisted: unknown): V3State {
  const v2 = (persisted ?? {}) as V2State;
  return {
    ...v2,
    dailyChallenge: DAILY_CHALLENGE_DEFAULTS,
  };
}

function migrateV3ToV4(persisted: unknown): V4State {
  const v3 = (persisted ?? {}) as V3State;
  return {
    ...v3,
    adsWatchedToday: 0,
    adsWatchedLastDate: null,
    matchesSinceLastInterstitial: 0,
    adsRemoved: false,
  };
}

function migrateV4ToV5(persisted: unknown): V5State {
  const v4 = (persisted ?? {}) as V4State;
  // Existing-user heuristic: gamesPlayed > 0 means the player
  // has actually engaged (not just installed and bounced).
  // resetPlayStats clears gamesPlayed → 0, so a player who admin-
  // reset before upgrading is treated as "start over from scratch"
  // and sees the intro again. The optional chain + ?? 0 also
  // covers a malformed v4 blob with a missing stats field —
  // defaults to "show intro" rather than "skip intro" so a
  // corrupt persist never silently suppresses onboarding.
  const playedAtLeastOnce = (v4.stats?.gamesPlayed ?? 0) > 0;
  return {
    ...v4,
    onboarding: {
      ...ONBOARDING_DEFAULTS,
      introSeen: playedAtLeastOnce,
    },
    matchesCompletedSinceOnboarding: 0,
  };
}

/**
 * Phase 7A.7 CP3 — v5 → v6: seed `modeTutorialsSeen` with a
 * paternalistic-skip heuristic. Mirrors the v4→v5 introSeen
 * heuristic (same `gamesPlayed > 0` signal):
 *
 *   gamesPlayed > 0  → all Mode 2-7 marked seen. The player has
 *                      actually played matches, knows the modes,
 *                      and would find tutorials patronising.
 *   gamesPlayed === 0 → empty map. A fresh-install / reset user
 *                      reaches the per-mode tutorials at their
 *                      natural moment.
 *   missing stats     → empty map (defensive — corrupt blob
 *                      defaults to "show tutorials" rather than
 *                      "skip", matches v4→v5's defensive bias).
 *
 * Mode 1 deliberately not in the map — covered by
 * `onboarding.tutorialMatchCompleted` (Phase 7A.6 CP3). Two
 * sources of truth would invite drift.
 */
function migrateV5ToV6(persisted: unknown): V6State {
  const v5 = (persisted ?? {}) as V5State;
  const playedAtLeastOnce = (v5.stats?.gamesPlayed ?? 0) > 0;
  const modeTutorialsSeen: Record<number, boolean> = playedAtLeastOnce
    ? { 2: true, 3: true, 4: true, 5: true, 6: true, 7: true }
    : {};
  return {
    ...v5,
    modeTutorialsSeen,
  };
}

/**
 * Phase 7A.8 CP6 — v6 → v7: two changes, both schema-only.
 *
 *   1. Seed `modeUnlocked` with fresh-install DEFAULTS (Mode 1 free,
 *      2-7 locked). NO retroactive unlock from play history: there is
 *      no per-mode play counter to honour (`perMode` tracks only
 *      `winRate`, `stats.gamesPlayed` is aggregate), and no production
 *      cohort predates the unlock economy — so the per-mode heuristic
 *      the design brief assumed is moot. Everyone lands on defaults;
 *      the developer seeds their own test state via the store.
 *   2. Strip the dead `onboarding.tokenWalkthroughSeen` field (CP2
 *      deleted the walkthrough screen; the flag was never read by
 *      routing). The onboarding object is rebuilt from the current
 *      `OnboardingState` keys so a v6 blob carrying the dropped key
 *      lands clean.
 *
 * `markTokenWalkthroughSeen` and `completeOnboarding` are removed in
 * the same CP, but those are actions — zustand persists state, not
 * functions, so their removal needs no migration handling.
 */
function migrateV6ToV7(persisted: unknown): V7State {
  const v6 = (persisted ?? {}) as V6State;
  const ob = v6.onboarding ?? ONBOARDING_DEFAULTS;
  return {
    ...v6,
    onboarding: {
      introSeen: ob.introSeen ?? false,
      tutorialMatchCompleted: ob.tutorialMatchCompleted ?? false,
      blitzTeaserSeen: ob.blitzTeaserSeen ?? false,
      mirrorTeaserSeen: ob.mirrorTeaserSeen ?? false,
      notificationOptInAsked: ob.notificationOptInAsked ?? false,
      completedAt: ob.completedAt ?? null,
    },
    modeUnlocked: { ...MODE_UNLOCKED_DEFAULTS },
  };
}

/**
 * Phase 7A.8 CP9.1 — v7 → v8: backfill the per-user Daily epoch.
 * `firstPlayedDate` anchors Day 1; for an upgrading player we infer it
 * from the earliest date we know they engaged (the oldest history
 * entry, else `lastPlayedDate`) so their digit tier and streak
 * regression stay continuous instead of snapping back to Day 1 / tier
 * 4. A player with no daily history keeps `null` — Day 1 anchors on
 * their first play post-upgrade. Defensive `?? {}` + optional chaining
 * tolerate a malformed blob.
 */
function migrateV7ToV8(persisted: unknown): UserStoreState {
  const v7 = (persisted ?? {}) as V7State;
  const dc = v7.dailyChallenge ?? DAILY_CHALLENGE_DEFAULTS;
  const firstPlayedDate =
    dc.firstPlayedDate ?? dc.history?.[0]?.date ?? dc.lastPlayedDate ?? null;
  return {
    ...v7,
    dailyChallenge: { ...DAILY_CHALLENGE_DEFAULTS, ...dc, firstPlayedDate },
  };
}

function migrateUserStore(persisted: unknown, version: number): UserStoreState {
  if (version === STORE_VERSION) {
    return persisted as UserStoreState;
  }
  // Future / corrupt version stamps fall through to defaults rather
  // than attempting a downgrade — losing persisted progress is the
  // documented behaviour for an unrecognised version. (We can't
  // safely synthesise a downgrade because the future shape might
  // contain fields the current code doesn't understand.)
  if (version < 1 || version > STORE_VERSION) {
    return USER_STORE_DEFAULTS;
  }
  let current: unknown = persisted;
  let v = version;
  while (v < STORE_VERSION) {
    if (v === 1) {
      current = migrateV1ToV2(current);
      v = 2;
    } else if (v === 2) {
      current = migrateV2ToV3(current);
      v = 3;
    } else if (v === 3) {
      current = migrateV3ToV4(current);
      v = 4;
    } else if (v === 4) {
      current = migrateV4ToV5(current);
      v = 5;
    } else if (v === 5) {
      current = migrateV5ToV6(current);
      v = 6;
    } else if (v === 6) {
      current = migrateV6ToV7(current);
      v = 7;
    } else if (v === 7) {
      current = migrateV7ToV8(current);
      v = 8;
    } else {
      // Defensive — the bounds check above should prevent reaching
      // this branch, but it keeps the loop total in case the bound
      // check is ever loosened.
      return USER_STORE_DEFAULTS;
    }
  }
  return current as UserStoreState;
}

export const useUserStore = create<UserStoreState & UserStoreActions>()(
  persist(
    (set, get) => ({
      ...USER_STORE_DEFAULTS,

      addTokens: (amount, _source) => {
        if (amount <= 0) return;
        set((s) => ({ tokens: s.tokens + amount }));
      },

      subtractTokens: (amount) => {
        if (amount <= 0) return;
        set((s) => ({ tokens: Math.max(0, s.tokens - amount) }));
      },

      setHasOnboarded: (value) => set({ hasOnboarded: value }),

      setUsername: (next) => {
        const trimmed = next.trim();
        if (trimmed.length === 0) return;
        set({ username: trimmed });
      },

      recordMatchResult: ({ modeId, outcome, turns, tokensEarnedThisMatch = 0 }) => {
        set((s) => {
          const stats = s.stats;
          const isWin = outcome === 'victory';
          const isLoss = outcome === 'defeat';

          const wins = Math.round((stats.winRate / 100) * stats.gamesPlayed);
          const newWins = isWin ? wins + 1 : wins;
          const newGamesPlayed = stats.gamesPlayed + 1;
          const newWinRate = Math.round((newWins / newGamesPlayed) * 100);

          const nextStreak = isWin
            ? stats.currentStreak + 1
            : isLoss
              ? 0
              : stats.currentStreak;
          const nextBestStreak = Math.max(stats.bestStreak, nextStreak);

          // Running mean — exact for the new sample, rounded to 1 decimal
          // to match the Profile screen's display fidelity.
          const newAvgTurnsRaw =
            (stats.avgTurns * stats.gamesPlayed + turns) / newGamesPlayed;
          const newAvgTurns = Math.round(newAvgTurnsRaw * 10) / 10;

          // perMode shares the same wins-from-rate trick. We don't track
          // games-per-mode yet, so estimate from the totals; Phase 7A
          // replaces this once the backend supplies authoritative counts.
          const modeEntry = s.perMode[modeId] ?? { winRate: 50 };
          const estModeGames = Math.max(1, Math.round(stats.gamesPlayed / 7));
          const modeWins = Math.round((modeEntry.winRate / 100) * estModeGames);
          const newModeWins = isWin ? modeWins + 1 : modeWins;
          const newModeGames = estModeGames + 1;
          const newModeWinRate = Math.round((newModeWins / newModeGames) * 100);

          // Rolling window — most recent outcome lands at the tail; older
          // entries fall off when the cap is exceeded.
          const nextRecent = [...stats.recentMatches, outcome].slice(-RECENT_MATCH_WINDOW);

          // Lifetime cumulative — only credit the counter when there
          // was real economic gain (negative inputs are clamped to 0).
          const earnedDelta = Math.max(0, tokensEarnedThisMatch);
          const newTotalTokensEarned = stats.totalTokensEarned + earnedDelta;

          return {
            stats: {
              gamesPlayed: newGamesPlayed,
              winRate: newWinRate,
              currentStreak: nextStreak,
              bestStreak: nextBestStreak,
              avgTurns: newAvgTurns,
              totalTokensEarned: newTotalTokensEarned,
              recentMatches: nextRecent,
            },
            perMode: { ...s.perMode, [modeId]: { winRate: newModeWinRate } },
          };
        });
      },

      addXp: (amount) => {
        if (amount <= 0) return;
        set((s) => ({ currentXP: s.currentXP + amount }));
      },

      recordDailyResult: (result) => {
        set((s) => {
          const prev = s.dailyChallenge;
          const streakUpdate = computeNextDailyStreakState(prev, result.date, result);
          // Hint pool earning — runs alongside the streak transition
          // so a streak that just crossed 7 / 14 / 21 grants the +1
          // in the same atomic update (CP6).
          const hintUpdate = computeEarnedHints(
            prev.earnedHints,
            prev.lastHintEarnedAtStreak,
            prev.currentStreak,
            streakUpdate.currentStreak,
          );
          const historyEntry = {
            date: result.date,
            digits: result.digits,
            turns: result.turnsUsed,
            success: result.success,
            hintsUsed: result.hintsUsed,
          };
          // Cap 90 — slice at write time so selectors stay O(1) and
          // a one-shot 91-entry blob can't sneak in via direct setState.
          const nextHistory = [...prev.history, historyEntry].slice(-90);
          return {
            dailyChallenge: {
              ...prev,
              // CP9.1 — guarantee the per-user epoch invariant
              // (lastPlayedDate set ⟹ firstPlayedDate set). `startToday`
              // normally stamps this first; the coalesce defends the
              // path where a result lands without a prior stamp.
              firstPlayedDate: prev.firstPlayedDate ?? result.date,
              lastPlayedDate: result.date,
              currentStreak: streakUpdate.currentStreak,
              longestStreak: streakUpdate.longestStreak,
              effectiveDayOffset: streakUpdate.effectiveDayOffset,
              earnedHints: hintUpdate.earnedHints,
              lastHintEarnedAtStreak: hintUpdate.lastHintEarnedAtStreak,
              lastResult: result,
              history: nextHistory,
            },
          };
        });
      },

      resetPlayStats: () => {
        set(() => ({
          stats: {
            gamesPlayed: 0,
            winRate: 0,
            currentStreak: 0,
            bestStreak: 0,
            avgTurns: 0,
            totalTokensEarned: 0,
            recentMatches: [],
          },
          perMode: {
            1: { winRate: 0 },
            2: { winRate: 0 },
            3: { winRate: 0 },
            4: { winRate: 0 },
            5: { winRate: 0 },
            6: { winRate: 0 },
            7: { winRate: 0 },
          },
          dailyChallenge: DAILY_CHALLENGE_DEFAULTS,
        }));
      },

      recordMissedDay: (today) => {
        set((s) => {
          const prev = s.dailyChallenge;
          // Cross-midnight stale-drop semantics: streak breaks,
          // regression applies based on the prior tier (computed off
          // `lastPlayedDate` and the existing offset). Inline rather
          // than via `computeNextDailyStreakState({result:null})` so
          // the regression delta is auditable here, where the only
          // call site lives.
          if (prev.lastPlayedDate === null) {
            // First-ever interaction is a "missed day" — no prior
            // tier to regress from. Stamp the date so the next play
            // sees a sensible gap; leave streak/offset at zero.
            return {
              dailyChallenge: { ...prev, lastPlayedDate: today },
            };
          }
          // Per-user epoch (CP9.1): same absolute tier formula as
          // `getDailyConfig`, so it indexes off `firstPlayedDate`
          // (guaranteed stamped here — `lastPlayedDate` is non-null),
          // never today. `?? prev.lastPlayedDate` is a defensive
          // self-consistent fallback for a corrupt blob.
          const epoch = prev.firstPlayedDate ?? prev.lastPlayedDate;
          const lastTierEffectiveDay =
            calendarDayIndex(prev.lastPlayedDate, epoch) - prev.effectiveDayOffset;
          const lastTier = effectiveDigitTier(lastTierEffectiveDay);
          let regressionDelta = 0;
          if (lastTier.digits === 6) regressionDelta = TIER_5_PERIOD;
          else if (lastTier.digits === 5) regressionDelta = TIER_4_PERIOD;
          // tier-4 floor: regressionDelta stays 0.
          return {
            dailyChallenge: {
              ...prev,
              lastPlayedDate: today,
              currentStreak: 0,
              effectiveDayOffset: prev.effectiveDayOffset + regressionDelta,
              // Streak break (CP6) — earned-hint pool resets in
              // lockstep with the streak counter.
              earnedHints: 0,
              lastHintEarnedAtStreak: 0,
            },
          };
        });
      },

      markDailyFirstPlayed: (date) => {
        set((s) => {
          // Idempotent — only the first call (firstPlayedDate still
          // null) anchors the per-user Daily epoch. Subsequent plays
          // no-op so Day 1 never drifts.
          if (s.dailyChallenge.firstPlayedDate !== null) return {};
          return {
            dailyChallenge: { ...s.dailyChallenge, firstPlayedDate: date },
          };
        });
      },

      incrementMatchCounter: () => {
        set((s) => ({
          matchesSinceLastInterstitial: s.matchesSinceLastInterstitial + 1,
        }));
      },

      resetMatchCounter: () => {
        set({ matchesSinceLastInterstitial: 0 });
      },

      setAdsRemoved: (value) => {
        set({ adsRemoved: value });
      },

      markIntroSeen: () => {
        set((s) => ({ onboarding: { ...s.onboarding, introSeen: true } }));
      },

      markTutorialMatchCompleted: () => {
        set((s) => ({ onboarding: { ...s.onboarding, tutorialMatchCompleted: true } }));
      },

      markBlitzTeaserSeen: () => {
        set((s) => ({ onboarding: { ...s.onboarding, blitzTeaserSeen: true } }));
      },

      markMirrorTeaserSeen: () => {
        set((s) => ({ onboarding: { ...s.onboarding, mirrorTeaserSeen: true } }));
      },

      markNotificationOptInAsked: () => {
        set((s) => ({ onboarding: { ...s.onboarding, notificationOptInAsked: true } }));
      },

      stampOnboardingComplete: (today) => {
        set((s) => {
          // Same idempotency guard as `completeOnboarding` —
          // completedAt is the canonical timestamp; a second call
          // (e.g. screen re-render race) must not overwrite it.
          if (s.onboarding.completedAt !== null) return {};
          return {
            hasOnboarded: true,
            onboarding: { ...s.onboarding, completedAt: today },
          };
        });
      },

      incrementMatchesSinceOnboarding: () => {
        set((s) => ({
          matchesCompletedSinceOnboarding: s.matchesCompletedSinceOnboarding + 1,
        }));
      },

      markModeTutorialSeen: (modeId) => {
        set((s) => ({
          modeTutorialsSeen: { ...s.modeTutorialsSeen, [modeId]: true },
        }));
      },

      markFirstTokenEarnTooltipSeen: () => {
        set((s) => {
          if (s.jitTooltipsSeen.firstTokenEarn) return {};
          return {
            jitTooltipsSeen: { ...s.jitTooltipsSeen, firstTokenEarn: true },
          };
        });
      },

      markFirstHintSpendTooltipSeen: () => {
        set((s) => {
          if (s.jitTooltipsSeen.firstHintSpend) return {};
          return {
            jitTooltipsSeen: { ...s.jitTooltipsSeen, firstHintSpend: true },
          };
        });
      },

      markFirstStreakMilestoneTooltipSeen: () => {
        set((s) => {
          if (s.jitTooltipsSeen.firstStreakMilestone) return {};
          return {
            jitTooltipsSeen: { ...s.jitTooltipsSeen, firstStreakMilestone: true },
          };
        });
      },

      unlockMode: (modeId, options) => {
        // Guard order matters: validate the id, then reject an
        // already-unlocked mode (Mode 1 falls in here — it's
        // default-unlocked and has cost 0, but "unlocking" it is a
        // category error, not a free purchase), then the balance
        // check. Each reject is pure — no state touched — so the CP7
        // UI can call optimistically and branch on the result.
        if (!Number.isInteger(modeId) || modeId < 1 || modeId > 7) {
          return { success: false, error: 'invalid_mode' };
        }
        const state = get();
        if (state.modeUnlocked[modeId]) {
          return { success: false, error: 'already_unlocked' };
        }
        const regularCost = MODE_UNLOCK_COSTS[modeId] ?? 0;
        // CP10 — honour a promotional override only when it's a valid
        // discount: a finite, non-negative number strictly BELOW the
        // catalog cost. Anything else (negative, NaN/Infinity, or
        // >= regular) falls back to the catalog cost, so a malformed or
        // over-priced param can never mint a cheap unlock or overcharge.
        const override = options?.cost;
        const cost =
          typeof override === 'number' &&
          Number.isFinite(override) &&
          override >= 0 &&
          override < regularCost
            ? override
            : regularCost;
        if (state.tokens < cost) {
          return { success: false, error: 'insufficient_balance' };
        }
        // Single atomic set — debit + flag flip together so a reader
        // can never observe a spent wallet without the unlock (or an
        // unlock without the debit).
        set((s) => ({
          tokens: s.tokens - cost,
          modeUnlocked: { ...s.modeUnlocked, [modeId]: true },
        }));
        return { success: true };
      },

      isModeUnlocked: (modeId) => get().modeUnlocked[modeId] ?? false,

      grantModeUnlock: (modeId) => {
        if (!Number.isInteger(modeId) || modeId < 2 || modeId > 7) {
          return { success: false, error: 'invalid_mode' };
        }
        const alreadyUnlocked = get().modeUnlocked[modeId] === true;
        if (!alreadyUnlocked) {
          set((s) => ({ modeUnlocked: { ...s.modeUnlocked, [modeId]: true } }));
        }
        return { success: true, alreadyUnlocked };
      },

      applyRewardedDouble: (matchId) => {
        // Validation chain — each step has a typed error so the
        // caller (and analytics) can distinguish the reject reason.
        // The user cannot supply or influence the credited amount
        // (Codex finding 1 fix); the action computes it from the
        // active matchState authoritatively.
        const matchSnap = useMatchStore.getState().matchState;
        if (matchSnap === null) {
          return { success: false, error: 'no_match' };
        }
        if (matchSnap.id !== matchId) {
          return { success: false, error: 'wrong_id' };
        }
        if (matchSnap.phase !== 'completed' || matchSnap.result === null) {
          return { success: false, error: 'not_completed' };
        }
        const outcome = matchSnap.result.outcome;
        if (outcome !== 'player_won' && outcome !== 'draw') {
          return { success: false, error: 'wrong_outcome' };
        }
        if (matchSnap.doubledReward === true) {
          return { success: false, error: 'already_doubled' };
        }
        const today = formatDailyDate(new Date());
        const userSnap = useUserStore.getState();
        const capState = {
          adsWatchedToday: userSnap.adsWatchedToday,
          adsWatchedLastDate: userSnap.adsWatchedLastDate,
        };
        if (!canWatchAd(capState, today)) {
          return { success: false, error: 'cap_reached' };
        }

        // All validations passed. Compute the doubled amount from
        // the catalog + DDA stamp — same source of truth
        // MatchScreen.tsx uses for the original credit.
        const mode = modeRegistry.get(matchSnap.modeId);
        const doubledAmount = rewardForCompletedMatch(
          matchSnap.result,
          mode,
          matchSnap.botDifficulty ?? 'normal',
        );
        if (doubledAmount <= 0) {
          // Defensive — `wrong_outcome` should already cover this,
          // but a 0-reward outcome (e.g. catalog drift) shouldn't
          // consume an ad-cap slot for nothing.
          return { success: false, error: 'wrong_outcome' };
        }

        const next = applyAdWatched(capState, today);
        // Single setState mutates four fields atomically: ad-cap
        // counter + lastDate (one watch consumed), wallet credit
        // (doubled amount layered on top of the original), and the
        // interstitial counter reset (Q9 priority — the double ad
        // satisfies this cadence slot; the forced interstitial
        // does not also fire).
        set((s) => ({
          adsWatchedToday: next.adsWatchedToday,
          adsWatchedLastDate: next.adsWatchedLastDate,
          tokens: s.tokens + doubledAmount,
          matchesSinceLastInterstitial: 0,
        }));
        return { success: true, doubledAmount };
      },

      watchAdAction: (today) => {
        // Two-stage gate: read snapshot first to evaluate the cap
        // (cap-reached must NOT mutate state — it's a refusal,
        // not a watch). Action ordering matches `useHint`: pure
        // gate, then state update, then return shape.
        const snapshot = useUserStore.getState();
        const capState = {
          adsWatchedToday: snapshot.adsWatchedToday,
          adsWatchedLastDate: snapshot.adsWatchedLastDate,
        };
        if (!canWatchAd(capState, today)) {
          return { success: false, reward: 0 };
        }
        const next = applyAdWatched(capState, today);
        set((s) => ({
          adsWatchedToday: next.adsWatchedToday,
          adsWatchedLastDate: next.adsWatchedLastDate,
          tokens: s.tokens + AD_REWARD_TOKENS,
        }));
        return { success: true, reward: AD_REWARD_TOKENS };
      },
    }),
    {
      name: 'cipherbreaker.user.v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: STORE_VERSION,
      migrate: (persisted, version) => {
        const next = migrateUserStore(persisted, version);
        return next as UserStoreState & UserStoreActions;
      },
    },
  ),
);

/** Test-only — exported so migration tests can call the pure mapper
 *  without hitting AsyncStorage / zustand internals. */
export const __migrateUserStoreForTests = migrateUserStore;
