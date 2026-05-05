/**
 * Phase 7A.5 CP1 — Economy constants.
 *
 * Single canonical home for the launch-balance levers: ad cap, ad
 * reward, low-balance threshold, plus the DDA-aware reward
 * multiplier (CP2). Imported by `adCap.ts`, the shop UI low-balance
 * gate (CP3), and `MatchResultScreen` reward computation (CP2).
 *
 * Keeping these as named constants — not magic numbers in screens —
 * is the same discipline `dailyConfig.ts` enforces for Daily
 * progression bands. A future re-balance lands here, the rest of
 * the codebase tracks.
 */

/**
 * Maximum ads a player can watch in one local-calendar day. Cap
 * resets at midnight in the player's timezone via cross-midnight
 * detection (`adCap.ts`'s `applyAdWatched` writes today's date when
 * the count resets to 1; subsequent same-day watches increment
 * without the date change). Set to 10 per Phase 7A.5 brainstorm
 * decision Q2 — high enough that engaged players aren't gated mid-
 * session, low enough that an idle exploit can't farm the wallet.
 */
export const AD_CAP_PER_DAY = 10;

/**
 * Tokens credited per completed ad watch. Phase 7A.5 brainstorm
 * decision Q4 — 50 tokens covers exactly one Mode 1/2/3/4/6 stake,
 * so a low-balance player can self-recover one match's worth of
 * play. Multiplies cleanly: 10 ads × 50 tokens = 500 tokens/day
 * theoretical ceiling, comparable to ~3-4 winning matches.
 */
export const AD_REWARD_TOKENS = 50;

/**
 * Token balance below which the InsufficientTokens / shop low-
 * balance UX surfaces (Phase 7A.5 CP3). Phase 7A.5 brainstorm
 * decision Q3 — 100 tokens, set just above the lowest competitive
 * stake (50 for Modes 1/2/3/4/6) so the gate fires *before* the
 * player can't afford a single match, not at the exact moment they
 * already can't.
 */
export const LOW_BALANCE_THRESHOLD = 100;

/**
 * Phase 7A.5 CP3 — frequency cap for the periodic interstitial.
 * After every Nth completed Mode 1–7 match, the next post-match
 * navigation routes through `InterstitialAdScreen`. Set to 3 per
 * Phase 7A.5 brainstorm — high enough to keep interstitials out of
 * the immediate "play again" loop, low enough to monetise an
 * engaged session. The threshold is inclusive: counter ≥ 3 fires
 * the ad, then `resetMatchCounter()` puts the counter back to 0.
 *
 * Daily Challenge does NOT increment this counter (separate
 * concern — Daily is ad-free by design). The increment lives on
 * the Mode 1–7 match-completion seam (`MatchResultScreen.tsx`,
 * single call site). Pinned by a regression test in
 * `userStore.test.ts` so a future PR can't accidentally cross-
 * wire the two domains.
 */
export const INTERSTITIAL_MATCH_THRESHOLD = 3;

/**
 * Phase 7A.5 CP2 — DDA-aware reward multiplier for win-token
 * payouts. The mode catalog's `rewardWin` is the easy-band base;
 * normal and hard apply these multipliers when computing the
 * actual credit at `MatchResultScreen` reward time.
 *
 * Multiplier rationale (brainstorm Q1):
 *   - 1.0× easy: no upside for stomping a soft bot — keeps the
 *     DDA hidden (no metagame around forcing easy bands for farm).
 *   - 1.2× normal: ~20% premium on the design-tuned baseline; the
 *     band most players spend most of their time in.
 *   - 1.5× hard: 50% premium for the 8–10/10 win rate band; pays
 *     for the difficulty without breaking the ≤125 Daily ceiling.
 *
 * Floors at 1.0× — there is no negative multiplier. A player on
 * the easy band still gets the full `rewardWin`; they just don't
 * get a bonus.
 */
export const REWARD_MULTIPLIER_EASY = 1.0;
export const REWARD_MULTIPLIER_NORMAL = 1.2;
export const REWARD_MULTIPLIER_HARD = 1.5;

/**
 * Phase 7A.5 CP1 — Remove Ads IAP product metadata.
 *
 * Production: RevenueCat-verified non-consumable purchase.
 * `IAP_REMOVE_ADS_PRODUCT_ID` is the App Store / Play Store
 * product identifier; `IAP_REMOVE_ADS_PRICE_USD` is the canonical
 * price the catalog UI compares against; `IAP_REMOVE_ADS_DISPLAY_PRICE`
 * is the user-facing string. Localized pricing lands in Phase 8
 * (full IAP integration); for the prototype the display price is
 * a hardcoded USD string.
 *
 * What "Remove Ads" removes (brainstorm Q11): only the **forced**
 * interstitial layer (CP3). The need-driven `AdWatchScreen` reward
 * loop and the rewarded "double tokens" CTA (CP6) stay available —
 * those are user-elective, and disabling them would cap the
 * earning ceiling for paying players. Q12 confirmed: just remove
 * the ads, no token bonus on purchase.
 */
export const IAP_REMOVE_ADS_PRODUCT_ID = 'com.cipherbreaker.remove_ads';
export const IAP_REMOVE_ADS_PRICE_USD = 2.99;
export const IAP_REMOVE_ADS_DISPLAY_PRICE = '$2.99';
