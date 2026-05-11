/**
 * Phase 7A.7 CP5 — Mode 3 (Precision) per-mode tutorial content.
 *
 * Three slides + an interactive demo board (slide 3's visual).
 *
 * Mechanic correction (CP5 pre-impl finding, mirrors CP4
 * pattern): the spec's Decision-6 copy claimed cumulative
 * scoring across guesses ("Final score = total points across
 * all guesses"), but the production evaluator
 * (`@game/modes/mode3/evaluate`) returns per-guess `+plus
 * −minus` values and the win condition is `plus === 4` on a
 * single guess (every digit in its right place). There is no
 * cumulative score anywhere in production — `Mode3Row` renders
 * one chip per guess row, no footer total. Shipping the literal
 * spec copy would teach a fictional mental model; CP5 ships
 * corrected copy. UX-writer polish remains queued in Phase 9
 * backlog ("Per-mode tutorial copy review", added in CP4).
 *
 * Mastermind framing for slide 1 disambiguates `−minus`: it
 * counts digits that are IN the secret but at a DIFFERENT
 * position (white peg). Digits absent from the secret produce
 * 0, not −1 — the spec's "wrong placements" wording was
 * ambiguous about that.
 *
 * DemoBoard is interactive but isolated: pinned secret '4719',
 * local useState for draft + history, calls the production
 * `evaluatePrecision` evaluator directly. Same isolation
 * discipline as Phase 7A.6 CP3 `TutorialMatchScreen` and CP4
 * `mode2`'s DemoBoard. 3-guess soft-rig: on attempt 3, force
 * `isWin: true` and override `plus = 4 / minus = 0` so the
 * forced victory renders a clean +4 chip rather than the
 * user's actual (likely off-target) numbers.
 */

import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import * as haptics from '@/lib/haptics';
import { Button } from '@components/Button';
import { DigitKeypad } from '@components/DigitKeypad';
import { DigitTile } from '@components/DigitTile';
import { evaluatePrecision, SECRET_LENGTH } from '@game/modes/mode3/evaluate';
import { colors, fonts } from '@theme/tokens';

import type { ModeTutorialSlide } from './mode2';

const DEMO_SECRET = '4719';
const MAX_DEMO_GUESSES = 3;

export const slides: readonly ModeTutorialSlide[] = [
  {
    title: 'Score over speed',
    body: '+1 for a digit in the right place. −1 for a digit in the secret but the wrong place.',
    visual: <Slide1Visual />,
  },
  {
    title: 'Net score wins',
    body: 'Each guess gets its own +N −M. Win when one guess is +4 — every digit in place.',
    visual: <Slide2Visual />,
  },
  {
    title: 'Bisect by elimination',
    body: 'Use the −M to learn which digits belong somewhere else. Move them next round.',
    visual: <DemoBoard />,
  },
];

// ─────────────────────────────────────────────────────────────
// Slide 1 — single guess + +N −M chip (introduces the chip
// idiom and the Mastermind +/− framing).
// ─────────────────────────────────────────────────────────────

