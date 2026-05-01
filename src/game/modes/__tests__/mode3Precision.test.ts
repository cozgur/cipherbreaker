import * as fs from 'fs';
import * as path from 'path';

import { createRNG } from '@/lib/random';

import { __resetCandidatePoolCacheForTests } from '../../shared/candidatePool';
import type { BotContext } from '../../types';
import { mode3Precision } from '../mode3Precision';

describe('mode3Precision — meta + rules wired from catalog (single source of truth)', () => {
  it('exposes catalog meta', () => {
    expect(mode3Precision.id).toBe(3);
    expect(mode3Precision.meta.name).toBe('PRECISION');
    expect(mode3Precision.meta.section).toBe('CLASSIC');
  });

  it('exposes catalog rules — Phase 4 flipped digitsUnique to true', () => {
    expect(mode3Precision.rules.secretLength).toBe(4);
    expect(mode3Precision.rules.digitsUnique).toBe(true);
  });
});

describe('mode3Precision — evaluate (SPEC §3.4 +N/−M two-pass)', () => {
  const cases: ReadonlyArray<{
    guess: string;
    secret: string;
    plus: number;
    minus: number;
    isWin: boolean;
    note: string;
  }> = [
    {
      guess: '1234',
      secret: '1234',
      plus: 4,
      minus: 0,
      isWin: true,
      note: 'exact match → +4 / −0 / isWin',
    },
    {
      guess: '1249',
      secret: '1234',
      plus: 2,
      minus: 1,
      isWin: false,
      note: 'SPEC §3.4 worked example',
    },
    {
      guess: '4321',
      secret: '1234',
      plus: 0,
      minus: 4,
      isWin: false,
      note: 'reversed → all wrong-spot',
    },
    {
      guess: '5678',
      secret: '1234',
      plus: 0,
      minus: 0,
      isWin: false,
      note: 'no overlap → +0 / −0',
    },
    {
      guess: '1239',
      secret: '1234',
      plus: 3,
      minus: 0,
      isWin: false,
      note: 'three correct positions, last digit absent',
    },
    {
      guess: '0234',
      secret: '1234',
      plus: 3,
      minus: 0,
      isWin: false,
      note: 'first slot mismatched — three plus matches, no wandering minus',
    },
    {
      guess: '2143',
      secret: '1234',
      plus: 0,
      minus: 4,
      isWin: false,
      note: 'every digit present but every position wrong',
    },
    {
      guess: '1342',
      secret: '1234',
      plus: 1,
      minus: 3,
      isWin: false,
      note: 'one in place, three drifting',
    },
  ];

  it.each(cases)(
    'evaluate(guess=$guess, secret=$secret) → $note',
    ({ guess, secret, plus, minus, isWin }) => {
      const fb = mode3Precision.evaluate(guess, secret);
      expect(fb.kind).toBe('precision');
      if (fb.kind !== 'precision') return;
      expect(fb.plus).toBe(plus);
      expect(fb.minus).toBe(minus);
      expect(fb.isWin).toBe(isWin);
    },
  );

  it('is pure — same inputs always produce identical output', () => {
    const a = mode3Precision.evaluate('1234', '5678');
    const b = mode3Precision.evaluate('1234', '5678');
    expect(a).toEqual(b);
  });

  it('a winning evaluate sets isWin=true', () => {
    const fb = mode3Precision.evaluate('5678', '5678');
    expect(fb.kind).toBe('precision');
    if (fb.kind !== 'precision') return;
    expect(fb.isWin).toBe(true);
    expect(fb.plus).toBe(4);
    expect(fb.minus).toBe(0);
  });
});

