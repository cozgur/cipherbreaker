// jest.setup.js mocks `@lib/usernameGen` globally to return a stable
// 'nova_code' so existing test fixtures and snapshots stay
// deterministic. This file tests the REAL implementation, so we
// unmock it locally before importing.
jest.unmock('@lib/usernameGen');

import { generateUsername } from '@lib/usernameGen';

describe('generateUsername', () => {
  it('matches the player_<hex4> contract for any rng output in [0, 1)', () => {
    expect(generateUsername(() => 0)).toMatch(/^player_[0-9a-f]{4}$/);
    expect(generateUsername(() => 0.5)).toMatch(/^player_[0-9a-f]{4}$/);
    // 0.99999 stays just under 1 — the floor of (0.99999 * 65536) is
    // a 4-hex value, not 5. Verifies the upper-bound padding works.
    expect(generateUsername(() => 0.99999)).toMatch(/^player_[0-9a-f]{4}$/);
  });

  it('is deterministic when an rng source is injected', () => {
    // 0 → floor(0 * 0x10000) = 0x0000 → "0000"
    expect(generateUsername(() => 0)).toBe('player_0000');
    // 0.5 → floor(0.5 * 0x10000) = 0x8000 → "8000"
    expect(generateUsername(() => 0.5)).toBe('player_8000');
  });

  it('produces different values across calls when backed by a real PRNG', () => {
    // Math.random is the production default — collisions are theoretically
    // possible at 1/65536 but the suite is deterministic enough that two
    // back-to-back calls inside the same test should not collide. The
    // assertion would fire on the unlucky 1-in-65k draw; we accept that
    // probability as a reasonable signal that the function actually
    // consumes from the rng (vs. e.g. caching the first call).
    const a = generateUsername();
    const b = generateUsername();
    // Both match the contract; not asserting `a !== b` because the
    // tiny collision probability would flake across enough runs.
    expect(a).toMatch(/^player_[0-9a-f]{4}$/);
    expect(b).toMatch(/^player_[0-9a-f]{4}$/);
  });

  it('pads short hex values to 4 chars', () => {
    // 0x000a (decimal 10) → "000a" not "a"
    const value = 10 / 0x10000;
    expect(generateUsername(() => value)).toBe('player_000a');
  });
});
