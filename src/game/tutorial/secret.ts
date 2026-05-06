/**
 * Phase 7A.6 CP3 — Tutorial secret generator.
 *
 * Lives in its own module (rather than inline in TutorialMatchScreen)
 * so tests can mock it deterministically without spying on `Math.random`
 * — the RN renderer consumes `Math.random` for animation IDs and other
 * housekeeping, so a global spy can't reliably pin a 4-call sequence.
 *
 * Mirrors `generateRandomDigits(SECRET_LENGTH, false, rng)` semantics
 * (first slot 1-9 to avoid leading-zero ambiguity, remaining slots
 * 0-9 with repeats) but using `Math.random` directly — the tutorial
 * has no replay-determinism requirement, so the engine's seeded RNG
 * is overkill here.
 */

const SECRET_LENGTH = 4;

export function generateTutorialSecret(): readonly number[] {
  const first = 1 + Math.floor(Math.random() * 9);
  const rest = Array.from({ length: SECRET_LENGTH - 1 }, () =>
    Math.floor(Math.random() * 10),
  );
  return [first, ...rest];
}
