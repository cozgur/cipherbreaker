/**
 * Phase 7A.3 codex-backlog cleanup — hidden DDA invariant CI guard.
 *
 * SPEC §5.5 + ARCHITECTURE "Phase 7A.2 — Hidden DDA":
 *   The strings 'easy' / 'normal' / 'hard' must never appear in
 *   user-facing UI code. DDA is hidden by design — the player
 *   experiences difficulty only through bot behaviour (pool
 *   selectivity + thinking time), never through copy or labels.
 *
 * What this test does:
 *   - Walks every `.ts` / `.tsx` file under `src/screens` and
 *     `src/components` (skipping `__tests__`, `__snapshots__`, and
 *     `*.test.*` / `*.snap` files).
 *   - Counts string-literal occurrences of the three difficulty
 *     names (`'easy' | 'normal' | 'hard'` in either quote style).
 *   - Compares each file's count against an explicit whitelist.
 *
 * Whitelist policy:
 *   The only allowed occurrences are `BotContext` plumbing sites
 *   that pass `state.botDifficulty ?? 'normal'` into a new context
 *   object. Today this is exactly two lines in `MatchScreen.tsx`
 *   (the two `runOpponentTurn`-driving `useEffect` hooks). Any
 *   other appearance — even in a Daily Challenge UI banner, a
 *   debug HUD, or an a11y label — fails the test.
 *
 * If a future PR legitimately adds another plumbing site (e.g. a
 * second engine path), update `WHITELIST` with the new count AND
 * add a code comment at the new site explaining why. The whitelist
 * is the audit trail.
 *
 * If a UI feature legitimately needs to surface the literal (which
 * SPEC §5.5 forbids), this guard is the explicit conversation seam:
 * change the SPEC first, then update this test.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC_ROOT = join(__dirname, '..', '..');

const SCAN_ROOTS = ['screens', 'components'] as const;

// Single-quoted or double-quoted literal of the three forbidden tokens.
// Word-boundary anchored so substrings like "harden" or "normalize" do
// not trip the guard.
const FORBIDDEN = /(?:'(?:easy|normal|hard)'|"(?:easy|normal|hard)")/g;

/**
 * File path (relative to `src/`) → expected literal count. Every entry
 * is documented at the call site; this map is the audit trail.
 */
const WHITELIST: Readonly<Record<string, number>> = {
  // MatchScreen.tsx lines 306, 381 — both `BotContext` initialisers
  // pass `state.botDifficulty ?? 'normal'` so the bot's `makeGuess`
  // and `thinkingTime` receive the engine-stamped difficulty (or the
  // hydrated-pre-7A.2 fallback). These are plumbing, not UI surface.
  'screens/MatchScreen.tsx': 2,
};

function shouldSkipDirEntry(name: string): boolean {
  return name === '__tests__' || name === '__snapshots__';
}

function shouldSkipFile(name: string): boolean {
  return /\.(test|spec)\.(ts|tsx)$/.test(name) || name.endsWith('.snap');
}

function isScannableSourceFile(name: string): boolean {
  return (name.endsWith('.ts') || name.endsWith('.tsx')) && !shouldSkipFile(name);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      if (shouldSkipDirEntry(entry)) continue;
      out.push(...walk(abs));
    } else if (stat.isFile() && isScannableSourceFile(entry)) {
      out.push(abs);
    }
  }
  return out;
}

function countMatches(content: string): number {
  const matches = content.match(FORBIDDEN);
  return matches === null ? 0 : matches.length;
}

describe('hidden DDA invariant — UI must never surface bot difficulty literals', () => {
  const findings: Array<{ relPath: string; count: number }> = [];
  for (const root of SCAN_ROOTS) {
    const absRoot = join(SRC_ROOT, root);
    for (const file of walk(absRoot)) {
      const content = readFileSync(file, 'utf8');
      const count = countMatches(content);
      if (count > 0) {
        const relPath = relative(SRC_ROOT, file).split('\\').join('/');
        findings.push({ relPath, count });
      }
    }
  }

  it('only the whitelisted plumbing sites contain difficulty literals', () => {
    const violations: string[] = [];
    const accountedFor: Set<string> = new Set();

    for (const { relPath, count } of findings) {
      const expected = WHITELIST[relPath];
      if (expected === undefined) {
        violations.push(
          `${relPath} contains ${count} difficulty literal(s) and is not whitelisted. ` +
            `If this is BotContext plumbing, add it to WHITELIST. Otherwise SPEC §5.5 ` +
            `forbids surfacing 'easy'|'normal'|'hard' in user-facing UI.`,
        );
        continue;
      }
      if (count !== expected) {
        violations.push(
          `${relPath} has ${count} difficulty literal(s); whitelist expects ${expected}. ` +
            `Update WHITELIST to match if the new occurrence is also plumbing, ` +
            `or remove the literal if it is UI copy.`,
        );
      }
      accountedFor.add(relPath);
    }

    // A whitelisted file that no longer contains any literal is a
    // signal — either the plumbing was refactored (good, remove from
    // whitelist) or the file was deleted (good, remove from whitelist).
    // Either way, surface it so the audit trail stays current.
    for (const relPath of Object.keys(WHITELIST)) {
      if (!accountedFor.has(relPath)) {
        violations.push(
          `${relPath} is in WHITELIST but no longer contains any difficulty literal. ` +
            `Remove it from WHITELIST.`,
        );
      }
    }

    expect(violations).toEqual([]);
  });
});
