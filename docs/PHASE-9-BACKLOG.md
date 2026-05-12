# Phase 9 / Future Backlog

Forward-looking items deliberately deferred during Phase 7A.6 sealing. ARCHITECTURE.md is the historical record of decisions made; this file is the queue of decisions intentionally postponed.

Each item lists: scope, why it was deferred, and (where applicable) what would unblock taking it on.

---

## Open design decisions

### Per-mode first-time tutorials

**Scope.** Mini-tutorials (overlay + visual cue) shown the first time the user enters Mode 2 (High/Low), Mode 3 (Precision), Mode 4 (Blitz), Mode 5 (Blackout), Mode 6 (Sudden Death), Mode 7 (Mirror). Each tutorial would explain that mode's specific feedback semantic (+1/-M for Mode 3, blackout reveal for Mode 5, etc.) before the player commits a stake.

**Why deferred.** User explicitly tabled this until Phase 7A.6 sealed. Each per-mode tutorial is a meaningful design + content surface (visual mockup, explanation copy, dismissal semantics, persisted "seen" flag per mode). Six tutorials × the CP3 / CP4 surface effort each is non-trivial. Better to ship the core onboarding (CP1-CP8) and observe which modes generate the most "I don't understand the feedback" friction post-launch, then size the per-mode tutorial work against real data.

**Unblocks.** Phase 7A.7 design conversation. Open questions:
- One-shot per mode (six independent flags) or grouped (one "advanced modes" tutorial that fires before Mode 2)?
- Modal interrupt or inline overlay during the first match's first turn?
- Skip semantics (per-mode skip / skip-all-mode-tutorials)?
- Replay-from-Settings affordance (matches the future tutorial-replay item below)?

**Schema impact (informational).** Six new boolean flags would slot cleanly into `OnboardingState`. Migrations would seed them `false` for everyone (existing players included — they "haven't seen" the new tutorials by definition).

### Mode 1-7 in-match hint UI integration

**Scope.** Currently only Daily Challenge has a hint affordance (`HintButton` in `DailyMatchScreen.tsx` — Hint A Reveal at 100 tokens, Hint B Probe at 50). Mode 1-7 production matches have no hint UI at all. The CP3 tutorial invented an auto-hint mechanic to teach the concept, knowing production would catch up later.

