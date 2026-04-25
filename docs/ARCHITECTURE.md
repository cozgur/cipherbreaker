# CipherBreaker Architecture

This doc records architectural decisions as they are made. Each phase appends a section. For the product spec see `specs/CipherBreaker-SPEC.md`; for the visual language see `specs/CipherBreaker-DESIGN-PROMPT.md`; for the phase-by-phase plan see `specs/CipherBreaker-ROADMAP-v4.md`.

---

## Phase 0 decisions

### TypeScript strict config

`tsconfig.json` extends `expo/tsconfig.base` and sets four additional flags on top of `strict: true`:

- **`noUncheckedIndexedAccess: true`** — array/record lookups return `T | undefined`. Forces explicit bounds checks before indexing into candidate pools, guess history, and bot solver state. The 4-digit-guess domain has lots of `arr[i]` access; this flag catches off-by-one errors at compile time instead of producing `undefined.toString()` at runtime.
- **`noImplicitOverride: true`** — subclass methods must declare `override`. Cheap insurance against silently-broken inheritance in Zustand store actions and future abstract engine hooks.
- **`noFallthroughCasesInSwitch: true`** — required because `NormalizedFeedback` is a discriminated union (`kind: 'colorMatch' | 'direction' | ...`) and every renderer/evaluator switches on `kind`. Forgotten `break` would make one mode's feedback bleed into another.
- **`forceConsistentCasingInFileNames: true`** — macOS case-insensitive FS is forgiving; CI on Linux is not. Catch `import Mode1Row from './mode1row'` locally.

Only `App.tsx`, `index.ts`, and `src/**` are included; build-tool config (`babel.config.js`, `metro.config.js`, `jest.config.js`) is excluded from the typecheck pass.

### Path aliases

```
@/*           → src/*
@game/*       → src/game/*
@components/* → src/components/*
@screens/*    → src/screens/*
@theme/*      → src/theme/*
@state/*      → src/state/*
@lib/*        → src/lib/*
@data/*       → src/data/*
@navigation/* → src/navigation/*
```

**Runtime resolution** relies on Metro reading `tsconfig.json` paths natively — supported since Expo SDK 52. We deliberately did **not** add `babel-plugin-module-resolver`: every additional babel plugin slows transforms and another layer has to stay in sync with the tsconfig. If Metro path resolution ever proves insufficient (for example for nested alias prefixes), add the plugin then.

**Jest resolution** does not go through Metro, so `jest.config.js` mirrors the aliases in `moduleNameMapper`. This file is the only place that needs updating when an alias is added.

### ESLint flat config (ESLint 9)

`eslint.config.js` is a flat config (ESLint 9 dropped `.eslintrc.*` support from the default resolver). Composition order:

1. Global ignores (`node_modules`, `.expo`, `dist`, `reference`, `fonts-download`, bundler configs).
2. Rule block for `**/*.{ts,tsx}` that spreads `@typescript-eslint`, `react`, and `react-hooks` recommended rules.
3. `eslint-config-prettier` appended last so it disables every stylistic rule Prettier owns.

Project-specific rule overrides:

- **`react/react-in-jsx-scope: 'off'`** — React 17+ JSX transform; we never import `React` just for JSX.
- **`@typescript-eslint/consistent-type-imports`** set to `inline-type-imports` — keeps type-only imports terse and easy for bundler tree-shaking.
- **`@typescript-eslint/no-require-imports: 'off'`** — React Native loads static assets (fonts, images, sounds) via `require('./asset.ttf')`. Banning `require()` globally would make every font/asset import a lint violation.
- **`@typescript-eslint/no-unused-vars`** with `^_` ignore pattern — matches the common convention for intentionally unused destructures.
- **`@typescript-eslint/no-explicit-any: 'warn'`** (not `'error'`) — avoids a hard fail on legitimate boundary code while still surfacing the debt.

### Prettier

Config (`.prettierrc.json`): `singleQuote`, `trailingComma: all`, `printWidth: 100`, `arrowParens: always`. `.prettierignore` excludes `reference/`, `assets/`, `fonts-download/`, and the lockfile. Prettier is the last word on formatting — ESLint does not enforce stylistic rules (thanks to `eslint-config-prettier`).

### Husky v9 pre-commit

Modern Husky setup: `npx husky init` generates `.husky/pre-commit`, which was overridden from the default `npm test` to:

```sh
npm run typecheck && npm run lint
```

