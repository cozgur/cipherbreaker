/**
 * Phase 7A.7 CP6 — Mode 7 (Mirror) per-mode tutorial.
 *
 * Three slides + an interactive demo board (slide 3's
 * visual). Mode 7 is the only mode in the set with a
 * **rival** in the demo, but the rival is intentionally
 * STATIC — Decision 4 (Phase 7A.6 design): tutorials don't
 * impose stress. The demo presents the split-board layout
 * and a frozen rival placeholder so the user understands the
 * "two minds, same code" framing without actually racing
 * anything.
 *
 * Mechanic (CP6 pre-impl): Mode 7 re-exports
 * `evaluateColorMatch` from Mode 1 and is routed through
 * `parallelEngine` with `flags: { parallelRace, sharedSecret
 * }`. Both sides race the same engine-generated secret with
 * no turn rotation and no per-player guess budget — first to
 * crack wins. The bot is Mode 1's actual bot
 * (`makeGuess` + `thinkingTime`), dressed as a rival via the
 * parallelEngine. Spec was mechanically accurate; only minor
 * refinement applied (slide 2 title "Race the clock-less" →
 * "Pace, not clock" for clarity, per user confirmation).
 *
 * **CRITICAL (per user spec)**: the demo's "static rival"
 * must NOT trigger any bot AI logic. No `setInterval`, no
 * `thinkingTime` calls, no `parallelEngine` invocation, no
 * `makeGuess` invocation. The rival is a decorative placeholder
 * with three frozen guess rows shown in production-style
 * tiles. The user wins their own side via the same 3-guess
 * soft-rig as the rest of CP4-CP6; the rival never moves.
 *
 * DemoBoard pinned secret '6052'. Calls `evaluateColorMatch`
 * directly for the user's side. Soft-rig: on attempt 3 force
 * `states = ALL_GREEN` + `isWin = true`.
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

const DEMO_SECRET = '6052';
const MAX_DEMO_GUESSES = 3;

export const slides: readonly ModeTutorialSlide[] = [
  {
    title: 'Same code, two minds',
    body: 'You and a rival are cracking the same code. First one to crack it wins.',
    visual: <Slide1Visual />,
  },
  {
    title: 'Pace, not clock',
    body: "No timer. The rival's pace is your pressure. Watch their progress on the side.",
    visual: <Slide2Visual />,
  },
  {
    title: 'Speed and accuracy',
    body: 'Crack faster than them — but a lucky early guess can swing it.',
    visual: <DemoBoard />,
  },
];

// ─────────────────────────────────────────────────────────────
// Slide 1 — split-board mockup with both sides showing
// progress (introduces the parallel-race shape).
// ─────────────────────────────────────────────────────────────

const SLIDE1_USER_DIGITS: readonly number[] = [6, 1, 5, 2];
const SLIDE1_USER_STATES: readonly DigitTileVisualState[] = ['green', 'gray', 'green', 'green'];
const SLIDE1_RIVAL_STATES: readonly DigitTileVisualState[] = ['gray', 'yellow', 'gray', 'green'];

function Slide1Visual(): React.JSX.Element {
  return (
    <View style={styles.splitBoard}>
      <View style={styles.boardSide}>
        <Text style={styles.sideLabel}>YOU</Text>
        <View style={styles.guessRow}>
          {SLIDE1_USER_DIGITS.map((d, i) => (
            <DigitTile
              key={i}
              digit={d}
              state={SLIDE1_USER_STATES[i] ?? 'gray'}
              size={26}
            />
          ))}
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.boardSide}>
        <Text style={styles.sideLabel}>RIVAL</Text>
        <View style={styles.guessRow}>
          {[0, 0, 0, 0].map((_, i) => (
            <DigitTile
              key={i}
              digit={null}
              state={SLIDE1_RIVAL_STATES[i] ?? 'gray'}
              size={26}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Slide 2 — visualizing the rival's pace as a "guess count"
// indicator (introduces the production header-indicator
// idiom for opponent progress, since Mode7Row only renders
// the local player's side).
// ─────────────────────────────────────────────────────────────

function Slide2Visual(): React.JSX.Element {
  return (
    <View style={styles.visualRoot}>
      <View style={styles.rivalProgressRow}>
        <Text style={styles.sideLabel}>RIVAL</Text>
        <Text style={styles.rivalCount}>3 GUESSES</Text>
      </View>
      <Text style={styles.captionMuted}>Their progress is the only clock.</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Slide 3 — interactive demo board with STATIC RIVAL.
//
// Pinned user secret '6052'. The rival side is decorative —
// three frozen guess rows show the rival "in progress" but
// never advance. NO bot AI, no setInterval, no parallelEngine.
// User's side runs the same 3-guess soft-rig as Modes 4 & 6
// (force ALL_GREEN + isWin on attempt 3).
// ─────────────────────────────────────────────────────────────

interface DemoGuess {
  readonly digits: readonly number[];
  readonly states: readonly DigitTileVisualState[];
  readonly isWin: boolean;
}

const ALL_GREEN: readonly DigitTileVisualState[] = ['green', 'green', 'green', 'green'];

// Frozen rival rows — three guesses, none winning, no
// progression during the demo. Pinning the data here (rather
// than computing it from any "rival secret") guarantees the
// rival cannot accidentally re-render with new content.
const STATIC_RIVAL_ROWS: readonly {
  readonly states: readonly DigitTileVisualState[];
}[] = [
  { states: ['gray', 'yellow', 'gray', 'gray'] },
  { states: ['gray', 'green', 'yellow', 'gray'] },
  { states: ['yellow', 'green', 'gray', 'green'] },
];

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
    <View style={styles.demoRoot} testID="mode7-demo-board">
      {/*
        Split board: user history on the left, static rival
        history on the right. The rival side is purely visual
        — never updated, no bot logic invoked. Test
        `mode7-rival-board` (always 3 frozen rows) anchors
        this invariant.
      */}
      <View style={styles.splitDemo}>
        <View style={styles.demoSide}>
          <Text style={styles.sideLabel}>YOU</Text>
          <View style={styles.demoSideHistory}>
            {guesses.length === 0 ? (
              <Text style={styles.captionMutedSmall}>Try a guess.</Text>
            ) : (
              guesses.map((g, i) => (
                <View key={i} style={styles.guessRowSmall}>
                  {g.digits.map((d, j) => (
                    <DigitTile
                      key={j}
                      digit={d}
                      state={g.states[j] ?? 'gray'}
                      size={22}
                    />
                  ))}
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.demoSide} testID="mode7-rival-board">
          <Text style={styles.sideLabel}>RIVAL</Text>
          <View style={styles.demoSideHistory}>
            {STATIC_RIVAL_ROWS.map((row, i) => (
              <View key={i} style={styles.guessRowSmall}>
                {row.states.map((state, j) => (
                  <DigitTile
                    key={j}
                    digit={null}
                    state={state}
                    size={22}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>

      {hasWon ? (
        <Text style={styles.demoWin}>Cracked it first. Try a real match.</Text>
      ) : (
        <>
          <View style={styles.draftRow}>
            {draftDigits.map((d, i) => (
              <DigitTile
                key={i}
                digit={d}
                state={d != null ? 'violet' : 'neutral'}
                size={32}
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
    gap: 5,
  },
  guessRowSmall: {
    flexDirection: 'row',
    gap: 4,
  },
  splitBoard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  boardSide: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: withAlpha('#ffffff', 0.18),
  },
  sideLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: withAlpha('#ffffff', 0.7),
  },
  rivalProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withAlpha('#94a3b8', 0.45),
    backgroundColor: withAlpha('#94a3b8', 0.12),
  },
  rivalCount: {
    fontFamily: fonts.mono,
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 1,
  },
  captionMuted: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#ffffff',
    opacity: 0.85,
  },
  captionMutedSmall: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#ffffff',
    opacity: 0.8,
  },

  // Demo board styles
  demoRoot: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 10,
    alignItems: 'center',
  },
  splitDemo: {
    flexDirection: 'row',
    width: '100%',
    minHeight: 80,
    gap: 10,
    paddingVertical: 6,
  },
  demoSide: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  demoSideHistory: {
    minHeight: 60,
    alignItems: 'center',
    gap: 4,
  },
  draftRow: {
    flexDirection: 'row',
    gap: 6,
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
