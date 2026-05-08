/**
 * Phase 7A.6 CP3 — Guided first match.
 *
 * Single-player Wordle-style flow that reuses Mode 1's pure
 * `evaluateColorMatch` evaluator without going through `matchStore`,
 * `MatchScreen`, or `MatchResultScreen`. The decoupling is deliberate:
 * threading an `isTutorial` flag through DDA + perMode + gamesPlayed
 * + recentMatches + addXp + interstitial would be invasive, and the
 * tutorial is one-time-only (gated by `onboarding.tutorialMatchCompleted`)
 * so the production Mode 1 surface keeps evolving without dragging
 * tutorial concerns along. See ARCHITECTURE.md once Phase 7A.6 seals.
 *
 * Soft-rigged win mechanism:
 *   - Code is fully random (Math.random, no rigging).
 *   - At end of player turn 6, if not yet won and the auto-hint hasn't
 *     fired yet, reveal one un-won position via `lockedPosition` +
 *     a TutorialToast announcement. The locked DigitTile auto-fills
 *     on subsequent turns so the player can spend their working memory
 *     on deduction, not bookkeeping (Codex round 2 guidance: peg over
 *     text; user sees the colour, not a position-N-digit-D string).
 *   - Manual hints don't exist in Mode 1 today, so there's nothing
 *     to disable — the spec's "buttons hidden" requirement is met by
 *     absence.
 *
 * Lose flow: tutorial enforces a 10-turn cap (Mode 1 itself has no
 * cap — without one the lose UX in the spec would be unreachable).
 * Lose view reveals the code and offers "Try again" (regenerate +
 * reset overlays + reset auto-hint) or "Skip and continue" (mark
 * complete + Home).
 *
 * Exit paths (all four call `markTutorialMatchCompleted` and replace
 * the stack with Home — CP7 will swap Home for the next onboarding
 * step):
 *   - Win celebration overlay → Continue
 *   - Skip mid-match (confirm dialog) → Skip
 *   - Lose view → Skip and continue
 *   - Lose view → Try again does NOT mark complete (unlimited retries)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import * as haptics from '@/lib/haptics';
import { Button } from '@components/Button';
import { DigitKeypad } from '@components/DigitKeypad';
import { DigitTile } from '@components/DigitTile';
import { Screen } from '@components/Screen';
import { SectionLabel } from '@components/SectionLabel';
import { SkipTutorialDialog } from '@components/tutorial/SkipTutorialDialog';
import { TutorialOverlay } from '@components/tutorial/TutorialOverlay';
import { TutorialToast } from '@components/tutorial/TutorialToast';
import { evaluateColorMatch, SECRET_LENGTH } from '@game/modes/mode1/evaluate';
import { generateTutorialSecret } from '@game/tutorial/secret';
import type { DigitTileVisualState } from '@game/types';
import type { RootStackParamList } from '@navigation/routes';
import { useUserStore } from '@state/userStore';
import { colors, fonts } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'TutorialMatch'>;

const MAX_TURNS = 10;
const AUTO_HINT_TURN = 6;
// Phase 7A.6 CP3.1 — recalibrated from 10 → 50. Pre-CP3.1 the
// 10-token reward sat below every spend threshold in this economy
// (lowest stake = 50, lowest hint = 50), so the chip was
// functionally inert. 50 tokens covers exactly one Mode 1/2/3/4/6
// stake or one Hint B, giving the user a concrete first-action.
const TUTORIAL_REWARD_TOKENS = 50;

interface TutorialGuess {
  readonly digits: readonly number[];
  readonly states: readonly DigitTileVisualState[];
}

type OverlayKey = 'welcome' | 'feedbackTeaching' | 'win' | null;

interface TutorialState {
  readonly secret: readonly number[];
  readonly guesses: readonly TutorialGuess[];
  readonly draftDigits: readonly (number | null)[];
  readonly overlay: OverlayKey;
  /** Top toast shown after Welcome dismiss; auto-clears on first peg. */
  readonly showFirstGuessToast: boolean;
  /** Top toast shown when auto-hint fires at end of turn 6. */
  readonly showAutoHintToast: boolean;
  /** Position revealed by the auto-hint, locked on the keypad row. */
  readonly lockedPosition: number | null;
  /** Once-per-match guard so a second turn-6 (after Try again) can fire. */
  readonly autoHintFired: boolean;
  /** True once the player has won — drives win celebration overlay. */
  readonly hasWon: boolean;
  /** True once the player has exhausted all 10 turns without winning. */
  readonly hasLost: boolean;
}