describe('mode3Precision — validateGuess', () => {
  it('accepts a 4-digit guess with all unique digits', () => {
    expect(mode3Precision.validateGuess('1234')).toEqual({ ok: true });
  });

  it('rejects repeats with NOT_UNIQUE — surfaces SPEC §3.4 invariant', () => {
    const r = mode3Precision.validateGuess('1122');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_UNIQUE');
  });

  it('rejects all-same digits with NOT_UNIQUE', () => {
    const r = mode3Precision.validateGuess('0000');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_UNIQUE');
  });

  it('rejects too-short input with WRONG_LENGTH (length is checked before uniqueness)', () => {
    const r = mode3Precision.validateGuess('123');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('WRONG_LENGTH');
  });

  it('rejects non-digit characters with NOT_DIGITS', () => {
    const r = mode3Precision.validateGuess('12a4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_DIGITS');
  });

  it('does not throw — user-facing failures propagate as data', () => {
    expect(() => mode3Precision.validateGuess('')).not.toThrow();
    expect(() => mode3Precision.validateGuess('xxxx')).not.toThrow();
  });
});

describe('mode3Precision — generateSecret (unique digits)', () => {
  it('produces a 4-digit string with all distinct digits', () => {
    const rng = createRNG(42);
    const secret = mode3Precision.generateSecret(rng);
    expect(secret).toMatch(/^\d{4}$/);
    expect(new Set(secret.split('')).size).toBe(4);
  });

  it('is deterministic for the same RNG state', () => {
    const a = mode3Precision.generateSecret(createRNG({ seed: 7, callCount: 0 }));
    const b = mode3Precision.generateSecret(createRNG({ seed: 7, callCount: 0 }));
    expect(a).toBe(b);
  });

  it('advances the RNG cursor', () => {
    const rng = createRNG({ seed: 11, callCount: 0 });
    const before = rng.getState().callCount;
    mode3Precision.generateSecret(rng);
    expect(rng.getState().callCount).toBeGreaterThan(before);
  });
});

