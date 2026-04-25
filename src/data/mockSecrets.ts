/**
 * Per-mode mock secret codes used by MatchResult to render the
 * "the secret was" reveal. Phase 2's engine will replace this map
 * with a freshly generated secret per match (delivered via route
 * params); the consumer signature — `secretFor(modeId): string` —
 * stays identical.
 *
 * Modes 3 (Precision) and 5 (Blackout) require unique digits per
 * the catalog rule; the test next door enforces that here so the
 * mock can never drift away from the spec it advertises.
 */

export const mockSecretByMode: Readonly<Record<number, string>> = {
  1: '3847',
  2: '5062',
  3: '1964',
  4: '2759',
  5: '3847',
  6: '6314',
  7: '4058',
};

export function secretFor(modeId: number): string {
  return mockSecretByMode[modeId] ?? '0000';
}

/** Convenience: secret string → array of digit numbers for DigitTile. */
export function secretDigits(modeId: number): readonly number[] {
  return Array.from(secretFor(modeId), (c) => Number.parseInt(c, 10));
}
