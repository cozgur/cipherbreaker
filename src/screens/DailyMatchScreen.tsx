/**
 * Phase 7A.4 CP6 — Daily Challenge play surface.
 *
 * Single-player Wordle-style flow with the CP6 hint mechanic
 * layered on. No bot, no PvP primitives. Two hint actions sit
 * above the keypad:
 *
 *   💡 HINT  — Hint A reveal (priority green > yellow > warning).
 *              Pulls the picker via `analyzeHintCandidates(...)`.
 *              Cost: 1 earned hint OR 100 tokens. `'warning'`
 *              short-circuits and charges nothing — no info, no
 *              charge.
 *   🔍 PROBE — Hint B existence test. Player taps PROBE → digit
 *              picker modal → confirm → result modal. Already-
 *              probed digits disabled in the picker. Cost: 1 earned
 *              hint OR 50 tokens. probedDigits state drives the
 *              keypad indicator overlay (green dot for `exists`,
 *              strikethrough for `!exists`).
 *
 * Draft input:
 *   - Revealed positions (from green hints) auto-fill the draft
 *     row with the secret digit and lock the cell (a green border).
 *   - User taps fill the remaining (non-revealed) positions in
 *     order. Backspace removes the last user-typed digit.
 *
 * Hint A yellow reveals don't auto-fill — they confirm "this digit
 * exists somewhere" without binding it. The keypad indicator
 * surfaces the same digit; the player chooses where to place it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import * as haptics from '@/lib/haptics';
import { DigitKeypad, type DigitKeypadIndicator } from '@components/DigitKeypad';
import { DigitTile } from '@components/DigitTile';
import { Mode1Row } from '@components/game/rows/Mode1Row';
import { Mode3Row } from '@components/game/rows/Mode3Row';
import { Screen } from '@components/Screen';
import { calendarDayIndex, getDailyConfig } from '@game/daily/dailyConfig';
import { formatDailyDate } from '@game/daily/dailyDate';
import { colorMatchStates } from '@game/daily/evaluate';
import { dailyModeForDate, dailyModeLabel, type DailyMode } from '@game/daily/dailyMode';
import {
  analyzeHintCandidates,
  canProbeDigit,
  hintCostForState,
  HINT_PROBE_TOKEN_COST,
  HINT_REVEAL_TOKEN_COST,
} from '@game/daily/hint';
import type { DailyGuessRecord, DailyInProgress } from '@game/daily/types';
import type { GuessRowProps, NormalizedFeedback } from '@game/types';
import type { RootStackParamList } from '@navigation/routes';
import { useDailyChallengeStore } from '@state/dailyChallengeStore';
import { useUserStore } from '@state/userStore';
import { JITTooltipHost } from '@components/tutorial/JITTooltipHost';
import { fireJITTooltip } from '@/lib/jitTooltipManager';
import { colors, fonts, withAlpha } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Daily'>;

const PROBE_DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/**
 * Phase 7A.8 CP3 — HINT_SPEND JIT tooltip trigger. Called from the
 * OK callback of green / yellow hint Alerts and the resolved-probe
 * Alert. Eligibility gate matches the spec:
 *   - `hasOnboarded === true` — onboarding flow suppresses all JIT
 *     tooltips. TutorialMatch's auto-hint is purely local state and
 *     never reaches this seam (no `useHint` call); covered
 *     defensively here regardless.
 *   - `!jitTooltipsSeen.firstHintSpend` — fire once per user.
 * `fireJITTooltip` reads the seen flag and short-circuits if set,
 * but reading it upfront keeps the seam grep-able from the screen.
 */
function maybeFireHintSpendTooltip(): void {
  const state = useUserStore.getState();
  if (!state.hasOnboarded) return;
  if (state.jitTooltipsSeen.firstHintSpend) return;
  fireJITTooltip('HINT_SPEND');
}

