import * as fs from 'fs';
import * as path from 'path';

import { createRNG } from '@/lib/random';

import type { BotContext } from '../../types';
import { mode2HighLow } from '../mode2HighLow';

describe('mode2HighLow — meta + rules wired from catalog (single source of truth)', () => {
  it('exposes catalog meta', () => {
    expect(mode2HighLow.id).toBe(2);
    expect(mode2HighLow.meta.name).toBe('HIGH & LOW');
    expect(mode2HighLow.meta.section).toBe('CLASSIC');
  });

  it('exposes catalog rules (4 digits, duplicates allowed)', () => {
    expect(mode2HighLow.rules.secretLength).toBe(4);
    expect(mode2HighLow.rules.digitsUnique).toBe(false);
  });
});

describe('mode2HighLow — evaluate (numeric compare, SPEC §3.3)', () => {
  const cases: ReadonlyArray<{
    guess: string;
    secret: string;
    dir: 'higher' | 'lower';
    isWin: boolean;
    note: string;
  }> = [
    { guess: '3817', secret: '3817', dir: 'higher', isWin: true, note: 'exact match → isWin' },
    { guess: '7234', secret: '3817', dir: 'lower', isWin: false, note: 'guess > secret → lower' },
    { guess: '3142', secret: '3817', dir: 'higher', isWin: false, note: 'guess < secret → higher' },
    { guess: '0000', secret: '0001', dir: 'higher', isWin: false, note: 'leading zeros — numeric compare' },
    { guess: '9999', secret: '0000', dir: 'lower', isWin: false, note: 'maximum > minimum → lower' },
    { guess: '0817', secret: '3817', dir: 'higher', isWin: false, note: 'parseInt strips leading zero (817 < 3817)' },
    { guess: '5000', secret: '5000', dir: 'higher', isWin: true, note: 'midpoint exact match' },
    { guess: '5001', secret: '5000', dir: 'lower', isWin: false, note: 'one above → lower' },
    { guess: '4999', secret: '5000', dir: 'higher', isWin: false, note: 'one below → higher' },
    { guess: '1122', secret: '1122', dir: 'higher', isWin: true, note: 'duplicate-digit win still counts' },
  ];

  it.each(cases)(
    'evaluate(guess=$guess, secret=$secret) → $note',
    ({ guess, secret, dir, isWin }) => {
      const fb = mode2HighLow.evaluate(guess, secret);
      expect(fb.kind).toBe('direction');
      if (fb.kind !== 'direction') return;
      expect(fb.dir).toBe(dir);
      expect(fb.isWin).toBe(isWin);
    },
  );

  it('is pure — same inputs always produce identical output', () => {
    const a = mode2HighLow.evaluate('1234', '5678');
    const b = mode2HighLow.evaluate('1234', '5678');
    expect(a).toEqual(b);
  });

  it('a winning evaluate sets isWin=true', () => {
    const fb = mode2HighLow.evaluate('5678', '5678');
    expect(fb.kind).toBe('direction');
    if (fb.kind !== 'direction') return;
    expect(fb.isWin).toBe(true);
  });
});

describe('mode2HighLow — validateGuess', () => {
  it('accepts a 4-digit guess', () => {
    expect(mode2HighLow.validateGuess('1234')).toEqual({ ok: true });
  });

  it('accepts a 4-digit guess WITH duplicates (Mode 2 has digitsUnique=false)', () => {
    expect(mode2HighLow.validateGuess('1122')).toEqual({ ok: true });
    expect(mode2HighLow.validateGuess('0000')).toEqual({ ok: true });
  });

  it('rejects too-short input with WRONG_LENGTH', () => {
    const r = mode2HighLow.validateGuess('123');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('WRONG_LENGTH');
  });

  it('rejects too-long input with WRONG_LENGTH', () => {
    const r = mode2HighLow.validateGuess('12345');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('WRONG_LENGTH');
  });

  it('rejects non-digit characters with NOT_DIGITS', () => {
    const r = mode2HighLow.validateGuess('12a4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_DIGITS');
  });

  it('does not throw — user-facing failures propagate as data', () => {
    expect(() => mode2HighLow.validateGuess('')).not.toThrow();
    expect(() => mode2HighLow.validateGuess('xxxx')).not.toThrow();
  });
});

describe('mode2HighLow — generateSecret', () => {
  it('produces a 4-digit string', () => {
    const rng = createRNG(42);
    const secret = mode2HighLow.generateSecret(rng);
    expect(secret).toMatch(/^\d{4}$/);
  });

  it('is deterministic for the same RNG state', () => {
    const a = mode2HighLow.generateSecret(createRNG({ seed: 7, callCount: 0 }));
    const b = mode2HighLow.generateSecret(createRNG({ seed: 7, callCount: 0 }));
    expect(a).toBe(b);
  });

  it('advances the RNG cursor (callCount strictly increases)', () => {
    const rng = createRNG({ seed: 11, callCount: 0 });
    const before = rng.getState().callCount;
    mode2HighLow.generateSecret(rng);
    expect(rng.getState().callCount).toBeGreaterThan(before);
  });
});

