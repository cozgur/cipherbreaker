import { createRNG } from '@/lib/random';

import { __resetRegistryForTests, modeRegistry } from '../../modeRegistry';
import type { ModeDefinition } from '../../types';
import {
  applyClockSnapshot,
  applyTimeout,
  createMatch,
  startMatch,
  submitGuess,
} from '../parallelEngine';

function registerMirror(): ModeDefinition {
  const mode: ModeDefinition = {
    id: 7,
    meta: {
      section: 'ADVANCED',
      name: 'MIRROR',
      shortLabel: 'MIRROR',
      description: 'fixture',
      stake: 50,
      rewardWin: 100,
      rewardDraw: 50,
      gradient: ['#000', '#fff'],
      iconKey: 'mirror',
    },
    rules: { secretLength: 4, digitsUnique: false, flags: { parallelRace: true } },
    generateSecret: () => '5678',
    validateGuess: () => ({ ok: true }),
    evaluate: () => ({ kind: 'colorMatch', states: [] }),
    bot: {
      initSolverState: () => ({ kind: 'mirror', pool: [], targetTurn: 0 }),
      makeGuess: async () => ({
        guess: '0000',
        newSolverState: { kind: 'mirror', pool: [], targetTurn: 0 },
      }),
      thinkingTime: () => 2000,
    },
  };
  modeRegistry.register(mode);
  return mode;
}

describe('parallelEngine — soft-fail stub', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    __resetRegistryForTests();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('createMatch returns a valid setup-phase MatchState (no warn yet)', () => {
    registerMirror();
    const state = createMatch(7, '1234', { seed: 1, callCount: 0 });
    expect(state.modeId).toBe(7);
    expect(state.phase).toBe('setup');
    expect(state.playerSecret).toBe('1234');
    expect(state.opponentSecret).toBe('5678');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('startMatch advances to active_parallel and warns once', () => {
    const mode = registerMirror();
    const created = createMatch(7, '1234', { seed: 1, callCount: 0 });
    const started = startMatch(created, createRNG(created.rngState));
    expect(started.phase).toBe('active_parallel');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/Faz 6/i);
    void mode;
  });

  it('submitGuess does NOT throw and returns identity result + warns', async () => {
    registerMirror();
    const created = createMatch(7, '1234', { seed: 1, callCount: 0 });
    const started = startMatch(created, createRNG(created.rngState));
    const out = await submitGuess(started, '0000', 'self', createRNG(started.rngState));
    expect(out.state).toBe(started);
    expect(out.feedback).toBeNull();
    expect(out.error).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('applyTimeout returns state unchanged + warns (no terminal result)', () => {
    const mode = registerMirror();
    const created = createMatch(7, '1234', { seed: 1, callCount: 0 });
    const next = applyTimeout(created, mode);
    expect(next).toBe(created);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('applyClockSnapshot is a no-op (no warn for irrelevant calls)', () => {
    registerMirror();
    const created = createMatch(7, '1234', { seed: 1, callCount: 0 });
    const next = applyClockSnapshot(created, {
      playerMs: 30_000,
      opponentMs: 30_000,
      activeOwner: null,
      snapshotTimestamp: 0,
    });
    expect(next).toBe(created);
  });
});