function emptyDraft(): readonly (number | null)[] {
  return Array.from({ length: SECRET_LENGTH }, () => null);
}

function freshState(): TutorialState {
  return {
    secret: generateTutorialSecret(),
    guesses: [],
    draftDigits: emptyDraft(),
    overlay: 'welcome',
    showFirstGuessToast: false,
    showAutoHintToast: false,
    lockedPosition: null,
    autoHintFired: false,
    hasWon: false,
    hasLost: false,
  };
}

/**
 * Pick a position to reveal via the auto-hint. Prefers a position the
 * player has not yet locked in green (i.e. has not yet matched
 * exactly). Falls back to position 0 for the degenerate "every
 * position already green" case (which can't happen here — the player
 * would have already won — but the fallback keeps the helper total).
 */
function pickHintPosition(
  secret: readonly number[],
  guesses: readonly TutorialGuess[],
): number {
  const greenAlready = new Set<number>();
  for (const g of guesses) {
    g.states.forEach((s, i) => {
      if (s === 'green') greenAlready.add(i);
    });
  }
  for (let i = 0; i < secret.length; i += 1) {
    if (!greenAlready.has(i)) return i;
  }
  return 0;
}

export function TutorialMatchScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const addTokens = useUserStore((s) => s.addTokens);
  const markTutorialMatchCompleted = useUserStore((s) => s.markTutorialMatchCompleted);

  const [state, setState] = useState<TutorialState>(() => freshState());
  const [showSkipDialog, setShowSkipDialog] = useState(false);

  const filledCount = state.draftDigits.filter((d) => d != null).length;
  const isComplete = filledCount === SECRET_LENGTH;
  const turnNumber = state.guesses.length + 1;
  const inputDisabled =
    state.overlay !== null || state.hasWon || state.hasLost || showSkipDialog;

  const dismissOverlay = useCallback((next: OverlayKey) => {
    setState((s) => {
      // Welcome → first-guess prompt toast (auto-dismisses on first
      // peg tap). Feedback teaching / win celebration just clear.
      const showFirstGuessToast = s.overlay === 'welcome' ? true : s.showFirstGuessToast;
      return { ...s, overlay: next, showFirstGuessToast };
    });
  }, []);

  const handleDigit = useCallback(
    (digit: number) => {
      setState((s) => {
        if (s.hasWon || s.hasLost || s.overlay !== null) return s;
        // The first peg tap auto-dismisses the first-guess toast — no
        // separate gesture needed.
        const nextDraft = [...s.draftDigits];
        // Skip the locked position: auto-hint already fills it; user
        // input flows into the remaining slots in order.
        const slot = nextDraft.findIndex(
          (d, i) => d == null && i !== s.lockedPosition,
        );
        if (slot === -1) return { ...s, showFirstGuessToast: false };
        nextDraft[slot] = digit;
        return { ...s, draftDigits: nextDraft, showFirstGuessToast: false };
      });
    },
    [],
  );

  const handleBackspace = useCallback(() => {
    setState((s) => {
      if (s.hasWon || s.hasLost) return s;
      const nextDraft = [...s.draftDigits];
      // Walk back skipping the locked position (it stays filled across
      // turns) and remove the last user-typed digit.
      for (let i = nextDraft.length - 1; i >= 0; i -= 1) {
        if (i === s.lockedPosition) continue;
        if (nextDraft[i] != null) {
          nextDraft[i] = null;
          return { ...s, draftDigits: nextDraft };
        }
      }
      return s;
    });
  }, []);

  const submitGuess = useCallback(() => {
    haptics.impact('medium');
    setState((s) => {
      if (s.hasWon || s.hasLost || s.overlay !== null) return s;
      if (s.draftDigits.some((d) => d == null)) return s;

      const guessDigits = s.draftDigits.map((d) => d as number);
      const guessStr = guessDigits.join('');
      const secretStr = s.secret.join('');
      const fb = evaluateColorMatch(guessStr, secretStr);
      // `evaluateColorMatch` always returns a `colorMatch`-kind
      // feedback, but the `NormalizedFeedback` union also covers a
      // `direction` variant (Mode 2) without `states`. Narrow before
      // reading.
      const states: readonly DigitTileVisualState[] =
        fb.kind === 'colorMatch' ? fb.states : ['gray', 'gray', 'gray', 'gray'];
      const newGuesses: readonly TutorialGuess[] = [
        ...s.guesses,
        { digits: guessDigits, states },
      ];

      // Win — surface celebration overlay; mark + reward fire on its
      // CTA so the player sees the chip before navigating away.
      if (fb.isWin) {
        return {
          ...s,
          guesses: newGuesses,
          draftDigits: emptyDraft(),
          overlay: 'win',
          showFirstGuessToast: false,
          showAutoHintToast: false,
          hasWon: true,
        };
      }

      // After turn 1: surface the feedback teaching overlay. Only
      // fires once (subsequent turns just append to the guess list).
      const showTeaching = newGuesses.length === 1;

      // After turn 6: trigger the auto-hint (once per match max).
      let autoHintFired = s.autoHintFired;
      let lockedPosition = s.lockedPosition;
      let showAutoHintToast = s.showAutoHintToast;
      if (!autoHintFired && newGuesses.length === AUTO_HINT_TURN) {
        const pos = pickHintPosition(s.secret, newGuesses);
        lockedPosition = pos;
        autoHintFired = true;
        showAutoHintToast = true;
      }

      // Lose — exhausted all 10 turns without winning.
      if (newGuesses.length >= MAX_TURNS) {
        return {
          ...s,
          guesses: newGuesses,
          draftDigits: emptyDraft(),
          showFirstGuessToast: false,
          showAutoHintToast: false,
          autoHintFired,
          lockedPosition,
          hasLost: true,
        };
      }

      // Auto-fill the locked position into the next draft so the
      // player doesn't have to retype it every turn.
      const nextDraft = emptyDraft().slice();
      const next = [...nextDraft];
      if (lockedPosition !== null) {
        next[lockedPosition] = s.secret[lockedPosition] ?? null;
      }

      return {
        ...s,
        guesses: newGuesses,
        draftDigits: next,
        overlay: showTeaching ? 'feedbackTeaching' : s.overlay,
        showFirstGuessToast: false,
        showAutoHintToast,
        autoHintFired,
        lockedPosition,
      };
    });
  }, []);

  const dismissAutoHint = useCallback(() => {
    setState((s) => ({ ...s, showAutoHintToast: false }));
  }, []);

  // Phase 7A.7 CP1 — outcome haptics. Win/Lose are state-driven
  // transitions inside `submitGuess`'s setState callback, so we
  // can't fire haptics there cleanly. Instead, useEffect on
  // hasWon / hasLost: fires once when the flag flips.
  useEffect(() => {
    if (state.hasWon) haptics.notify('success');
  }, [state.hasWon]);
  useEffect(() => {
    if (state.hasLost) haptics.notify('error');
  }, [state.hasLost]);

  const finishAndExit = useCallback(() => {
    // Phase 7A.6 CP7 — single exit funnel for all three paths
    // (Win Continue, Lose Skip-and-continue, Mid-match Skip
    // confirm). Marks the tutorial step seen and forwards to the
    // token economy walkthrough (CP4). Replaces the CP3-shipped
    // `'Home'` placeholder.
    markTutorialMatchCompleted();
    navigation.replace('OnboardingTokenWalkthrough');
  }, [markTutorialMatchCompleted, navigation]);

  const onWinContinue = useCallback(() => {
    addTokens(TUTORIAL_REWARD_TOKENS, 'tutorial_match_complete');
    finishAndExit();
  }, [addTokens, finishAndExit]);

  const onTryAgain = useCallback(() => {
    setState(() => freshState());
  }, []);

  const onSkipPress = useCallback(() => {
    // If an overlay is up, dismiss it first so the confirm dialog
    // isn't stacked on top — keeps a11y focus order sane.
    setState((s) => ({ ...s, overlay: null, showFirstGuessToast: false }));
    setShowSkipDialog(true);
  }, []);

  const onSkipCancel = useCallback(() => {
    setShowSkipDialog(false);
  }, []);

  const onSkipConfirm = useCallback(() => {
    setShowSkipDialog(false);
    finishAndExit();
  }, [finishAndExit]);

  const revealedHintDigit = useMemo(() => {
    if (state.lockedPosition === null) return null;
    return state.secret[state.lockedPosition] ?? null;
  }, [state.lockedPosition, state.secret]);

  if (state.hasLost) {
    return (
      <TutorialLoseView
        secret={state.secret}
        onTryAgain={onTryAgain}
        onSkipAndContinue={finishAndExit}
      />
    );
  }

  return (
    <Screen ambientIntensity={0.18}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <SectionLabel>{`TURN ${turnNumber} OF ${MAX_TURNS}`}</SectionLabel>
        {/* Skip button is rendered separately below so it always sits
            above any overlay (otherwise the welcome overlay's backdrop
            would absorb the tap). The header reserves space for it
            via `flex-end` justification + an empty placeholder. */}
        <View style={styles.skipPlaceholder} />
      </View>

      <ScrollView
        style={styles.timeline}
        contentContainerStyle={styles.timelineContent}
        showsVerticalScrollIndicator={false}
      >
        {state.guesses.map((g, i) => (
          <View key={i} style={styles.guessRow}>
            {g.digits.map((d, j) => (
              <DigitTile key={j} digit={d} state={g.states[j] ?? 'gray'} size={36} />
            ))}
          </View>
        ))}
        {state.guesses.length === 0 ? (
          <Text style={styles.emptyHint}>Make your first guess.</Text>
        ) : null}
      </ScrollView>

      <View style={[styles.inputArea, { paddingBottom: insets.bottom + 18 }]}>
        <View style={styles.draftRow}>
          {state.draftDigits.map((d, i) => {
            const isLocked = i === state.lockedPosition;
            return (
              <DigitTile
                key={i}
                digit={d}
                state={isLocked ? 'green' : d != null ? 'violet' : 'neutral'}
                size={44}
              />
            );
          })}
        </View>

        <DigitKeypad
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          disabled={inputDisabled}
        />

        <Button
          onPress={submitGuess}
          disabled={!isComplete || inputDisabled}
          size="lg"
          style={styles.guessButton}
        >
          Guess
        </Button>
      </View>

      <TutorialToast
        visible={state.showFirstGuessToast && !inputDisabled}
        message="Tap pegs to build your guess."
        testID="tutorial-toast-first-guess"
      />
      <TutorialToast
        visible={state.showAutoHintToast}
        badge="Tutorial"
        message={
          state.lockedPosition !== null
            ? `Here's a hint — position ${state.lockedPosition + 1} is`
            : "Here's a hint"
        }
        testID="tutorial-toast-auto-hint"
      >
        {revealedHintDigit !== null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Got it"
            onPress={dismissAutoHint}
          >
            <DigitTile digit={revealedHintDigit} state="green" size={32} />
          </Pressable>
        ) : null}
      </TutorialToast>

      <TutorialOverlay
        visible={state.overlay === 'welcome'}
        title="Crack the code"
        body="4 digits. 0–9. 10 guesses. Make a guess, read the feedback, narrow it down."
        ctaLabel="Start →"
        onDismiss={() => dismissOverlay(null)}
        testID="tutorial-overlay-welcome"
      />
      <TutorialOverlay
        visible={state.overlay === 'feedbackTeaching'}
        title="Reading the feedback"
        body="Green = right digit, right position. Yellow = right digit, wrong position. Gray = not in the code."
        ctaLabel="Got it →"
        onDismiss={() => dismissOverlay(null)}
        testID="tutorial-overlay-feedback"
      />
      <TutorialOverlay
        visible={state.overlay === 'win'}
        title="Code cracked!"
        body={`+${TUTORIAL_REWARD_TOKENS} tokens earned.`}
        ctaLabel="Continue →"
        onDismiss={onWinContinue}
        testID="tutorial-overlay-win"
      />

      <SkipTutorialDialog
        visible={showSkipDialog}
        onCancel={onSkipCancel}
        onConfirm={onSkipConfirm}
        testID="tutorial-skip-dialog"
      />

      {/* Skip button rendered last in the tree (zIndex via order) so an
          overlay's backdrop never absorbs its tap. The Pressable sits
          at top-right with safe-area padding and is hidden when the
          confirm dialog is up (the dialog is the focused surface; a
          second Skip press there would be redundant). */}
      {showSkipDialog ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip tutorial"
          onPress={onSkipPress}
          style={({ pressed }) => [
            styles.skipFloater,
            { top: insets.top + 14 },
            pressed && styles.skipPressed,
          ]}
          testID="tutorial-skip"
        >
          <Text style={styles.skipLabel}>Skip</Text>
        </Pressable>
      )}
    </Screen>
  );
}

