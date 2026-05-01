import * as fs from 'fs';
import * as path from 'path';

import { createRNG } from '@/lib/random';

import { __resetCandidatePoolCacheForTests } from '../../shared/candidatePool';
import type { BotContext } from '../../types';
import { mode5Blackout } from '../mode5Blackout';

describe('mode5Blackout — meta + rules wired from catalog (single source of truth)', () => {
  it('exposes catalog meta', () => {
    expect(mode5Blackout.id).toBe(5);
    expect(mode5Blackout.meta.name).toBe('BLACKOUT');
    expect(mode5Blackout.meta.section).toBe('ADVANCED');
    expect(mode5Blackout.meta.stake).toBe(100);
    expect(mode5Blackout.meta.rewardWin).toBe(250);
  });

  it('exposes catalog rules — Phase 5 flipped digitsUnique to true', () => {
    expect(mode5Blackout.rules.secretLength).toBe(4);
    expect(mode5Blackout.rules.digitsUnique).toBe(true);
    expect(mode5Blackout.rules.flags.blackoutReveal).toBe(true);
  });
});

describe('mode5Blackout — evaluate (SPEC §3.7 count-only feedback, no positional leak)', () => {
  const cases: ReadonlyArray<{
    guess: string;
    secret: string;
    locked: number;
    isWin: boolean;
    note: string;
  }> = [
    { guess: '1234', secret: '1234', locked: 4, isWin: true, note: 'exact match → 4 / win' },
    // SPEC §3.7's worked example claims `3249` vs `3847` → "1 LOCKED",
    // but pos 0 (3=3) AND pos 2 (4=4) both match — actual is 2. The
    // SPEC text has an arithmetic typo; the rule is correctly stated.
    { guess: '3249', secret: '3847', locked: 2, isWin: false, note: 'SPEC §3.7 example, recomputed (SPEC text says 1, real count is 2)' },
    { guess: '3849', secret: '3847', locked: 3, isWin: false, note: 'first three positions lock' },
    { guess: '5678', secret: '1234', locked: 0, isWin: false, note: 'no overlap → 0' },
    { guess: '4321', secret: '1234', locked: 0, isWin: false, note: 'reversed → 0 (no locked positions)' },
    { guess: '1239', secret: '1234', locked: 3, isWin: false, note: 'three positions lock' },
    { guess: '0234', secret: '1234', locked: 3, isWin: false, note: 'first slot mismatched, three lock' },
  ];

  it.each(cases)(
    'evaluate(guess=$guess, secret=$secret) → $note',
    ({ guess, secret, locked, isWin }) => {
      const fb = mode5Blackout.evaluate(guess, secret);
      expect(fb.kind).toBe('blackout');
      if (fb.kind !== 'blackout') return;
      expect(fb.locked).toBe(locked);
      expect(fb.isWin).toBe(isWin);
    },
  );

  it('SPEC §3.7 — states are ALL "blackout" so the row component never leaks per-position info', () => {
    const fb = mode5Blackout.evaluate('1239', '1234');
    expect(fb.kind).toBe('blackout');
    if (fb.kind !== 'blackout') return;
    expect(fb.states).toEqual(['blackout', 'blackout', 'blackout', 'blackout']);
  });

  it('is pure — same inputs always produce identical output', () => {
    const a = mode5Blackout.evaluate('1234', '5678');
    const b = mode5Blackout.evaluate('1234', '5678');
    expect(a).toEqual(b);
  });
});

describe('mode5Blackout — validateGuess (Mode 3-style unique chain)', () => {
  it('accepts a 4-digit unique guess', () => {
    expect(mode5Blackout.validateGuess('1234')).toEqual({ ok: true });
  });

  it('rejects repeats with NOT_UNIQUE — surfaces SPEC §3.7 invariant', () => {
    const r = mode5Blackout.validateGuess('1122');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_UNIQUE');
  });

  it('rejects too-short input with WRONG_LENGTH', () => {
    const r = mode5Blackout.validateGuess('123');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('WRONG_LENGTH');
  });

  it('rejects non-digit input with NOT_DIGITS', () => {
    const r = mode5Blackout.validateGuess('12a4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_DIGITS');
  });
});

describe('mode5Blackout — generateSecret (unique digits)', () => {
  it('produces a 4-digit string with all distinct digits', () => {
    const rng = createRNG(42);
    const secret = mode5Blackout.generateSecret(rng);
    expect(secret).toMatch(/^\d{4}$/);
    expect(new Set(secret.split('')).size).toBe(4);
  });

  it('is deterministic for the same RNG state', () => {
    const a = mode5Blackout.generateSecret(createRNG({ seed: 7, callCount: 0 }));
    const b = mode5Blackout.generateSecret(createRNG({ seed: 7, callCount: 0 }));
    expect(a).toBe(b);
  });
});