export function DailyMatchScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const username = useUserStore((s) => s.username);
  const tokens = useUserStore((s) => s.tokens);
  const dailyState = useUserStore((s) => s.dailyChallenge);
  const currentAttempt = useDailyChallengeStore((s) => s.currentAttempt);
  const submitGuess = useDailyChallengeStore((s) => s.submitGuess);

  const [today] = useState(() => formatDailyDate(new Date()));
  const config = useMemo(() => getDailyConfig(today, dailyState), [today, dailyState]);
  const dayNumber = useMemo(() => calendarDayIndex(today), [today]);
  // Phase 7A.8 CP9 — today's mode is a pure function of the day index
  // (deterministic alternation Mode 1 ↔ Mode 3). Re-derived on render,
  // never persisted — the attempt only stores `date`.
  const mode = useMemo<DailyMode>(() => dailyModeForDate(today), [today]);
  const modeLabel = useMemo(() => dailyModeLabel(mode), [mode]);

  useEffect(() => {
    useDailyChallengeStore.getState().startToday(today, config);
  }, [today, config]);

  const [userInput, setUserInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPickingProbe, setIsPickingProbe] = useState(false);

  const onDigit = useCallback(
    (digit: number) => {
      setError(null);
      setUserInput((prev) => {
        const remaining = config.digits - (currentAttempt?.revealedPositions.length ?? 0);
        if (prev.length >= remaining) return prev;
        return prev + digit.toString();
      });
    },
    [config.digits, currentAttempt],
  );

  const onBackspace = useCallback(() => {
    setError(null);
    setUserInput((prev) => prev.slice(0, -1));
  }, []);

  const fullDraft = useMemo(
    () => composeDraft(userInput, currentAttempt?.revealedPositions ?? [], currentAttempt?.secret ?? '', config.digits),
    [userInput, currentAttempt, config.digits],
  );

  const onSubmit = useCallback(() => {
    if (currentAttempt === null) return;
    const remaining = config.digits - currentAttempt.revealedPositions.length;
    if (userInput.length !== remaining) {
      setError(`Enter ${remaining} more digit${remaining === 1 ? '' : 's'}.`);
      return;
    }
    haptics.impact('medium');
    const guess = fullDraft.join('');
    const result = submitGuess(guess);
    if (result.error !== null) {
      setError(result.error.message);
      return;
    }
    setUserInput('');
    setError(null);
    if (result.summary !== null) {
      navigation.replace('DailyResult');
    } else {
      // Phase 7A.7 CP1 — feedback-rendered pulse for non-final
      // guesses (the row appears in the timeline; no navigation).
      haptics.impact('light');
    }
  }, [currentAttempt, config.digits, userInput, fullDraft, submitGuess, navigation]);

  const onClose = useCallback(() => navigation.navigate('Home'), [navigation]);

  // ── Hint A button state machine ──
  const hintCandidate = useMemo(
    () =>
      currentAttempt
        ? analyzeHintCandidates(
            currentAttempt.secret,
            currentAttempt.guesses,
            currentAttempt.revealedPositions,
            currentAttempt.revealedDigits,
          )
        : null,
    [currentAttempt],
  );
  const hintAffordability = useMemo(
    () => hintCostForState(dailyState.earnedHints, tokens, HINT_REVEAL_TOKEN_COST),
    [dailyState.earnedHints, tokens],
  );
  const hintButton = useMemo(
    () => buildHintButtonState(currentAttempt, hintCandidate, hintAffordability, dailyState.earnedHints),
    [currentAttempt, hintCandidate, hintAffordability, dailyState.earnedHints],
  );

  const onHintPress = useCallback(() => {
    if (currentAttempt === null) return;
    haptics.impact('medium');
    const r = useDailyChallengeStore.getState().useHint();
    if (r.kind === 'no-attempt' || r.kind === 'unaffordable') {
      // Both should be UI-prevented; defensive no-op.
      return;
    }
    if (r.kind === 'warning') {
      // Warning short-circuits — no hint resource consumed, no
      // JIT tooltip. (`hintCostForState` returns 'free' for
      // this branch in the store; nothing to teach about.)
      Alert.alert('No correct digits yet', 'Try a guess that lands at least one position or digit first.');
      return;
    }
    // Phase 7A.8 CP3 — green / yellow are token- or earned-hint-
    // paid. The OK callback fires the HINT_SPEND tooltip AFTER
    // the Alert dismisses so the toast's 5s auto-dismiss timer
    // doesn't tick down behind a blocking native dialog.
    if (r.kind === 'green') {
      Alert.alert('Hint', `Position ${r.position + 1} is ${r.digit}.`, [
        { text: 'OK', onPress: maybeFireHintSpendTooltip },
      ]);
      return;
    }
    // yellow
    Alert.alert(
      'Hint',
      `Digit ${r.digit} is somewhere in the secret. Place it to find out where.`,
      [{ text: 'OK', onPress: maybeFireHintSpendTooltip }],
    );
  }, [currentAttempt]);

  // ── Hint B (Probe) state machine ──
  const probeAffordability = useMemo(
    () => hintCostForState(dailyState.earnedHints, tokens, HINT_PROBE_TOKEN_COST),
    [dailyState.earnedHints, tokens],
  );
  const probeButton = useMemo(
    () => buildProbeButtonState(currentAttempt, probeAffordability, dailyState.earnedHints),
    [currentAttempt, probeAffordability, dailyState.earnedHints],
  );

  const onProbePress = useCallback(() => {
    if (currentAttempt === null || probeButton.disabled) return;
    haptics.impact('medium');
    setIsPickingProbe(true);
  }, [currentAttempt, probeButton.disabled]);

  const onPickProbeDigit = useCallback(
    (digit: number) => {
      setIsPickingProbe(false);
      const costLabel =
        probeAffordability === 'earned'
          ? '1 earned hint'
          : `${HINT_PROBE_TOKEN_COST} tokens`;
      Alert.alert(`Probe digit ${digit}?`, `Costs ${costLabel}.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Probe',
          onPress: () => {
            const r = useDailyChallengeStore.getState().useProbe(digit);
            if (r.kind === 'resolved') {
              // Phase 7A.8 CP3 — probe is the other token-/earned-
              // hint-paid path; same OK-callback fire pattern as
              // `onHintPress` so the tooltip lands after the
              // native Alert dismisses.
              Alert.alert(
                r.exists ? `✅ ${r.digit} is in the secret` : `❌ ${r.digit} is not in the secret`,
                undefined,
                [{ text: 'OK', onPress: maybeFireHintSpendTooltip }],
              );
            }
          },
        },
      ]);
    },
    [probeAffordability],
  );

  // ── Keypad indicators ──
  const indicators = useMemo(
    () => buildKeypadIndicators(currentAttempt),
    [currentAttempt],
  );

  const guesses = currentAttempt?.guesses ?? [];
  const turnsUsed = guesses.length;
  const turnsRemaining = Math.max(0, config.turnLimit - turnsUsed);

  // Phase 7A.4 post-CP7 iOS test fix — at 5+ guesses the history
  // view's natural height pushed past its `flexShrink: 1` parent and
  // the rows rendered through the draft row below (RN default
  // `overflow: 'visible'`). Wrapping in a ScrollView gives the
  // history a bounded scroll region and keeps the static stack
  // (draft + hints + keypad + submit) anchored. Auto-scroll mirrors
  // the chat-app convention used in `MatchScreen.tsx`.
  const historyRef = useRef<ScrollView>(null);
  useEffect(() => {
    const id = setTimeout(() => {
      historyRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(id);
  }, [turnsUsed]);

  return (
    <Screen>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onClose}
          style={styles.backChip}
        >
          <Svg width={14} height={14} viewBox="0 0 14 14">
            <Path
              d="M9 3L5 7l4 4"
              stroke={colors.textSecondary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </Pressable>
        <View style={styles.dayBadge}>
          <Text style={styles.dayBadgeText}>DAY #{dayNumber}</Text>
        </View>
        <View style={styles.spacer} />
      </View>

      <View style={styles.body}>
        <View style={styles.headerStack}>
          <Text style={styles.title}>DAILY</Text>
          <Text
            style={styles.modeLabel}
            accessibilityLabel={`Daily Challenge — ${modeLabel}`}
          >
            {modeLabel}
          </Text>
          <Text style={styles.subtitle}>
            {config.digits} digits · {turnsRemaining}/{config.turnLimit} turns left
          </Text>
        </View>

        <ScrollView
          ref={historyRef}
          style={styles.history}
          contentContainerStyle={styles.historyContent}
          accessibilityLabel="Daily guess history"
          showsVerticalScrollIndicator={false}
        >
          {guesses.map((entry, idx) => {
            const rowProps = buildRowProps(entry, username, mode, currentAttempt?.secret ?? '');
            return mode === 1 ? (
              <Mode1Row key={idx} {...rowProps} />
            ) : (
              <Mode3Row key={idx} {...rowProps} />
            );
          })}
          {guesses.length === 0 ? (
            <Text style={styles.placeholder}>
              Crack today&apos;s code in {config.turnLimit} guesses or fewer.
            </Text>
          ) : null}
        </ScrollView>

        <View style={styles.draftBlock}>
          <View style={styles.draftRow}>
            {fullDraft.map((digit, i) => {
              const isRevealed = currentAttempt?.revealedPositions.includes(i) === true;
              return (
                <View key={i} style={[isRevealed && styles.draftCellRevealed]}>
                  <DigitTile
                    digit={digit !== '' ? Number.parseInt(digit, 10) : undefined}
                    state={isRevealed ? 'green' : 'neutral'}
                    size={42}
                  />
                </View>
              );
            })}
          </View>
          {error !== null ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.hintRow}>
          <HintButton
            label={hintButton.label}
            sublabel={hintButton.sublabel}
            disabled={hintButton.disabled}
            tone="hint"
            onPress={onHintPress}
            accessibilityLabel="Hint button"
          />
          <HintButton
            label={probeButton.label}
            sublabel={probeButton.sublabel}
            disabled={probeButton.disabled}
            tone="probe"
            onPress={onProbePress}
            accessibilityLabel="Probe button"
          />
        </View>

        <View style={styles.keypadWrap}>
          <DigitKeypad onDigit={onDigit} onBackspace={onBackspace} indicators={indicators} />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Submit guess"
          onPress={onSubmit}
          disabled={
            userInput.length !==
            config.digits - (currentAttempt?.revealedPositions.length ?? 0)
          }
          style={({ pressed }) => [
            styles.submitButton,
            userInput.length !==
              config.digits - (currentAttempt?.revealedPositions.length ?? 0) &&
              styles.submitButtonDisabled,
            pressed &&
            userInput.length === config.digits - (currentAttempt?.revealedPositions.length ?? 0)
              ? styles.submitButtonPressed
              : null,
            { marginBottom: insets.bottom + 16 },
          ]}
        >
          <Text style={styles.submitLabel}>SUBMIT</Text>
        </Pressable>
      </View>

      <Modal
        visible={isPickingProbe}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPickingProbe(false)}
      >
        <Pressable
          accessibilityLabel="Dismiss probe picker"
          onPress={() => setIsPickingProbe(false)}
          style={styles.modalBackdrop}
        >
          <Pressable
            accessibilityLabel="Probe digit picker"
            onPress={() => undefined}
            style={styles.probeSheet}
          >
            <Text style={styles.probeSheetTitle}>Pick a digit to probe</Text>
            <Text style={styles.probeSheetSubtitle}>
              {probeAffordability === 'earned'
                ? '1 earned hint'
                : `${HINT_PROBE_TOKEN_COST} tokens`}
            </Text>
            <View style={styles.probeGrid}>
              {PROBE_DIGITS.map((d) => {
                const probed = currentAttempt
                  ? !canProbeDigit(d, currentAttempt.probedDigits)
                  : false;
                return (
                  <Pressable
                    key={d}
                    accessibilityRole="button"
                    accessibilityLabel={`Probe digit ${d}${probed ? ' (already probed)' : ''}`}
                    disabled={probed}
                    onPress={() => onPickProbeDigit(d)}
                    style={({ pressed }) => [
                      styles.probeChoice,
                      probed && styles.probeChoiceDisabled,
                      pressed && !probed && styles.probeChoicePressed,
                    ]}
                  >
                    <Text
                      style={[styles.probeChoiceLabel, probed && styles.probeChoiceLabelDisabled]}
                    >
                      {d}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel probe"
              onPress={() => setIsPickingProbe(false)}
              style={styles.probeCancel}
            >
              <Text style={styles.probeCancelLabel}>CANCEL</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <JITTooltipHost />
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers — pure
// ─────────────────────────────────────────────────────────────

interface ButtonState {
  readonly label: string;
  readonly sublabel: string;
  readonly disabled: boolean;
}

function buildHintButtonState(
  attempt: DailyInProgress | null,
  candidate: ReturnType<typeof analyzeHintCandidates> | null,
  affordability: ReturnType<typeof hintCostForState>,
  earnedHints: number,
): ButtonState {
  if (attempt === null) {
    return { label: 'HINT', sublabel: '—', disabled: true };
  }
  if (attempt.guesses.length === 0) {
    return { label: 'HINT', sublabel: 'Make a guess first', disabled: true };
  }
  if (candidate === null || candidate.kind === 'warning') {
    return { label: 'HINT', sublabel: 'No correct digits yet', disabled: true };
  }
  if (affordability === 'unaffordable') {
    return { label: 'HINT', sublabel: 'Need 100 tokens', disabled: true };
  }
  const sub = affordability === 'earned' ? `Free (${earnedHints} left)` : '100 tokens';
  return { label: 'HINT', sublabel: sub, disabled: false };
}

function buildProbeButtonState(
  attempt: DailyInProgress | null,
  affordability: ReturnType<typeof hintCostForState>,
  earnedHints: number,
): ButtonState {
  if (attempt === null) {
    return { label: 'PROBE', sublabel: '—', disabled: true };
  }
  // All digits already probed → nothing left to ask about.
  if (attempt.probedDigits.length >= 10) {
    return { label: 'PROBE', sublabel: 'All digits probed', disabled: true };
  }
  if (affordability === 'unaffordable') {
    return { label: 'PROBE', sublabel: 'Need 50 tokens', disabled: true };
  }
  const sub = affordability === 'earned' ? `Free (${earnedHints} left)` : '50 tokens';
  return { label: 'PROBE', sublabel: sub, disabled: false };
}

function buildKeypadIndicators(
  attempt: DailyInProgress | null,
): Readonly<Record<number, DigitKeypadIndicator>> {
  if (attempt === null) return {};
  const out: Record<number, DigitKeypadIndicator> = {};
  // Hint A yellow reveals → positive (digit confirmed in secret).
  for (const d of attempt.revealedDigits) out[d] = 'positive';
  // Hint B probes → positive if exists, negative if not. Probe
  // wins over yellow on collision (it's the more recent / explicit
  // signal — the player paid for the answer).
  for (const r of attempt.probedDigits) {
    out[r.digit] = r.exists ? 'positive' : 'negative';
  }
  return out;
}

function composeDraft(
  userInput: string,
  revealedPositions: readonly number[],
  secret: string,
  digits: number,
): string[] {
  const taken = new Set(revealedPositions);
  const out: string[] = [];
  let userIdx = 0;
  for (let i = 0; i < digits; i += 1) {
    if (taken.has(i)) {
      out.push(secret[i] ?? '');
    } else {
      out.push(userInput[userIdx] ?? '');
      userIdx += 1;
    }
  }
  return out;
}

function buildRowProps(
  record: DailyGuessRecord,
  avatar: string,
  mode: DailyMode,
  secret: string,
): GuessRowProps {
  // Mode 1 (Color Match) days paint each digit green / yellow / gray,
  // recomputed from the persisted (guess, secret). Mode 3 (Precision)
  // days keep neutral digits + the +N/−M chip the row already shows.
  if (mode === 1) {
    const states = colorMatchStates(record.guess, secret);
    const digits = Array.from({ length: record.guess.length }, (_, i) => ({
      val: Number.parseInt(record.guess[i] as string, 10),
      state: states[i] ?? 'neutral',
    }));
    const feedback: NormalizedFeedback = {
      kind: 'colorMatch',
      states,
      isWin: record.isWin,
    };
    return { side: 'right', avatar, digits, feedback };
  }

  const digits = Array.from({ length: record.guess.length }, (_, i) => ({
    val: Number.parseInt(record.guess[i] as string, 10),
    state: 'neutral' as const,
  }));
  const feedback: NormalizedFeedback = {
    kind: 'precision',
    plus: record.plus,
    minus: record.minus,
    isWin: record.isWin,
  };
  return {
    side: 'right',
    avatar,
    digits,
    feedback,
  };
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

interface HintButtonProps {
  readonly label: string;
  readonly sublabel: string;
  readonly disabled: boolean;
  readonly tone: 'hint' | 'probe';
  readonly onPress: () => void;
  readonly accessibilityLabel: string;
}

function HintButton({
  label,
  sublabel,
  disabled,
  tone,
  onPress,
  accessibilityLabel,
}: HintButtonProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.hintButton,
        tone === 'probe' ? styles.hintButtonProbe : styles.hintButtonHint,
        disabled && styles.hintButtonDisabled,
        pressed && !disabled && styles.hintButtonPressed,
      ]}
    >
      <Text style={[styles.hintButtonLabel, disabled && styles.hintButtonLabelDisabled]}>
        {tone === 'hint' ? '💡 ' : '🔍 '}
        {label}
      </Text>
      <Text style={styles.hintButtonSublabel}>{sublabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: withAlpha(colors.violet, 0.18),
    borderWidth: 1,
    borderColor: withAlpha(colors.violet, 0.4),
  },
  dayBadgeText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.violet,
    textTransform: 'uppercase',
  },
  spacer: {
    width: 36,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
  },
  headerStack: {
    alignItems: 'center',
    marginTop: 12,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.text,
    letterSpacing: -0.4,
  },
  modeLabel: {
    marginTop: 2,
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
    letterSpacing: 1.2,
    color: colors.violet,
    textTransform: 'uppercase',
  },
  subtitle: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  history: {
    flex: 1,
    marginTop: 16,
  },
  historyContent: {
    flexGrow: 1,
    minHeight: 80,
  },
  placeholder: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 24,
  },
  draftBlock: {
    marginTop: 12,
    alignItems: 'center',
  },
  draftRow: {
    flexDirection: 'row',
    gap: 8,
  },
  draftCellRevealed: {
    borderRadius: 6,
    borderWidth: 2,
    borderColor: withAlpha(colors.success, 0.6),
  },
  error: {
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.danger,
  },
  hintRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  hintButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintButtonHint: {
    backgroundColor: withAlpha(colors.violet, 0.14),
    borderColor: withAlpha(colors.violet, 0.4),
  },
  hintButtonProbe: {
    backgroundColor: withAlpha(colors.warning, 0.14),
    borderColor: withAlpha(colors.warning, 0.4),
  },
  hintButtonDisabled: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.borderSubtle,
    opacity: 0.7,
  },
  hintButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  hintButtonLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
    letterSpacing: 1.2,
    color: colors.text,
    textTransform: 'uppercase',
  },
  hintButtonLabelDisabled: {
    color: colors.textSecondary,
  },
  hintButtonSublabel: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textSecondary,
  },
  keypadWrap: {
    marginTop: 12,
  },
  submitButton: {
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.violet,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: withAlpha(colors.violet, 0.32),
  },
  submitButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  submitLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    letterSpacing: 1.6,
    color: colors.text,
    textTransform: 'uppercase',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: withAlpha('#000000', 0.55),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  probeSheet: {
    width: '100%',
    backgroundColor: colors.bgElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 18,
    paddingVertical: 22,
    alignItems: 'center',
  },
  probeSheetTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.text,
    letterSpacing: -0.2,
  },
  probeSheetSubtitle: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  probeGrid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  probeChoice: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.bgBase,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  probeChoiceDisabled: {
    backgroundColor: withAlpha(colors.borderSubtle, 0.4),
    opacity: 0.55,
  },
  probeChoicePressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  probeChoiceLabel: {
    fontFamily: fonts.mono,
    fontSize: 22,
    color: colors.text,
  },
  probeChoiceLabelDisabled: {
    color: colors.textDim,
  },
  probeCancel: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  probeCancelLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    letterSpacing: 1.6,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
});

// Identity export — keeps test helpers stable.
export const __TEST_ONLY = { buildRowProps, composeDraft, buildKeypadIndicators };
