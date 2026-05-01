import * as fs from 'fs';
import * as path from 'path';

import { createRNG } from '@/lib/random';

import type { BotContext } from '../../types';
import { mode4Blitz } from '../mode4Blitz';

describe('mode4Blitz — meta + rules wired from catalog (single source of truth)', () => {
  it('exposes catalog meta', () => {
    expect(mode4Blitz.id).toBe(4);
    expect(mode4Blitz.meta.name).toBe('BLITZ');
    expect(mode4Blitz.meta.section).toBe('ADVANCED');
  });

  it('exposes catalog rules — 60s clock per player, perPlayerClock flag', () => {
    expect(mode4Blitz.rules.secretLength).toBe(4);
    expect(mode4Blitz.rules.digitsUnique).toBe(false);
    expect(mode4Blitz.rules.perPlayerTimeLimitMs).toBe(60_000);
    expect(mode4Blitz.rules.flags.perPlayerClock).toBe(true);
  });
});

describe('mode4Blitz — evaluator re-uses Mode 1 ColorMatch (Wordle two-pass)', () => {
  it('produces colorMatch feedback', () => {
    const fb = mode4Blitz.evaluate('1234', '1244');
    expect(fb.kind).toBe('colorMatch');
  });

  it('isWin=true on exact match', () => {
    const fb = mode4Blitz.evaluate('5678', '5678');
    expect(fb.kind).toBe('colorMatch');
    if (fb.kind !== 'colorMatch') return;
    expect(fb.isWin).toBe(true);
  });

  it('SPEC §3.2 worked example (1919 vs 1122) — proves identity with Mode 1 evaluator', () => {
    const fb = mode4Blitz.evaluate('1919', '1122');
    expect(fb.kind).toBe('colorMatch');
    if (fb.kind !== 'colorMatch') return;
    expect(fb.states).toEqual(['green', 'gray', 'yellow', 'gray']);
  });
});

describe('mode4Blitz — validateGuess (Mode 1 chain — duplicates allowed)', () => {
  it('accepts 4-digit input with duplicates', () => {
    expect(mode4Blitz.validateGuess('1122')).toEqual({ ok: true });
  });

  it('rejects too-short input with WRONG_LENGTH', () => {
    const r = mode4Blitz.validateGuess('123');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('WRONG_LENGTH');
  });

  it('rejects non-digit input with NOT_DIGITS', () => {
    const r = mode4Blitz.validateGuess('12a4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_DIGITS');
  });
});

describe('mode4Blitz — generateSecret', () => {
  it('produces a 4-digit string (duplicates allowed)', () => {
    const rng = createRNG(42);
    expect(mode4Blitz.generateSecret(rng)).toMatch(/^\d{4}$/);
  });

  it('is deterministic across identical RNG cursors', () => {
    const a = mode4Blitz.generateSecret(createRNG({ seed: 7, callCount: 0 }));
    const b = mode4Blitz.generateSecret(createRNG({ seed: 7, callCount: 0 }));
    expect(a).toBe(b);
  });
});

describe('mode4Blitz — bot strategy re-uses Mode 1 (9K candidatePool, clock-naïve)', () => {
  function makeContext(overrides: Partial<BotContext> = {}): BotContext {
    return {
      previousGuesses: [],
      mySecret: '1234',
      difficulty: 'normal',
      turnNumber: 1,
      solverState: mode4Blitz.bot.initSolverState('1234', mode4Blitz.rules),
      rng: createRNG({ seed: 1, callCount: 0 }),
      ...overrides,
    };
  }

  it('initSolverState seeds a candidatePool of 9 000 (duplicates allowed, no leading zero)', () => {
    const s = mode4Blitz.bot.initSolverState('1234', mode4Blitz.rules);
    expect(s.kind).toBe('candidatePool');
    if (s.kind !== 'candidatePool') return;
    expect(s.pool.length).toBe(9_000);
  });

  it('hard difficulty picks pool[0] = "1000"', async () => {
    const out = await mode4Blitz.bot.makeGuess(
      makeContext({ difficulty: 'hard' }),
    );
    expect(out.guess).toBe('1000');
  });

  it('makeGuess deterministic across identical RNG cursors', async () => {
    const a = await mode4Blitz.bot.makeGuess(
      makeContext({ rng: createRNG({ seed: 42, callCount: 0 }) }),
    );
    const b = await mode4Blitz.bot.makeGuess(
      makeContext({ rng: createRNG({ seed: 42, callCount: 0 }) }),
    );
    expect(a.guess).toBe(b.guess);
  });

  it('thinkingTime stays inside the global [BOT_THINK_MIN_MS, BOT_THINK_MAX_MS] band — clock-naïve, no panic mode at Phase 5', () => {
    // SPEC §3.6 calls for a clock-aware "panic mode" (faster guesses
    // when remaining time < 10s); Phase 5 deliberately ships the
    // default Mode 1 band (deferred to Phase 7A). The same band that
    // works for non-Blitz modes works here — this test pins that
    // intent so a future eager-optimisation PR doesn't quietly couple
    // bot timing to clock state without a roadmap entry.
    for (let i = 0; i < 100; i += 1) {
      const t = mode4Blitz.bot.thinkingTime(makeContext());
      expect(t).toBeGreaterThanOrEqual(2000);
      expect(t).toBeLessThanOrEqual(12_000);
    }
  });
});

describe('mode4 file imports — domain purity', () => {
  it('mode4Blitz.ts imports no React', () => {
    const filepath = path.resolve(__dirname, '..', 'mode4Blitz.ts');
    const src = fs.readFileSync(filepath, 'utf8');
    expect(src).not.toMatch(/from ['"]react['"]/);
    expect(src).not.toMatch(/from ['"]react-native['"]/);
  });
});