describe('mode5Blackout — bot strategy (4536 unique pool, chunked filter mandatory)', () => {
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
      solverState: mode5Blackout.bot.initSolverState('1234', mode5Blackout.rules),
      rng: createRNG({ seed: 1, callCount: 0 }),
      ...overrides,
    };
  }

  it('initSolverState seeds a candidatePool of all 4536 unique-digit candidates', () => {
    const s = mode5Blackout.bot.initSolverState('1234', mode5Blackout.rules);
    expect(s.kind).toBe('candidatePool');
    if (s.kind !== 'candidatePool') return;
    expect(s.pool.length).toBe(4536);
    for (const c of s.pool) {
      expect(new Set(c.split('')).size).toBe(4);
    }
  });

  it('opening guess: returns a unique-digit candidate from the full pool', async () => {
    const out = await mode5Blackout.bot.makeGuess(makeContext());
    expect(out.guess).toMatch(/^\d{4}$/);
    expect(new Set(out.guess.split('')).size).toBe(4);
    if (out.newSolverState.kind !== 'candidatePool') return;
    expect(out.newSolverState.pool.length).toBe(4536);
  });

  it('hard difficulty picks pool[0] = "1023" (sorted, first unique-digit ≥ 1)', async () => {
    const out = await mode5Blackout.bot.makeGuess(
      makeContext({ difficulty: 'hard' }),
    );
    expect(out.guess).toBe('1023');
  });

  it('makeGuess deterministic across identical RNG cursors', async () => {
    const a = await mode5Blackout.bot.makeGuess(
      makeContext({ rng: createRNG({ seed: 42, callCount: 0 }) }),
    );
    const b = await mode5Blackout.bot.makeGuess(
      makeContext({ rng: createRNG({ seed: 42, callCount: 0 }) }),
    );
    expect(a.guess).toBe(b.guess);
  });

  it('opening narrow runs through chunked filter — pool ≥ 1000 invariant', async () => {
    // The chunked path is what keeps the UI thread alive while the
    // bot crunches its first feedback round. We assert the call
    // completes within a generous timing bound and that the narrowed
    // pool obeys the locked-count constraint.
    const opening = await mode5Blackout.bot.makeGuess(makeContext());
    const fakeEntry = {
      side: 'opponent' as const,
      guessIndex: 1,
      digits: [0, 1, 2, 3] as const,
      feedback: {
        kind: 'blackout' as const,
        states: ['blackout', 'blackout', 'blackout', 'blackout'] as const,
        locked: 1,
        isWin: false,
      },
    };
    const ctx2 = makeContext({
      previousGuesses: [fakeEntry],
      turnNumber: 2,
      solverState: opening.newSolverState,
      rng: createRNG({ seed: 99, callCount: 0 }),
    });
    const start = Date.now();
    const next = await mode5Blackout.bot.makeGuess(ctx2);
    const elapsed = Date.now() - start;
    if (next.newSolverState.kind !== 'candidatePool') throw new Error('wrong kind');
    expect(next.newSolverState.pool.length).toBeGreaterThan(0);
    expect(next.newSolverState.pool.length).toBeLessThan(4536);
    // Every survivor reproduces the exact "1 locked" count against '0123'.
    for (const candidate of next.newSolverState.pool) {
      let locked = 0;
      for (let i = 0; i < 4; i += 1) {
        if (candidate[i] === '0123'[i]) locked += 1;
      }
      expect(locked).toBe(1);
    }
    expect(elapsed).toBeLessThan(2000);
  });

  it('thinkingTime stays inside the global [BOT_THINK_MIN_MS, BOT_THINK_MAX_MS] band', () => {
    for (let i = 0; i < 100; i += 1) {
      const t = mode5Blackout.bot.thinkingTime(makeContext());
      expect(t).toBeGreaterThanOrEqual(2000);
      expect(t).toBeLessThanOrEqual(12_000);
    }
  });
});

describe('mode5 file imports — domain purity', () => {
  it.each(['mode5Blackout.ts', 'mode5/bot.ts', 'mode5/evaluate.ts'])(
    '%s imports no React',
    (rel) => {
      const filepath = path.resolve(__dirname, '..', rel);
      const src = fs.readFileSync(filepath, 'utf8');
      expect(src).not.toMatch(/from ['"]react['"]/);
      expect(src).not.toMatch(/from ['"]react-native['"]/);
    },
  );
});
