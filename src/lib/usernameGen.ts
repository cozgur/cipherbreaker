/**
 * Phase 7A.6 CP3.1 — fresh-install username generator.
 *
 * Returns `player_<hex4>` strings (e.g. `player_a8f3`). The 4-hex
 * suffix is sampled from `rng()` so tests can inject a deterministic
 * source; production calls run with `Math.random` (no replay-
 * determinism requirement here — it's an identity nicety, not engine
 * state).
 *
 * Lives in `src/lib/` alongside `random.ts` / `appLifecycle.ts` /
 * `useReducedMotion.ts` — utility primitives that don't carry game
 * domain. The `@lib/usernameGen` module path is mocked in
 * `jest.setup.js` to return a fixed `'nova_code'` so existing test
 * snapshots and assertions stay stable; `usernameGen.test.ts` calls
 * `jest.unmock` to exercise the real function.
 *
 * Pre-CP3.1, `USER_STORE_DEFAULTS.username` was a hardcoded
 * `'nova_code'` (Phase 1B mock fixture). Random-by-default removes
 * the "every fresh install starts with the same name" anti-pattern
 * and avoids the need for a forced username-set screen on day 1.
 */

const HEX_RANGE = 0x10000;
const HEX_PAD = 4;

export function generateUsername(rng: () => number = Math.random): string {
  const value = Math.floor(rng() * HEX_RANGE);
  const hex = value.toString(16).padStart(HEX_PAD, '0');
  return `player_${hex}`;
}
