/**
 * Phase 7A.5 CP2 — DDA-aware reward multiplier suite.
 *
 * Pure-function tests over `computeReward(base, difficulty)`.
 * Three layers:
 *   1. Multiplier math at the boundary cases (zero, the catalog
 *      values for Modes 1/4/5/6/7, the rounding direction).
 *   2. Parametric `it.each` over the catalog × difficulty matrix
 *      so a re-balance in either dimension surfaces here as a
 *      single-line table edit, not a scattered test rewrite.
 *   3. Round-down policy (Math.floor) — the function never over-
 *      credits the wallet on a fractional multiplier result.
 */

import type { BotDifficulty } from '@game/types';
import {
  REWARD_MULTIPLIER_EASY,
  REWARD_MULTIPLIER_HARD,
  REWARD_MULTIPLIER_NORMAL,
} from '../constants';
import { computeReward } from '../rewardPacing';

describe('computeReward — multiplier math', () => {
  it('easy difficulty is the 1.0× baseline (returns base unchanged)', () => {
    expect(computeReward(100, 'easy')).toBe(100);
    expect(computeReward(150, 'easy')).toBe(150);
    expect(computeReward(250, 'easy')).toBe(250);
  });

  it('normal difficulty applies the 1.2× premium', () => {
    expect(computeReward(100, 'normal')).toBe(120);
    expect(computeReward(150, 'normal')).toBe(180);
    expect(computeReward(250, 'normal')).toBe(300);
  });

  it('hard difficulty applies the 1.5× premium', () => {
    expect(computeReward(100, 'hard')).toBe(150);
    expect(computeReward(150, 'hard')).toBe(225);
    expect(computeReward(250, 'hard')).toBe(375);
  });

  it('zero base reward stays zero on every difficulty (multiply-by-zero invariant)', () => {
    expect(computeReward(0, 'easy')).toBe(0);
    expect(computeReward(0, 'normal')).toBe(0);
    expect(computeReward(0, 'hard')).toBe(0);
  });

  it('uses constants from the constants module — re-balance lands in one place', () => {
    expect(computeReward(100, 'easy')).toBe(Math.floor(100 * REWARD_MULTIPLIER_EASY));
    expect(computeReward(100, 'normal')).toBe(Math.floor(100 * REWARD_MULTIPLIER_NORMAL));
    expect(computeReward(100, 'hard')).toBe(Math.floor(100 * REWARD_MULTIPLIER_HARD));
  });
});

describe('computeReward — Math.floor truncation policy', () => {
  // The wallet is integer-only; fractional results from a
  // multiplier round DOWN so the ledger never over-credits
  // beyond what the multiplier strictly permits.

  it('Mode 7 win × normal (180 × 1.2 = 216 exactly — no truncation needed)', () => {
    expect(computeReward(180, 'normal')).toBe(216);
  });

  it('truncates a fractional result rather than rounding (75 × 1.2 = 90 exact, no edge)', () => {
    // 75 × 1.2 = 90, integer — verify that the float arithmetic
    // doesn't produce 89.99999… and round-trip to 89.
    expect(computeReward(75, 'normal')).toBe(90);
  });

  it('an irrational-by-floating-point base × multiplier still floors cleanly', () => {
    // 1 × 1.2 = 1.2 → floor = 1.
    expect(computeReward(1, 'normal')).toBe(1);
    // 1 × 1.5 = 1.5 → floor = 1 (the loss-of-half-token is
    // intentional — the wallet has no 0.5-token granularity).
    expect(computeReward(1, 'hard')).toBe(1);
  });

  it('large reward × hard multiplier scales linearly', () => {
    expect(computeReward(1000, 'hard')).toBe(1500);
    expect(computeReward(10_000, 'hard')).toBe(15_000);
  });
});

describe('computeReward — mode catalog cross-product (parametric)', () => {
  // Five mode-base × three difficulty = 15 cases. Catalog values
  // mirror `data/modeCatalog.ts` rewardWin entries today; if the
  // catalog re-balances, this table is the one place the test
  // matrix updates. Drift surfaces immediately.

  type Row = { readonly modeName: string; readonly base: number; readonly difficulty: BotDifficulty; readonly expected: number };
  const cases: readonly Row[] = [
    // Mode 1 / Mode 6 family — base 100/120 (low end).
    { modeName: 'Mode 1 (Color Match) win', base: 100, difficulty: 'easy', expected: 100 },
    { modeName: 'Mode 1 (Color Match) win', base: 100, difficulty: 'normal', expected: 120 },
    { modeName: 'Mode 1 (Color Match) win', base: 100, difficulty: 'hard', expected: 150 },
    { modeName: 'Mode 6 (Sudden Death) win', base: 120, difficulty: 'easy', expected: 120 },
    { modeName: 'Mode 6 (Sudden Death) win', base: 120, difficulty: 'normal', expected: 144 },
    { modeName: 'Mode 6 (Sudden Death) win', base: 120, difficulty: 'hard', expected: 180 },
    // Mode 4 / Mode 7 family — base 150/180 (mid).
    { modeName: 'Mode 4 (Blitz) win', base: 150, difficulty: 'easy', expected: 150 },
    { modeName: 'Mode 4 (Blitz) win', base: 150, difficulty: 'normal', expected: 180 },
    { modeName: 'Mode 4 (Blitz) win', base: 150, difficulty: 'hard', expected: 225 },
    { modeName: 'Mode 7 (Mirror) win', base: 180, difficulty: 'easy', expected: 180 },
    { modeName: 'Mode 7 (Mirror) win', base: 180, difficulty: 'normal', expected: 216 },
    { modeName: 'Mode 7 (Mirror) win', base: 180, difficulty: 'hard', expected: 270 },
    // Mode 5 family — base 250 (high end).
    { modeName: 'Mode 5 (Blackout) win', base: 250, difficulty: 'easy', expected: 250 },
    { modeName: 'Mode 5 (Blackout) win', base: 250, difficulty: 'normal', expected: 300 },
    { modeName: 'Mode 5 (Blackout) win', base: 250, difficulty: 'hard', expected: 375 },
  ];

  it.each(cases)(
    '$modeName × $difficulty: base $base → $expected',
    ({ base, difficulty, expected }) => {
      expect(computeReward(base, difficulty)).toBe(expected);
    },
  );
});

describe('computeReward — draw-reward path (consistency with win path)', () => {
  // Mode 1's rewardDraw = 50 in the catalog. Same multiplier
  // applies — the function is outcome-agnostic; the call site
  // (`MatchScreen.tsx`) decides which catalog value to feed in.

  it('draw rewards multiply identically to win rewards', () => {
    expect(computeReward(50, 'easy')).toBe(50);
    expect(computeReward(50, 'normal')).toBe(60);
    expect(computeReward(50, 'hard')).toBe(75);
    // Mode 5 draw = 100.
    expect(computeReward(100, 'normal')).toBe(120);
    expect(computeReward(100, 'hard')).toBe(150);
    // Mode 7 draw = 75.
    expect(computeReward(75, 'normal')).toBe(90);
    expect(computeReward(75, 'hard')).toBe(112);
  });
});
