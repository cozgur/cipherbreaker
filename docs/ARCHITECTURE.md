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

## Phase 2 decisions

Phase 2 ships the engine skeleton, the four state stores, and the test infra that holds them together. **No mode is implemented in this phase** — Phase 3 lands Mode 1 against this scaffolding. The 1B `mockUser` mock is preserved as a facade routing to Zustand under the hood, so all 1B screens and tests keep working unchanged.

### Plug-in mode system — three layers

Modes live in three files apiece, with strict directional dependencies:

```
src/game/modes/mode{N}{Name}.ts        ← pure domain, NO React import
src/components/game/rows/Mode{N}Row.tsx ← UI feedback rendering
src/game/renderers.ts                   ← modeId → row component registry
```

Every `ModeDefinition` is registered with `modeRegistry.register(mode)` at module load. The registry's `get(id)` throws `ModeNotFoundError` so a missing registration surfaces at the call site, not deep in an undefined-property dereference. `getOrNull(id)` is the non-throwing variant for fallback paths.

Adding a mode is mechanical (see "Adding a new mode" below): one domain file, one row component, one registry call, one renderers entry, one catalog entry. A switch statement nowhere.

### Domain vs Presentation invariant

`src/game/**` *never* imports React. The engine layer is pure TS so it runs identically in Jest, on a server (future replay/leaderboard tooling), and in the device runtime. The boundary is enforced by convention today; a CI grep can be added once Phase 3 introduces the first mode file:

```sh
grep -r "from 'react'" src/game/   # must be empty
```

The reverse is not symmetric — `src/components/game/rows/*` does import React, but never imports from `src/game/modes/*`. Rows take `GuessRowProps` and render; the mode file is what produced those props.

### Hata stratejisi — net çizgi

Two distinct failure modes, two distinct mechanisms:

| Origin | Mechanism | Example |
|---|---|---|
| User input | `ValidationResult` discriminated union → `{ ok: false, error }` | `validateGuess('12a4')` fails with `code: 'NOT_DIGITS'` |
| Engine submit return | `{ state, feedback: null, error }` | `submitGuess` propagates the validation error in-band |
| Architectural | `throw` a typed `Error` subclass | `modeRegistry.get(99) → ModeNotFoundError` |
| State corruption | `throw InvalidEngineStateError` | `applyTimeout` called when no end condition is satisfied |
| Solver mismatch | `throw SolverStateMismatchError` | Mode hands back a `mirror` solver to a non-Mirror engine |

**Rule of thumb:** user-facing errors never throw. A throw is the dev's signal that *this code path should not have executed in a healthy build*.

`ValidationResult` lives in `src/game/types.ts`; the three error classes in `src/game/errors.ts`. Each carries a stable `code` field for analytics and an optional `cause` so wrapping a lower-level throw preserves the chain.

### Adding a new mode — five steps

1. **Mode file** — `src/game/modes/mode{N}{Name}.ts` exporting a single `ModeDefinition`. **No React import.** Implements `generateSecret`, `validateGuess`, `evaluate`, and the `bot` subtree (`initSolverState`, `makeGuess`, `thinkingTime`).
2. **Row component** — `src/components/game/rows/Mode{N}Row.tsx`, consumes `GuessRowProps`, switches on `feedback.kind` for the mode-specific painting.
3. **Registry call** — `modeRegistry.register(mode{N}{Name})` at import time (typically from a barrel that the app entry imports during boot).
4. **Renderers map** — entry in `src/game/renderers.ts` keying the new `modeId` to the row component. `renderers.test.ts` cross-checks this against the catalog.
5. **Catalog entry** — append to `src/data/modeCatalog.ts`. The numeric `id` lives **only** at the entry root; never inside `meta` or `rules`. `modeCatalog.test.ts` enforces uniqueness + the closed `iconKey` set.

### Engine vs orchestration

Engines are **event-driven only**. There is intentionally no `tick(state, deltaMs)` method. Wall-clock orchestration — Mode 4 Blitz countdown — is owned by:

- `liveMatchStore.tickClock(deltaMs)` — TRANSIENT in-memory decrement at ~10Hz
- `MatchScreen` `useEffect` setInterval — drives the tick + checks the live clock for zero
- On zero: the screen calls `matchStore.applyTimeout(snapshot)`, which updates the durable snapshot and routes through `engine.applyTimeout` → `checkEndConditions`

Engines see structural events (`createMatch`, `startMatch`, `submitGuess`, `applyTimeout`, `applyClockSnapshot`) and nothing else. This makes them trivially replayable and unit-testable without timers.

### SolverState pattern

`SolverState` is a discriminated union over the three shapes a bot needs to carry between turns:

```ts
type SolverState =
  | { kind: 'candidatePool'; pool: readonly string[] }            // Modes 1, 2, 4, 6, 7
  | { kind: 'blackoutConstraints'; pool; constraints }            // Mode 5
  | { kind: 'mirror'; pool; targetTurn: number }                  // Mode 7 race tracking
```

Solver pool members are 4-character digit strings (`'1234'`) — half the memory of `number[]`, identity-comparable, easy to dedupe. Conversion to/from `number[]` happens at the engine's `parseDigits` boundary.

`SolverStates` is a `{ player?, opponent? }` envelope — both optional so only the bot side carries one today, but the player slot is reserved for hint mode (Phase 7B) and AI-vs-AI replay (post-launch). Solver state is part of `MatchState` and persists with it.

If a mode hands back a solver whose `kind` doesn't match what the engine expects, the engine throws `SolverStateMismatchError` with `expected` and `actual` filled.

### Durable vs transient state

Two stores, two different write frequencies:

| Store | Persisted | Update cadence | What lives here |
|---|---|---|---|
| `useUserStore` | AsyncStorage (`cipherbreaker.user.v1`) | Match results, Shop, Ad reward | tokens, username, level, XP, stats |
| `useSettingsStore` | AsyncStorage (`cipherbreaker.settings.v1`) | Settings toggles | sound, haptics, hasSeenBlitzTip |
| `useMatchStore` | AsyncStorage (`cipherbreaker.match.v1`) | Per guess + timeout + phase change | `MatchState | null` |
| `useLiveMatchStore` | **NOT persisted** | ~10Hz clock tick | `LiveClockState | null` |

**AsyncStorage frequency rule:** never write at tick frequency. A 10Hz persist would burn IO and drop frames; the live clock therefore lives in `liveMatchStore` (transient) and the durable snapshot is captured to `matchStore.matchState.clockSnapshot` only on structural events.

`useLiveMatchStore` is asserted not to expose a `persist` field by `liveMatchStore.test.ts` — a future change that wraps it in `persist(...)` fails CI loudly.

`createMatch` on `useMatchStore` is **no-op-guarded**: a second call while a match is already in flight returns `false` and does nothing. Prevents navigation re-entries from clobbering an in-progress match.