**Why deferred.** Adding hint UI to Mode 1-7 is a larger design conversation than fits the onboarding sealing scope:
- Should Hint A be a flat 100 in all modes, or scaled by stake (e.g. 200 for Mode 5's higher-stake matches)?
- Per-match cap (e.g. max 1 reveal + 1 probe per match) to prevent stake-1-hint-stake-1-hint farming?
- DDA interaction (does using a hint shift difficulty? almost certainly should not, but pin it)?
- Mode 5 Blackout hint surface — what does "reveal" mean when only locked-in digits are normally shown?

**Unblocks.** Either a separate post-launch design conversation or Phase 7B observation data showing hints would unlock more matches than they cost. Spec snippet from CP3 reconnaissance: "Hint A/B is Daily-only" was a finding, not a permanent constraint.

### Daily login reward

**Scope.** A small token grant (e.g. 25 tokens) on first Daily Challenge attempt of the day, regardless of win/lose. Encourages daily return without coupling to win-rate.

**Why deferred.** Phase 7A.5's economy modeling explicitly chose Daily as ad-free + token-reward-free ("pure skill" framing — output is the earned-hint pool). Adding a login reward changes the economic shape; revisit only after Phase 7B's live economy observation shows whether daily retention is healthy or anemic.

**Unblocks.** Live retention data from Phase 8 TestFlight + early launch, plus a sink:source ratio review of the existing economy at scale.

### Daily Challenge token reward

**Scope.** Win-bound token grant on Daily Challenge (e.g. 50 tokens for a successful crack). Currently Daily grants no tokens; reward is exclusively the streak-driven earned-hint pool.

**Why deferred.** Same reasoning as the login reward — the "pure skill" framing is intentional. Adding a token grant would double up on an already-rewarded path and may distort the streak hint pool's perceived value. Revisit only with strong observed data showing the pure-skill framing isn't motivating enough.

**Unblocks.** Phase 7B / 8 retention data + qualitative feedback from TestFlight.

---

### Sound asset polish

**Scope.** Replace CP2 procedural ffmpeg WAVs with curated/produced sounds. The five files in `assets/sounds/` (`win.wav`, `lose.wav`, `draw.wav`, `earn.wav`, `dailyUnlock.wav`) shipped during Phase 7A.7 CP2 as mathematically-synthesized placeholders (sine + amix + afade chains) — see `assets/sounds/ATTRIBUTION.md` for generation details.

**Why deferred.** Procedural assets are functional and fully license-free, sufficient to ship a working sound surface. Production polish should source from a professional library (Mixkit / Pixabay CC0, or licensed pack) or commission custom sounds.

**Asset swap is a 5-file drop-in.** New WAV / MP3 files at the same paths. `src/lib/sound.ts` `require()` references are filename-stable; no code changes needed. Update `assets/sounds/ATTRIBUTION.md` with the new source + license.

**Adjacent: master volume slider.** CP2 hardcoded `volume: 0.7` per player. A user-facing master volume slider in Settings is also queued; both can land together if the Phase 9 polish pass takes audio seriously.

### Per-mode tutorial copy review

**Scope.** Native-English / UX-writer pass over the slide titles and bodies in `src/components/modeTutorial/mode<2..7>.tsx`. Headlines and microcopy were authored by the Phase 7A.7 CP4-CP6 design conversation, not by a copywriter.

**Why deferred.** Three mechanic mismatches caught at pre-impl across CP4-CP6, none shipped:
- **CP4 Mode 2** — spec described per-digit HIGHER/LOWER feedback, but `evaluateHighLow` compares whole-number values and emits a single direction. Corrected copy shipped.
- **CP5 Mode 3 (Precision)** — spec described cumulative scoring across guesses ("Final score = total points across all guesses"), but production has no cumulative score; `Mode3Row` shows a per-guess `+N −M` chip and win = `plus === 4` on a single guess. Corrected copy shipped. CP5 also tightened Mode 4's chess-clock copy (spec's "submit to pause briefly" oversold a delay that does not exist).
- **CP6 Mode 5 (Blackout)** — the **largest correction** in Phase 7A.7. The entire spec metaphor ("lock digits to see them / wrong locks waste turns / right locks reveal feedback for the rest") was fictional. Production: submit a 4-digit guess, see zero positional info, get a single number 0-4 telling you how many digits landed in the right slot. No manual lock action exists. Corrected copy ships a pure-blackout-count mental model.
- **CP6 Mode 7 (Mirror)** — minor title tweak ("Race the clock-less" → "Pace, not clock") for clarity. No mechanic correction; spec was accurate.

3 of 6 audited modes had mechanic mismatches (50%). The verification discipline is doing real work. Mode 5 in particular would have shipped a fictional gameplay model. The polish pass should verify mechanic accuracy alongside language polish, not just style.

**Verification protocol for the polish pass.** For each mode 2-7, locate the evaluator (`@game/modes/mode<id>/evaluate`) and the row renderer (`@components/game/rows/Mode<id>Row`), confirm the actual feedback semantics, then read the tutorial copy against that ground truth. Flag any contradictions before touching language. CP4-CP6 implementation discipline (added partway through Phase 7A.7) requires this verification at implementation time; the polish pass is the second-pass safety net.

**Bundled with copy:** the `Start match →` / `Continue →` footer wording in `ModeTutorialScreen.tsx` and the per-mode CTA tone (e.g., "Bisect to crack it" intentionally hints at strategy — modes 5 Blackout / 7 Mirror should get a similar strategy hook on slide 3 if the language pass agrees with the framing).

### HomeScreen gate ordering — tutorial-before-balance for first-time mode access?

**Scope.** CP7's `playMode` runs the balance gate first (`tokens < stake → InsufficientTokens`) and the tutorial gate second (`!modeTutorialsSeen[modeId] → ModeTutorial`). For a user with insufficient balance tapping Mode 2-7 for the first time, this means they see the InsufficientTokens modal before they ever see the mode's tutorial — they may not understand what they're being asked to stake on.

