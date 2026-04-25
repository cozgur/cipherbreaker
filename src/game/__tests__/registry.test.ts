import { ModeNotFoundError } from '../errors';
import { __resetRegistryForTests, modeRegistry } from '../modeRegistry';
import type { ModeDefinition } from '../types';

function fakeMode(id: number, section: 'CLASSIC' | 'ADVANCED' = 'CLASSIC'): ModeDefinition {
  return {
    id,
    meta: {
      section,
      name: `MODE ${id}`,
      shortLabel: `M${id}`,
      description: 'fixture',
      stake: 50,
      rewardWin: 100,
      rewardDraw: 50,
      gradient: ['#000', '#fff'],
      iconKey: 'color-match',
    },
    rules: { secretLength: 4, digitsUnique: false, flags: {} },
    generateSecret: () => '1234',
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

describe('modeRegistry', () => {
  beforeEach(() => {
    __resetRegistryForTests();
  });

  it('get throws ModeNotFoundError for an unregistered id', () => {
    expect(() => modeRegistry.get(99)).toThrow(ModeNotFoundError);
  });

  it('register + get roundtrip preserves the definition', () => {
    const mode = fakeMode(1);
    modeRegistry.register(mode);
    expect(modeRegistry.get(1)).toBe(mode);
  });

  it('getOrNull returns null instead of throwing', () => {
    expect(modeRegistry.getOrNull(99)).toBeNull();
  });

  it('getAll returns every registered mode in insertion order', () => {
    modeRegistry.register(fakeMode(2));
    modeRegistry.register(fakeMode(3));
    const all = modeRegistry.getAll();
    expect(all.map((m) => m.id)).toEqual([2, 3]);
  });

  it('getBySection filters by meta.section', () => {
    modeRegistry.register(fakeMode(1, 'CLASSIC'));
    modeRegistry.register(fakeMode(7, 'ADVANCED'));
    expect(modeRegistry.getBySection('CLASSIC').map((m) => m.id)).toEqual([1]);
    expect(modeRegistry.getBySection('ADVANCED').map((m) => m.id)).toEqual([7]);
  });

  it('__resetRegistryForTests wipes registrations', () => {
    modeRegistry.register(fakeMode(1));
    __resetRegistryForTests();
    expect(modeRegistry.getAll()).toHaveLength(0);
  });

  it('the unregistered-id error round-trips its modeId', () => {
    try {
      modeRegistry.get(7);
      fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ModeNotFoundError);
      if (err instanceof ModeNotFoundError) {
        expect(err.modeId).toBe(7);
      }
    }
  });
});
