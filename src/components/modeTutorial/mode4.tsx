/**
 * Phase 7A.7 CP5 — Mode 4 (Blitz) per-mode tutorial content.
 *
 * Three slides + an interactive demo board (slide 3's visual).
 *
 * Mechanic finding (CP5 pre-impl): Mode 4's evaluator is
 * literally Mode 1's `evaluateColorMatch` — `mode4Blitz.ts`
 * re-exports it directly. Mode 4 differs from Mode 1 only by
 * `rules.perPlayerTimeLimitMs: 60_000` and
 * `flags.perPlayerClock: true` in the catalog. The evaluator
 * is **clock-naïve**: timer logic lives in MatchScreen
 * orchestration (interval + AppState + checkEndConditions),
 * not in the pure feedback function. This makes the demo
 * trivial to isolate — no timer bypass needed; just call
 * `evaluateColorMatch` directly and never render a clock.
 *
 * Decision (Phase 7A.6 design): tutorial does NOT impose time
 * pressure. The "Beat the clock" slide explains the 60-second
 * rule, but the demo lets the user experience the mechanic
 * stress-free. Production imposes the timer; the tutorial
 * teaches.
 *
 * Slide 2 copy refined from spec ("Submit your guess to pause
 * briefly between turns") to the chess-clock semantic ("ticks
 * while it's your turn / run out and you lose"). The "pause
 * briefly" framing oversold a delay that does not exist —
 * once the player submits, control passes to the opponent and
 * the player's clock is paused for the opponent's full think,
 * not "briefly." The corrected copy is honest about the
 * lose-on-timeout consequence.
 *
 * DemoBoard reuses Mode 1's Wordle two-pass green/yellow/gray
 * digit-tile idiom (same evaluator → same visual). 3-guess
 * soft-rig: on attempt 3, force `isWin: true` and override
 * `states = ['green', 'green', 'green', 'green']` for the
 * clean visual reward.
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

const DEMO_SECRET = '5183';
const MAX_DEMO_GUESSES = 3;

export const slides: readonly ModeTutorialSlide[] = [
  {
    title: 'Beat the clock',
    body: 'Same as Color Match. But you have 60 seconds total.',
    visual: <Slide1Visual />,
  },
  {
    title: 'Time over thought',
    body: "The clock ticks down while it's your turn. Run out and you lose.",
    visual: <Slide2Visual />,
  },
  {
    title: 'Speed strategy',
    body: 'Don’t optimize first guesses. Quick partials beat slow perfects.',
    visual: <DemoBoard />,
  },
];

// ─────────────────────────────────────────────────────────────
// Slide 1 — single guess + Wordle-style feedback (introduces
// the green/yellow/gray idiom and confirms Mode 1 inheritance).
// ─────────────────────────────────────────────────────────────

const SLIDE1_DIGITS: readonly number[] = [5, 2, 7, 3];
const SLIDE1_STATES: readonly DigitTileVisualState[] = ['green', 'gray', 'gray', 'green'];

function Slide1Visual(): React.JSX.Element {
  return (
    <View style={styles.visualRoot}>
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
      <Text style={styles.captionMuted}>Same green/yellow/gray feedback</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Slide 2 — countdown clock visual (introduces the 60-second
// chess-clock metaphor without simulating it interactively).
// ─────────────────────────────────────────────────────────────

function Slide2Visual(): React.JSX.Element {
  return (
    <View style={styles.visualRoot}>
      <View style={styles.clock}>
        <Text style={styles.clockTime}>00:43</Text>
        <Text style={styles.clockLabel}>YOUR CLOCK</Text>
      </View>
      <Text style={styles.captionMuted}>Hits zero → you lose</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Slide 3 — interactive demo board (Mode 1 mechanic, NO timer).
//
// Pinned secret '5183'. User builds a 4-digit draft via the
// shared DigitKeypad, taps Guess, and sees Wordle-style colored
// tiles render in the history. State is screen-local; no
// matchStore, no scoring, no persistence, NO clock.
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

    // Soft-rig: on the 3rd submission, force a win regardless
    // of input. Overriding the per-tile states to all-green
    // keeps the visual reward clean — a forced-win row
    // displaying the user's actual gray/yellow tiles next to a
    // "Cracked it" cue would feel inconsistent. Legitimate
    // early wins (typing 5183 on attempt 1 or 2) take the
    // natural `fb.isWin` branch and keep their own states.
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
    <View style={styles.demoRoot} testID="mode4-demo-board">
      <View style={styles.demoHistory}>
        {guesses.length === 0 ? (
          <Text style={styles.captionMuted}>No timer here. Try a guess.</Text>
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
  captionMuted: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#ffffff',
    opacity: 0.85,
  },
  clock: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: withAlpha(colors.danger, 0.55),
    backgroundColor: withAlpha(colors.danger, 0.12),
    alignItems: 'center',
    gap: 4,
  },
  clockTime: {
    fontFamily: fonts.mono,
    fontSize: 28,
    fontWeight: '700',
    color: colors.danger,
    letterSpacing: 1.5,
  },
  clockLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.danger,
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