**Why deferred.** The current ordering is defensible: the tutorial CTA at the end of ModeTutorial routes to Matchmaking, which would dead-end at InsufficientTokens for a low-balance user anyway. Showing the modal first lets them resolve balance; their next tap takes the tutorial path naturally. But there's an argument for "teach first, gate second" — a user who has no idea what Blackout is shouldn't be pressured to buy tokens for it. Worth a design conversation.

**Unblocks.** A small swap in `HomeScreen.tsx:playMode`. Existing tests would need a parallel "tutorial gate wins over balance gate" case if the ordering flips.

### Mode 7 polish — deferred recon items (CP8)

CP8 reconnaissance flagged 7 polish opportunities; the user picked the top 4 (race-aware result copy, animated badge, tighter bot pace, mid-match haptic). The remaining 3 are queued here:

- **VS ceremony / match start splash.** A short pre-match transition showing both avatars with a brief "VS" treatment before Match mounts. Currently Matchmaking → Match is a hard cut. Effort: medium-large (new component + navigation interlock). Impact: low-medium (cosmetic, not load-bearing).
- **Milestone copy in SoloRaceBanner (dynamic headline).** Replace the static "Both solving the same code" with state-driven variants like "You're ahead by N guesses" / "Rival's catching up" / "Neck and neck." Effort: medium (state-driven copy variants, tuning risk to avoid feeling fake). Impact: low — risk of overpromising rival behavior.
- **`BotTypingFooter` verb upgrade for Mode 7.** Currently shows "is guessing" for both Mode 6 and Mode 7. A Mode 7-specific "is racing" would lean into the race framing established in CP6 tutorial + CP8 result copy. Effort: trivial (one-line ternary). Impact: low (cosmetic). Trivial enough to bundle with the next Mode 7-adjacent CP rather than ship standalone.

### Mode 7 forfeit copy

**Scope.** CP8 race-aware result copy handles natural victory / defeat / draw. `confirmForfeit` short-circuits via `clearMatch()` + `popToTop()` — forfeit never routes through MatchResultScreen. But forfeit currently has no race-specific framing at all (the Alert just says "Forfeit match? You lose your entry stake."). A Mode 7-specific Alert variant could read "Quit the race? Rival wins by default." or similar.

**Why deferred.** Forfeit is a low-frequency action; race-specific Alert copy is cosmetic polish that doesn't compose with CP8's core race ecosystem (different code path entirely — Alert API call, not result screen).

### SoloRaceBanner static headline + no asymmetry signal

**Scope.** Two related Mode 7 gaps surfaced by CP8 recon item (k):
- The SoloRaceBanner headline "Both solving the same code" is static — never reflects progress imbalance.
- If the user's timeline is short and rival's count is high, there's no visual asymmetry to communicate "they're way ahead." Could surface a subtle indicator (e.g., a marker on the rival pill at certain thresholds).

**Why deferred.** Both items overlap with the "Milestone copy" entry above and should be tackled in the same pass to keep the Mode 7 voice coherent.

---

## Cleanup / tech debt

### `completeOnboarding` does not flip `hasOnboarded`

**Scope.** `completeOnboarding(today)` flips all 6 onboarding step flags + `completedAt` but leaves `hasOnboarded` as-is. Skip users land in `pickInitialRoute()`'s "all step flags true + hasOnboarded false" failsafe branch. The branch routes correctly to Home, but it's load-bearing for Skip users — not a true edge case.

**Cleanup options** (either is acceptable; current state works correctly):

- **Option A (active fix).** Make `completeOnboarding` flip `hasOnboarded: true` explicitly. The failsafe branch then becomes a true edge case (corrupt-state recovery only), and Skip users use the master gate path identical to linear-completion users. Behavior change: invisible to users; observable only in test fixtures that pin `hasOnboarded` separately. Pinning tests already cover both states; minor update.
- **Option B (passive doc).** Document the current behavior more thoroughly. Update `pickInitialRoute()`'s failsafe comment to acknowledge it's load-bearing for Skip users, not "defensive against corruption only". Update `completeOnboarding`'s JSDoc to call out the `hasOnboarded` non-flip. Zero behavior change; future readers don't have to grep to understand.