function Slide1Visual(): React.JSX.Element {
  return (
    <View style={styles.visualRoot}>
      <View style={styles.guessRow}>
        {[1, 2, 4, 9].map((d, i) => (
          <DigitTile key={i} digit={d} state="neutral" size={40} />
        ))}
      </View>
      <PrecisionChip plus={2} minus={1} />
      <Text style={styles.captionMuted}>2 right place, 1 wrong place</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Slide 2 — winning guess with +4 chip (introduces the win
// condition: a single guess scoring +4).
// ─────────────────────────────────────────────────────────────

function Slide2Visual(): React.JSX.Element {
  return (
    <View style={styles.visualRoot}>
      <View style={styles.attemptRow}>
        <View style={styles.guessRow}>
          {[1, 2, 4, 9].map((d, i) => (
            <DigitTile key={i} digit={d} state="neutral" size={32} />
          ))}
        </View>
        <PrecisionChip plus={2} minus={1} />
      </View>
      <View style={styles.attemptRow}>
        <View style={styles.guessRow}>
          {[4, 7, 1, 9].map((d, i) => (
            <DigitTile key={i} digit={d} state="green" size={32} />
          ))}
        </View>
        <PrecisionChip plus={4} minus={0} />
      </View>
      <Text style={styles.captionMuted}>+4 = every digit in place</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Slide 3 — interactive demo board.
//
// Pinned secret '4719'. User builds a 4-digit draft via the
// shared DigitKeypad, taps Guess, and sees the corresponding
// production +N −M chip render below. State is screen-local;
// no matchStore, no scoring, no persistence.
// ─────────────────────────────────────────────────────────────

interface DemoGuess {
  readonly digits: readonly number[];
  readonly plus: number;
  readonly minus: number;
  readonly isWin: boolean;
}

function emptyDraft(): readonly (number | null)[] {
  return Array.from({ length: SECRET_LENGTH }, () => null);
}

export function DemoBoard(): React.JSX.Element {
  const [guesses, setGuesses] = useState<readonly DemoGuess[]>([]);
  const [draftDigits, setDraftDigits] = useState<readonly (number | null)[]>(emptyDraft());

  const filledCount = draftDigits.filter((d) => d != null).length;
  const isComplete = filledCount === SECRET_LENGTH;
  const hasWon = guesses.some((g) => g.isWin);

  const handleDigit = useCallback((digit: number) => {
    setDraftDigits((current) => {
      const slot = current.findIndex((d) => d == null);
      if (slot === -1) return current;
      const next = [...current];
      next[slot] = digit;
      return next;
    });
  }, []);

  const handleBackspace = useCallback(() => {
    setDraftDigits((current) => {
      for (let i = current.length - 1; i >= 0; i -= 1) {
        if (current[i] != null) {
          const next = [...current];
          next[i] = null;
          return next;
        }
      }
      return current;
    });
  }, []);

  const submitGuess = useCallback(() => {
    if (!isComplete || hasWon) return;
    haptics.impact('medium');
    const guessDigits = draftDigits.map((d) => d as number);
    const guessStr = guessDigits.join('');
    const fb = evaluatePrecision(guessStr, DEMO_SECRET);
    if (fb.kind !== 'precision') return;

    // Soft-rig: on the 3rd submission, force a win regardless
    // of input. Overriding `plus = 4 / minus = 0` keeps the
    // visual reward clean — a forced win that renders the
    // user's true `+0 −1` (e.g.) next to a "Cracked it" cue
    // would feel inconsistent. Legitimate early wins (typing
    // 4719 on attempt 1 or 2) take the natural `fb.isWin`
    // branch and keep their own +N −M.
    const isCapAttempt = guesses.length === MAX_DEMO_GUESSES - 1;
    const naturalWin = fb.isWin === true;
    const plus = isCapAttempt && !naturalWin ? 4 : fb.plus;
    const minus = isCapAttempt && !naturalWin ? 0 : fb.minus;
    const isWin = naturalWin || isCapAttempt;

    setGuesses((current) => [
      ...current,
      { digits: guessDigits, plus, minus, isWin },
    ]);
    setDraftDigits(emptyDraft());
  }, [draftDigits, isComplete, hasWon, guesses.length]);

  return (
    <View style={styles.demoRoot} testID="mode3-demo-board">
      <View style={styles.demoHistory}>
        {guesses.length === 0 ? (
          <Text style={styles.captionMuted}>Try 4719 — or guess to learn it.</Text>
        ) : (
          guesses.map((g, i) => (
            <View key={i} style={styles.attemptRow}>
              <View style={styles.guessRow}>
                {g.digits.map((d, j) => (
                  <DigitTile
                    key={j}
                    digit={d}
                    state={g.isWin ? 'green' : 'neutral'}
                    size={28}
                  />
                ))}
              </View>
              {/*
                Phase 7A.7 CP7.1 — fixed-width chip slot. Mode 3
                suppresses the chip on a winning row to mirror
                CP4 mode2's "no pill on winning row" idiom (the
                "Cracked it" cue speaks for the win, and a
                redundant +4 chip would compete for attention).
                But suppression without a placeholder caused the
                win row's tile column to drift right of the
                non-win rows because parent `alignItems: 'center'`
                centered each row by content width. Wrapping the
                chip (or its absence) in a fixed-width slot keeps
                the row total width constant.
              */}
              <View style={styles.chipSlot} testID={`mode3-chip-slot-${i}`}>
                {g.isWin ? null : <PrecisionChip plus={g.plus} minus={g.minus} />}
              </View>
            </View>
          ))
        )}
      </View>

      {hasWon ? (
        <Text style={styles.demoWin}>Cracked it. Try a real match.</Text>
      ) : (
        <>
          <View style={styles.draftRow}>
            {draftDigits.map((d, i) => (
              <DigitTile
                key={i}
                digit={d}
                state={d != null ? 'violet' : 'neutral'}
                size={36}
              />
            ))}
          </View>

          <View style={styles.keypadStretch}>
            <DigitKeypad
              onDigit={handleDigit}
              onBackspace={handleBackspace}
              disabled={hasWon}
            />
          </View>

          <Button
            onPress={submitGuess}
            disabled={!isComplete || hasWon}
            variant="outline"
            size="lg"
            style={styles.demoCta}
          >
            Guess
          </Button>
        </>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Inline PrecisionChip — visually mirrors `Mode3Row.PrecisionCounter`
// (success-green +N, danger-red −M) so users see the same
// idiom they will encounter in production. NOT importing the
// production component to keep the tutorial isolated from
// production rendering changes.
// ─────────────────────────────────────────────────────────────

interface PrecisionChipProps {
  readonly plus: number;
  readonly minus: number;
}

function PrecisionChip({ plus, minus }: PrecisionChipProps): React.JSX.Element {
  return (
    <View style={styles.chip}>
      <Text style={[styles.chipCount, { color: colors.success }]}>+{plus}</Text>
      <Text style={[styles.chipCount, { color: colors.danger }]}>−{minus}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  visualRoot: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  attemptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  guessRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    gap: 6,
  },
  // Fixed-width chip slot — sized for the worst-case "+N −M"
  // chip ("+4 −0" at mono 15px ≈ 50px content + 6px gap → 56px;
  // 60 buys breathing room). The slot consumes the same
  // horizontal space whether populated or empty (win row), so
  // the tile column stays aligned across all history rows.
  chipSlot: {
    minWidth: 60,
    alignItems: 'flex-start',
  },
  chipCount: {
    fontFamily: fonts.mono,
    fontSize: 15,
    fontWeight: '700',
  },
  captionMuted: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#ffffff',
    opacity: 0.85,
  },

  // Demo board styles
  demoRoot: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 10,
    alignItems: 'center',
  },
  demoHistory: {
    width: '100%',
    minHeight: 36,
    alignItems: 'center',
    gap: 8,
  },
  draftRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  keypadStretch: {
    alignSelf: 'stretch',
  },
  demoCta: {
    marginTop: 8,
    alignSelf: 'stretch',
  },
  demoWin: {
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.success,
    marginTop: 12,
    textAlign: 'center',
  },
});