### RNG state serialization

`src/lib/random.ts` exposes `createRNG(stateOrSeed: RNGState | number): RNG`. The algorithm is mulberry32 over a uint32 state; every `next()` increments a `callCount`, and `getState()` returns the `{seed, callCount}` cursor.

The resume contract:

```ts
createRNG(42).next() x 5       // produces sequence S
createRNG({ seed: 42, callCount: 5 }).next()   // continues from S[5]
```

`turnBasedEngine.submitGuess` writes `state.rngState = rng.getState()` after every consuming step, so a hydrated `MatchState` produces bit-identical bot moves. Replay tests, post-mortem debugging, and resume-after-suspend all use the same primitive.

`int`, `pick`, `shuffle`, `weightedPick` all funnel through `next()` so call-count bookkeeping covers every consumer. Empty arrays / non-positive weights / inverted ranges throw `RangeError`.

### Heavy filtering — chunking pattern

`src/game/shared/asyncHelpers.ts` ships a one-line `yieldToUI()` that resolves on the next macrotask (`setTimeout(0)`, deliberately not `queueMicrotask` — microtasks run before render flushes).

`filterByFeedbackChunked(pool, evaluator, chunkSize=500)` slices a pool into `FILTER_CHUNK_SIZE` batches and `await`s `yieldToUI()` between them. Mode 3 (5040 permutations) and Mode 5 (constraint sweep) are the targeted consumers; Modes 1, 2, 4, 6, 7 with a < 1000 narrowed pool can use the synchronous `filterByFeedback` instead.

`bot.makeGuess` therefore returns `Promise<{ guess, newSolverState }>` and `engine.submitGuess` is async throughout — so the heavy modes don't force a wider interface refactor when their day arrives.

### `checkEndConditions` — single source of truth

`src/game/engines/checkEndConditions.ts` is *the* function that converts in-flight match state to a terminal `MatchResult`. Every engine path that could end a match — `submitGuess` after evaluate, `applyTimeout` after a clock-zero — funnels through it. Order of checks is fixed:

1. Both sides cracked this turn → `draw / simultaneous_crack`
2. Player cracked → `player_won / cracked`
3. Opponent cracked → `opponent_won / cracked`
4. Mode 4 — `clockSnapshot.playerMs <= 0` → `opponent_won / player_time_out`
5. Mode 4 — `clockSnapshot.opponentMs <= 0` → `player_won / opponent_time_out`
6. Mode 6 — both exhausted → `stalemate / both_exhausted`
7. Mode 6 — one side exhausted → other side wins by `_guess_limit`
8. Otherwise → `null` (match continues)

The helper is **pure** — no clocks, no stores, no side effects. The caller passes the prospective state, the helper says yes/no.

**Engine invariant** (asserted by the CP3 invariant test): `phase === 'completed'` ⇔ `result !== null` ⇔ the `feedback.isWin` chain led to an `outcome`. The engine NEVER returns `isWin === true` while `phase` stays `'active_*'` — `submitGuess` always promotes the state to `'completed'` in the same call.

### Phase model

```
setup → active_turn_player ↔ active_turn_opponent → completed
        active_parallel ────────────────────────→ completed
```

`MatchState.phase` and `MatchState.result` carry a strict invariant: `phase === 'completed'` iff `result !== null`. `submitGuess` and `applyTimeout` are the only transitions to `'completed'`. `startMatch` is the only transition out of `'setup'`. Calling `startMatch` on a non-setup state throws `InvalidEngineStateError`; calling `submitGuess` on `'setup'` or `'completed'` throws the same.

### parallelEngine — soft-fail strategy

Mode 7 (Mirror) ships in Phase 6. Until then `src/game/engines/parallelEngine.ts` is a soft-fail stub: every operation returns a sensible no-op result and emits a single `console.warn('parallelEngine: Faz 6 implementation pending — call ignored')`.

**No throws.** The reasoning: "feature not implemented yet" is not a programmer error — it's a known gap. Throwing would force every screen-level navigation flow to wrap calls in try/catch defensively. A warn lets dev tooling surface the call without breaking the screen, and the test (`parallelEngine.test.ts`) asserts both the no-throw contract (`expect(...).not.toThrow`) and the warn signal (`jest.spyOn(console, 'warn')`).

`selectEngine(mode)` routes on `mode.rules.flags.parallelRace === true` — that's the canonical flag name (matches the existing 1B catalog and `modeRouter.ts`). The ROADMAP mentions `parallelMode` informally; renaming would cascade through the catalog and router for no behavioural gain.

### isWin contract

`NormalizedFeedback.isWin?: boolean` is **optional** at the type level, but **required when produced by `engine.evaluate`**. Phase 1B mock fixtures and the `mockSecrets`/`mockMatchHistory` data continue to ship without it — they never represent a winning state. Helpers (`isWinningFeedback`, `checkEndConditions`) read defensively with `?? false` so undefined never crashes a check.

The CP3 invariant test pins this contract at the engine boundary: a stub mode whose `evaluate` always returns `isWin: true` must produce `phase: 'completed'` with `result.outcome` set on the same `submitGuess` call. The engine cannot leak `isWin: true` into an active phase.

### Mock facade pattern (Phase 1B → Phase 2 bridge)

`src/data/mockUser.ts` is now a façade. The exported `mockUser` object uses `Object.defineProperty` getter/setter chains; reads pull from `useUserStore.getState()` / `useSettingsStore.getState()`, writes call `setState({...})`. The `settings` field is itself a sub-facade with three nested getter/setter pairs. `enumerable: true` on every property preserves `JSON.stringify` and `console.log` behaviour so debug surfaces look unchanged.

Why a façade rather than a rip-and-replace: Phase 1B ships 11 test files and 8 production components that read `mockUser.X` or write `mockUser.X = Y`. Migrating them all in one PR would have meant 60+ files of diff for zero behaviour change. The façade lets each consumer migrate to direct store usage on its own schedule.

`useMockUser()` subscribes to *both* stores via the Zustand hook so a settings toggle still triggers a re-render in components that key off `mockUser`. It's `useMemo`-stabilised so the returned reference is stable across re-renders that don't change either slice.

**Phase 7 deprecation plan**: replace `useMockUser()` consumers with direct `useUserStore` / `useSettingsStore` selectors as each screen gets polish, and delete the façade once the import count hits zero.

### Test infra — AsyncStorage mock + global hydration hygiene

Two pieces:

1. **AsyncStorage mock** (in `jest.setup.js`). v3 ships `./jest` exports but the path isn't reachable through `jest-expo`'s resolver matrix; we ship an inline 30-line in-memory shim covering the surface the persist middleware exercises (get/set/remove/clear + multi variants).