**Why deferred.** CP7.1 spec said don't touch `completeOnboarding`. The side-finding was logged; no user-visible bug. Either cleanup is small enough for a single-CP hotfix when the maintainer is in this code anyway.

**Unblocks.** Whoever next touches `RootNavigator.tsx` or `userStore.ts` near these actions can pick Option A or B in passing.

### Audit haptics + sound async rejection handling

**Scope.** CP1 + CP2 helpers gate on `useSettingsStore` and fire-and-forget into native bindings. Most call sites use `void` or implicit ignore; a few (`sound.ts:107 player.seekTo(0).catch(...)`) have explicit catch blocks to suppress unhandled-rejection warnings in dev/test. The mix is inconsistent — a focused audit should:
- Enumerate every async path in `src/lib/haptics.ts` + `src/lib/sound.ts`
- Standardize on explicit `.catch(() => {})` (or a shared `swallow` helper) over implicit void for rejection-prone calls
- Add a lint rule (or test) that catches a future bare `.play()` / `.seekTo()` that drops the rejection

**Why deferred.** No user-visible failure today; this is a robustness pass, not a bug fix.

### Schema migration bookkeeping checklist (ARCHITECTURE note)

**Scope.** The persist-store migration pattern is now thrice-applied:
- v1 → v2 → v3: pre-Phase-7A.5 schema evolution
- v3 → v4: Phase 7A.5 daily ad-free invariant (four fields atomic)
- v5 → v6: Phase 7A.7 CP3 `modeTutorialsSeen` field

Each migration follows the same 5-step pattern (type-alias chain, explicit migration function, STORE_VERSION bump, seeding heuristic for pre-existing users, test coverage). Worth promoting to its own ARCHITECTURE.md checklist so the fourth migration doesn't re-derive the pattern from scratch.

**Why deferred.** Documentation-only; nothing user-visible. Pick up when the next migration lands.

### Tutorial copy native-English / UX-writer review

**Scope.** Already covered in detail under the "Per-mode tutorial copy review" entry above. Cross-listed here as a cleanup item because the corrections shipped in CP4-CP6 were **mechanic-driven** (verification protocol catches), not **stylistic** — a formal UX writer pass over Modes 2-7 slide copy + the win-cue / button label vocabulary is still owed.

**Why deferred.** Same as the upstream entry: queued for the polish pass, not blocking launch.

### Legacy `OnboardingScreen.tsx` archived (CP7)

**Status.** Removed in CP7 (`f0f75bb`) — file, test, snapshot, route registration, route param all cleaned up. Zero orphan references at sealing time.

**Note for history.** The legacy screen lived in the codebase from Phase 1B through Phase 7A.5; CP3.1 flagged it for removal because its hardcoded "You start with 500 tokens" copy contradicted the post-CP3.1 starting balance of 100. CP7 was the natural place to remove it because the conditional flow finally replaced its routing role. Mentioned here only as a historical record; nothing to action.

---

## Settings entries (post-launch polish)

### "Replay tutorial"

**Scope.** Settings entry that flips `tutorialMatchCompleted: false` and navigates to `TutorialMatch`. Lets users re-experience the CP3 tutorial after they've onboarded.

**Why deferred.** Onboarding flow ships in Phase 7A.6; "I want to revisit X" Settings affordances are post-launch polish. Low-risk, mechanical addition. CP1's `OnboardingState` schema docs explicitly anticipated this ("a Replay Tutorial entry on Settings is a separate future affordance that will clear flags then").

**Schema impact.** None new. Reuses the existing `tutorialMatchCompleted` flag flipping pattern.

**Edge cases worth considering when implemented.** Should replay reset `matchesCompletedSinceOnboarding` (so CP5 teasers re-fire afterward)? Probably no — counter is "lifetime since onboarding", replay is "experience the screen again". Counter should outlive replay.

### "Re-enable notifications"

**Scope.** Settings entry visible only when `notificationOptInAsked === true`. Either:
- (a) Re-surfaces `NotificationOptInModal` on tap (identical UX to first-time soft-ask).
- (b) Deep-links to iOS Settings → CipherBreaker → Notifications via `Linking.openSettings()` so user can flip the OS-level permission (if they previously denied).

