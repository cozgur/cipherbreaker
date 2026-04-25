import type { ModeDefinition } from '../../types';
import { parallelEngine, selectEngine, turnBasedEngine } from '../index';

function makeMode(parallelRace: boolean): ModeDefinition {
  return {
    id: 1,
    meta: {
      section: 'CLASSIC',
      name: 'SELECT',
      shortLabel: 'SEL',
      description: 'fixture',
      stake: 0,
      rewardWin: 0,
      rewardDraw: 0,
      gradient: ['#000', '#fff'],
      iconKey: 'color-match',
    },
    rules: {
      secretLength: 4,
      digitsUnique: false,
      flags: parallelRace ? { parallelRace: true } : {},
    },
    generateSecret: () => '0000',
    validateGuess: () => ({ ok: true }),
    evaluate: () => ({ kind: 'colorMatch', states: [] }),
    bot: {
      initSolverState: () => ({ kind: 'candidatePool', pool: [] }),
      makeGuess: async () => ({
        guess: '0000',
        newSolverState: { kind: 'candidatePool', pool: [] },
      }),
      thinkingTime: () => 2000,
    },
  };
}

describe('selectEngine', () => {
  it('returns turnBasedEngine when parallelRace flag is absent', () => {
    expect(selectEngine(makeMode(false))).toBe(turnBasedEngine);
  });

  it('returns parallelEngine when parallelRace flag is true', () => {
    expect(selectEngine(makeMode(true))).toBe(parallelEngine as unknown);
  });
});
