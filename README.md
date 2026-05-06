# CipherBreaker

1v1 number-guessing game for iOS + Android, built with React Native + Expo. Players bet tokens, compete against opponents, and try to crack a 4-digit code first across seven modes (Color Match, High & Low, Precision, Blitz, Blackout, Sudden Death, Mirror). Opponents are AI but always presented as real players — the illusion is a core product constraint.

Specs live in `specs/`. The approved web prototype lives in `reference/`.

## Quick start

```bash
npm install
npm run ios      # run in iOS Simulator
npm run android  # run in Android emulator
npm run web      # web preview
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Expo dev server |
| `npm run ios` | Launch iOS Simulator build |
| `npm run android` | Launch Android emulator build |
| `npm run web` | Web preview |
| `npm run typecheck` | `tsc --noEmit` (strict + noUncheckedIndexedAccess) |
| `npm run lint` | ESLint (flat config) |
| `npm run format` | Prettier (write) |
| `npm run format:check` | Prettier (check) |
| `npm run test` | Jest |
| `npm run test:watch` | Jest watch mode |
| `npm run ci` | typecheck + lint + test |

Pre-commit hook (Husky) runs `typecheck` and `lint` before each commit.

## Folder map

```
App.tsx                  # font loading + navigation root
index.ts                 # registerRootComponent(App)
app.json                 # Expo config (name, icon, dark theme, expo-font plugin)
assets/fonts/            # Chakra Petch, Inter (3 weights), JetBrains Mono
src/
  game/
    modes/               # plug-in mode definitions (pure domain, no React)
    engines/             # turn-based + parallel engines, checkEndConditions
    shared/              # pure helpers (candidate pool, validation, feedback)
    __tests__/
  components/game/rows/  # per-mode guess row renderers
  screens/               # route-level components
  navigation/            # RootNavigator (native-stack)
  state/                 # zustand stores (durable + transient)
  data/                  # mode catalog, opponent name pools, token packages
  theme/                 # tokens, typography, spacing
  lib/dev/               # dev tools
specs/                   # product, design, roadmap docs
reference/               # approved web prototype (do not import from app code)
```

## Architecture references

- `specs/CipherBreaker-SPEC.md` — gameplay rules, 7 modes, economy, bot AI.
- `specs/CipherBreaker-DESIGN-PROMPT.md` — visual direction, type scale, motion, screen briefs.
- `specs/CipherBreaker-ROADMAP-v4.md` — phased implementation plan + architecture contract (durable/transient state split, RNG state serialization, chunked filtering, `checkEndConditions` helper, Blitz grace period, error strategy).

## Path aliases

TypeScript + Metro resolve these at runtime; Jest mirrors them in `jest.config.js`:

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

