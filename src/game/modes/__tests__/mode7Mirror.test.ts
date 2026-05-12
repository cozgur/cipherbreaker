import * as fs from 'fs';
import * as path from 'path';

import { createRNG } from '@/lib/random';

import type { BotContext } from '../../types';
import { mode1ColorMatch } from '../mode1ColorMatch';
import { mode7Mirror } from '../mode7Mirror';

describe('mode7Mirror — meta + rules wired from catalog (single source of truth)', () => {
  it('exposes catalog meta', () => {
    expect(mode7Mirror.id).toBe(7);
    expect(mode7Mirror.meta.name).toBe('MIRROR');
    expect(mode7Mirror.meta.section).toBe('ADVANCED');
  });

  it('exposes catalog rules — parallelRace + sharedSecret, duplicates allowed, no budget', () => {
    expect(mode7Mirror.rules.secretLength).toBe(4);
    expect(mode7Mirror.rules.digitsUnique).toBe(false);
    expect(mode7Mirror.rules.maxGuessesPerPlayer).toBeUndefined();
    expect(mode7Mirror.rules.flags.parallelRace).toBe(true);
    expect(mode7Mirror.rules.flags.sharedSecret).toBe(true);
  });
});

describe('mode7Mirror — evaluator identity with Mode 1 ColorMatch (Wordle two-pass)', () => {
  it('produces colorMatch feedback', () => {
    const fb = mode7Mirror.evaluate('1234', '1244');
    expect(fb.kind).toBe('colorMatch');
  });

  it('isWin=true on exact match', () => {
    const fb = mode7Mirror.evaluate('5678', '5678');
    expect(fb.kind).toBe('colorMatch');
    if (fb.kind !== 'colorMatch') return;
    expect(fb.isWin).toBe(true);
  });

  it('SPEC §3.2 worked example (1919 vs 1122) — proves identity with Mode 1 evaluator', () => {
    const fb = mode7Mirror.evaluate('1919', '1122');
    expect(fb.kind).toBe('colorMatch');
    if (fb.kind !== 'colorMatch') return;
    expect(fb.states).toEqual(['green', 'gray', 'yellow', 'gray']);
  });

  it('byte-equal output to Mode 1 across a digit-string sweep (re-export sanity)', () => {
    const samples = ['0000', '1234', '4321', '1122', '9999', '8765', '0123', '9876'];
    for (const guess of samples) {
      for (const secret of samples) {
        expect(mode7Mirror.evaluate(guess, secret)).toEqual(
          mode1ColorMatch.evaluate(guess, secret),
        );
      }
    }
  });
});

describe('mode7Mirror — validateGuess (Mode 1 chain — duplicates allowed)', () => {
  it('accepts 4-digit input with duplicates', () => {
    expect(mode7Mirror.validateGuess('1122')).toEqual({ ok: true });
  });

  it('accepts 4-digit input with no duplicates', () => {
    expect(mode7Mirror.validateGuess('1234')).toEqual({ ok: true });
  });

  it('rejects too-short input with WRONG_LENGTH', () => {
    const r = mode7Mirror.validateGuess('123');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('WRONG_LENGTH');
  });

  it('rejects too-long input with WRONG_LENGTH', () => {
    const r = mode7Mirror.validateGuess('12345');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('WRONG_LENGTH');
  });

  it('rejects non-digit input with NOT_DIGITS', () => {
    const r = mode7Mirror.validateGuess('12a4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_DIGITS');
  });
});

describe('mode7Mirror — generateSecret', () => {
  it('produces a 4-digit string (duplicates allowed)', () => {
    const rng = createRNG(42);
    expect(mode7Mirror.generateSecret(rng)).toMatch(/^\d{4}$/);
  });

  it('is deterministic across identical RNG cursors', () => {
    const a = mode7Mirror.generateSecret(createRNG({ seed: 7, callCount: 0 }));
    const b = mode7Mirror.generateSecret(createRNG({ seed: 7, callCount: 0 }));
    expect(a).toBe(b);
  });
});

