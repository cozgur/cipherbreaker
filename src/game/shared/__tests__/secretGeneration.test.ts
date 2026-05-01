import { createRNG } from '@/lib/random';

import { generateRandomDigits } from '../secretGeneration';

describe('generateRandomDigits', () => {
  it('produces a string of the requested length (non-unique)', () => {
    const rng = createRNG(11);
    const out = generateRandomDigits(4, false, rng);
    expect(out).toMatch(/^\d{4}$/);
  });

  it('produces all-distinct digits when unique=true', () => {
    const rng = createRNG(22);
    const out = generateRandomDigits(4, true, rng);
    expect(new Set(out).size).toBe(out.length);
  });

  it('is deterministic given the same seed', () => {
    const a = generateRandomDigits(4, false, createRNG(7));
    const b = generateRandomDigits(4, false, createRNG(7));
    expect(a).toBe(b);
  });

  it('rejects non-positive lengths', () => {
    expect(() => generateRandomDigits(0, false, createRNG(1))).toThrow(RangeError);
    expect(() => generateRandomDigits(-1, false, createRNG(1))).toThrow(RangeError);
    expect(() => generateRandomDigits(1.5, false, createRNG(1))).toThrow(RangeError);
  });

  it('rejects unique requests longer than the digit pool', () => {
    expect(() => generateRandomDigits(11, true, createRNG(1))).toThrow(RangeError);
  });

  // Phase 7A.4 CP1 — variable digit count infrastructure audit.
  // Daily Challenge ships at 4 / 5 / 6 digits; this sweep confirms
  // generateRandomDigits already honours any positive length (no
  // hidden 4-digit assumptions). Sweep extends to 8 to leave headroom
  // for any future Daily-tier expansion without re-auditing.
  describe('length-agnosticism — Daily Challenge infrastructure (3 → 8 digit sweep)', () => {
    it.each([3, 4, 5, 6, 7, 8])('produces a %i-digit string (non-unique pool)', (length) => {
      const out = generateRandomDigits(length, false, createRNG(length));
      expect(out).toHaveLength(length);
      expect(out).toMatch(/^[1-9]\d*$/); // SPEC §3 — first digit is 1-9
    });

    it.each([3, 4, 5, 6, 7, 8])(
      'produces a %i-digit all-distinct string (unique pool)',
      (length) => {
        const out = generateRandomDigits(length, true, createRNG(length * 7));
        expect(out).toHaveLength(length);
        expect(new Set(out).size).toBe(length);
        expect(out[0]).not.toBe('0');
      },
    );

    it.each([3, 4, 5, 6, 7, 8])(
      'is deterministic at length %i across two identical seeds',
      (length) => {
        const a = generateRandomDigits(length, false, createRNG(99));
        const b = generateRandomDigits(length, false, createRNG(99));
        expect(a).toBe(b);
      },
    );
  });
});
