/**
 * Phase 7A.7 CP4 — Mode 2 (High & Low) per-mode tutorial content.
 *
 * Three slides + an interactive demo board (slide 3's visual).
 *
 * Mechanic correction (CP4 pre-impl finding): the spec's
 * Decision-6 slide copy described per-digit feedback, but the
 * production evaluator (`@game/modes/mode2/evaluate`) compares
 * the integer values of the WHOLE 4-digit guess and emits a
 * single `'higher' | 'lower'` direction. Production renders this
 * as one pill ("▲ Higher" / "▼ Lower") below each guess row in
 * `Mode2Row`. Shipping the literal spec copy would teach a wrong
 * rule. CP4 ships corrected copy; native-English / UX-writer
 * polish queued in Phase 9 backlog.
 *
 * DemoBoard is interactive but isolated: pinned secret, local
 * useState for draft + history, calls the production
 * `evaluateHighLow` evaluator directly. No `matchStore`, no
 * scoring, no DDA, no persistence — same isolation discipline
 * as Phase 7A.6 CP3 `TutorialMatchScreen`.
 */

import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import * as haptics from '@/lib/haptics';
import { Button } from '@components/Button';
import { DigitKeypad } from '@components/DigitKeypad';
import { DigitTile } from '@components/DigitTile';
import { evaluateHighLow, SECRET_LENGTH } from '@game/modes/mode2/evaluate';
import { colors, fonts, withAlpha } from '@theme/tokens';

export interface ModeTutorialSlide {
  readonly title: string;
  readonly body: string;
  readonly visual: ReactNode;
}

const DEMO_SECRET = '7392';

/**
 * Cap the demo at 3 attempts. The tutorial's job is to teach the
 * mechanic (one direction per whole guess), not to make the user
 * grind out a full bisection — production already does that, and
 * the user just signed up for it by tapping the mode tile. Two
 * guesses are usually enough to internalize the Higher/Lower
 * idiom; the 3rd is a guaranteed soft-rig win that pivots them
 * into the real match.
 *
 * Soft-rig semantic (per CP4 spec): on attempt 3, force
 * `isWin: true` regardless of which 4 digits the user typed.
 * The user's actual digits are preserved in the history (matches
 * the spec sketch using `currentDraft`). This can read as a
 * white lie if their final guess was nowhere near 7392, but the
 * follow-up "Try a real match." cue keeps the framing honest.
 *
 * If the user wins legitimately on guess 1 or 2 by typing 7392,
 * the natural-win path triggers and the soft-rig branch never
 * fires — `hasWon` short-circuits `submitGuess` before we count.
 */
const MAX_DEMO_GUESSES = 3;

export const slides: readonly ModeTutorialSlide[] = [
  {
    title: 'One clue per guess',
    body: "After each guess, you'll see HIGHER or LOWER — one arrow for the whole number, not per digit.",
    visual: <Slide1Visual />,
  },
  {
    title: 'Bigger or smaller',
    body: 'HIGHER means the secret is bigger than your guess. LOWER means smaller. Pure numbers game.',
    visual: <Slide2Visual />,
  },
  {
    title: 'Bisect to crack it',
    body: "Start in the middle (try 5000). Each clue cuts the range in half — about 14 guesses covers any 4-digit code, and you'll usually beat that.",
    visual: <DemoBoard />,
  },
];

// ─────────────────────────────────────────────────────────────
// Slide 1 — single guess + Higher pill (introduces the feedback
// shape: one pill for the whole guess, not per digit).
// ─────────────────────────────────────────────────────────────