interface TutorialLoseViewProps {
  readonly secret: readonly number[];
  readonly onTryAgain: () => void;
  readonly onSkipAndContinue: () => void;
}

function TutorialLoseView({
  secret,
  onTryAgain,
  onSkipAndContinue,
}: TutorialLoseViewProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <Screen ambientIntensity={0.12}>
      <View style={[styles.loseRoot, { paddingTop: insets.top + 80 }]}>
        <Text style={styles.loseTitle} accessibilityRole="header">
          Not this time
        </Text>
        <Text style={styles.loseSubtitle}>The code was</Text>
        <View style={styles.loseSecretRow} testID="tutorial-lose-reveal">
          {secret.map((d, i) => (
            <DigitTile key={i} digit={d} state="green" size={48} />
          ))}
        </View>
        <Text style={styles.loseBody}>
          Losing in the tutorial is normal — Mastermind takes practice.
        </Text>
      </View>

      <View style={[styles.loseFooter, { paddingBottom: insets.bottom + 24 }]}>
        <Button onPress={onTryAgain} size="lg" style={styles.loseTryAgain}>
          Try again
        </Button>
        <Button onPress={onSkipAndContinue} variant="outline" size="lg">
          Skip and continue
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  skipPlaceholder: {
    width: 56,
    height: 28,
  },
  skipFloater: {
    position: 'absolute',
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    zIndex: 100,
    elevation: 12,
  },
  skipPressed: { opacity: 0.55 },
  skipLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  timeline: { flex: 1 },
  timelineContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 10,
  },
  guessRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  emptyHint: {
    marginTop: 24,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textDim,
    textAlign: 'center',
  },
  inputArea: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.bgBase,
    gap: 10,
  },
  draftRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  guessButton: {
    marginTop: 4,
  },
  loseRoot: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  loseTitle: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.text,
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  loseSubtitle: {
    marginTop: 22,
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textDim,
  },
  loseSecretRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  loseBody: {
    marginTop: 26,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  loseFooter: {
    paddingHorizontal: 24,
    flexDirection: 'column',
    gap: 10,
  },
  loseTryAgain: {
    width: '100%',
  },
});
