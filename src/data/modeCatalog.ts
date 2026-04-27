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
      rewardWin: 100,
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
      rewardWin: 200,
      rewardDraw: 100,
      badge: { label: 'PRESTIGE', color: colors.pink },
      gradient: ['#5b21b6', colors.bgBase],
      iconKey: 'blackout',
    },
    rules: {
      secretLength: 4,
      digitsUnique: false,
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
      rewardWin: 100,
      rewardDraw: 0,
      badge: { label: 'HIGH RISK', color: '#dc2626' },
      gradient: ['#7f1d1d', '#dc2626'],
      iconKey: 'sudden-death',
    },
    rules: {
      secretLength: 4,
      digitsUnique: false,
      maxGuessesPerPlayer: 5,
      flags: { suddenDeath: true },
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
      rewardWin: 150,
      rewardDraw: 75,
      badge: { label: 'SOLO RACE', color: '#14b8a6' },
      gradient: ['#14b8a6', '#94a3b8'],
      iconKey: 'mirror',
    },
    rules: {
      secretLength: 4,
      digitsUnique: false,
      flags: { parallelRace: true },
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