function Slide1Visual(): React.JSX.Element {
  return (
    <View style={styles.visualRoot}>
      <View style={styles.guessRow}>
        {[5, 0, 0, 0].map((d, i) => (
          <DigitTile key={i} digit={d} state="neutral" size={40} />
        ))}
      </View>
      <DirectionPill dir="higher" />
      <Text style={styles.captionMuted}>Secret &gt; 5000</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Slide 2 — two guesses showing how the range narrows.
// ─────────────────────────────────────────────────────────────

function Slide2Visual(): React.JSX.Element {
  return (
    <View style={styles.visualRoot}>
      <View style={styles.attemptRow}>
        <View style={styles.guessRow}>
          {[5, 0, 0, 0].map((d, i) => (
            <DigitTile key={i} digit={d} state="neutral" size={32} />
          ))}
        </View>
        <DirectionPill dir="higher" />
      </View>
      <View style={styles.attemptRow}>
        <View style={styles.guessRow}>
          {[8, 0, 0, 0].map((d, i) => (
            <DigitTile key={i} digit={d} state="neutral" size={32} />
          ))}
        </View>
        <DirectionPill dir="lower" />
      </View>
      <Text style={styles.captionMuted}>5000 &lt; secret &lt; 8000</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Slide 3 — interactive demo board.
//
// Pinned secret '7392'. User builds a 4-digit draft via the
// shared DigitKeypad, taps Guess, and sees the corresponding
// production pill render below. State is screen-local; no
// matchStore, no scoring, no persistence.
// ─────────────────────────────────────────────────────────────

interface DemoGuess {
  readonly digits: readonly number[];
  readonly dir: 'higher' | 'lower';
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
    const fb = evaluateHighLow(guessStr, DEMO_SECRET);
    if (fb.kind !== 'direction') return;

    // Soft-rig: on the 3rd submission, treat as win regardless
    // of input. `guesses.length` is the count BEFORE we append
    // this attempt — so 2 means this submission is the 3rd. The
    // pre-existing `fb.isWin === true` short-circuit (legitimate
    // 7392 entry on attempt 1 or 2) still wins via the OR below;
    // the cap only intervenes when the natural evaluator says
    // "not yet."
    const isCapAttempt = guesses.length === MAX_DEMO_GUESSES - 1;
    const isWin = fb.isWin === true || isCapAttempt;

    setGuesses((current) => [
      ...current,
      { digits: guessDigits, dir: fb.dir, isWin },
    ]);
    setDraftDigits(emptyDraft());
  }, [draftDigits, isComplete, hasWon, guesses.length]);

  return (
    <View style={styles.demoRoot} testID="mode2-demo-board">
      <View style={styles.demoHistory}>
        {guesses.length === 0 ? (
          <Text style={styles.captionMuted}>Try 5000 to start.</Text>
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
              {g.isWin ? null : <DirectionPill dir={g.dir} />}
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

          {/*
            DigitKeypad has no intrinsic width — its rows use `flex: 1`
            keySlots that compute against the parent. `demoRoot` sets
            `alignItems: 'center'` to center the history rows, draft
            row, and Guess button (none have an explicit width). That
            same rule collapses the keypad to ~0 width, leaving only
            1px-border vertical bars where the digit keys should be.
            `alignSelf: 'stretch'` opts the keypad out of the parent's
            center alignment so it spans the full content width — same
            effect as production's stretched footers (SecretSetup,
            MatchScreen) without disturbing the rest of the demo.
          */}
          <View style={styles.keypadStretch}>
            <DigitKeypad
              onDigit={handleDigit}
              onBackspace={handleBackspace}
              disabled={hasWon}
            />
          </View>

          {/*
            Secondary outline variant + size="lg" + alignSelf:'stretch'
            mirrors the START MATCH primary CTA in the screen footer
            (`ModeTutorialScreen.tsx > styles.cta`). Same height, same
            full-width treatment, distinct variant — visually pairs
            the two CTAs as a primary/secondary stack even though the
            scaffold structure separates them by the slide title +
            body + pagination dots. Drops the prior fixed `width: 160`
            which read as left-biased next to the stretched keypad.
          */}
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
// Inline DirectionPill — visually mirrors `Mode2Row.DirectionPill`
// (cyan = lower, pink = higher) so users see the same idiom they
// will encounter in production. NOT importing the production
// component to keep the tutorial isolated from production
// rendering changes.
// ─────────────────────────────────────────────────────────────

interface DirectionPillProps {
  readonly dir: 'higher' | 'lower';
}

function DirectionPill({ dir }: DirectionPillProps): React.JSX.Element {
  const color = dir === 'lower' ? colors.cyan : colors.pink;
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: withAlpha(color, 0.12),
          borderColor: withAlpha(color, 0.45),
        },
      ]}
    >
      <Text style={[styles.pillLabel, { color }]}>
        {dir === 'lower' ? '▼ Lower' : '▲ Higher'}
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
  attemptRow: {
    alignItems: 'center',
    gap: 6,
  },
  guessRow: {
    flexDirection: 'row',
    gap: 6,
  },
  pill: {
    paddingVertical: 3,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'center',
  },
  pillLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.4,
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