describe('mode2HighLow — bot strategy (binary-search interval)', () => {
  function makeContext(overrides: Partial<BotContext> = {}): BotContext {
    return {
      previousGuesses: [],
      mySecret: '3817',
      difficulty: 'normal',
      turnNumber: 1,
      solverState: mode2HighLow.bot.initSolverState('3817', mode2HighLow.rules),
      rng: createRNG({ seed: 1, callCount: 0 }),
      ...overrides,
    };
  }

  it('initSolverState seeds a directionRange spanning [0, 9999]', () => {
    const s = mode2HighLow.bot.initSolverState('3817', mode2HighLow.rules);
    expect(s.kind).toBe('directionRange');
    if (s.kind !== 'directionRange') return;
    expect(s.low).toBe(0);
    expect(s.high).toBe(9999);
  });

  it('opening guess on hard returns the midpoint deterministically (5000-ish, no RNG draws)', async () => {
    const ctx = makeContext({
      difficulty: 'hard',
      rng: createRNG({ seed: 42, callCount: 0 }),
    });
    const before = ctx.rng.getState().callCount;
    const out = await mode2HighLow.bot.makeGuess(ctx);
    expect(out.guess).toMatch(/^\d{4}$/);
    // Hard never consumes from rng — same invariant as Mode 1.
    expect(ctx.rng.getState().callCount).toBe(before);
    // Math.floor((0 + 9999) / 2) = 4999.
    expect(out.guess).toBe('4999');
  });

  it('makeGuess is deterministic across identical RNG cursors (normal)', async () => {
    const a = await mode2HighLow.bot.makeGuess(
      makeContext({ rng: createRNG({ seed: 42, callCount: 0 }) }),
    );
    const b = await mode2HighLow.bot.makeGuess(
      makeContext({ rng: createRNG({ seed: 42, callCount: 0 }) }),
    );
    expect(a.guess).toBe(b.guess);
  });

  it('range monotonically narrows after a "higher" feedback round', async () => {
    // Bot guessed '4999' — secret would be greater. Range should pull
    // up to [5000, 9999] and the next guess must lie inside it.
    const opening = await mode2HighLow.bot.makeGuess(
      makeContext({ difficulty: 'hard' }),
    );
    expect(opening.guess).toBe('4999');

    const fakeEntry = {
      side: 'opponent' as const,
      guessIndex: 1,
      digits: [4, 9, 9, 9] as const,
      feedback: { kind: 'direction' as const, dir: 'higher' as const, isWin: false },
    };
    const ctx2 = makeContext({
      previousGuesses: [fakeEntry],
      turnNumber: 2,
      solverState: opening.newSolverState,
      difficulty: 'hard',
      rng: createRNG({ seed: 99, callCount: 0 }),
    });
    const next = await mode2HighLow.bot.makeGuess(ctx2);
    if (next.newSolverState.kind !== 'directionRange') throw new Error('wrong kind');
    expect(next.newSolverState.low).toBe(5000);
    expect(next.newSolverState.high).toBe(9999);
    // Hard midpoint of [5000, 9999] = 7499.
    expect(next.guess).toBe('7499');
  });

  it('range narrows after a "lower" feedback round', async () => {
    const fakeEntry = {
      side: 'opponent' as const,
      guessIndex: 1,
      digits: [7, 0, 0, 0] as const,
      feedback: { kind: 'direction' as const, dir: 'lower' as const, isWin: false },
    };
    const ctx = makeContext({
      previousGuesses: [fakeEntry],
      turnNumber: 2,
      solverState: { kind: 'directionRange', low: 0, high: 9999 },
      difficulty: 'hard',
    });
    const out = await mode2HighLow.bot.makeGuess(ctx);
    if (out.newSolverState.kind !== 'directionRange') throw new Error('wrong kind');
    expect(out.newSolverState.low).toBe(0);
    expect(out.newSolverState.high).toBe(6999);
  });

  it('inconsistent feedback collapses range — falls back to [0, 9999] safely', async () => {
    // Solver claims [5000, 5000] but the previous guess of 7000 + 'higher'
    // says secret > 7000 → impossible against the existing high. Guard
    // against deadlock by resetting to the full range.
    const fakeEntry = {
      side: 'opponent' as const,
      guessIndex: 1,
      digits: [7, 0, 0, 0] as const,
      feedback: { kind: 'direction' as const, dir: 'higher' as const, isWin: false },
    };
    const ctx = makeContext({
      previousGuesses: [fakeEntry],
      solverState: { kind: 'directionRange', low: 5000, high: 5000 },
      difficulty: 'hard',
    });
    const out = await mode2HighLow.bot.makeGuess(ctx);
    if (out.newSolverState.kind !== 'directionRange') throw new Error('wrong kind');
    // The range falls back to the full span; the guess is the midpoint.
    expect(out.newSolverState.low).toBe(0);
    expect(out.newSolverState.high).toBe(9999);
  });

  it('thinkingTime stays inside the global [BOT_THINK_MIN_MS, BOT_THINK_MAX_MS] band', () => {
    for (let i = 0; i < 200; i += 1) {
      const t = mode2HighLow.bot.thinkingTime(makeContext());
      expect(t).toBeGreaterThanOrEqual(2000);
      expect(t).toBeLessThanOrEqual(12_000);
    }
  });

  it.each(['easy', 'normal', 'hard'] as const)(
    'thinkingTime works for difficulty=%s',
    (difficulty) => {
      const t = mode2HighLow.bot.thinkingTime(makeContext({ difficulty }));
      expect(t).toBeGreaterThanOrEqual(2000);
      expect(t).toBeLessThanOrEqual(12_000);
    },
  );
});

describe('mode2 file imports — domain purity', () => {
  it.each(['mode2HighLow.ts', 'mode2/bot.ts', 'mode2/evaluate.ts'])(
    '%s imports no React',
    (rel) => {
      const filepath = path.resolve(__dirname, '..', rel);
      const src = fs.readFileSync(filepath, 'utf8');
      expect(src).not.toMatch(/from ['"]react['"]/);
      expect(src).not.toMatch(/from ['"]react-native['"]/);
    },
  );
});
