/**
 * Scenario / fixed-sequence sanity tests for `pickDifficultyFromOutcomes`.
 *
 * Not a stochastic convergence test — `pickDifficultyFromOutcomes` is a
 * pure function with no internal state, so there's nothing to converge.
 * Instead, each test feeds a deterministic outcome sequence simulating a
 * specific player profile and asserts the difficulty trajectory that
 * sequence produces. These cover the "did the rolling window actually
 * react?" question in a way the threshold tests don't.
 */

import type { MatchResultOutcome } from '@navigation/routes';

import { pickDifficultyFromOutcomes } from '../pickDifficultyFromOutcomes';

const V: MatchResultOutcome = 'victory';
const D: MatchResultOutcome = 'defeat';

/** Replays `recordMatchResult`'s push-and-cap semantics on a plain array. */
function step(history: MatchResultOutcome[], outcome: MatchResultOutcome): MatchResultOutcome[] {
  return [...history, outcome].slice(-10);
}

describe('pickDifficultyFromOutcomes — scenarios', () => {
  it('20%-win profile (2V + 8D pattern) settles into easy once the window is full', () => {
    // Struggling player. Pattern: V, D, D, D, V, D, D, D, D, D — 2 victories
    // in 10. After the 10th match the window is full and the threshold trips
    // easy. Continued 20%-win pace holds easy across further matches.
    const pattern: MatchResultOutcome[] = [V, D, D, D, V, D, D, D, D, D];
    let history: MatchResultOutcome[] = [];
    for (const outcome of pattern) history = step(history, outcome);
    expect(pickDifficultyFromOutcomes(history)).toBe('easy');

    for (const outcome of pattern) history = step(history, outcome);
    expect(pickDifficultyFromOutcomes(history)).toBe('easy');
  });

  it('30%-win profile (3V + 7D) sits in normal — the wide-normal band absorbs casual play', () => {
    // Documents the deliberate wide-normal-band design (Option B): a player
    // who wins three out of ten is "below average but not struggling" and
    // gets the same bot as a 70%-winner. This is the band the DDA is
    // intentionally lazy about — only sustained streaks at the extremes
    // move it.
    const pattern: MatchResultOutcome[] = [V, D, D, D, V, D, D, V, D, D];
    let history: MatchResultOutcome[] = [];
    for (const outcome of pattern) history = step(history, outcome);
    expect(pickDifficultyFromOutcomes(history)).toBe('normal');
  });

  it('80%-win profile (8V + 2D pattern) lands on hard once the window is full', () => {
    const pattern: MatchResultOutcome[] = [V, V, V, V, D, V, V, V, V, D];
    let history: MatchResultOutcome[] = [];
    for (const outcome of pattern) history = step(history, outcome);
    expect(pickDifficultyFromOutcomes(history)).toBe('hard');
  });

  it('50%-win profile lands on normal — the dead centre of the target band', () => {
    const pattern: MatchResultOutcome[] = [V, D, V, D, V, D, V, D, V, D];
    let history: MatchResultOutcome[] = [];
    for (const outcome of pattern) history = step(history, outcome);
    expect(pickDifficultyFromOutcomes(history)).toBe('normal');
  });

  it('player swings from easy → normal → hard as their win streak grows', () => {
    // Start with 10 defeats — easy.
    let history: MatchResultOutcome[] = [];
    for (let i = 0; i < 10; i += 1) history = step(history, D);
    expect(pickDifficultyFromOutcomes(history)).toBe('easy');

    // Add 5 victories — window is now [5D, 5V] → 5 wins → normal.
    for (let i = 0; i < 5; i += 1) history = step(history, V);
    expect(pickDifficultyFromOutcomes(history)).toBe('normal');

    // Add 5 more victories — window is now [10V] → hard.
    for (let i = 0; i < 5; i += 1) history = step(history, V);
    expect(pickDifficultyFromOutcomes(history)).toBe('hard');

    // Slip into a slump — 8 defeats — window is [2V, 8D] → 2 wins → easy.
    for (let i = 0; i < 8; i += 1) history = step(history, D);
    expect(pickDifficultyFromOutcomes(history)).toBe('easy');
  });
});