describe('mode7Mirror — bot strategy re-uses Mode 1 (9K candidatePool)', () => {
  function makeContext(overrides: Partial<BotContext> = {}): BotContext {
    return {
      previousGuesses: [],
      mySecret: '1234',
      difficulty: 'normal',
      turnNumber: 1,
      solverState: mode7Mirror.bot.initSolverState('1234', mode7Mirror.rules),
      rng: createRNG({ seed: 1, callCount: 0 }),
      ...overrides,
    };
  }

  it('initSolverState seeds a candidatePool of 9 000 (duplicates allowed, no leading zero)', () => {
    const s = mode7Mirror.bot.initSolverState('1234', mode7Mirror.rules);
    expect(s.kind).toBe('candidatePool');
    if (s.kind !== 'candidatePool') return;
    expect(s.pool.length).toBe(9_000);
  });

  it('hard difficulty picks pool[0] = "1000"', async () => {
    const out = await mode7Mirror.bot.makeGuess(
      makeContext({ difficulty: 'hard' }),
    );
    expect(out.guess).toBe('1000');
  });

  it('makeGuess deterministic across identical RNG cursors', async () => {
    const a = await mode7Mirror.bot.makeGuess(
      makeContext({ rng: createRNG({ seed: 42, callCount: 0 }) }),
    );
    const b = await mode7Mirror.bot.makeGuess(
      makeContext({ rng: createRNG({ seed: 42, callCount: 0 }) }),
    );
    expect(a.guess).toBe(b.guess);
  });

  it('makeGuess output identical to Mode 1 under the same context (bot re-export sanity)', async () => {
    const ctxArgs = {
      previousGuesses: [],
      mySecret: '1234',
      difficulty: 'normal' as const,
      turnNumber: 1,
      rng: createRNG({ seed: 99, callCount: 0 }),
    };
    const mirrorOut = await mode7Mirror.bot.makeGuess({
      ...ctxArgs,
      solverState: mode7Mirror.bot.initSolverState('1234', mode7Mirror.rules),
      rng: createRNG({ seed: 99, callCount: 0 }),
    });
    const mode1Out = await mode1ColorMatch.bot.makeGuess({
      ...ctxArgs,
      solverState: mode1ColorMatch.bot.initSolverState('1234', mode1ColorMatch.rules),
      rng: createRNG({ seed: 99, callCount: 0 }),
    });
    expect(mirrorOut.guess).toBe(mode1Out.guess);
  });

  it('thinkingTime stays inside Mode 7\'s tighter [2500, 8000] band (CP8 item 3)', () => {
    // Phase 7A.7 CP8 (item 3): Mode 7 ships a tighter band than the
    // global [2000, 12_000] inherited from Mode 1. The race-tension
    // deliverable raises the floor to 2.5s (humanlike minimum,
    // user-fairness on hard) and lowers the ceiling to 8s (removes
    // the 12s dead spots). The sweep below — 200 iterations covers
    // both warmup and post-warmup paths and the (now-removed) 8%
    // outlier branch — confirms NO single value escapes the band.
    for (let i = 0; i < 200; i += 1) {
      const t = mode7Mirror.bot.thinkingTime(makeContext());
      expect(t).toBeGreaterThanOrEqual(2500);
      expect(t).toBeLessThanOrEqual(8000);
    }
  });

  it('thinkingTime NEVER produces Mode 1\'s 8% phone-down outlier (>=12s) — CP8 item 3 regression guard', () => {
    // Mode 1's `thinkingTime` adds 5-10s to the chosen delay on 8% of
    // calls, capped at 12s. That branch was deliberately dropped for
    // Mode 7. With 1000 samples per difficulty + multiple turn
    // numbers, the binomial probability of NOT catching it if still
    // present is negligible (< 1e-30).
    const difficulties = ['easy', 'normal', 'hard'] as const;
    for (const difficulty of difficulties) {
      for (let i = 0; i < 1000; i += 1) {
        const t = mode7Mirror.bot.thinkingTime(makeContext({ difficulty, turnNumber: i % 10 }));
        expect(t).toBeLessThan(8001);
      }
    }
  });

  it('hard difficulty stays at or above the 2.5s humanlike floor (no instant-guess unfairness)', () => {
    // Hard's band is [0.0, 0.4] of the span, post-warmup ×0.8 on the
    // high end. Math: low = 2500 + 5500*0.0 = 2500; high (warmup) =
    // 2500 + 5500*0.4*0.8 = 4260. Anything below 2500 is a bug.
    for (let i = 0; i < 500; i += 1) {
      const t = mode7Mirror.bot.thinkingTime(makeContext({ difficulty: 'hard', turnNumber: 10 }));
      expect(t).toBeGreaterThanOrEqual(2500);
    }
  });

  it('DDA-pace skew preserved within the new band — easy slower than hard on average', () => {
    // The whole point of the CP8 narrowing is "tighten without
    // flattening DDA": easy must still feel slower than hard, just
    // not 12s-slow. Average over 500 samples per difficulty; the
    // mean is monotonically decreasing easy → normal → hard.
    function meanOver(difficulty: 'easy' | 'normal' | 'hard', samples: number): number {
      let total = 0;
      for (let i = 0; i < samples; i += 1) {
        total += mode7Mirror.bot.thinkingTime(makeContext({ difficulty, turnNumber: 5 }));
      }
      return total / samples;
    }
    const easyMean = meanOver('easy', 500);
    const normalMean = meanOver('normal', 500);
    const hardMean = meanOver('hard', 500);
    expect(easyMean).toBeGreaterThan(normalMean);
    expect(normalMean).toBeGreaterThan(hardMean);
  });
});

describe('mode7 file imports — domain purity', () => {
  it('mode7Mirror.ts imports no React', () => {
    const filepath = path.resolve(__dirname, '..', 'mode7Mirror.ts');
    const src = fs.readFileSync(filepath, 'utf8');
    expect(src).not.toMatch(/from ['"]react['"]/);
    expect(src).not.toMatch(/from ['"]react-native['"]/);
  });
});
