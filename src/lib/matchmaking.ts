/**
 * Phase 7A.8 CP5 — bot-illusion matchmaking duration.
 *
 * Real matchmaking has variance: usually quick, occasionally a longer
 * wait. A fixed search delay reads as mechanical and breaks the
 * "real opponent" illusion (Phase 7A.7 user feedback). This helper
 * draws a skewed duration so most matches resolve fast (4-8s) with an
 * occasional medium (8-12s) or long (12-15s) wait.
 *
 * Distribution (sealed in the CP5 design conversation):
 *   - 60% → 4-8s   (fast match — the common case)
 *   - 30% → 8-12s  (medium)
 *   - 10% → 12-15s (long)
 *   - 0%  beyond 15s — no "phone-down" outlier. Capping the tail is
 *     the same bot-pace ecosystem decision Mode 7 took in Phase 7A.7
 *     CP8: a believable wait never becomes an abandoned-feeling one.
 *
 * The caller picks ONCE at match start and stores the result (e.g. in
 * a ref) so the same match doesn't re-roll its wait on re-render.
 */

export const MATCHMAKING_MAX_MS = 15000;

export function pickMatchmakingDuration(): number {
  const r = Math.random();
  if (r < 0.6) return 4000 + Math.random() * 4000; // 4-8s
  if (r < 0.9) return 8000 + Math.random() * 4000; // 8-12s
  return 12000 + Math.random() * 3000; // 12-15s
}
