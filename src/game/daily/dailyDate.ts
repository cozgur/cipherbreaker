/**
 * Phase 7A.4 CP3 — Local-calendar date helpers for Daily Challenge.
 *
 * Hard rule (advisor discipline): NEVER use `Date.prototype.toISOString()`.
 * It returns UTC, and a player at 11pm in Tokyo gets a different ISO
 * date than the calendar shows in their hand. Daily Challenge is a
 * "today's puzzle" feature; "today" is the player's local-calendar
 * date, not UTC.
 *
 * Hard rule #2: NEVER do day arithmetic via `(d2.getTime() - d1.getTime()) / 86400000`.
 * Spring-forward / fall-back days are 23 / 25 hours long; that math
 * gives 1.96 or 2.04 days at DST boundaries. We compute day diffs by
 * converting to `Date.UTC(year, month, date)` (a synthetic UTC midnight
 * built from the local-calendar parts), where day arithmetic is
 * exact regardless of the player's timezone.
 *
 * Surface:
 *   - `formatDailyDate(d)` — local 'YYYY-MM-DD' string from a Date.
 *   - `parseDailyDate(s)` — local-anchored Date from a 'YYYY-MM-DD'.
 *   - `addDaysLocal(d, n)` — local-anchored Date n days later.
 *   - `dayDifferenceLocal(a, b)` — integer day count, DST-immune.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatDailyDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a 'YYYY-MM-DD' string into a local-anchored Date pointing at
 * 00:00 of that calendar day. The Date constructor `new Date(y, m, d)`
 * is local-time by spec — exactly what we want here.
 */
export function parseDailyDate(s: string): Date {
  const m = DATE_RE.exec(s);
  if (m === null) {
    throw new RangeError(`parseDailyDate: expected 'YYYY-MM-DD' format, got: ${s}`);
  }
  const year = Number(m[1]);
  const monthIdx = Number(m[2]) - 1;
  const day = Number(m[3]);
  const date = new Date(year, monthIdx, day);
  // Reject calendar arithmetic surprises (`new Date(2026, 1, 30)`
  // silently rolls forward to March 2). The round-trip guard catches
  // that without re-implementing the Gregorian month-length table.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIdx ||
    date.getDate() !== day
  ) {
    throw new RangeError(`parseDailyDate: invalid calendar date: ${s}`);
  }
  return date;
}

/**
 * Build a fresh local-anchored Date `days` calendar days after `d`.
 * Constructor-arity form (`new Date(y, m, d + days)`) handles month
 * + year rollover natively, and the Date object lands at local
 * midnight so subsequent `getDate()`-style accessors are stable.
 */
export function addDaysLocal(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/**
 * Integer day count from `from` to `to`, DST-immune. Both inputs are
 * reduced to their local-calendar `(year, month, date)` triple, then
 * lifted into UTC midnights — UTC has no DST, so the millisecond gap
 * is always an integer multiple of 86_400_000.
 *
 * Returns negative when `to` precedes `from`, which is the
 * expected algebra (and what `streak.ts` relies on for "yesterday →
 * today is +1 day" checks).
 */
export function dayDifferenceLocal(from: Date, to: Date): number {
  const fromUTC = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUTC = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUTC - fromUTC) / 86_400_000);
}