Probably (a) is sufficient when the user previously dismissed our soft-ask without granting permission; (b) when they granted then later disabled at OS level. Detect via `Notifications.getPermissionsAsync()`.

**Why deferred.** Same as replay-tutorial — post-launch polish, not load-bearing.

### "Replay token economy walkthrough" + "Replay onboarding intro"

**Scope.** Symmetric Settings entries for CP2 and CP4 walkthroughs. Lower priority than the tutorial replay because CP2/CP4 are passive content (slides) — users who want a refresher could find it elsewhere (a future Help / FAQ surface). Mentioned for completeness; design-discuss before adding.

### "Replay per-mode tutorials" (Mode 2-7)

**Scope.** Six new Settings entries, one per Mode 2-7, that clear the corresponding `modeTutorialsSeen[modeId]` flag so the next tap on that ModeCard re-routes through the tutorial. Or one combined entry — "Replay mode tutorials" — that resets all six flags. Combined is probably right (six toggles in Settings is noisy; the tutorial is a teach-once surface).

**Why deferred.** Phase 7A.7 sealed without a replay path. Users who skip a tutorial today have no way to re-visit it without resetting the entire app. Low-frequency need; CP9 reviewer noted it's "post-launch polish" alongside the other replay entries.

**Implementation sketch.** A single Settings row with the existing toggle style; tapping it calls `useUserStore.setState((s) => ({ modeTutorialsSeen: {} }))`. Optionally add a confirm dialog ("Reset all mode tutorials? Next time you tap Mode 2-7, you'll see the tutorial again.").

### Master volume slider (CP2 deferred)

**Scope.** Already covered as an adjacent under "Sound asset polish" above. Cross-listed here because the slider lives in the Settings surface (not the asset pipeline). When the polish pass adds the slider, the existing `useSettingsStore.sound` boolean master toggle stays as a kill-switch — the slider sits below it for finer control.

---

## Phase 7B test infrastructure

### Runtime smoke check on dev startup

**Scope.** A development-only check (gated by `__DEV__`) that runs at app launch and verifies every action declared in `UserStoreActions` is `typeof === 'function'` on `useUserStore.getState()`. If any are missing, log a loud error and surface a developer banner. Catches Fast Refresh stale-store issues at the moment they happen, not 5 CPs later.

**Why deferred.** The CP7.2 hotfix documented the failure mode and added a regression test for the adjacent persist-rehydration scenario. The runtime smoke is the proper systemic fix but requires a small dev-only utility module + integration with the app launch sequence; better as part of a coordinated Phase 7B test infra pass.

**Implementation sketch.** A `validateStoreActionsOnLaunch()` helper imported from `App.tsx`. Iterates over a list of expected action names (kept in sync with `UserStoreActions` interface, possibly via a `keyof` derivation if TS allows runtime introspection). On mismatch, calls `console.error` with a clear "Fast Refresh stale store — run npx expo start --clear" message + surfaces a non-blocking dev banner.

### HMR-stale-store detection banner for developers

**Scope.** Same direction as above but more user-visible: a dev-only banner overlay that appears when stale-store conditions are detected (e.g. action returns undefined for a known-implemented action). Distinct from generic error overlays — explicitly diagnoses the HMR issue and tells the developer the fix.

**Why deferred.** Layered on top of the runtime smoke. Both are Phase 7B test-infra polish; neither is blocking.

### Real-store integration test pattern

**Scope.** The existing test suite predominantly uses `useUserStore.setState({...})` to pin state and let actions run against the real store, but the test environment loads userStore once per worker and never simulates Fast Refresh. A more aggressive pattern would isolate each test in its own module-scoped store instance, OR introduce a "module-reload simulation" that re-imports userStore and verifies action availability mid-test. Either would catch interface-vs-implementation gaps that pure setState-based tests miss.

**Why deferred.** Non-trivial test infra change; the CP7.2 persist-rehydration regression test already covers the adjacent failure mode. Phase 7B is the right time to consider the broader infra investment.

---

## Phase 7B analytics

### `addTokens` source parameter consumer

**Scope.** CP3.1 added an optional `source?: string` parameter to `addTokens(amount, source?)`. The implementation discards it (`_source` underscore). All call sites pass meaningful source strings (`'tutorial_match_complete'`, `'blitz_teaser_gift'`, `'mirror_teaser_gift'`, etc.) anticipating a Phase 7B analytics provider migration.

