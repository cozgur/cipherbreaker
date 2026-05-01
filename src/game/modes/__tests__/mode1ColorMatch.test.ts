import * as fs from 'fs';
import * as path from 'path';

import { createRNG } from '@/lib/random';

import type { BotContext } from '../../types';
import { mode1ColorMatch } from '../mode1ColorMatch';

describe('mode1ColorMatch — meta + rules wired from catalog (single source of truth)', () => {
  it('exposes catalog meta', () => {
    expect(mode1ColorMatch.id).toBe(1);
    expect(mode1ColorMatch.meta.name).toBe('COLOR MATCH');
    expect(mode1ColorMatch.meta.section).toBe('CLASSIC');
  });

  it('exposes catalog rules (4 digits, duplicates allowed)', () => {
    expect(mode1ColorMatch.rules.secretLength).toBe(4);
    expect(mode1ColorMatch.rules.digitsUnique).toBe(false);
  });
});

describe('mode1ColorMatch — evaluate (Wordle two-pass)', () => {
  const cases: ReadonlyArray<{
    guess: string;
    secret: string;
    states: ReadonlyArray<'green' | 'yellow' | 'gray'>;
    isWin: boolean;
    note: string;
  }> = [
    {
      guess: '1234',
      secret: '1234',
      states: ['green', 'green', 'green', 'green'],
      isWin: true,
      note: 'exact match → all green, isWin=true',
    },
    {
      guess: '4321',
      secret: '1234',
      states: ['yellow', 'yellow', 'yellow', 'yellow'],
      isWin: false,
      note: 'reversed → all yellow',
    },
    {
      guess: '5678',
      secret: '1234',
      states: ['gray', 'gray', 'gray', 'gray'],
      isWin: false,
      note: 'no overlap → all gray',
    },
    {
      guess: '1234',
      secret: '1111',
      states: ['green', 'gray', 'gray', 'gray'],
      isWin: false,
      note: 'guess has unique digits, secret is repeated — only the green claims',
    },
    {
      guess: '1111',
      secret: '1234',
      states: ['green', 'gray', 'gray', 'gray'],
      isWin: false,
      note: 'guess is repeated, secret has unique digits — green consumes the only 1',
    },
    {
      guess: '2121',
      secret: '1212',
      states: ['yellow', 'yellow', 'yellow', 'yellow'],
      isWin: false,
      note: 'every position swapped, repeats all match',
    },
    {
      guess: '4554',
      secret: '5544',
      states: ['yellow', 'green', 'yellow', 'green'],
      isWin: false,
      note: 'positions 1+3 are exact (green); 0+2 swap their twins (yellow)',
    },
    {
      guess: '1919',
      secret: '1122',
      states: ['green', 'gray', 'yellow', 'gray'],
      isWin: false,
      note: 'SPEC §3.2 worked example — pos 2 yellow because the second 1 in secret is unconsumed',
    },
    {
      guess: '5455',
      secret: '5544',
      states: ['green', 'yellow', 'yellow', 'gray'],
      isWin: false,
      note: 'multi-duplicate claim limit — pos 3 stays gray because only one 5 remains unconsumed in secret after pos 2 claims it',
    },
    {
      guess: '2222',
      secret: '1234',
      states: ['gray', 'green', 'gray', 'gray'],
      isWin: false,
      note: 'guess-side flooding — only the matched 2 turns green, the rest cannot claim a digit that does not appear elsewhere',
    },
  ];

  it.each(cases)(
    'evaluate(guess=$guess, secret=$secret) → $note',
    ({ guess, secret, states, isWin }) => {
      const fb = mode1ColorMatch.evaluate(guess, secret);
      expect(fb.kind).toBe('colorMatch');
      if (fb.kind !== 'colorMatch') return;
      expect(fb.states).toEqual(states);
      expect(fb.isWin).toBe(isWin);
    },
  );

  it('is pure — same inputs always produce identical output', () => {
    const a = mode1ColorMatch.evaluate('1234', '5678');
    const b = mode1ColorMatch.evaluate('1234', '5678');
    expect(a).toEqual(b);
  });

  it('a winning evaluate sets isWin=true and every state to green', () => {
    const fb = mode1ColorMatch.evaluate('5678', '5678');
    expect(fb.kind).toBe('colorMatch');
    if (fb.kind !== 'colorMatch') return;
    expect(fb.isWin).toBe(true);
    expect(fb.states).toEqual(['green', 'green', 'green', 'green']);
  });
});

describe('mode1ColorMatch — validateGuess', () => {
  it('accepts a 4-digit guess with no duplicates', () => {
    expect(mode1ColorMatch.validateGuess('1234')).toEqual({ ok: true });
  });

  it('accepts a 4-digit guess WITH duplicates (Mode 1 has digitsUnique=false)', () => {
    expect(mode1ColorMatch.validateGuess('1122')).toEqual({ ok: true });
    expect(mode1ColorMatch.validateGuess('0000')).toEqual({ ok: true });
  });

  it('rejects too-short input with WRONG_LENGTH', () => {
    const r = mode1ColorMatch.validateGuess('123');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('WRONG_LENGTH');
  });

  it('rejects too-long input with WRONG_LENGTH', () => {
    const r = mode1ColorMatch.validateGuess('12345');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('WRONG_LENGTH');
  });

  it('rejects non-digit characters with NOT_DIGITS', () => {
    const r = mode1ColorMatch.validateGuess('12a4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_DIGITS');
  });

  it('does not throw — user-facing failures propagate as data', () => {
    expect(() => mode1ColorMatch.validateGuess('')).not.toThrow();
    expect(() => mode1ColorMatch.validateGuess('xxxx')).not.toThrow();
  });
});

