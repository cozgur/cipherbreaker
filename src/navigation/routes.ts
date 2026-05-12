/**
 * Root-stack route names + param shapes. Colocated in its own module
 * (not inside `RootNavigator.tsx`) so screens can import only the type
 * without dragging the navigator component tree into their bundle.
 */

export type MatchResultOutcome = 'victory' | 'defeat' | 'draw' | 'stalemate';

export type RootStackParamList = {
  /**
   * Phase 7A.8 CP2 — single-slide onboarding hero. Replaces
   * Phase 7A.6 CP2's three-slide `OnboardingIntro` carousel and
   * CP4's `OnboardingTokenWalkthrough` (both deleted in CP2).
   * Single CTA "Get started" → `markIntroSeen` →
   * `TutorialMatch`. No Skip path — TutorialMatch is mandatory.
   */
  OnboardingHero: undefined;
  /**
   * Phase 7A.6 CP3 — guided first match. Self-contained tutorial
   * surface that reuses Mode 1's `evaluateColorMatch` evaluator
   * without going through `matchStore` / `MatchScreen` /
   * `MatchResultScreen` (see TutorialMatchScreen header for the
   * isolation rationale). Phase 7A.8 CP2 moved the
   * `stampOnboardingComplete` call into TutorialMatch's
   * `finishAndExit` because TutorialMatch is now the LAST
   * onboarding screen (the token walkthrough that previously
   * owned the stamp was deleted).
   */
  TutorialMatch: undefined;
  /**
   * Phase 7A.7 CP4 — per-mode tutorial. Generic 3-slide scaffold
   * keyed by `modeId`. CP4 ships Mode 2 content only; CP5 adds
   * Modes 3+4, CP6 adds Modes 5+6+7. Mode 1 is excluded — Phase
   * 7A.6 CP3's `TutorialMatch` covers it.
   *
   * Skip and Start CTA both call `markModeTutorialSeen(modeId)`
   * and replace into `Matchmaking` with the same modeId — the user
   * tapped that mode on Home and we keep them on the path. Going
   * to Home would feel like a regression of their tap. Skip and
   * Start both flip the seen flag so the tutorial does not
   * intercept again on next mode launch (matches CP3's
   * "skip = don't show me again" semantic for Mode 1).
   *
   * CP7 will wire the interception: `MatchmakingScreen` (or the
   * Home → mode tile press handler) consults
   * `userStore.modeTutorialsSeen[modeId]` and routes here when
   * unseen.
   */
  ModeTutorial: { modeId: number };
  Home: undefined;
  Matchmaking: { modeId: number };
  SecretSetup: { modeId: number; opponentId: string };
  Match: { modeId: number; opponentId: string };
  MatchResult: {
    modeId: number;
    outcome: MatchResultOutcome;
    /** Threaded from Matchmaking → SecretSetup → Match → MatchResult so the
     *  defeat copy can name the rival who cracked it. Phase 7A.1 — was
     *  hardcoded to 'opp-1' in the result screen until the chain landed. */
    opponentId: string;
    /** Engine path — real opponent secret for the reveal. Mock path omits. */
    secret?: string;
    /** Engine path — winner's per-side guess count for the headline copy. */
    guessCount?: number;
    /** Engine path — token reward computed from the mode's stake table. */
    reward?: number;
    /** Engine path — XP earned this match. */
    xpGain?: number;
  };
  Shop: undefined;
  /**
   * Phase 7A.5 CP6 + Codex finding 1 (HIGH) fix — `mode` chooses
   * between the legacy reward flow (default `'reward'` → `+50`
   * tokens via `watchAdAction`) and the rewarded-double flow
   * (`'double'` → credits the doubled reward via
   * `applyRewardedDouble(matchId)`). Both modes share the same
   * screen surface (5-second countdown + Skip arming), only the
   * finish handler branches.
   *
   * The double-mode param is `matchId` (NOT a credit amount) —
   * the action computes the doubled tokens internally from the
   * matchState. This closes the pre-fix exploit where a
   * manipulated `extraReward` could mint arbitrary tokens.
   *
   * Both params are optional so existing call sites
   * (`navigation.navigate('AdWatch')`) keep their pre-CP6
   * behaviour. `matchId` is required when `mode === 'double'`;
   * the screen defends against a missing param by falling through
   * to a `no_match` reject + analytics event for invalid attempts.
   */
  AdWatch: { mode?: 'reward' | 'double'; matchId?: string } | undefined;
  /**
   * Phase 7A.5 CP3 — periodic interstitial. Pushed from
   * `MatchResultScreen` after every Nth Mode 1-7 match
   * (`INTERSTITIAL_MATCH_THRESHOLD`); routes back to MatchResult
   * via `goBack` rather than `popToTop` so the player keeps the
   * result screen + Play Again CTA on dismiss.
   */
  InterstitialAd: undefined;
  Profile: undefined;
  InsufficientTokens: { modeId: number };
  ChangeUsername: undefined;
  /**
   * Phase 7A.4 — Daily Challenge anchor feature. No params: the
   * screen reads "today" from the system clock at mount and consults
   * `dailyChallengeStore.currentAttempt` for resume vs fresh path.
   */
  Daily: undefined;
  /**
   * Phase 7A.4 — Daily Challenge result. No params: the screen reads
   * the just-completed result from `userStore.dailyChallenge.lastResult`.
   */
  DailyResult: undefined;
};