**Status today.** Placeholder. No analytics events fire on token grants.

**Phase 7B deliverable.** Wire the source parameter to whichever analytics provider Phase 7B adopts (likely RevenueCat events alongside the existing IAP integration, plus a generic event tracker for non-purchase grants). Existing call sites need no changes; the action implementation gains a single "log event" call after the wallet-credit setState.

### Token grant/spend events

**Scope.** Beyond the `addTokens` source parameter, the broader question of what gets logged. Candidate event taxonomy:
- `tokens_granted { source, amount, balance_after }`
- `tokens_spent { sink, amount, balance_after }` — match stakes, hint purchases, future spend points
- `wallet_low_balance_seen` — fires when LowBalanceToast surfaces
- `wallet_zero_balance_reached` — likely a leading indicator of churn
- `token_pack_purchased { sku, usd_amount, tokens_granted }` — IAP path

**Why deferred.** Phase 7B analytics work; this taxonomy is part of that planning, not part of 7A.6 sealing.

### Onboarding step completion events

**Scope.** Track which steps each user completes vs skips:
- `onboarding_intro_started` / `onboarding_intro_completed` / `onboarding_intro_skipped`
- Same triplet per CP3 (tutorial), CP4 (token walkthrough)
- `onboarding_tutorial_skip_at_match_n { turn, attempts_so_far }` — diagnose tutorial drop-off
- `onboarding_completed_at { path: 'linear' | 'skip', surfaces_seen: [...] }`

**Why deferred.** Same as token events. Phase 7B will take a coordinated pass over event tracking.

### Per-mode tutorial events (Mode 2-7)

**Scope.** Track which per-mode tutorials each user completes vs skips:
- `mode_tutorial_shown { mode_id, modeName }`
- `mode_tutorial_skipped { mode_id, slide_index }` — diagnose drop-off mid-walk
- `mode_tutorial_completed { mode_id }` — Start match CTA path
- `mode_tutorial_demo_engaged { mode_id, guess_count }` — did the user interact with the slide-3 DemoBoard, or just swipe past?

**Why deferred.** Phase 7B analytics sweep alongside the Onboarding step events above. The DemoBoard engagement is the highest-signal metric here — a low engagement rate would suggest the tutorial demos aren't doing their pedagogical job and could be simplified.

### Mode 7 race outcome analytics

**Scope.** Mode 7's race ecosystem (CP8) introduces specific signals that warrant their own slice:
- `mode7_race_outcome { outcome, user_guesses, opponent_guesses, bot_difficulty }` — distribution of victories/defeats/draws + how close each was
- `mode7_bot_pace_p50_p95 { difficulty }` — observed thinking-time percentiles per difficulty band; sanity-check the CP8 pace tightening landed where intended
- `mode7_match_duration_ms { outcome }` — useful for tuning future pacing decisions

**Why deferred.** Phase 7B analytics sweep. Mode 7 is the only mode where bot pace is part of the user-facing UX (CP8 explicitly tightened it), so it warrants its own telemetry slice that other modes don't need.

### Teaser / push opt-in events

**Scope.** CP5 / CP6 surface tracking:
- `mode_teaser_shown { mode: 'blitz' | 'mirror', match_count }`
- `mode_teaser_cta_taken { mode, granted_tokens }`
- `mode_teaser_skipped { mode }`
- `notification_opt_in_shown` / `notification_opt_in_granted` / `notification_opt_in_denied` / `notification_opt_in_dismissed`

**Why deferred.** Same Phase 7B sweep.

---

## Notes on this file

- ARCHITECTURE.md is the historical record. PHASE-9-BACKLOG.md is the forward-looking queue.
- Items here are intentionally NOT prioritized; ordering is by category, not urgency.
- Each item should remain self-contained: a future maintainer reading it cold should understand scope + deferral reason without needing to grep history.
- When an item is taken on, MOVE the entry from this file to ARCHITECTURE.md as a record of the decision (or delete, if the rationale doesn't warrant preserving). Don't leave stale items here once they're shipped.

Last updated: Phase 7A.6 sealing (CP8).
