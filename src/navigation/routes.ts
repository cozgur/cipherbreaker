/**
 * Root-stack route names + param shapes. Colocated in its own module
 * (not inside `RootNavigator.tsx`) so screens can import only the type
 * without dragging the navigator component tree into their bundle.
 */

export type MatchResultOutcome = 'victory' | 'defeat' | 'draw' | 'stalemate';

export type RootStackParamList = {
  Onboarding: undefined;
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
   * Phase 7A.5 CP6 — `mode` chooses between the legacy reward
   * flow (default `'reward'` → `+50` tokens via `watchAdAction`)
   * and the rewarded-double flow (`'double'` → grants `extraReward`
   * extra tokens via `applyRewardedDouble`). Both modes share the
   * same screen surface (5-second countdown + Skip arming), only
   * the finish handler branches.
   *
   * Both params are optional so existing call sites
   * (`navigation.navigate('AdWatch')`) keep their pre-CP6 behaviour.
   * `extraReward` is required when `mode === 'double'`; the screen
   * defends against the missing-param edge by falling through to a
   * no-credit completion.
   */
  AdWatch: { mode?: 'reward' | 'double'; extraReward?: number } | undefined;
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