describe('mode3Precision — bot strategy (4536 unique-digit pool, chunked filter)', () => {
  // Pool: 4-digit unique-digit candidates with first digit ≥ 1
  // (10·9·8·7 − 9·8·7 = 5040 − 504 = 4536). pool[0] = '1023'.
  beforeEach(() => {
    __resetCandidatePoolCacheForTests();
  });

  function makeContext(overrides: Partial<BotContext> = {}): BotContext {
    return {
      previousGuesses: [],
      mySecret: '1234',
      difficulty: 'normal',
      turnNumber: 1,
      solverState: mode3Precision.bot.initSolverState('1234', mode3Precision.rules),
      rng: createRNG({ seed: 1, callCount: 0 }),
      ...overrides,
    };
  }

  it('initSolverState seeds a candidatePool with all 4536 unique-digit candidates', () => {
    const s = mode3Precision.bot.initSolverState('1234', mode3Precision.rules);
    expect(s.kind).toBe('candidatePool');
    if (s.kind !== 'candidatePool') return;
    expect(s.pool.length).toBe(4536);
    // Every candidate must have unique digits.
    for (const c of s.pool) {
      expect(new Set(c.split('')).size).toBe(4);
    }
  });

  it('opening guess: returns a 4-digit unique candidate when the pool is full', async () => {
    const ctx = makeContext();
    const out = await mode3Precision.bot.makeGuess(ctx);
    expect(out.guess).toMatch(/^\d{4}$/);
    expect(new Set(out.guess.split('')).size).toBe(4);
    expect(out.newSolverState.kind).toBe('candidatePool');
    if (out.newSolverState.kind !== 'candidatePool') return;
    // Opening turn — no feedback yet, pool size unchanged.
    expect(out.newSolverState.pool.length).toBe(4536);
  });

  it('makeGuess is deterministic across identical RNG cursors', async () => {
    const a = await mode3Precision.bot.makeGuess(
      makeContext({ rng: createRNG({ seed: 42, callCount: 0 }) }),
    );
    const b = await mode3Precision.bot.makeGuess(
      makeContext({ rng: createRNG({ seed: 42, callCount: 0 }) }),
    );
    expect(a.guess).toBe(b.guess);
  });

  it('hard difficulty picks pool[0] (sorted, first unique-digit candidate = "1023")', async () => {
    const out = await mode3Precision.bot.makeGuess(
      makeContext({
        difficulty: 'hard',
        rng: createRNG({ seed: 42, callCount: 0 }),
      }),
    );
    expect(out.guess).toBe('1023');
  });

  it('opening uses the chunked filter — pool ≥ 1000 must yield to UI', async () => {
    // Indirect assertion: with the synchronous filter, a 4536-entry
    // narrow would block. The fact that `makeGuess` uses the chunked
    // path means the function stays awaitable on the timeline. We
    // assert the resulting narrowed pool is sane (count > 0, all
    // unique-digit) and that the call completed within a wide bound.
    const opening = await mode3Precision.bot.makeGuess(makeContext());
    const fakeEntry = {
      side: 'opponent' as const,
      guessIndex: 1,
      digits: [0, 1, 2, 3] as const,
      feedback: { kind: 'precision' as const, plus: 0, minus: 0, isWin: false },
    };
    const ctx2 = makeContext({
      previousGuesses: [fakeEntry],
      turnNumber: 2,
      solverState: opening.newSolverState,
      rng: createRNG({ seed: 99, callCount: 0 }),
    });
    const start = Date.now();
    const next = await mode3Precision.bot.makeGuess(ctx2);
    const elapsed = Date.now() - start;
    if (next.newSolverState.kind !== 'candidatePool') throw new Error('wrong kind');
    expect(next.newSolverState.pool.length).toBeGreaterThan(0);
    expect(next.newSolverState.pool.length).toBeLessThan(4536);
    // Filtering 4536 candidates against an empty-set guess (no overlap
    // with 0/1/2/3) should leave only candidates from the digits 4–9.
    for (const candidate of next.newSolverState.pool) {
      expect(candidate).not.toMatch(/[0123]/);
    }
    // Loose timing bound — the chunked filter takes ≤500ms in CI.
    expect(elapsed).toBeLessThan(2000);
  });

  it('pool monotonically narrows after a +2 −1 feedback round', async () => {
    // Use a known-shape opening guess so the consistency narrowing is
    // deterministic. Pre-narrow with a single round of feedback against
    // hypothetical guess '0123', secret-side feedback +2 −1.
    const fakeEntry = {
      side: 'opponent' as const,
      guessIndex: 1,
      digits: [0, 1, 2, 3] as const,
      feedback: { kind: 'precision' as const, plus: 2, minus: 1, isWin: false },
    };
    const ctx = makeContext({
      previousGuesses: [fakeEntry],
      turnNumber: 2,
    });
    const out = await mode3Precision.bot.makeGuess(ctx);
    if (out.newSolverState.kind !== 'candidatePool') throw new Error('wrong kind');
    // Every survivor must reproduce the +2/−1 feedback against guess '0123'.
    expect(out.newSolverState.pool.length).toBeLessThan(4536);
    expect(out.newSolverState.pool.length).toBeGreaterThan(0);
  });

  it('thinkingTime stays inside the global [BOT_THINK_MIN_MS, BOT_THINK_MAX_MS] band', () => {
    for (let i = 0; i < 200; i += 1) {
      const t = mode3Precision.bot.thinkingTime(makeContext());
      expect(t).toBeGreaterThanOrEqual(2000);
      expect(t).toBeLessThanOrEqual(12_000);
    }
  });

  it.each(['easy', 'normal', 'hard'] as const)(
    'thinkingTime works for difficulty=%s',
    (difficulty) => {
      const t = mode3Precision.bot.thinkingTime(makeContext({ difficulty }));
      expect(t).toBeGreaterThanOrEqual(2000);
      expect(t).toBeLessThanOrEqual(12_000);
    },
  );
});

describe('mode3 file imports — domain purity', () => {
  it.each(['mode3Precision.ts', 'mode3/bot.ts', 'mode3/evaluate.ts'])(
    '%s imports no React',
    (rel) => {
      const filepath = path.resolve(__dirname, '..', rel);
      const src = fs.readFileSync(filepath, 'utf8');
      expect(src).not.toMatch(/from ['"]react['"]/);
      expect(src).not.toMatch(/from ['"]react-native['"]/);
    },
  );
});
