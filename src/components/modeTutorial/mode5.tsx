/**
 * Phase 7A.7 CP6 — Mode 5 (Blackout) per-mode tutorial content.
 *
 * Three slides + an interactive demo board (slide 3's visual).
 *
 * Mechanic correction (CP6 pre-impl finding — the largest in
 * Phase 7A.7 to date): the entire spec metaphor was fictional.
 * Spec described a "lock digits to see them / once locked,
 * they stay / wrong locks waste turns / right locks reveal
 * feedback for the rest" mental model with manual locking
 * action and per-digit persistence across guesses. None of
 * that exists in production.
 *
 * Reality (`@game/modes/mode5/evaluate`): submit a 4-digit
 * guess, the evaluator counts how many digits landed in the
 * right slot (`locked: 0..4`), and emits all `'blackout'`
 * states for the digit tiles. No per-position info is ever
 * leaked — `Mode5Row` shows only blackout tiles + a "N LOCKED"
 * pill. The count IS the entire feedback. Win condition:
 * `locked === 4` on a single guess. `digitsUnique: true` (per
 * catalog rules) — repeats are blocked at the keypad layer.
 *
 * Shipping the spec copy would have taught users to look for
 * a "lock" UI affordance that does not exist; corrected copy
 * teaches the actual single-number-per-guess mechanic.
 *
 * DemoBoard pinned secret '2841' (unique digits, satisfies
 * `digitsUnique`). Local useState for draft + history; calls
 * `evaluateBlackout` directly. 3-guess soft-rig: on attempt 3,
 * force `locked = 4 / isWin = true` so the forced victory
 * presents a clean "4 LOCKED" pill rather than the user's
 * actual count.
 */

import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import * as haptics from '@/lib/haptics';
import { Button } from '@components/Button';
import { DigitKeypad } from '@components/DigitKeypad';
import { DigitTile } from '@components/DigitTile';
import { evaluateBlackout, SECRET_LENGTH } from '@game/modes/mode5/evaluate';
import { colors, fonts } from '@theme/tokens';

import type { ModeTutorialSlide } from './mode2';

const DEMO_SECRET = '2841';
const MAX_DEMO_GUESSES = 3;

export const slides: readonly ModeTutorialSlide[] = [
  {
    title: "Everything's blacked out",
    body: "You won't see any digits in your guess. Just one number: how many you put in the right slot.",
    visual: <Slide1Visual />,
  },
  {
    title: 'Count is the only clue',
    body: '0, 1, 2, 3, or 4 right spots — but never WHICH spots. Each guess: pure deduction.',
    visual: <Slide2Visual />,
  },
  {
    title: 'High stakes, low signal',
    body: 'Bigger stake than other modes. The blackout is the cost. Use unique digits to maximize your read.',
    visual: <DemoBoard />,
  },
];

// ─────────────────────────────────────────────────────────────
// Slide 1 — single guess + 1 LOCKED pill (introduces the
// blackout-tiles + count-only feedback shape).
// ─────────────────────────────────────────────────────────────