2. **Global `beforeEach`** (`setupFilesAfterEnv` — not `setupFiles`, since `beforeEach` needs the test framework to be installed first). Each test starts with `AsyncStorage.clear()`, then `await store.persist.clearStorage()` for each persisted store, then `setState({...DEFAULTS})`, then `await waitForHydration(store)` for each persisted store. The hydration wait uses `store.persist.onFinishHydration` — Zustand's persist middleware hydrates asynchronously, so a fast post-clear read can race the hydrate callback otherwise. The helper lives in `src/test-utils/zustandHydration.ts` (deliberately outside `__tests__/` so jest doesn't try to run it as a suite).

### Future Work — RNG forward compatibility

The current `RNGState = { seed, callCount }` is sufficient for in-version resume but breaks if engine call counts shift across versions (a refactor that adds an extra `rng.int(...)` somewhere upstream changes every downstream draw). If deterministic replay across versions becomes a feature (post-v0.2), two paths:

- **Per-operation sub-seeds** — `deriveSubRng(parent, namespace)` derives child generators per operation (`'opponentSecret'`, `'startMatch'`, `'bot.move.3'`). Each named operation has its own cursor, so adding a draw upstream doesn't invalidate downstream sequences.
- **Schema versions on saved match states** — bump a `replayVersion` field on `MatchState` and refuse to replay across versions. Simpler but loses cross-version replay value.

Defer the decision until a replay use case exists. The current mulberry32 + flat callCount is the right default for resume.

---

## Phase 3 decisions

Phase 3 lands the first real mode (Color Match) end-to-end against the Phase 2 scaffolding and produces the canonical template every Phase 4-5 mode copies. CP1 was the pure-domain core (evaluator + bot + secret generation, no React), CP2 was the bot strategy and difficulty bands, CP3 wired the engine through `useMatchStore` and added the `runOpponentTurn` orchestration, CP4 cut MatchScreen + MatchResultScreen over from the mock path to the engine path and fixed three production-wiring bugs surfaced by the device walkthrough.

### Mode 1 as reference template

`src/game/modes/mode1ColorMatch.ts` is intentionally a thin façade — under 60 lines — and every helper lives in `src/game/modes/mode1/`. The split is load-bearing for Phase 4-5: `evaluate.ts` and `bot.ts` are individually grep-able units of strategy, and the parent file's only job is to wire `meta` + `rules` from the catalog into a `ModeDefinition` shape. Mode 6 (Sudden Death) and Mode 4 (Blitz) reuse `evaluateColorMatch` directly via re-export from their own folders; without the file split, that re-use would mean importing a façade and discarding everything but one symbol.

Catalog is the single source of truth for `meta` + `rules` — `mode1ColorMatch.ts` reads the catalog entry at module load and explodes (via `ModeNotFoundError`) if it's missing. Hardcoding `meta`/`rules` in the mode file would create two places to keep in sync whenever a `stake` or `rewardWin` changes, so the mode file deliberately holds zero presentation data.

The `mode1` sub-folder respects the same domain-purity rule as the parent: `mode1/bot.ts` and `mode1/evaluate.ts` import nothing from React. `mode1ColorMatch.test.ts` enforces this with a filesystem grep across all four files.

### Adding a new mode — concrete checklist

The Phase 2 five-step recipe is generic; Phase 3's Mode 1 makes it concrete. For Phase 4-5:

1. **Mode façade** — `src/game/modes/mode{N}{Name}.ts`. Copy `mode1ColorMatch.ts`. Read catalog via `findMode(N)`, throw on absence. Pick the validators that fit (`validateLength`, `validateDigitsOnly`, `validateUniqueDigits` for unique-digit modes). Assemble the `ModeDefinition` literal. **Keep it under ~60 lines.**
2. **Strategy folder** — `src/game/modes/mode{N}/{evaluate,bot}.ts`. `evaluate.ts` is pure `(guess, secret) => NormalizedFeedback`. `bot.ts` exports `makeGuess` (async, returns `{ guess, newSolverState }`) and `thinkingTime` (sync, `Math.random` only). Re-import the evaluator inside `bot.ts` so the bot can verify candidate consistency without a circular dep on the façade.
3. **Row component** — `src/components/game/rows/Mode{N}Row.tsx`. Switch on `feedback.kind`; render via `GuessRowShell`.
4. **Registry + renderers** — append `import + register` to `src/game/modes/index.ts`; add the row entry to `src/game/renderers.ts`. `renderers.test.ts` cross-checks against the catalog and fails CI on a missing pair.
5. **Domain-purity test** — extend the file list in `mode{N}{Name}.test.ts`'s "imports no React" `it.each` block to cover the new files.

Once these five touchpoints land, the existing `MatchScreen` engine path lights up automatically — there is no per-mode UI fork to add (the conditional cutover gate is mode-id-agnostic).

### Wordle two-pass evaluator + duplicate handling

`evaluateColorMatch` (SPEC §3.2) runs in two strict passes against a `used[]` ledger. Pass 1 paints exact-position matches green and marks the secret slot consumed. Pass 2 paints unmatched guess positions yellow if their digit appears in any *unconsumed* secret slot. The ledger is what makes the duplicate cases — `'1919'` vs `'1122'` → 🟢⚫🟡⚫ — produce SPEC-correct feedback: a single-pass evaluator that just searches the secret would paint position 0 green AND position 2 yellow off the same secret slot, double-counting the `'1'`.

A one-pass implementation that just searches the secret per guess position would fail the multi-duplicate cases — `'5455'` vs `'5544'` would paint position 3 yellow off the same `'5'` already claimed at position 0. The two-pass approach with the `used[]` ledger is canonical Wordle; the test table in `mode1ColorMatch.test.ts` pins ten duplicate edge cases. Every Phase 4-5 mode that surfaces colour feedback (Mode 4 Blitz, Mode 6 Sudden Death, Mode 7 Mirror) re-uses this evaluator unchanged.

### Bot solver pool — synchronous below 1000

`mode1/bot.ts` defines `HEAVY_FILTER_THRESHOLD = 1000`. Pools at or above the threshold go through `filterByFeedbackChunked` (yields between 500-element batches); pools below go through `filterByFeedback` (sync). Mode 1 hits the threshold exactly once per match — the 10 000-strong opening pool — and drops to the low hundreds after the first feedback round, so subsequent turns pay the sync path's lower per-call overhead.

The threshold is per-mode by design (lives in `mode1/bot.ts`, not in `@game/constants`) — Mode 3's 5040 unique-digit pool hits the chunked path *every* turn and Mode 5's blackout-constraint sweep is heavier still. Hardcoding 1000 globally would either over-yield Mode 1 (4 frame drops per match for no perceptible benefit) or under-yield Mode 3 (visible jank on the device).

### `BotContext.rng` — single-instance threading

`matchStore.runOpponentTurn` constructs **one** RNG via `createRNG(current.rngState)` and threads it into both `mode.bot.makeGuess(ctx)` (where `ctx.rng` is the same instance) and `engine.submitGuess(stateWithSolver, guess, 'opponent', rng)`. The persisted `rngState` after the action reflects every draw the bot made.

