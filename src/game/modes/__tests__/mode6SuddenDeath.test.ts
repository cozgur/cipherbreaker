import * as fs from 'fs';
import * as path from 'path';

import { createRNG } from '@/lib/random';

import type { BotContext } from '../../types';
import { mode6SuddenDeath } from '../mode6SuddenDeath';

describe('mode6SuddenDeath — meta + rules wired from catalog (single source of truth)', () => {
  it('exposes catalog meta', () => {
    expect(mode6SuddenDeath.id).toBe(6);
    expect(mode6SuddenDeath.meta.name).toBe('SUDDEN DEATH');
    expect(mode6SuddenDeath.meta.section).toBe('ADVANCED');
  });

  it('exposes catalog rules — 5-guess budget per player, duplicates allowed', () => {
    expect(mode6SuddenDeath.rules.secretLength).toBe(4);
    expect(mode6SuddenDeath.rules.digitsUnique).toBe(false);
    expect(mode6SuddenDeath.rules.maxGuessesPerPlayer).toBe(5);
    expect(mode6SuddenDeath.rules.flags.suddenDeath).toBe(true);
  });
});

describe('mode6SuddenDeath — evaluator re-uses Mode 1 ColorMatch (Wordle two-pass)', () => {
  it('produces colorMatch feedback', () => {
    const fb = mode6SuddenDeath.evaluate('1234', '1244');
    expect(fb.kind).toBe('colorMatch');
  });

  it('isWin=true on exact match', () => {
    const fb = mode6SuddenDeath.evaluate('5678', '5678');
    expect(fb.kind).toBe('colorMatch');
    if (fb.kind !== 'colorMatch') return;
    expect(fb.isWin).toBe(true);
  });

  it('SPEC §3.2 worked example (1919 vs 1122) — proves identity with Mode 1 evaluator', () => {
    const fb = mode6SuddenDeath.evaluate('1919', '1122');
    expect(fb.kind).toBe('colorMatch');
    if (fb.kind !== 'colorMatch') return;
    expect(fb.states).toEqual(['green', 'gray', 'yellow', 'gray']);
  });
});

describe('mode6SuddenDeath — validateGuess (Mode 1 chain — duplicates allowed)', () => {
  it('accepts 4-digit input with duplicates', () => {
    expect(mode6SuddenDeath.validateGuess('1122')).toEqual({ ok: true });
  });

  it('rejects too-short input with WRONG_LENGTH', () => {
    const r = mode6SuddenDeath.validateGuess('123');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('WRONG_LENGTH');
  });

  it('rejects non-digit input with NOT_DIGITS', () => {
    const r = mode6SuddenDeath.validateGuess('12a4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_DIGITS');
  });
});

describe('mode6SuddenDeath — generateSecret', () => {
  it('produces a 4-digit string (duplicates allowed)', () => {
    const rng = createRNG(42);
    expect(mode6SuddenDeath.generateSecret(rng)).toMatch(/^\d{4}$/);
  });

  it('is deterministic across identical RNG cursors', () => {
    const a = mode6SuddenDeath.generateSecret(createRNG({ seed: 7, callCount: 0 }));
    const b = mode6SuddenDeath.generateSecret(createRNG({ seed: 7, callCount: 0 }));
    expect(a).toBe(b);
  });
});

describe('mode6SuddenDeath — bot strategy re-uses Mode 1 (9K candidatePool)', () => {
  function makeContext(overrides: Partial<BotContext> = {}): BotContext {
    return {
      previousGuesses: [],
      mySecret: '1234',
      difficulty: 'normal',
      turnNumber: 1,
      solverState: mode6SuddenDeath.bot.initSolverState('1234', mode6SuddenDeath.rules),
      rng: createRNG({ seed: 1, callCount: 0 }),
      ...overrides,
    };
  }

  it('initSolverState seeds a candidatePool of 9 000 (duplicates allowed, no leading zero)', () => {
    const s = mode6SuddenDeath.bot.initSolverState('1234', mode6SuddenDeath.rules);
    expect(s.kind).toBe('candidatePool');
    if (s.kind !== 'candidatePool') return;
    expect(s.pool.length).toBe(9_000);
  });

  it('hard difficulty picks pool[0] = "1000"', async () => {
    const out = await mode6SuddenDeath.bot.makeGuess(
      makeContext({ difficulty: 'hard' }),
    );
    expect(out.guess).toBe('1000');
  });

  it('makeGuess deterministic across identical RNG cursors', async () => {
    const a = await mode6SuddenDeath.bot.makeGuess(
      makeContext({ rng: createRNG({ seed: 42, callCount: 0 }) }),
    );
    const b = await mode6SuddenDeath.bot.makeGuess(
      makeContext({ rng: createRNG({ seed: 42, callCount: 0 }) }),
    );
    expect(a.guess).toBe(b.guess);
  });

  it('thinkingTime stays inside the global [BOT_THINK_MIN_MS, BOT_THINK_MAX_MS] band', () => {
    for (let i = 0; i < 100; i += 1) {
      const t = mode6SuddenDeath.bot.thinkingTime(makeContext());
      expect(t).toBeGreaterThanOrEqual(2000);
      expect(t).toBeLessThanOrEqual(12_000);
    }
  });
});

describe('mode6 file imports — domain purity', () => {
  it('mode6SuddenDeath.ts imports no React', () => {
    const filepath = path.resolve(__dirname, '..', 'mode6SuddenDeath.ts');
    const src = fs.readFileSync(filepath, 'utf8');
    expect(src).not.toMatch(/from ['"]react['"]/);
    expect(src).not.toMatch(/from ['"]react-native['"]/);
  });
});
