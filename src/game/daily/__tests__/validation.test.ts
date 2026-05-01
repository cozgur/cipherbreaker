/**
 * Daily Challenge guess validation — Phase 7A.4 CP2 test-first suite.
 *
 * Two atomic rules: length match (variable per day's tier) and
 * digit-only content. NO uniqueness check — Daily allows multiset
 * (this is the cardinal Mode 3 vs Daily separation).
 */

import { validateDailyGuess } from '../validation';

describe('validateDailyGuess — length match across the 3 → 8 sweep', () => {
  it.each([3, 4, 5, 6, 7, 8])('accepts a %i-digit numeric guess at length %i', (length) => {
    const sample = '1'.repeat(length);
    const r = validateDailyGuess(sample, length);
    expect(r).toEqual({ ok: true });
  });

  it.each([3, 4, 5, 6, 7, 8])('rejects a too-short guess at length %i', (length) => {
    const sample = '1'.repeat(Math.max(1, length - 1));
    const r = validateDailyGuess(sample, length);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('WRONG_LENGTH');
  });

  it.each([3, 4, 5, 6, 7, 8])('rejects a too-long guess at length %i', (length) => {
    const sample = '1'.repeat(length + 1);
    const r = validateDailyGuess(sample, length);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('WRONG_LENGTH');
  });
});

describe('validateDailyGuess — digit-only content', () => {
  it('rejects letters even at the correct length', () => {
    const r = validateDailyGuess('12a4', 4);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_DIGITS');
  });

  it('rejects an empty string at any length', () => {
    const r = validateDailyGuess('', 4);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('WRONG_LENGTH');
  });

  it('rejects mixed-content (digits + symbols)', () => {
    const r = validateDailyGuess('12-4', 4);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_DIGITS');
  });
});

describe('validateDailyGuess — multiset is allowed (cardinal vs Mode 3)', () => {
  // The multi-digit-repeat strings below would FAIL Mode 3's unique
  // check. Daily must accept them because the Daily secret may
  // legitimately contain repeats.
  it.each(['1233', '1111', '0000', '1212', '5555'])(
    'accepts repeated digits in guess (%s) — multiset OK',
    (guess) => {
      const r = validateDailyGuess(guess, guess.length);
      expect(r).toEqual({ ok: true });
    },
  );

  it('accepts a leading-zero guess (the convention is a SECRET property, not a GUESS property)', () => {
    // Mirrors `validateGuess` permissiveness in Modes 1-7 (KI #4):
    // the player can type 0XXX as a guess; it just won't match a
    // secret since secrets cannot start with 0. Daily inherits the
    // same asymmetry — secret is strict, guess is permissive.
    const r = validateDailyGuess('0123', 4);
    expect(r).toEqual({ ok: true });
  });
});