Splitting these into two `createRNG(current.rngState)` calls — one for the bot, one for the engine — would reset the cursor to the pre-bot snapshot on the second call. On the next turn the bot would re-draw the same numbers, and the resume contract (deserialise the persisted state ⇒ produce the same continuation) would silently break. Two RNG instances ⇒ two independent cursors ⇒ broken resume identity. The single-instance threading is therefore the resume contract; `BotContext.rng` carries a doc-comment naming this and the resume-identity test in `matchStore.test.ts` pins it at the seam.

`bot.thinkingTime` deliberately does *not* receive the threaded RNG — it's a UI delay, not a domain quantity. See below.

### `thinkingTime` — `Math.random` asymmetry

`mode.bot.thinkingTime(ctx)` is the only `Math.random` consumer in the whole game layer. Every other RNG draw goes through the seeded `BotContext.rng`. The asymmetry is intentional: think time is a cosmetic UI delay (2–12s, SPEC §4.4 phone-down outlier band), and a resume after suspend should not re-roll the durable RNG cursor just to re-derive how long the bot pretends to think. Using the threaded RNG would mean the cursor advances on every `thinkingTime` call, polluting the bot's actual move sequence.

The price is that thinking-time tests can't pin a specific value without `jest.spyOn(Math, 'random')` — the test in `mode1ColorMatch.test.ts` settles for "stays inside the 2–12s band over 200 samples" instead. Worth it: a single `Math.random` import keeps `thinkingTime` a one-line rule the next mode can copy verbatim.

### `MatchState.botDifficulty` + `firstAuthor` — durable, defaulted, optional

Two new optional fields on `MatchState`. Both are durable (persist with the rest of the snapshot) so resume produces the same bot behaviour and timeline ordering. Both are optional so the persist version doesn't have to bump for hydrated Phase 2 states.

- **`botDifficulty`** — frozen at `startMatch` (Phase 3 hardcodes `'normal'`; Phase 7A wires SPEC §5.5 dynamic-difficulty adjustment from `userStore.stats`). The field exists today so the wiring change is one line in `startMatch` and zero everywhere else. `runOpponentTurn` falls back to `'normal'` for `undefined`, so a hydrated pre-Phase-3 state still works.
- **`firstAuthor`** — set by the same RNG roll in `startMatch` that picks the initial phase. The MatchScreen UI consumes this through `interleaveTimeline(state)` to round-robin `playerGuesses` + `opponentGuesses` into chronological order. Without it, the UI would have to assume "player always goes first" and Mode 4 (Blitz, where the opponent often cracks first) would render the timeline backwards.

Both fields use the `state.X ?? default` idiom in their consumers — adding a third optional field in a future phase (e.g. `replayVersion`) follows the same pattern with no migration overhead.

### `matchStore.runOpponentTurn` — orchestration site

`runOpponentTurn` is where the bot ↔ engine ↔ persist contract lives. The action:

