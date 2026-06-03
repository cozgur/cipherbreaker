import { MATCHMAKING_MAX_MS, pickMatchmakingDuration } from '../matchmaking';

describe('pickMatchmakingDuration', () => {
  it('always returns a value within [4000, 15000)ms — no phone-down outlier', () => {
    for (let i = 0; i < 10000; i += 1) {
      const d = pickMatchmakingDuration();
      expect(d).toBeGreaterThanOrEqual(4000);
      expect(d).toBeLessThan(MATCHMAKING_MAX_MS);
    }
  });

  it('follows the sealed 60/30/10 skew within tolerance', () => {
    const N = 50000;
    let fast = 0; // 4-8s
    let medium = 0; // 8-12s
    let long = 0; // 12-15s
    for (let i = 0; i < N; i += 1) {
      const d = pickMatchmakingDuration();
      if (d < 8000) fast += 1;
      else if (d < 12000) medium += 1;
      else long += 1;
    }
    // With N=50000 the proportion stderr is ~0.002, so a 0.04 tolerance
    // is ~18 sigma — generous enough to never flake while still pinning
    // the distribution shape.
    expect(fast / N).toBeCloseTo(0.6, 1);
    expect(medium / N).toBeCloseTo(0.3, 1);
    expect(long / N).toBeCloseTo(0.1, 1);
    // toBeCloseTo(x, 1) checks |diff| < 0.05; assert the tighter bound
    // explicitly so the intent is documented and a drift to e.g. 0.55
    // still fails loudly.
    expect(Math.abs(fast / N - 0.6)).toBeLessThan(0.04);
    expect(Math.abs(medium / N - 0.3)).toBeLessThan(0.04);
    expect(Math.abs(long / N - 0.1)).toBeLessThan(0.04);
  });

  it('covers the full range across many samples (reaches both fast and long buckets)', () => {
    let sawFast = false;
    let sawLong = false;
    for (let i = 0; i < 5000 && !(sawFast && sawLong); i += 1) {
      const d = pickMatchmakingDuration();
      if (d < 8000) sawFast = true;
      if (d >= 12000) sawLong = true;
    }
    expect(sawFast).toBe(true);
    expect(sawLong).toBe(true);
  });
});
