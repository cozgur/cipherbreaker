/**
 * The seven launch modes, ported from reference/modes.jsx with explicit
 * metadata and rules so Phase 2 can wire in engines without touching
 * the catalog schema.
 */

import { colors } from '@theme/tokens';
import type { ModeCatalogEntry } from '@game/types';

export const modeCatalog: readonly ModeCatalogEntry[] = [
  {
    id: 1,
    meta: {
      section: 'CLASSIC',
      name: 'COLOR MATCH',
      shortLabel: 'COLOR',
      description: 'Green, yellow, gray — Wordle-style feedback.',
      stake: 50,
      rewardWin: 100,
      rewardDraw: 50,
      gradient: [colors.cyan, colors.violet],
      iconKey: 'color-match',
    },
    rules: {
      secretLength: 4,
      digitsUnique: false,
      flags: {},
    },
  },
  {
    id: 2,
    meta: {
      section: 'CLASSIC',
      name: 'HIGH & LOW',
      shortLabel: 'HIGH',
      description: 'One hint: is the secret higher or lower?',
      stake: 50,
      rewardWin: 100,
      rewardDraw: 50,
      gradient: [colors.violet, colors.pink],
      iconKey: 'high-low',
    },
    rules: {
      secretLength: 4,
      digitsUnique: false,
      flags: {},
    },
  },
  {
    id: 3,
    meta: {
      section: 'CLASSIC',
      name: 'PRECISION',
      shortLabel: 'PRECISION',
      description: '+1 for right spot, −1 for wrong spot.',
      stake: 50,
      rewardWin: 100,
      rewardDraw: 50,
      gradient: [colors.gold, '#ea580c'],
      iconKey: 'precision',
    },
    rules: {
      secretLength: 4,
      // Phase 4: flipped to true once the engine landed. SPEC §3.4
      // requires unique digits in the secret AND the guess —
      // `validateGuess` chains `validateUnique` so the keypad rejects
      // repeats inline.
      digitsUnique: true,
      flags: {},
    },
  },
  {
    id: 4,
    meta: {
      section: 'ADVANCED',
      name: 'BLITZ',
      shortLabel: 'BLITZ',
      description: "Chess clock. 60 seconds each. Don't flag.",
      stake: 50,
      rewardWin: 150,
      rewardDraw: 50,
      badge: { label: '⏱ TIMED', color: '#f97316' },
      gradient: [colors.danger, '#f97316'],
      iconKey: 'blitz',
    },
    rules: {
      secretLength: 4,
      digitsUnique: false,
      perPlayerTimeLimitMs: 60_000,
      flags: { perPlayerClock: true },
    },
  },
  {
    id: 5,
    meta: {
      section: 'ADVANCED',
      name: 'BLACKOUT',
      shortLabel: 'BLACKOUT',
      description: 'Only locked-in digits revealed. High stakes.',
      stake: 100,
      rewardWin: 250,
      rewardDraw: 100,
      badge: { label: 'PRESTIGE', color: colors.pink },
      gradient: ['#5b21b6', colors.bgBase],
      iconKey: 'blackout',
    },
    rules: {
      secretLength: 4,
      // Phase 5: flipped to true with the engine. SPEC §3.7 requires
      // unique digits; `validateGuess` chains `validateUnique` so the
      // keypad rejects repeats inline, mirroring Mode 3.
      digitsUnique: true,
      flags: { blackoutReveal: true },
    },
  },
  {
    id: 6,
    meta: {
      section: 'ADVANCED',
      name: 'SUDDEN DEATH',
      shortLabel: 'SUDDEN',
      description: 'Five guesses. No second chances.',
      stake: 50,
      rewardWin: 120,
      rewardDraw: 50,
      badge: { label: 'HIGH RISK', color: '#dc2626' },
      gradient: ['#7f1d1d', '#dc2626'],
      iconKey: 'sudden-death',
    },
    rules: {
      secretLength: 4,
      digitsUnique: false,
      maxGuessesPerPlayer: 5,
      // Phase 6 CP3 — flipped to parallelEngine after the parity test
      // (mode6ParityLegacyVsParallel.test.ts) confirmed identical
      // outcomes across the two engines for crack/exhaustion/last-turn
      // scenarios. `sharedSecret` is intentionally absent: Mode 6
      // keeps the player-set secret (SecretSetup runs as before) —
      // only Mode 7 (Mirror) carries `sharedSecret` for engine-
      // generated mirroring.
      flags: { suddenDeath: true, parallelRace: true },
    },
  },
  {
    id: 7,
    meta: {
      section: 'ADVANCED',
      name: 'MIRROR',
      shortLabel: 'MIRROR',
      description: 'Same code, different minds. First to crack wins.',
      stake: 75,
      rewardWin: 180,
      rewardDraw: 75,
      badge: { label: 'SOLO RACE', color: '#14b8a6' },
      gradient: ['#14b8a6', '#94a3b8'],
      iconKey: 'mirror',
    },
    rules: {
      secretLength: 4,
      digitsUnique: false,
      flags: { parallelRace: true, sharedSecret: true },
    },
  },
];

/**
 * Lookup by id with `noUncheckedIndexedAccess` in mind — returns
 * `undefined` for unknown ids rather than blowing up.
 */
export function findMode(id: number): ModeCatalogEntry | undefined {
  return modeCatalog.find((entry) => entry.id === id);
}

/**
 * Phase 7A.8 CP6 — one-time token cost to unlock each mode (sealed
 * unlock-economy design). Mode 1 is free (default-unlocked); 2-7 are
 * bought once and stay unlocked. Lives in the catalog because it's
 * per-mode metadata — CP7's HomeScreen lock UI and the
 * `userStore.unlockMode` spend action both read from here, so a single
 * source of truth keeps the price the player sees and the price the
 * store charges in lockstep. Total: 6500 tokens across 2-7.
 */
export const MODE_UNLOCK_COSTS: Readonly<Record<number, number>> = {
  1: 0,
  2: 300,
  3: 500,
  4: 1000,
  5: 1500,
  6: 1200,
  7: 2000,
};
