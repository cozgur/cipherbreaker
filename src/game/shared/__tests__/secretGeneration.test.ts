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
});
