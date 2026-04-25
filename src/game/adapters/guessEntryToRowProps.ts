/**
 * Turn a `GuessEntry` (engine output in Phase 2, mock factory in Phase
 * 1B) into the `GuessRowProps` shape consumed by per-mode row
 * components. Keeping this mapping in one place means:
 *
 * - Row components never know which player is "self" — `side` is
 *   already `'left' | 'right'`.
 * - The "extra" chip (`0:08s` for Blitz, `3/5` for Sudden Death) is
 *   pre-formatted here, not inside the row JSX.
 * - Phase 2 engines + Phase 1B mocks share the exact same consumer —
 *   swapping the data source is a single import change.
 */

import type {
  DigitTileVisualState,
  GuessEntry,
  GuessRowAdaptorContext,
  GuessRowProps,
  NormalizedFeedback,
} from '../types';

const SUDDEN_DEATH_GUESS_BUDGET = 5;

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}s`;
}

function pickDigitStates(
  feedback: NormalizedFeedback,
  length: number,
): readonly DigitTileVisualState[] {
  if (feedback.kind === 'colorMatch' || feedback.kind === 'blackout') {
    return feedback.states;
  }
  // Modes 2 (direction) and 3 (precision) paint digits as plain neutral
  // tiles — the hint lives alongside the row, not on the digits.
  return Array.from<DigitTileVisualState>({ length }).fill('neutral');
}

function pickExtra(modeId: number, entry: GuessEntry): string | undefined {
  switch (modeId) {
    case 4:
      return entry.elapsedMs != null ? formatElapsed(entry.elapsedMs) : undefined;
    case 6:
      return `${entry.guessIndex}/${SUDDEN_DEATH_GUESS_BUDGET}`;
    default:
      return undefined;
  }
}

export function guessEntryToRowProps(
  entry: GuessEntry,
  ctx: GuessRowAdaptorContext,
): GuessRowProps {
  const side: 'left' | 'right' = entry.side === 'self' ? 'left' : 'right';
  const avatar = entry.side === 'self' ? ctx.selfAvatar : ctx.opponentAvatar;
  const states = pickDigitStates(entry.feedback, entry.digits.length);

  const digits = entry.digits.map((val, i) => ({
    val,
    state: states[i] ?? 'neutral',
  }));

  return {
    side,
    avatar,
    digits,
    feedback: entry.feedback,
    extra: pickExtra(ctx.modeId, entry),
  };
}
