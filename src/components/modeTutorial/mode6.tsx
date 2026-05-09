/**
 * Phase 7A.7 CP6 — Mode 6 (Sudden Death) per-mode tutorial.
 *
 * **Two** slides + an interactive demo board (slide 2's
 * visual). Mode 6 is intentionally the only 2-slide tutorial
 * in the set — Decision 2 (Phase 7A.6 design) called for a
 * shorter walk because the mechanic ("Mode 1 + 5-guess cap")
 * is simpler than the others and a third slide would pad.
 *
 * Mechanic (CP6 pre-impl): Mode 6 re-exports
 * `evaluateColorMatch` from Mode 1 — same Wordle two-pass
 * green/yellow/gray feedback. The only difference is the
 * `rules.maxGuessesPerPlayer: 5` budget enforced by the
 * engine (`turnBasedEngine.buildModeBaseExtras` + the
 * `submitGuess` decrement + `checkEndConditions` exhaustion
 * check). The mode file itself ships zero new strategy logic
 * (per its own docstring). Spec was accurate; copy ships as
 * proposed with the placeholder `N` filled in to `5`.
 *
 * Demo design (per Decision 2 + 5): the demo's 3-guess
 * soft-rig cap is visualized via an "ATTEMPT N / 3" counter
 * near the draft row — the same visual idiom as production's
 * "N / 5" `extra` label, just smaller cap because demos cap.
 * The slide-1 copy mentions the real "5" budget; the demo's
 * "/ 3" denominator is honest about the cap and never
 * pretends to be the production budget.
 *
 * DemoBoard pinned secret '9436'. Calls `evaluateColorMatch`
 * directly. Soft-rig: on attempt 3 force `states = ALL_GREEN`
 * + `isWin = true`.
 */

import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import * as haptics from '@/lib/haptics';
import { Button } from '@components/Button';
import { DigitKeypad } from '@components/DigitKeypad';
import { DigitTile } from '@components/DigitTile';
import { evaluateColorMatch, SECRET_LENGTH } from '@game/modes/mode1/evaluate';
import type { DigitTileVisualState } from '@game/types';
import { colors, fonts, withAlpha } from '@theme/tokens';

import type { ModeTutorialSlide } from './mode2';

const DEMO_SECRET = '9436';
const MAX_DEMO_GUESSES = 3;

export const slides: readonly ModeTutorialSlide[] = [
  {
    title: 'Five chances',
    body: 'Same as Color Match. But only 5 guesses. No second chances.',
    visual: <Slide1Visual />,
  },
  {
    title: 'Make every guess count',
    body: 'Information-rich first guesses matter. Each turn is precious.',
    visual: <DemoBoard />,
  },
];

// ─────────────────────────────────────────────────────────────
// Slide 1 — Mode 1-style row + an "attempt 1/5" pill
// (introduces both the inherited green/yellow/gray idiom and
// the 5-guess cap simultaneously).
// ─────────────────────────────────────────────────────────────

const SLIDE1_DIGITS: readonly number[] = [9, 0, 3, 0];
const SLIDE1_STATES: readonly DigitTileVisualState[] = ['green', 'gray', 'green', 'gray'];

function Slide1Visual(): React.JSX.Element {
  return (
    <View style={styles.visualRoot}>
      <View style={styles.attemptCounterPill}>
        <Text style={styles.attemptCounterLabel}>1 / 5</Text>
      </View>
      <View style={styles.guessRow}>
        {SLIDE1_DIGITS.map((d, i) => (
          <DigitTile
            key={i}
            digit={d}
            state={SLIDE1_STATES[i] ?? 'gray'}
            size={40}
          />
        ))}
      </View>
      <Text style={styles.captionMuted}>Five guesses total. Make them count.</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Slide 2 — interactive demo board (Mode 1 mechanic, capped
// at 3 attempts with "ATTEMPT N / 3" counter mirroring
// production's "N / 5" idiom).
// ─────────────────────────────────────────────────────────────

interface DemoGuess {
  readonly digits: readonly number[];
  readonly states: readonly DigitTileVisualState[];
  readonly isWin: boolean;
}

const ALL_GREEN: readonly DigitTileVisualState[] = ['green', 'green', 'green', 'green'];

function emptyDraft(): readonly (number | null)[] {
  return Array.from({ length: SECRET_LENGTH }, () => null);
}

export function DemoBoard(): React.JSX.Element {
  const [guesses, setGuesses] = useState<readonly DemoGuess[]>([]);
  const [draftDigits, setDraftDigits] = useState<readonly (number | null)[]>(emptyDraft());

  const filledCount = draftDigits.filter((d) => d != null).length;
  const isComplete = filledCount === SECRET_LENGTH;
  const hasWon = guesses.some((g) => g.isWin);
  const attemptNumber = guesses.length + 1;

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
    const fb = evaluateColorMatch(guessStr, DEMO_SECRET);
    if (fb.kind !== 'colorMatch') return;

    const isCapAttempt = guesses.length === MAX_DEMO_GUESSES - 1;
    const naturalWin = fb.isWin === true;
    const isWin = naturalWin || isCapAttempt;
    const states = isCapAttempt && !naturalWin ? ALL_GREEN : fb.states;

    setGuesses((current) => [
      ...current,
      { digits: guessDigits, states, isWin },
    ]);
    setDraftDigits(emptyDraft());
  }, [draftDigits, isComplete, hasWon, guesses.length]);

  return (
    <View style={styles.demoRoot} testID="mode6-demo-board">
      <View style={styles.demoHistory}>
        {guesses.length === 0 ? (
          <Text style={styles.captionMuted}>Demo caps at 3. Real match: 5.</Text>
        ) : (
          guesses.map((g, i) => (
            <View key={i} style={styles.guessRow}>
              {g.digits.map((d, j) => (
                <DigitTile
                  key={j}
                  digit={d}
                  state={g.states[j] ?? 'gray'}
                  size={28}
                />
              ))}
            </View>
          ))
        )}
      </View>

      {hasWon ? (
        <Text style={styles.demoWin}>Cracked it. Try a real match.</Text>
      ) : (
        <>
          <View style={styles.attemptCounterPill} testID="mode6-attempt-counter">
            <Text style={styles.attemptCounterLabel}>
              {`ATTEMPT ${attemptNumber} / ${MAX_DEMO_GUESSES}`}
            </Text>
          </View>

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

const styles = StyleSheet.create({
  visualRoot: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  guessRow: {
    flexDirection: 'row',
    gap: 6,
  },
  attemptCounterPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: withAlpha(colors.danger, 0.55),
    backgroundColor: withAlpha(colors.danger, 0.1),
  },
  attemptCounterLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.danger,
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