function Slide1Visual(): React.JSX.Element {
  return (
    <View style={styles.visualRoot}>
      <View style={styles.guessRow}>
        {[0, 0, 0, 0].map((_, i) => (
          <DigitTile key={i} digit={null} state="blackout" size={40} />
        ))}
      </View>
      <LockedPill locked={1} />
      <Text style={styles.captionMuted}>1 right spot — but not which</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Slide 2 — two stacked guesses with different counts
// (introduces the count varies; same blackout treatment).
// ─────────────────────────────────────────────────────────────

function Slide2Visual(): React.JSX.Element {
  return (
    <View style={styles.visualRoot}>
      <View style={styles.attemptRow}>
        <View style={styles.guessRow}>
          {[0, 0, 0, 0].map((_, i) => (
            <DigitTile key={i} digit={null} state="blackout" size={32} />
          ))}
        </View>
        <LockedPill locked={2} />
      </View>
      <View style={styles.attemptRow}>
        <View style={styles.guessRow}>
          {[0, 0, 0, 0].map((_, i) => (
            <DigitTile key={i} digit={null} state="blackout" size={32} />
          ))}
        </View>
        <LockedPill locked={0} />
      </View>
      <Text style={styles.captionMuted}>Some guesses help. Some teach by elimination.</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Slide 3 — interactive demo board.
//
// Pinned secret '2841'. User builds a 4-digit draft via the
// shared DigitKeypad, taps Guess, and sees blackout tiles +
// the count pill. State is screen-local; no matchStore, no
// scoring, no persistence.
// ─────────────────────────────────────────────────────────────

interface DemoGuess {
  readonly digits: readonly number[];
  readonly locked: number;
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
    const fb = evaluateBlackout(guessStr, DEMO_SECRET);
    if (fb.kind !== 'blackout') return;

    // Soft-rig: on the 3rd submission, force a win regardless
    // of input. Override `locked = 4` so the forced-win row
    // presents a clean "4 LOCKED" pill rather than the user's
    // actual count next to a "Cracked it" cue.
    const isCapAttempt = guesses.length === MAX_DEMO_GUESSES - 1;
    const naturalWin = fb.isWin === true;
    const isWin = naturalWin || isCapAttempt;
    const locked = isCapAttempt && !naturalWin ? 4 : fb.locked;

    setGuesses((current) => [
      ...current,
      { digits: guessDigits, locked, isWin },
    ]);
    setDraftDigits(emptyDraft());
  }, [draftDigits, isComplete, hasWon, guesses.length]);

  return (
    <View style={styles.demoRoot} testID="mode5-demo-board">
      <View style={styles.demoHistory}>
        {guesses.length === 0 ? (
          <Text style={styles.captionMuted}>Try 4 unique digits to start.</Text>
        ) : (
          guesses.map((g, i) => (
            <View key={i} style={styles.attemptRow}>
              <View style={styles.guessRow}>
                {g.digits.map((_, j) => (
                  <DigitTile
                    key={j}
                    digit={null}
                    state={g.isWin ? 'green' : 'blackout'}
                    size={28}
                  />
                ))}
              </View>
              {/*
                On a winning row we show `4 LOCKED` to land the
                victory in the same idiom as Mode3Row's `+4 −0`
                — the pill IS the feedback in Blackout, so unlike
                Mode 2/3 where we suppress the pill on win, here
                the pill is load-bearing right up to the very end.
              */}
              <LockedPill locked={g.locked} />
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
// Inline LockedPill — visually mirrors `Mode5Row.LockedPill`
// (dim "NONE" when 0; success-green dot + "N LOCKED" otherwise)
// so users see the same idiom they will encounter in
// production. NOT importing the production component to keep
// the tutorial isolated from production rendering changes.
// ─────────────────────────────────────────────────────────────

interface LockedPillProps {
  readonly locked: number;
}

function LockedPill({ locked }: LockedPillProps): React.JSX.Element {
  const isNone = locked === 0;
  const dotColor = isNone ? colors.textDim : colors.success;
  const labelColor = isNone ? colors.textDim : colors.success;
  return (
    <View style={styles.pill}>
      <View style={[styles.pillDot, { backgroundColor: dotColor }]} />
      <Text style={[styles.pillLabel, { color: labelColor }]}>
        {isNone ? 'NONE' : `${locked} LOCKED`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  visualRoot: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  // Column layout (tiles row, then pill below) — mirrors
  // production `Mode5Row`'s `below` placement via
  // `GuessRowShell`. Side-by-side row layout (the original
  // CP6 attempt) caused tile-column drift between rows
  // because the parent's `alignItems: 'center'` centered
  // each row by its total content width — and "NONE" vs
  // "4 LOCKED" pills shifted the centered position. Stacking
  // the pill underneath keeps the tile group's X position
  // constant across guesses regardless of label width.
  attemptRow: {
    alignItems: 'center',
    gap: 6,
  },
  guessRow: {
    flexDirection: 'row',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pillLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
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