Rationale: Jest is not useful on every commit (tests in a non-empty repo usually pass locally and flakes waste time), but broken types or lint errors block meaningful review. Tests run in CI (`npm run ci`) where the full matrix is cheap.

`package.json` has `"prepare": "husky"` so fresh clones install the hooks automatically after `npm install`. The hook was added *after* the first `npm install`, because Husky's prepare script fails with "husky: command not found" if it runs before Husky itself is in `node_modules`.

### Jest + jest-expo pinning

- **`jest-expo@~54.0.0`** — pinned to match Expo SDK 54. npm originally resolved `jest-expo` to `^55.0.16`, which ships a preset that assumes SDK 55's JS environment. Wrong-major pinning silently breaks the transformer matrix (babel-preset-expo, jest-expo's mocked modules list). Whenever the Expo SDK bumps, this pin moves with it.
- **Jest 29** (transitively via `jest-expo`) — not Jest 30. `jest-expo 54` does not list Jest 30 as a peer. Overriding to Jest 30 would mean maintaining our own preset.
- **`@testing-library/react-native 13`** — peer-compatible with React 19 / RN 0.81.
- **Path aliases** are mirrored in `moduleNameMapper` (Jest doesn't consult `tsconfig.json`).
- **`transformIgnorePatterns`** inherits the long `jest-expo` default so ESM packages in `node_modules` (expo, @react-navigation, react-native internals) are transformed rather than left as raw ESM.

### App shell

- **`App.tsx`** — calls `SplashScreen.preventAutoHideAsync()` at module top, `useFonts` for the 5 TTFs, hides the splash on the root `onLayout` callback. Returns `null` until fonts resolve so first paint is always with the right glyphs — no font swap flash.
- **`expo-font` plugin** declared in `app.json` so native builds bundle the fonts correctly.
- **`RootNavigator.tsx`** — native-stack with a `dark: true` NavigationTheme bound to our `bg-base`, `bg-elevated`, `violet`, and `pink` tokens so React Navigation's default back-gesture chrome matches the app.
- **`PlaceholderScreen.tsx`** — Phase 0 smoke test (Chakra Petch Bold title with a violet `textShadow` glow on the neo-noir base). Replaced in Phase 1 by the real 9-screen set.

### app.json

- `name: "CipherBreaker"`, `slug: "cipherbreaker"`, `version: "0.1.0"`.
- `userInterfaceStyle: "dark"`, splash `backgroundColor: "#0a0b1e"`, adaptive-icon `backgroundColor: "#0a0b1e"` — the app is dark-only; we don't want a white flash between splash and first render.
- `bundleIdentifier` / `android.package`: `com.cipherbreaker.app`.
- `plugins: ["expo-font"]` — added by `npx expo install expo-font` so fonts are embedded by EAS builds.

### Folder skeleton

```
src/
  game/
    modes/       # per-mode ModeDefinition (pure domain, no React)
    engines/     # turnBasedEngine, parallelEngine, checkEndConditions
    shared/      # candidate pool, validation, feedback, bot helpers
    __tests__/
  components/game/rows/   # per-mode GuessRow components
  screens/
  navigation/
  state/
  data/
  theme/
  lib/dev/
assets/fonts/    # ChakraPetch-Bold, Inter-{Regular,Medium,SemiBold}, JetBrainsMono-Bold
```

The `game/modes` → `game/shared` → `components/game/rows` separation is load-bearing for Phase 3+: mode files never import React, row components never import game logic. This is enforced by convention today and will be asserted by a grep in CI in Phase 2.

### Package scripts

```
start, android, ios, web       # Expo dev server
typecheck                       # tsc --noEmit
lint                            # eslint (flat config)
format / format:check           # Prettier write / check
test / test:watch               # Jest
ci                              # typecheck && lint && test --passWithNoTests
prepare                         # husky (fresh-clone hook install)
```

`npm run ci` is the single command CI (and `.husky/pre-push` later) will rely on.

---

## Phase 1A decisions

### Shared primitives, not a component library

`src/components/*.tsx` hosts 17 standalone primitives (`AmbientBackground`, `GrainOverlay`, `Screen`, `TinyTag`, `SectionLabel`, `TokenCoin`, `TokenBadge`, `Avatar`, `OpponentCard`, `DigitTile`, `DigitKeypad`, `ModeIcon`, `ModeCard`, `Button`, `GlassCard`, `LevelBar`, `RadarAnimation`, `TypingIndicator`) — one file each, no combined/compound components, no shared container layer. Barrel export in `src/components/index.ts` is the one import path screens use.

The rule ("one primitive per file") exists because Phase 1B screens will cherry-pick. If primitives were bundled into compound containers, every screen-specific tweak would need a prop-drill refactor back through the library. One primitive per file also means one unit test per file, and renaming/removing a primitive is a single grep.

### Animation stack: moti + reanimated v4

Animations go through **Moti** (`<MotiView from={…} animate={…} transition={…}/>`). Moti runs on **Reanimated v4**, which itself runs on **react-native-worklets** as a peer. All three were installed via `npx expo install` so versions track the SDK 54 runtime in Expo Go.

`babel.config.js` was added in this phase (not Phase 0 — Phase 0 had no animations) and carries `react-native-reanimated/plugin` as the **last** plugin. v4 ships this as a shim that forwards to `react-native-worklets/plugin`; listing the reanimated form keeps the config portable across v3→v4 migrations.

Reanimated v4 **does not supply a working Jest mock**. Its shipped `react-native-reanimated/mock` still boots the native Worklets runtime and crashes in Node. `jest.setup.js` inlines minimal stubs for the Reanimated surface Moti touches (`Easing.*`, `useSharedValue`, `useAnimatedStyle`, `withTiming`, etc.) plus a `MotiView` passthrough that renders children as a plain `View`. This is *intentional*: snapshot tests record layout, not motion — device screenshots cover the animated side.

### React 19 duplicate de-dupe via `overrides`

Moti depends on `framer-motion@6`, whose `peerDependencies` predate React 19 (`react: ">=16.8 || ^17.0.0 || ^18.0.0"`). npm therefore installed a nested `react@19.2.5` beside the project's `19.1.0`, and the mismatched renderer threw `Invalid hook call … hooks can only be called inside the body of a function component`.

Fix: `package.json > overrides > react: "19.1.0"`. A scoped override (`"moti": { "react": ... }`) didn't work because the duplicate is two levels deep (moti → framer-motion → react); the global override dedupes the whole tree. `react-test-renderer` was pinned to `19.1.0` alongside for the same reason (mismatched renderer vs renderer-host).

### Grain overlay: deterministic scatter, not `feTurbulence`

`react-native-svg` does not implement `feTurbulence` on its native side — it logs a startup warning listing every filter it skips. The reference prototype's fractal-noise grain is therefore unreachable in-bundle.

`GrainOverlay` instead paints 260 white 1px `<Rect/>`s inside a 260×260 SVG cell, positioned by a deterministic 32-bit LCG seeded from a prop. `preserveAspectRatio="xMidYMid slice"` makes the cell fill the screen. The overlay sits at 2% opacity per the DESIGN-PROMPT tweak; deterministic seeding means snapshot tests are stable and identical playgrounds at different ambient tints show consistent grain. A tileable PNG is the obvious upgrade if hand-tuned dot density isn't enough — the primitive takes a seed prop so callers can vary per-screen without needing a new component.

### `ModeCatalogEntry` schema: `id` only at the root

`src/game/types.ts` defines `ModeMeta` (presentation), `ModeRules` (mechanics incl. `maxGuessesPerPlayer`, `perPlayerTimeLimitMs`, `flags: ModeRuleFlags`), and `ModeCatalogEntry = { id; meta; rules }`. The numeric `id` lives **only** on the catalog root — never inside `meta` or `rules`. Route params, analytics events, and match payloads reference the root id; duplicating it into nested shapes creates two sources of truth to keep in sync whenever a mode is renamed or re-numbered.

`modeCatalog.test.ts` guards this invariant at runtime (`expect((entry.meta as …).id).toBeUndefined()`). The test also enforces seven modes, unique ids, and a closed set of allowed `iconKey`s so Phase 2's engine dispatch can rely on exhaustive switches.

The `flags` subfield (not booleans scattered on `ModeRules`) exists so Phase 2's engines can discriminate by capability without knowing mode ids — `rules.flags.parallelRace` picks the parallel engine, `rules.flags.perPlayerClock` wires the live clock store, `rules.flags.blackoutReveal` gates the digit-reveal logic. Adding a flag is cheaper than adding a mode id to a switch.

### `Button` variants: only three

Reference + DESIGN-PROMPT usage was audited before implementation; only `primary` (violet gradient), `cyan` (Watch Ad CTA), and `outline` (secondary) are actually called anywhere in the prototype. `gold`, `ghost`, and `danger` existed in `CBButton`'s switch but had zero call sites. They were dropped to keep the variant surface minimal — adding a variant when a real screen needs it is cheaper than carrying three unused branches that drift from the rest of the design system.

### `ModeCard` badge placement

First implementation placed the advanced-mode badge next to the title in a flex row (matching `reference/screens-home.jsx`). On the long advanced-mode names ("SUDDEN DEATH" + "HIGH RISK") the title truncated to `SUDDEN DEA…` because the badge competed for horizontal space. The badge is now absolutely positioned as a corner ribbon at `top: 0; right: 14` with rounded bottom corners, outside the flex flow — the title always gets the full centre-column width. Cards without a badge (Classic modes) render identically to before.

### Temporary `PrimitivePlaygroundScreen`

`src/screens/PrimitivePlaygroundScreen.tsx` is a scroll-stacked catalogue that renders every primitive in every state, wired as the initial route in `RootNavigator` (with a `TODO(phase-1B)` to flip back). The file header warns against importing from it. It is deleted wholesale in Phase 1B once the real screen set consumes the primitives directly. The real purpose: a single simulator run is the visual regression test — screenshots go alongside this doc until Phase 1B lands.

---

## Phase 1B decisions

Phase 1B ships every screen the prototype calls for plus the navigation graph and mock data — but no engine. Three checkpoints landed in this order: CP1 onboarding/home/profile + per-mode row dispatch; CP2 matchmaking/secret-setup/shop/ad/insufficient flows; CP3 match arena + result epilogue + the dev-only outcome picker that stands in for the absent engine.

### `useSyncExternalStore` for the mock user

`src/data/mockUser.ts` exposes a mutable `mockUser` object plus a `useMockUser()` hook backed by `useSyncExternalStore`. Writers (`grantTokens`, `chargeTokens`, `setUsername`, `markOnboarded`, `toggleSetting`) mutate the object in place and emit a tick. Readers subscribe.

The point is the **hook signature** — `useMockUser(): MockUser`. Phase 2 swaps the implementation to a Zustand selector that hydrates from AsyncStorage; every screen that reads `useMockUser()` keeps working without diff. `mockUser` (the raw object) stays exported so tests can `mockUser.tokens = 0` to set up fixtures without going through the writer API. `__resetMockUserForTests()` lives in the same module, used by every test's `beforeEach`.

### `NormalizedFeedback` is the engine ↔ UI contract

`src/game/types.ts` defines a discriminated union `NormalizedFeedback` (`colorMatch | direction | precision | blackout`) plus `GuessEntry` and `GuessRowProps`. `src/game/adapters/guessEntryToRowProps.ts` turns the engine-shaped entry into the row-component-shaped props.

The contract is load-bearing: Phase 1B mocks produce `GuessEntry` shapes directly via `buildMockTimeline(modeId)`; Phase 2's engines emit the **same** shape on every `submitGuess`. The MatchScreen consumer path is `engineState.entries.map(entry => guessEntryToRowProps(entry, ctx))`, identical in both phases.

The adaptor is also where the "extra" sublabel formatting lives — Mode 4 elapsed time (`"0:08s"`) and Mode 6 sudden-death index (`"3/5"`). Row components never format time or counts.

### Plugin row dispatch, not a switch

`src/game/renderers.ts` exports `guessRowRenderers: Readonly<Record<number, ComponentType<GuessRowProps>>>` plus a `getRowRenderer(modeId)` helper. Each mode's row component lives in `src/components/game/rows/Mode{1..7}Row.tsx`; a private `GuessRowShell` (folder-local, not in the rows barrel) hosts the shared layout (avatar + extra label + digit row + optional `trailing`/`below` slots).

Adding a mode is three files (mode definition + row component + registry entry), not a multi-line switch. The registry's keys are cross-checked by a test (`renderers.test.ts`) against `modeCatalog` so a missing mapping fails CI immediately.

### `modeRouter` for navigation policy

`src/game/modeRouter.ts` exposes `nextRouteAfterMatchmaking(modeId): 'SecretSetup' | 'Match'`. Modes 1–6 head into SecretSetup; Mode 7 (Mirror, `parallelRace` flag) skips it because both players race the same engine-generated code.

Pulling this into a helper means MatchmakingScreen and MatchResultScreen never `if (modeId === 7)`. Phase 6's Mirror engine can introduce a pre-shared secret stage (or any other Mirror-specific routing) by editing this one file. The catalog `parallelRace` flag remains the single source of truth.

### Mode 7 stays in `MatchScreen.tsx` (conditional, not a fork)

The bottom input region (DigitTile draft + DigitKeypad + Guess CTA + DevResultPicker), the header (round label + forfeit X), and the timeline dispatch are identical between turn-based and Mirror modes. Only the player area differs (`PlayerCardPair` vs `SoloRaceBanner`) and the typing-indicator verb (`is typing` vs `is guessing`).

A separate `MatchScreenMirror.tsx` would duplicate the shared 80% and create a drift surface every time Phase 5/6 change the input or DevPicker. The conditional pays off until Phase 6 introduces Mirror-specific behaviour large enough to justify a fork — the call is one `git mv` away.

### `DevResultPicker` is `__DEV__`-gated, in-screen, not a route

The Guess CTA in MatchScreen has no engine to call in Phase 1B. Two design rules drove the dev shim:

1. **Production must never see the picker.** The Guess button reads `__DEV__ ? open picker : Alert("Coming soon")`. The picker component itself is only rendered when `pickerOpen=true`, so production builds never even allocate it.
2. **Don't burn a navigation route on a dev affordance.** The picker is a `transparentModal`-style absolute overlay rendered inside MatchScreen. No entry in `RootStackParamList`, no route to remember when Phase 3's engine deletes the whole thing.

Outcome dispatch is `navigation.replace('MatchResult', { modeId, outcome })` — `replace` so the back gesture cannot land back inside Match mid-result.

### Idempotent reward grant on MatchResult

`MatchResultScreen` mounts → `useEffect` checks a `useRef(false)` guard → if not yet granted, calls `grantTokens(reward)` and flips the ref. A re-render (font load tick, ambient theme update, future Suspense boundary) cannot double-pay. Phase 2 will move this side effect into `checkEndConditions` on the engine itself; the screen will then read the granted amount as a presentational fact.

Reward policy comes straight from SPEC §6 + §7.2: victory `+rewardWin / +30 XP`, draw `+rewardDraw / +15 XP`, stalemate `+stake refunded / +0 XP`, defeat `+0 / +5 XP`. The OutcomeViewModel record in `MatchResultScreen.tsx` is the single source of truth for tint, copy, reward, and XP per outcome.

### `chargeTokens` is the deduction primitive

`grantTokens(amount: number)` is positive-only by name; deductions use `chargeTokens(amount: number)` which clamps the balance at zero (`Math.max(0, tokens - amount)`) and ignores zero/negative input. Used by forfeit (Match header X) and, in later phases, match-start stake collection.

The clamp is defensive: Phase 7B's real economy will assert affordability *before* the call, but the mock has no such gate, and a negative balance would cascade into broken UI everywhere.

### Mode 7 single-column timeline

`Mode7Row` ignores its incoming `side` prop and forces `side='left'`. The whole Mirror UI is a solo race; the opponent's progress is surfaced via the SoloRaceBanner header chip, not as right-side timeline rows. This keeps `guessRowRenderers` honest — the registry is still keyed by mode id and accepts the same `GuessRowProps` shape — without leaking the "is this mode parallel?" question into every row component.

### Snapshot stability with `react-native-screens`

Native-stack stamps every screen with a non-deterministic `screenId` prop. `src/test-utils/renderWithNavigation.tsx` exports `stableTreeForSnapshot(tree)` which walks the rendered tree and strips that prop before snapshotting. Fixed safe-area insets (`{ top: 44, bottom: 34 }`) come from a shared `SafeAreaProvider` initialMetrics so layout-derived numbers stay byte-identical across runs.

This is why every screen-level snapshot in `src/screens/__tests__/*.test.tsx` is gated through `stableTreeForSnapshot(toJSON())`. Component-level snapshots that don't go through a navigator (e.g. `DigitTile.test.tsx`) call `toJSON()` directly — there's no `screenId` prop to mask.

### Test infra: `RouteStubScreen` lives under `src/test-utils/`

The Checkpoint-2 stub is now a test-only utility. Production never imports it; `src/screens/` contains only real screens. Tests still need it to fill auxiliary routes (so an `InsufficientTokens → AdWatch` test can register both routes without mounting the full AdWatch implementation when the focus is the modal). Moving it to `src/test-utils/` keeps `src/screens/` a clean inventory of shipping screens.

### Mock secret per mode

`src/data/mockSecrets.ts` ships `mockSecretByMode: Record<number, string>` with a 4-digit secret per mode. Mode 3 (Precision) and Mode 5 (Blackout) carry unique-digit secrets so the reveal animation never paints repeats — `mockSecrets.test.ts` enforces this even though the catalog still ships `digitsUnique: false` for those modes (Phase 4 flips the catalog flag when the engine lands).

Phase 2's engine generates a fresh secret per match and delivers it on the route params; the consumer change in MatchResultScreen is one `secretFor(modeId)` swap for `route.params.secret`.

### MatchResult sub-component naming

`MatchResultScreen.tsx` declares `RewardChip` and `StatCard` as private function components in the same file (no `src/components/` extraction). They have one call site each, no overlap with other screens, and live alongside the `OutcomeViewModel` they're paired with. Premature extraction to the primitives barrel would create an interface to maintain for a single consumer.

The `OutcomeViewModel` map (`OUTCOMES: Record<MatchResultOutcome, OutcomeViewModel>`) is the result-screen analog of `modeCatalog`: data, not behaviour. Adding a fifth outcome (e.g. "abandoned" in Phase 7B) is one entry plus the route-param union update.

### `mockUser.hasOnboarded` drives the initial route

`RootNavigator` reads `mockUser.hasOnboarded` once at construction time; `Onboarding` if false, `Home` if true. The onboarding screen calls `markOnboarded()` + `navigation.reset({ index: 0, routes: [{ name: 'Home' }] })` on Skip / Start Playing so the back gesture cannot re-enter the carousel.

Phase 2 replaces the read with a Zustand selector that hydrates from AsyncStorage. The reset-on-completion pattern is the same.

---

## Upcoming sections

The following decisions are specified in `specs/CipherBreaker-ROADMAP-v4.md` and will be filled in as each phase lands.

### Plugin mode system

_(Phase 2–3)_ Three-layer split: pure-domain mode files → shared helpers → per-mode row components, wired through `modeRegistry` and a `renderers` map keyed by `modeId`. `ModeDefinition` carries `meta`, `rules`, `generateSecret`, `validateGuess`, `evaluate`, and a `bot` subtree. Adding a new mode is three files plus a registry call.

### Durable vs transient state

_(Phase 2)_ `matchStore` (persisted to AsyncStorage, mutated only on guess/timeout/phase changes) vs `liveMatchStore` (in-memory only, updated every 100ms for the Blitz clock). Design goal: never write to AsyncStorage at clock-tick frequency.

### RNG state serialization

_(Phase 2)_ `createRNG` accepts either a seed or a `{seed, callCount}` snapshot. Every bot move persists `rng.getState()` so hydration on app resume continues the exact deterministic sequence — and replay/snapshot tests are trivial.

### Chunked filtering pattern

_(Phase 2, exercised in Phase 4 for Mode 3)_ `filterByFeedbackChunked` breaks candidate-pool filtering into ~500-item chunks separated by `await yieldToUI()` (a `setTimeout(0)` wrapper). Bot `makeGuess` and engine `submitGuess` are `async` throughout so pools of 5040 permutations never block the JS thread.

### `checkEndConditions` helper

_(Phase 2)_ Single source of truth for match end: returns a `MatchResult | null` after evaluating crack, simultaneous-crack, timeout, guess-limit, and stalemate in a fixed order. Invoked from both `submitGuess` and `applyTimeout` — win/draw/loss logic lives in exactly one place.

### Error strategy

_(Phase 2)_ User errors (invalid guess input, non-unique digits in Mode 3/5) return a structured `ValidationResult` and propagate through the engine as `{ state, feedback: null, error }`. Architectural errors (unknown mode id, corrupt match state, solver/rules mismatch) `throw` a typed `Error` subclass. Rule of thumb: user-facing errors never throw.

### Engine separation

_(Phase 2 scaffolded, Phase 3/4/5 populate turn-based, Phase 6 populates parallel)_ `turnBasedEngine` covers modes 1–6; `parallelEngine` covers Mode 7 (Mirror). A `selectEngine(mode)` router switches on `rules.flags.parallelMode`. Engines are event-driven only — time-based behaviour (clock tick, timeout) is owned by `liveMatchStore` and the `MatchScreen` effect, which call back into the engine via `applyTimeout`.