1. Reads `current` and no-ops if `phase !== 'active_turn_opponent'` (idempotent — the screen's `useEffect` cleanup may fire it twice on rapid re-renders).
2. Constructs the **single** RNG instance + the `BotContext` (with the bot's previous guesses, frozen difficulty, and the carry-forward solver state).
3. Awaits `mode.bot.makeGuess(ctx)` to get the guess + the post-filter solver pool.
4. Writes `newSolverState` onto a snapshot before calling `engine.submitGuess` — `submitGuess` ignores `solverStates` (it's a passthrough field) but the engine's output state preserves it, so the next turn picks up the already-narrowed pool.
5. Calls `engine.submitGuess(stateWithSolver, guess, 'opponent', rng)` with the same RNG instance.
6. `set({ matchState: out.state })` — the persist middleware writes this synchronously to AsyncStorage.

The screen's bot-turn `useEffect` is a thin wrapper around this: pick a `thinkingTime`, fire `setShowTyping(true)` at 40% of the delay, fire `runOpponentTurn` at 100%. The screen never reads or constructs an RNG — that responsibility is fully owned by the store action.

### MatchScreen — conditional engine cutover gate

The screen runs in two modes, gated by:

```ts
const isEngineMode =
  modeRegistry.getOrNull(modeId) !== null && matchState?.modeId === modeId;
```

Both halves of the `&&` matter. The first guards against Modes 2-7 (still on the mock `DevResultPicker` path until Phase 4-5-6). The second catches the navigation re-entry where `SecretSetup` hasn't yet seeded the store for an unregistered mode — without it, an unregistered mode that was registered later in the session would briefly try to run the engine path against a stale `matchState` from a previous match.

Forking into `MatchScreenEngine.tsx` and `MatchScreenMock.tsx` was considered and rejected: the two paths share ~90% of the rendering (header, player cards, timeline, draft tiles, keypad). A fork would mean every Phase 4-5 visual tweak lands twice, and the mock fork is supposed to *shrink* as more modes register. The conditional shrinks toward zero on the same timeline.

The bot-turn effect, the completion-watcher effect, and the `submitGuess` callback are all early-returned on `!isEngineMode` so the mock path pays zero overhead. The dev-picker overlay is `__DEV__`-gated and only allocated when `pickerOpen=true`, so production builds with the engine path active never even ship the picker code.

### CP4 — three production-wiring fixes

The CP3 engine path passed every unit and integration test but failed the device walkthrough on three counts. Each fix is recorded so Phase 4-5 modes don't re-encounter them:

1. **`MatchResult` route params carry the engine summary, not catalog defaults.** CP3 left `MatchResult` reading `mockSecretByMode[modeId]` for the secret reveal and a hardcoded `turns = 6` for the headline copy. CP4 widened the route param shape with optional `secret`, `guessCount`, `reward`, `xpGain` fields and the engine completion-watcher fills them from `matchState.opponentSecret` / `matchState.result.turns` / `rewardForOutcome(result, mode)`. Mock path omits the fields and the screen falls back to catalog defaults — same Phase 1B behaviour. The optionality matters: a non-optional shape would mean every mock-path call site has to backfill, and the dev-picker is supposed to be deletable wholesale once Phase 4-5-6 lands.
2. **`recordMatchResult` only fires on the engine path.** `MatchResultScreen`'s grant `useEffect` was extended to also call `userStore.recordMatchResult({ modeId, outcome, turns })` and `addXp(xpGain)` — but only when `route.params.guessCount !== undefined` (the engine-path discriminator). Without the gate, every dev-picker open in development inflates `gamesPlayed` and corrupts `winRate`. The same `grantedRef` guards all three writes (tokens, stats, XP) so a re-mount under React Strict Mode never double-pays or double-bumps.
3. **Auto-scroll to the latest timeline row.** The engine path appends rows faster than the player can scroll; without auto-scroll, the freshest feedback sits below the fold. A `ScrollView` `ref` + a `useEffect` keyed on `playerGuesses.length + opponentGuesses.length` calls `scrollToEnd({ animated: true })` after a 100ms layout grace period. Mock-mode timeline is static so the effect runs once at mount with no visible change. The 100ms grace period exists because firing the scroll synchronously inside the effect can race the row's first layout pass — `scrollToEnd` then measures a stale content size and lands one row short.

These three are wiring fixes, not architectural changes — but they're the kind of mistake that's mechanical to repeat in Phase 4-5 if the lesson isn't recorded.

---

## Phase 4 decisions

Phase 4 lands Mode 2 (High & Low) and Mode 3 (Precision) end-to-end against the Phase 3 scaffolding. Both modes copied `mode1ColorMatch.ts` as the template — façade ≤ 60 lines, helpers in `mode{N}/{evaluate,bot}.ts`, registered in `src/game/modes/index.ts`. The five-step recipe survived the second and third execution unchanged; the only Phase 4-specific entry below the `Adding a new mode` section is "audit existing tests for Phase-1B-era language".

CP1 was Mode 2, CP2 was Mode 3, CP3 was the iOS walkthrough that surfaced three production bugs (round/guess number mismatch, Turkish validation message leak, MatchResult tile colours), CP4 was this doc + the closing commit.

### Mode 2 — `directionRange` solver state

Mode 2's bot keeps a binary-search interval `{ low: number; high: number }` instead of a candidate-string pool. The interval collapses by one bound per feedback round, so the post-hydrate working set is two integers — orders of magnitude smaller than the 10 000-entry `candidatePool` it would otherwise need. The new `SolverState` variant lives next to the existing three:

```ts
| { kind: 'directionRange'; low: number; high: number }
```

Adding a fourth `kind` cost zero updates elsewhere in the codebase: there is no exhaustive switch on `SolverState.kind` in production code (each mode's `bot.makeGuess` narrows on its own expected kind and throws on mismatch). That property is what lets the engine-shared types absorb mode-specific solver shapes without forcing a registry refactor every time. The same property will make Mode 5's `blackoutConstraints` extension and any future shape additions cheap.

The bot's `pickInRange` mirrors Mode 1's "hard never consumes from `rng`" invariant — hard returns the midpoint deterministically, normal samples uniformly via `rng.int(low, high)`, easy biases toward the outer thirds (analogous to Mode 1's "bottom-third on easy"). The "hard makes no rng draws" property is what keeps the `deterministic-on-equal-cursor` test pattern portable from Mode 1 to Mode 2 with no change.

### Mode 2 — turn count is intentional, not a bot tuning bug

Average Mode 2 matches run 6–12 player turns (hard bot) and longer on easy. The 12-guess Mode 2 victory the iOS walkthrough produced is the *intended* tension curve, not a bot-strength regression — SPEC §3.3 explicitly notes "Mod 1 ve Mod 3'e göre daha uzundur, ama mekanik daha analitik/matematiksel". A future "feels too long" complaint should NOT lower the bot's binary-search rigour; the right knob is matchmaking (e.g. shorter sessions for new players via difficulty selection in Phase 7A) or per-mode reward weighting in Phase 7C.

### Mode 3 — chunked filter is mandatory, not optional

Mode 3 opens with the 5040-entry unique-digit pool — well above the 1000-entry `HEAVY_FILTER_THRESHOLD` that ROADMAP §Heavy Filtering pins as the chunked-vs-synchronous boundary. `mode3/bot.ts` therefore ALWAYS uses `filterByFeedbackChunked` for the opening narrow; only after the pool drops below the threshold does the synchronous `filterByFeedback` get a chance to run. A naive port of Mode 1's "≥ threshold → chunked" branching kept that property accidentally; we added an explicit comment so a future "performance optimization" PR that swaps the chunked path for the synchronous one trips a code-review flag.

### `digitsUnique` flip — Mode 3 ships it, Mode 5 still pending

Phase 1B shipped Mode 3 with `digitsUnique: false` in the catalog. The mock secrets (`mockSecretByMode[3]`) already obeyed the *intended* invariant via a manual choice; `mockSecrets.test.ts` enforced this even though the catalog disagreed. Phase 4 flipped the flag to `true` and removed the per-test mutation dance from three suites (`SecretSetupScreen.test.tsx` × 2, `cp2Flows.test.tsx` × 1). Mode 5 stays at `false` until Phase 5; its mock-secret unique-digit invariant remains a test-only assertion until the engine ships.

The lesson: when a Phase 1B mock simulates a future-Phase rule, leave a `// flip this in Phase N` comment on the catalog entry plus a test that locks the *intended* shape. The flip then becomes a one-line change with the test catching any drift in between.

### `thinkingTime` triplication — deferred to Phase 5

`mode2/bot.ts` and `mode3/bot.ts` both copy `mode1/bot.ts`'s `thinkingTime` body verbatim — the same `BOT_THINK_*` band logic, the same `Math.random()` source (deliberately NOT `ctx.rng`, so resume-after-suspend doesn't re-roll the durable cursor for a cosmetic delay), the same 8% phone-down outlier branch. Three copies of identical logic is the inflection point for the standard refactor, but Phase 4 deferred it on purpose:

- Each mode currently *can* tweak its band — `bot.thinkingTime(ctx)` could return mode-specific delay shapes once a mode demands it (Mode 4 Blitz, with its chess clock, almost certainly will).
- Lifting before that demand would force a `ThinkingTimeOptions` parameter on the helper to keep flexibility, which adds API surface for a benefit that's not yet load-bearing.
- Phase 5 will see Modes 4-6 land with their own tuning needs; the shared helper extraction happens *then*, with concrete divergence informing the API shape.

The three copies are tagged with `// Body copied verbatim from Mode 1; Phase 5 promotes …` comments so the refactor moment is grep-able.

### Three CP3 walkthrough fixes

The iOS device test caught three production bugs the unit + integration suite missed. Each is documented here so Phase 5 modes don't re-encounter them.

#### 1. Round number formula — active-side count, not combined timeline

The Phase 3 MatchScreen header read `ROUND ${timeline.length + 1}`, where `timeline = interleaveTimeline(state)` is the chronological merge of both sides' guesses. After a 12-player-guess Mode 2 victory (player=12, opponent=11), the header showed `ROUND 23` while `MatchResultScreen` celebrated "in 12 guesses" — the same number reported through `result.turns`. Two counters, two answers, both visible on the same flow.

The fix is `src/game/adapters/currentGuessNumber.ts` — a single helper that returns the *active* side's current move number:

```
active_turn_player    → playerGuesses.length + 1
active_turn_opponent  → opponentGuesses.length + 1
active_parallel       → playerGuesses.length + 1   (Mode 7 — player POV)
setup / completed     → max(p, o)                  (matches result.turns)
```

Both the header chip and the "Guess #N" sub-counter call this. At the moment of a winning guess the value equals `result.turns`, so the header you saw on the last turn equals the number `MatchResultScreen` reads back.

The intuitive `Math.max(p, o) + 1` formula was considered and rejected. It reads correct on the player_first opening but breaks the walkthrough for both first-author cases:

- **player_first** after P1 (1/0, opponent's turn): `max(1,0)+1 = 2` says ROUND 2, but the round semantic ("P1 → O1 → both done → round complete") says ROUND 1 is still in progress until opponent plays.
- **opponent_first** after O1 (0/1, player's turn): `max(0,1)+1 = 2` again — but ROUND 1 hasn't finished.

`activeSideCount + 1` gives the right answer in every case (player_first, opponent_first, mid-round, completed) AND matches `result.turns` at completion. Tests in `currentGuessNumber.test.ts` cover both first-author flows + completed + mirror parallel.

#### 2. Validation messages — single English source, no per-screen drift

`validation.ts` shipped its `ValidationError.message` strings in Turkish (developer's first-language defaults), but `SecretSetupScreen.tsx` hardcoded the English version inline in JSX. Two surfaces, two languages — the iOS walkthrough caught Mode 3's MatchScreen inline error reading "TÜM BASAMAKLAR FARKLI OLMALI." while the same error in SecretSetup read "ALL DIGITS MUST BE UNIQUE".

Phase 4 collapsed the two onto a single source: `validation.ts` exports `ERROR_NOT_UNIQUE`, `ERROR_NOT_DIGITS`, `ERROR_WRONG_LENGTH(n)` constants in English. `validateUnique` etc. consume them; `SecretSetupScreen` imports `ERROR_NOT_UNIQUE` instead of repeating the literal string. A regression test in `validation.test.ts` asserts the canonical copy and pins the strings to ASCII via regex — a future Turkish leakage trips CI.

The lesson: any UI copy that has both a "data" version (validator output) and a "JSX" version (screen template) is a drift hazard. Centralise the constant the *first* time you reach for the hardcoded string in JSX, not the third. SPEC §UI is English throughout; per-language i18n is post-launch.

#### 3. Secret-reveal tile state is mode-agnostic

`MatchResultScreen` painted the secret reveal with `'green'` tiles on VICTORY and `'gray'` on every other outcome. Fine for Mode 1 (Wordle palette = "all green = won"), misleading for Mode 2/3 where the in-match timeline never paints per-digit colours. A Mode 2 victory showing four green tiles for `'1448'` reads as Wordle feedback the player would have to ignore.

Phase 4 collapsed `OutcomeViewModel.secretTileState: 'green' | 'gray'` into a single `SECRET_TILE_STATE = 'neutral'` constant. Confetti + the gold VICTORY title + the `+100 tokens` chip carry every signal needed; the tile colour was a fourth redundant cue with mode-specific semantic baggage. The same change ripples down identically to DEFEAT/DRAW/STALEMATE — the variant model gets simpler, not more conditional.

A wider rule fell out: any `MatchResultScreen` view-model field that's keyed off `outcome` should encode *outcome-specific* meaning (title text, tint, copy, reward). Anything that wants to encode *mode-specific* meaning belongs in the per-mode row component, not in the result-screen viewmodel.

---

## Phase 5 decisions

Phase 5 lands Mode 4 (Blitz), Mode 5 (Blackout), and Mode 6 (Sudden Death) end-to-end. Mode 1's reference template now has five copies behind it (Modes 1, 2, 3, 4, 6 by direct evaluator/bot reuse + Mode 5 by sibling pattern) — the five-step recipe holds across every mode that landed since Phase 3, and the only mode left for Phase 6 is Mode 7 (Mirror) plus a parallel migration of Mode 6.

iOS walkthrough surfaced **zero UX bugs** at Phase 5 — Phase 3 had three production-wiring fixes, Phase 4 had three iteration findings, Phase 5 shipped clean. The architecture matured: the `ModeDefinition` plug-in shape, the catalog-as-source-of-truth pattern, the engine ↔ liveStore seam, and the AppState lifecycle cleanly separate concerns enough that iteration debt stopped accumulating.

CP1 was Mode 6, CP2 was Mode 5, CP3 was Mode 4 (split into a/b/c — façade, tick orchestration, AppState lifecycle). CP4 is this doc + the closing commit.

### Reference-template reuse — cousins, not copies

`mode6SuddenDeath.ts` (CP1) and `mode4Blitz.ts` (CP3a) both import `evaluateColorMatch` and Mode 1's `bot.{makeGuess, thinkingTime}` directly — no `mode6/` or `mode4/` subfolder. Phase 3's prediction said each mode would get its own subdirectory with re-export shims; Phase 5 disproved that. With three new modes reusing Mode 1's evaluator unchanged, the re-export folder structure became pure overhead — direct imports make the Mode 1 dependency visible in the mode file's import block, no extra wrapper files to maintain.

The structural rule: a mode gets its own subfolder **iff** it has a mode-specific evaluator or bot. Modes 2, 3, and 5 do (each has its own `evaluate.ts` + `bot.ts`); Modes 4 and 6 don't, so they keep the façade-only shape. Mode 5 looks like Mode 3 (unique-digit pool, chunked filter), Mode 4 looks like Mode 6 (Mode 1 reuse) — the two clusters dictate the file layout.

### Mode 6 — engine SPEC §3.10 alignment (bonus fix)

CP1 was the simplest mode (façade + tests, ~30 min) but the integration test for stalemate caught a Phase 2 bug: `checkEndConditions` declared the match over the moment one side hit zero remaining guesses. With strict alternation Player's 5th guess always lands BEFORE Opponent's 5th (1 turn ahead), so the engine was firing `opponent_won/player_guess_limit` after Player's 5th and never reaching `stalemate/both_exhausted`.

SPEC §3.10 explicitly says rounds give each side a full turn before exhaustion ends the match: "Bir taraf gizli sayıyı bulursa **turn tamamlanır** (karşı tarafın da aynı turda tahmin hakkı olur)." The fix collapsed `player_guess_limit` and `opponent_guess_limit` single-side branches in `checkEndConditions` — only `both_exhausted → stalemate` fires for the Mode 6 turn-based path. The single-side `MatchResult.reason` types stay in the union for future modes that might allow asymmetric budgets, but Mode 6 alone never produces them.

### Mode 6 — UX deferral to Phase 6

CP1 shipped Mode 6 turn-based per the initial SPEC §3.10 reading. Device walkthrough revealed sequential play undermines the "sudden death" tension — bot wait time during the 5-guess limit felt slow rather than dramatic. Decision: Phase 5 ships Mode 6 turn-based as-is; Phase 6 migrates it to `parallelEngine` alongside the new Mode 7. The current turn-based codebase persists through Phase 5; Phase 6's parity test will compare turn-based-legacy outcomes against parallel implementation to catch regressions.

### Mode 5 — `candidatePool`, not a custom variant

The user's CP2 sketch suggested a deductive solver shape (`{ kind: 'blackoutConstraints', knownAt, knownNotAt, usedDigits }`). Two reasons the simpler `{ kind: 'candidatePool', pool }` won:

- SPEC §3.7 reveals only the **count** — never which positions or digits matched. `knownAt` and `knownNotAt` could only be filled by inference across multiple guesses, which the simpler filter-by-feedback-consistency approach gets for free without explicitly tracking positional knowledge.
- The 5040-entry unique pool × 4-position constant-time count = 20K comparisons per turn through the chunked filter. No measurable performance pressure to justify the cleverer solver.

A YAGNI win + the pattern stays uniform with Mode 3 (chunked filter mandatory on the opening narrow, both modes hit the `HEAVY_FILTER_THRESHOLD = 1000` invariant from ROADMAP §Heavy Filtering).

### `BlackoutConstraint` — Phase 2 dead stub deleted

`types.ts` shipped `interface BlackoutConstraint = { position; digit }` and a matching `blackoutConstraints` `SolverState` variant in Phase 2 as a forward-thinking guess about the Mode 5 solver. The shape was wrong: SPEC §3.7 reveals neither position nor digit, so the constraint shape was unreachable from feedback alone. CP2 deleted both the interface and the union variant. The lesson: forward-thinking type stubs that anticipate a SPEC reading are speculative; deleting them when the real implementation lands is cheaper than maintaining shapes that never get populated.

### Mode 5 — information leak prevention via opaque `states`

`NormalizedFeedback['blackout']` carries both `states: DigitTileVisualState[]` and `locked: number`. The evaluator (`evaluateBlackout`) always emits `states: ['blackout', 'blackout', 'blackout', 'blackout']` regardless of which positions actually matched — only the `locked` count carries data. This is structural, not stylistic: if the evaluator emitted per-position truth (`['green', 'blackout', ...]`) and `Mode5Row` happened to render the states array, a single per-mode UI tweak could leak SPEC §3.7's hidden info. Bricking the leak at the data source means future row redesigns can't accidentally violate the rule.

The bot still solves the same puzzle the player does — its `narrowPool` filter recomputes `countLocked(lastGuess, candidate)` and matches against the visible count, not the hidden positions. Difficulty bands stay meaningful.

### Mode 5 + 3 — catalog `digitsUnique` flips

Phase 4 flipped Mode 3's `digitsUnique` to `true`; Phase 5 did the same for Mode 5. The pattern: Phase 1B mocks each mode with its intended invariant (mock secrets respect uniqueness for Modes 3+5) but ships the catalog flag with the conservative default. The flag flip lands when the engine ships, removing the SPEC-vs-catalog drift in one line. The three Phase 1B test files that ran a `digitsUnique = true` mutation dance for Mode 3 were simplified in Phase 4; Phase 5 didn't add new mutation dances because Mode 5 had no equivalent test infrastructure leaning on the mocked flag.

### SPEC §3.7 arithmetic typo flagged

The CP2 evaluator test caught a typo in SPEC §3.7's worked example: `secret='3847'`, `guess='3249'` claims "1 LOCKED", but pos 0 (`3`==`3`) **and** pos 2 (`4`==`4`) both match — actual is 2. The engine implements the *rule* correctly (the SPEC text is right; the worked example's count is wrong). The test pins the recomputed value with a comment for the typo so a future reader doesn't assume the test diverges from the SPEC.

### Mode 4 — three-CP split rationale

The user's initial plan lumped Mode 4 into one CP. CP3 split it on advisor input: the four subsystems (façade + bot, engine clock seeding, MatchScreen tick orchestration, AppState lifecycle) are largely independent and each carries its own test surface. Lumping them risked debugging four bugs at once during the iOS walkthrough. The split:

- **CP3a** — `mode4Blitz.ts` façade + Mode 1 reuse + clock-naïve bot (1h)
- **CP3b** — engine `clockSnapshot` seeding + `advanceTurn` activeOwner flip + `submitGuess` `elapsedMs` + matchStore live↔durable seam + MatchScreen tick interval + live clock display (1.5h)
- **CP3c** — `appLifecycle.ts` AppState listener + grace period + `subtractPlayerTime` action (1.5h)

Each landed with its own CI-green checkpoint. The bug count from the iOS walkthrough was zero — the split paid off.

### `checkEndConditions` SPEC §3.6 timeout precedence fix

Phase 2's `checkEndConditions` ordered crack checks before timeout checks. CP3b's audit caught the bug: SPEC §3.6 says "Süresi ilk biten oyuncu OTOMATİK KAYBEDER, gizli sayıyı çözmüş olsa bile" — a timeout on the submitter's side wins over their cracking guess. Fix is the same shape as the Mode 6 fix from CP1 (reorder branches in the same file). One regression test pins the new ordering: a player who submits a winning guess at clock=0 loses by `player_time_out`, not wins by `cracked`.

The two `checkEndConditions` fixes (Mode 6 SPEC §3.10, Mode 4 SPEC §3.6) landed in Phase 5 because the device walkthrough is what revealed them — both are unreachable in unit tests built around isolated end-condition states. Phase 6 modes need the same kind of audit when their device walkthrough lands.

### `captureLiveSnapshot` — the cross-store seam

The Mode 4 clock has two homes: `liveMatchStore.liveClocks` (10Hz tick, transient, no persist) and `MatchState.clockSnapshot` (durable, written only on structural events — guess submission, timeout). The seam between them lives in `matchStore.submitGuess` / `runOpponentTurn` via `captureLiveSnapshot()`: read the live tick value, write it onto the prospective state, hand it to the engine. The engine stays clock-naïve — it only reads from the durable snapshot — and the matchStore is the single place that bridges the two stores.

**The frequency rule held**: the persist middleware never fires at tick frequency because `tickClock` writes only to `liveMatchStore` (which has no `persist`). The durable snapshot picks up the live value at structural events — a guess submission per side, a timeout — which lands at most ~10Hz over the lifetime of a match.

### Tick interval — three-layer cleanup defense

The advisor flagged the `setInterval` cleanup as a footgun: a leaked interval would burn 10×/sec firing `applyTimeout` against a completed match. Three layers prevent the leak:

1. **Phase dependency** — the effect's dependency array carries `isBlitzActive`, which is false on completion. React tears the interval down on the dependency change.
2. **Unmount cleanup** — the returned function calls `clearInterval` on unmount.
3. **In-tick guard** — every tick reads `useMatchStore.getState().matchState` and bails if `phase === 'completed'`. Defense in depth: even if both above layers fail (e.g. async race), the tick itself doesn't fire `applyTimeout` after the match ended.

The unit test (`MatchScreenBlitz.test.tsx`) advances fake timers past completion and asserts the result reference doesn't change — the only way that holds is if every layer is doing its job.

### `appLifecycle.ts` — `'background'` only, not `'inactive'`

iOS fires `active → inactive → background` on real backgrounding, but `active → inactive → active` on Control Center pulls, push notification banners, and accepted-then-dismissed phone calls. The lifecycle handler listens **only** for `'background'` — `'inactive'` is a deliberate no-op. Treating `'inactive'` as backgrounding would start grace timers that get immediately canceled, churning state for nothing and burning the player's clock during transient interruptions.

The `appLifecycle.ts` file header documents this and the iOS-vs-Android difference (Android skips the `'inactive'` intermediate; the same handler covers both because it only acts on `'background'`).

### 5-second grace rationale

`BLITZ_GRACE_PERIOD_MS = 5000` is the tradeoff midpoint between two failure modes:

- **Too short** (≤ 2s): a push notification preview, a misdirected swipe, or a Control Center dismissal all forfeit the match. Retention damage from "I lost because my phone vibrated" is large; the SPEC §3.6 spirit is "süresi ilk biten kaybeder" — not "anyone who blinks loses".
- **Too long** (≥ 30s): the player can read a notification, reply to a chat, then come back without their clock decrementing materially. Cheating-by-backgrounding becomes viable.

5 seconds covers the realistic transient case (read a banner, dismiss, return) without enabling the abuse case (open a notification, reply at length, return). The grace period applies as a **subtraction**, not a free pause: even within the 5s window, the elapsed bg time is decremented from the active owner's clock so the player can't game it for free thinking time.

### `subtractPlayerTime` — owner-aware despite the name

The action takes the literal name from ROADMAP §App Lifecycle but **decrements the active owner's clock**, not always the player's. Bot turn + bg → opponent's clock decrements. SPEC: real-world time keeps moving, the active side's clock keeps draining, regardless of which side that is.

The test pins this explicitly (a `subtracts from the active owner's clock — bot-turn background hits opponent's clock, not player's` case in `appLifecycle.test.ts`). The misleading name is documented in the JSDoc; renaming would fight the ROADMAP for no behavioural gain.

### Multiple bg/fg cycles — independent, no accumulation

Each `'background'` arrival sets `backgroundStartedAt = Date.now()` afresh and schedules a new timer. No "total time spent in background" accumulator. A user who backgrounds for 2s, returns, backgrounds for another 2s, returns — sees their clock decrement by 4s total (2 + 2), not by 6s (penalty for two cycles) or 12s (some squared accumulator). The test pins this with a `multiple bg/fg cycles stay independent` case.

### Forfeit goes through `applyTimeout`, not a new action

Auto-forfeit after grace expiration goes through the existing `matchStore.applyTimeout({ playerMs: 0, opponentMs: <whatever>, activeOwner: 'player', snapshotTimestamp: Date.now() })`. Same engine path, same `checkEndConditions` resolution to `opponent_won/player_time_out`, same telemetry. No new outcome reason. Even if the bot was the active owner when the bg started, the forfeit-by-abandonment is attributed to the player — the player is the one leaving the app.

Adding `applyForfeit` would have multiplied surfaces (route param mapping, MatchResultScreen variant, telemetry stream); funneling through `applyTimeout` keeps the result paths uniform.

### Cold-start resume — Phase 7B

Phase 5 implements only the **in-session** `'background' → 'active'` grace (a backgrounded match the user returns to within 5s). Cold-start resume — the user kills the app, opens it later, sees an unfinished match in `useMatchStore.matchState` — is Phase 7B. ROADMAP §App Lifecycle defers it deliberately: the cold-start case has different UX shape (resume modal, "your match was interrupted" toast) and its own test surface. Phase 5's persist middleware will hydrate `matchState` on cold-start as before; the screens that consume it (HomeScreen, MatchScreen) keep their existing behaviour (Phase 5 doesn't add a resume modal).

### Phase 7A polish — deferrals

Three pieces deferred to Phase 7A:

- **Bot panic mode** — SPEC §3.6 calls for clock-aware `thinkingTime` (bot guesses faster when clock < 10s). Phase 5 keeps Mode 4's `thinkingTime` identical to Mode 1's (default 2-12s band). The test pins the band so a future eager-optimisation PR can't quietly couple bot timing to clock state without a roadmap entry.
- **Onboarding tip** — "Blitz pauses briefly if you switch apps" first-time tip. ROADMAP §App Lifecycle prescribes it; Phase 7A polish.
- **`thinkingTime` triplication lift** — Mode 1's `thinkingTime` body is now copied verbatim in Mode 2, 3, 4, 5 bot files. Phase 4 explicitly deferred the shared-helper extraction; Phase 5 confirmed the deferral (the body stayed identical across all five). Phase 7A's panic-mode work is the natural trigger to lift it — the panic logic adds a clock-aware branch that breaks the "all five identical" invariant, which is the moment to extract a parameterised helper.

---

## Phase 6 — preview

Phase 6 scope: **Mode 7 (Mirror, new) + Mode 6 (Sudden Death) parallel migration**. The two modes share `parallelEngine`; the parallel family becomes Mode 6 + Mode 7. `parallelEngine.ts` ships in Phase 6 to replace the soft-fail stub from Phase 2.

### Mode 6 parallel migration — parity test

Mode 6's Phase 5 turn-based codebase (`mode6SuddenDeath.ts` façade + the existing `turnBasedEngine` integration) persists through Phase 5. Phase 6 introduces a parallel implementation; the migration is gated on a parity assertion test:

```
For matched (mode, secret, player_guesses, opponent_guesses) inputs,
turn-based-engine.run(...).result === parallel-engine.run(...).result
```

The parity test runs against a fixture set covering victory, defeat, draw (simultaneous_crack), and stalemate (both_exhausted). Once parity holds across the fixture set, Mode 6 swaps engines via `selectEngine(mode)`'s existing `flags.parallelRace` discriminator — same one Mode 7 will use.

### `parallelEngine` shape — both modes share

Mode 6 and Mode 7 share the parallel-race shape: both sides race the same secret (Mode 7) or their own secrets (Mode 6), submissions are independent, the first to crack wins. The differences are in `rules`:

- **Mode 6** — `maxGuessesPerPlayer: 5` (carries over from Phase 5 catalog), `flags.suddenDeath: true`
- **Mode 7** — no guess budget (unlimited), `flags.parallelRace: true`, single shared secret

The engine handles both via the `rules` flags — no per-mode branching inside the engine. Phase 6 tests both modes against the same engine, with mode-specific fixture sets covering each rule combo.

### What stays out of Phase 6

Cold-start resume, panic-mode bots, onboarding tips, all explicitly Phase 7. Phase 6 is two engines (Mode 7 new, Mode 6 migrated) and the parity test — nothing else.
