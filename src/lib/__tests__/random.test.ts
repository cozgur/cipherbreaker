import { createRNG } from '../random';

describe('createRNG (mulberry32)', () => {
  it('produces a deterministic sequence from a numeric seed', () => {
    const a = createRNG(42);
    const b = createRNG(42);
    for (let i = 0; i < 10; i += 1) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('different seeds diverge', () => {
    const a = createRNG(42);
    const b = createRNG(43);
    const sa = [a.next(), a.next(), a.next()];
    const sb = [b.next(), b.next(), b.next()];
    expect(sa).not.toEqual(sb);
  });

  it('next() advances callCount on every draw', () => {
    const rng = createRNG(7);
    expect(rng.getState()).toEqual({ seed: 7, callCount: 0 });
    rng.next();
    expect(rng.getState().callCount).toBe(1);
    rng.next();
    rng.next();
    expect(rng.getState().callCount).toBe(3);
  });

  it('serialize/deserialize round-trip continues from the same cursor', () => {
    const a = createRNG(99);
    const burn = [a.next(), a.next(), a.next(), a.next(), a.next()];
    const snapshot = a.getState();
    expect(snapshot).toEqual({ seed: 99, callCount: 5 });

    const b = createRNG(snapshot);
    const c = createRNG(99);
    for (const _ of burn) c.next();

    // From this point both b (resumed) and c (replayed) must yield
    // the same next 5 numbers as a fresh continuation.
    for (let i = 0; i < 5; i += 1) {
      const fromResumed = b.next();
      const fromReplayed = c.next();
      expect(fromResumed).toBe(fromReplayed);
    }
  });

  it('int respects inclusive bounds and is uniform-ish over many samples', () => {
    const rng = createRNG(123);
    const counts = new Array<number>(10).fill(0);
    for (let i = 0; i < 10_000; i += 1) {
      const v = rng.int(0, 9);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(9);
      counts[v] = (counts[v] ?? 0) + 1;
    }
    // Crude uniformity guard — every bucket gets at least 5% of draws.
    for (const c of counts) {
      expect(c).toBeGreaterThan(500);
    }
  });

  it('pick rejects empty arrays with RangeError', () => {
    const rng = createRNG(1);
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  it('shuffle preserves length + member set', () => {
    const rng = createRNG(7);
    const input = [1, 2, 3, 4, 5];
    const out = rng.shuffle(input);
    expect(out).toHaveLength(input.length);
    expect([...out].sort()).toEqual([...input].sort());
  });

  it('weightedPick favours heavy entries over many samples', () => {
    const rng = createRNG(5);
    const counts: Record<'a' | 'b', number> = { a: 0, b: 0 };
    for (let i = 0; i < 10_000; i += 1) {
      const k = rng.weightedPick({ a: 9, b: 1 });
      counts[k] += 1;
    }
    expect(counts.a).toBeGreaterThan(counts.b * 5);
  });

  it('weightedPick rejects empty / zero / negative weights', () => {
    const rng = createRNG(1);
    expect(() => rng.weightedPick({} as Record<string, number>)).toThrow(RangeError);
    expect(() => rng.weightedPick({ a: 0, b: 0 })).toThrow(RangeError);
    expect(() => rng.weightedPick({ a: -1, b: 2 })).toThrow(RangeError);
  });

  it('int rejects inverted ranges', () => {
    const rng = createRNG(1);
    expect(() => rng.int(5, 1)).toThrow(RangeError);
  });
});