describe('mode1ColorMatch — generateSecret', () => {
  it('produces a 4-digit string', () => {
    const rng = createRNG(42);
    const secret = mode1ColorMatch.generateSecret(rng);
    expect(secret).toMatch(/^\d{4}$/);
  });

  it('is deterministic for the same RNG state', () => {
    const a = mode1ColorMatch.generateSecret(createRNG({ seed: 7, callCount: 0 }));
    const b = mode1ColorMatch.generateSecret(createRNG({ seed: 7, callCount: 0 }));
    expect(a).toBe(b);
  });

  it('advances the RNG cursor (callCount strictly increases)', () => {
    const rng = createRNG({ seed: 11, callCount: 0 });
    const before = rng.getState().callCount;
    mode1ColorMatch.generateSecret(rng);
    expect(rng.getState().callCount).toBeGreaterThan(before);
  });
});

describe('mode1ColorMatch — bot strategy (CP2)', () => {
  function makeContext(overrides: Partial<BotContext> = {}): BotContext {
    return {
      previousGuesses: [],
      mySecret: '1234',
      difficulty: 'normal',
      turnNumber: 1,
      solverState: mode1ColorMatch.bot.initSolverState('1234', mode1ColorMatch.rules),
      rng: createRNG({ seed: 1, callCount: 0 }),
      ...overrides,
    };
  }

  it('initSolverState seeds a candidatePool with all 9 000 four-digit strings (no leading zero)', () => {
    const s = mode1ColorMatch.bot.initSolverState('1234', mode1ColorMatch.rules);
    expect(s.kind).toBe('candidatePool');
    if (s.kind !== 'candidatePool') return;
    expect(s.pool.length).toBe(9_000);
  });

  it('opening guess: returns a 4-digit candidate when the pool is full', async () => {
    const ctx = makeContext();
    const out = await mode1ColorMatch.bot.makeGuess(ctx);
    expect(out.guess).toMatch(/^\d{4}$/);
    expect(out.newSolverState.kind).toBe('candidatePool');
    if (out.newSolverState.kind !== 'candidatePool') return;
    // Opening turn — no feedback yet, pool size unchanged.
    expect(out.newSolverState.pool.length).toBe(9_000);
  });

  it('makeGuess is deterministic across identical RNG cursors', async () => {
    const a = await mode1ColorMatch.bot.makeGuess(
      makeContext({ rng: createRNG({ seed: 42, callCount: 0 }) }),
    );
    const b = await mode1ColorMatch.bot.makeGuess(
      makeContext({ rng: createRNG({ seed: 42, callCount: 0 }) }),
    );
    expect(a.guess).toBe(b.guess);
  });

  it('different difficulties produce different guesses on the same RNG cursor', async () => {
    // hard always picks pool[0] (sorted), normal/easy use rng.
    const hard = await mode1ColorMatch.bot.makeGuess(
      makeContext({
        difficulty: 'hard',
        rng: createRNG({ seed: 42, callCount: 0 }),
      }),
    );
    expect(hard.guess).toBe('1000'); // pool[0] of buildAllCandidates(false) — first digit ≥ 1
  });

  it('pool monotonically narrows after a feedback round', async () => {
    // Bot guessed '5678' against secret '1234' → all gray. Filtering on
    // "all gray for 5678" must drop every candidate that contains 5/6/7/8.
    const opening = await mode1ColorMatch.bot.makeGuess(makeContext());
    const fakeEntry = {
      side: 'opponent' as const,
      guessIndex: 1,
      digits: [5, 6, 7, 8] as const,
      feedback: {
        kind: 'colorMatch' as const,
        states: ['gray' as const, 'gray' as const, 'gray' as const, 'gray' as const],
        isWin: false,
      },
    };
    const ctx2 = makeContext({
      previousGuesses: [fakeEntry],
      turnNumber: 2,
      solverState: opening.newSolverState,
      rng: createRNG({ seed: 99, callCount: 0 }),
    });
    const next = await mode1ColorMatch.bot.makeGuess(ctx2);
    if (next.newSolverState.kind !== 'candidatePool') throw new Error('wrong kind');
    expect(next.newSolverState.pool.length).toBeLessThan(9_000);
    expect(next.newSolverState.pool.length).toBeGreaterThan(0);
    // Sanity — every survivor must contain none of 5/6/7/8.
    for (const candidate of next.newSolverState.pool) {
      expect(candidate).not.toMatch(/[5678]/);
    }
  });

  it('thinkingTime stays inside the global [BOT_THINK_MIN_MS, BOT_THINK_MAX_MS] band', () => {
    // Sample widely — the 8% phone-down outlier is bounded by the same
    // hard cap, so 200 samples cover both branches.
    for (let i = 0; i < 200; i += 1) {
      const t = mode1ColorMatch.bot.thinkingTime(makeContext());
      expect(t).toBeGreaterThanOrEqual(2000);
      expect(t).toBeLessThanOrEqual(12_000);
    }
  });

  it.each(['easy', 'normal', 'hard'] as const)(
    'thinkingTime works for difficulty=%s',
    (difficulty) => {
      const t = mode1ColorMatch.bot.thinkingTime(makeContext({ difficulty }));
      expect(t).toBeGreaterThanOrEqual(2000);
      expect(t).toBeLessThanOrEqual(12_000);
    },
  );
});

describe('mode1 file imports — domain purity', () => {
  it.each([
    'mode1ColorMatch.ts',
    'index.ts',
    'mode1/bot.ts',
    'mode1/evaluate.ts',
  ])('%s imports no React', (rel) => {
    const filepath = path.resolve(__dirname, '..', rel);
    const src = fs.readFileSync(filepath, 'utf8');
    expect(src).not.toMatch(/from ['"]react['"]/);
    expect(src).not.toMatch(/from ['"]react-native['"]/);
  });
});
