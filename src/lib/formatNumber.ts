/**
 * Phase 7A.8 CP10 — locale-stable number formatting.
 *
 * `Number.prototype.toLocaleString()` with no argument uses the host
 * device locale, so a Turkish-locale device renders `2340` as
 * `"2.340"` (period thousands separator) while a US device renders
 * `"2,340"`. The whole UI is English ("LEVEL", "XP", "TOKENS"), so the
 * design wants ONE deterministic format regardless of device locale —
 * grouped with commas. Pinning to 'en-US' gives that and makes the
 * counter/floater/level-bar suites pass on any contributor's machine
 * (they previously went red on non-US locales).
 *
 * Use this everywhere a player-facing token / XP / score number is
 * rendered, instead of a bare `.toLocaleString()`.
 */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}
