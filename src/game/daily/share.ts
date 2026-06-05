/**
 * Phase 7A.4 CP6 — Daily Challenge share text generator.
 *
 * Produces the share-button payload for both the success and the
 * failure flows. Numerical (NOT Wordle emoji squares) — captures
 * the deduction shape rather than tile colours, so two players
 * can compare guess paths at a glance. The +/- trail IS the
 * puzzle's signature.
 *
 * Format (success, no hints):
 *   ```
 *   CipherBreaker Day #142  4/10
 *   +1 -2
 *   +0 -3
 *   +2 -1
 *   +4 ✓
 *   ✨ pure skill
 *   cipherbreaker.app
 *   ```
 *
 * Suffix variants:
 *   - hintsUsed === 0 → `"✨ pure skill"`
 *   - hintsUsed >  0 → `"(N hints used)"` — singular `"(1 hint used)"`
 *
 * Failure replaces the headline ratio with `X/Y` where X is the
 * full turn limit, and the trail still includes every guess.
 *
 * The `cipherbreaker.app` line is a placeholder — the real domain
 * lands at launch (Phase 7A backlog item).
 */

import { calendarDayIndex } from './dailyConfig';
import type { DailyResultSummary } from './types';

/** Placeholder marketing URL — see ARCHITECTURE Phase 7A backlog. */
const SHARE_URL = 'cipherbreaker.app';

/**
 * Build the share payload. `epoch` is the player's first-play date
 * (CP9.1 per-user index) so "Day #N" matches the headline the player
 * saw in-app. Callers pass `firstPlayedDate ?? result.date` — a player
 * who has a result necessarily has a stamped epoch, the coalesce is
 * just defensive.
 */
export function formatDailyShare(result: DailyResultSummary, epoch: string): string {
  const day = calendarDayIndex(result.date, epoch);
  const headline = `CipherBreaker Day #${day}  ${result.turnsUsed}/${result.turnLimit}`;
  const lines = result.feedbackTrail.map((entry, idx) => {
    const isLast = idx === result.feedbackTrail.length - 1;
    if (isLast && entry.isWin) {
      // Winning row gets a check mark; +N format stays so the
      // share is a coherent +/- trail across all rows.
      return `+${entry.plus} ✓`;
    }
    return `+${entry.plus} -${entry.minus}`;
  });
  const suffix = formatHintSuffix(result.hintsUsed);
  return [headline, ...lines, suffix, SHARE_URL].join('\n');
}

export function formatHintSuffix(hintsUsed: number): string {
  if (hintsUsed === 0) return '✨ pure skill';
  if (hintsUsed === 1) return '(1 hint used)';
  return `(${hintsUsed} hints used)`;
}
