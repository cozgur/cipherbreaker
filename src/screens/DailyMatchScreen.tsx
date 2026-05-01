/**
 * Phase 7A.4 CP4 — Daily Challenge play surface.
 *
 * Single-player Wordle-style flow. No bot, no SoloRaceBanner, no
 * PlayerCardPair — those primitives belong to PvP-shaped Modes 1-7.
 * The screen is intentionally lean: identity badge ("DAY #N"), turn
 * counter, history (Mode 3 row reuse — same `+N / -M` precision
 * paint), and the digit input row.
 *
 * Resume on mount: `dailyChallengeStore.startToday(today, config)`.
 * The store handles the cross-midnight stale-drop case (silent +
 * `recordMissedDay`) and either resumes the persisted board or
 * seeds a fresh attempt for today's calendar tier. The user-aware
 * `getDailyConfig(today, userStore.dailyChallenge)` honours Reading
 * A regression: a recently-broken streak shows fewer digits.
 *
 * Win / loss → navigate to `DailyResult`. The store has already
 * stamped `lastResult` on userStore by the time we navigate, so
 * DailyResultScreen renders synchronously with no further fetch.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { DigitKeypad } from '@components/DigitKeypad';
import { DigitTile } from '@components/DigitTile';
import { Mode3Row } from '@components/game/rows/Mode3Row';
import { Screen } from '@components/Screen';
import { calendarDayIndex, getDailyConfig } from '@game/daily/dailyConfig';
import { formatDailyDate } from '@game/daily/dailyDate';
import type { DailyGuessRecord } from '@game/daily/types';
import type { GuessRowProps, NormalizedFeedback } from '@game/types';
import type { RootStackParamList } from '@navigation/routes';
import { useDailyChallengeStore } from '@state/dailyChallengeStore';
import { useUserStore } from '@state/userStore';
import { colors, fonts, withAlpha } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Daily'>;

export function DailyMatchScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const username = useUserStore((s) => s.username);
  const dailyState = useUserStore((s) => s.dailyChallenge);
  const currentAttempt = useDailyChallengeStore((s) => s.currentAttempt);
  const submitGuess = useDailyChallengeStore((s) => s.submitGuess);

  // `today` is captured once on mount. A user who lingers past
  // midnight gets the cross-midnight stale-drop on their NEXT visit,
  // not mid-session — that's Wordle behaviour. (A 5-hour idle session
  // crossing midnight is a rare path; not worth a real-time tick to
  // detect.)
  const [today] = useState(() => formatDailyDate(new Date()));

  const config = useMemo(() => getDailyConfig(today, dailyState), [today, dailyState]);
  const dayNumber = useMemo(() => calendarDayIndex(today), [today]);

  // Initialize-or-resume on mount. `startToday` is idempotent for
  // same-day re-entries (returns false; existing currentAttempt
  // persists), drops stale attempts via the store-level guard.
  useEffect(() => {
    useDailyChallengeStore.getState().startToday(today, config);
  }, [today, config]);

  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onDigit = useCallback(
    (digit: number) => {
      setError(null);
      setDraft((prev) => {
        if (prev.length >= config.digits) return prev;
        return prev + digit.toString();
      });
    },
    [config.digits],
  );

  const onBackspace = useCallback(() => {
    setError(null);
    setDraft((prev) => prev.slice(0, -1));
  }, []);

  const onSubmit = useCallback(() => {
    if (draft.length !== config.digits) {
      setError(`Enter ${config.digits} digits.`);
      return;
    }
    const result = submitGuess(draft);
    if (result.error !== null) {
      setError(result.error.message);
      return;
    }
    setDraft('');
    setError(null);
    if (result.summary !== null) {
      navigation.replace('DailyResult');
    }
  }, [draft, config.digits, submitGuess, navigation]);

  const onClose = useCallback(() => {
    navigation.navigate('Home');
  }, [navigation]);

  const guesses = currentAttempt?.guesses ?? [];
  const turnsUsed = guesses.length;
  const turnsRemaining = Math.max(0, config.turnLimit - turnsUsed);

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
          <Text style={styles.subtitle}>
            {config.digits} digits · {turnsRemaining}/{config.turnLimit} turns left
          </Text>
        </View>

        <View style={styles.history} accessibilityLabel="Daily guess history">
          {guesses.map((entry, idx) => (
            <Mode3Row key={idx} {...buildRowProps(entry, username)} />
          ))}
          {guesses.length === 0 ? (
            <Text style={styles.placeholder}>
              Crack today&apos;s code in {config.turnLimit} guesses or fewer.
            </Text>
          ) : null}
        </View>

        <View style={styles.draftBlock}>
          <View style={styles.draftRow}>
            {Array.from({ length: config.digits }, (_, i) => {
              const digit = draft[i];
              return (
                <DigitTile
                  key={i}
                  digit={digit !== undefined ? Number.parseInt(digit, 10) : undefined}
                  state="neutral"
                  size={42}
                />
              );
            })}
          </View>
          {error !== null ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.keypadWrap}>
          <DigitKeypad onDigit={onDigit} onBackspace={onBackspace} />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Submit guess"
          onPress={onSubmit}
          disabled={draft.length !== config.digits}
          style={({ pressed }) => [
            styles.submitButton,
            draft.length !== config.digits && styles.submitButtonDisabled,
            pressed && draft.length === config.digits ? styles.submitButtonPressed : null,
            { marginBottom: insets.bottom + 16 },
          ]}
        >
          <Text style={styles.submitLabel}>SUBMIT</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function buildRowProps(record: DailyGuessRecord, avatar: string): GuessRowProps {
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
  subtitle: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  history: {
    marginTop: 16,
    minHeight: 120,
    flexShrink: 1,
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
  error: {
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.danger,
  },
  keypadWrap: {
    marginTop: 14,
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
});

// Identity export — keeps the file's type alias visible to test
// helpers that pass `useDailyChallengeStore` through type-checked
// imports without a recursive cycle.
export const __TEST_ONLY = { buildRowProps };
