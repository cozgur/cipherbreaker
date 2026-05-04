/**
 * Phase 7A.4 CP4 — Daily Challenge result screen.
 *
 * Reads `userStore.dailyChallenge.lastResult` (stamped at submit
 * time by `dailyChallengeStore.submitGuess` → `recordDailyResult`).
 * Surfaces the just-completed attempt: success or failure header,
 * turn count, current streak, the share button (CP7 — native
 * Share.share({message})) and the next-puzzle countdown (post-launch
 * polish — current copy is "tomorrow").
 *
 * No replay path — Wordle-faithful "you played today, see you
 * tomorrow." Tapping the back affordance returns to Home; banner
 * navigation in CP5 will route returning visitors here directly via
 * the HomeScreen state-aware guard.
 */

import { useCallback } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Screen } from '@components/Screen';
import { calendarDayIndex } from '@game/daily/dailyConfig';
import { formatDailyShare } from '@game/daily/share';
import type { RootStackParamList } from '@navigation/routes';
import { useUserStore } from '@state/userStore';
import { colors, fonts, withAlpha } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'DailyResult'>;

export function DailyResultScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const lastResult = useUserStore((s) => s.dailyChallenge.lastResult);
  const currentStreak = useUserStore((s) => s.dailyChallenge.currentStreak);
  const longestStreak = useUserStore((s) => s.dailyChallenge.longestStreak);

  const goHome = useCallback(() => navigation.navigate('Home'), [navigation]);
  const onShare = useCallback(() => {
    // Phase 7A.4 CP7 — native Share sheet hookup. iOS surfaces the
    // system share sheet (AirDrop / Messages / Mail / etc.); Android
    // surfaces the equivalent intent picker. The promise rejects on
    // user cancel on iOS — swallow it so the screen doesn't show an
    // unhandled-rejection toast for a non-error path.
    if (lastResult === null) return;
    void Share.share({ message: formatDailyShare(lastResult) }).catch(() => undefined);
  }, [lastResult]);

  // Defensive — direct navigation to this screen with no recorded
  // result is a programmer error in production but handled cleanly
  // so a developer poking the route doesn't see a crash.
  if (lastResult === null) {
    return (
      <Screen>
        <View style={[styles.body, { paddingTop: insets.top + 40 }]}>
          <Text style={styles.headline}>No daily result yet</Text>
          <Text style={styles.subline}>Play today&apos;s puzzle to see your result here.</Text>
          <PrimaryButton label="HOME" onPress={goHome} />
        </View>
      </Screen>
    );
  }

  const dayNumber = calendarDayIndex(lastResult.date);
  const headline = lastResult.success
    ? `Cracked in ${lastResult.turnsUsed}/${lastResult.turnLimit}`
    : 'Day not cracked';

  return (
    <Screen>
      <View style={[styles.body, { paddingTop: insets.top + 32 }]}>
        <Text style={styles.dayLabel}>DAY #{dayNumber}</Text>
        <Text
          style={[styles.headline, lastResult.success ? styles.headlineWin : styles.headlineLose]}
        >
          {headline}
        </Text>

        {!lastResult.success ? (
          <View style={styles.revealBlock}>
            <Text style={styles.revealLabel}>THE CODE WAS</Text>
            <Text style={styles.revealValue} accessibilityLabel={`Secret was ${lastResult.secret}`}>
              {lastResult.secret}
            </Text>
          </View>
        ) : null}

        <View style={styles.skillBadge}>
          {lastResult.hintsUsed === 0 ? (
            <Text style={styles.skillBadgeText}>🎯 PURE SKILL</Text>
          ) : (
            <Text style={styles.hintsBadgeText}>
              {lastResult.hintsUsed === 1 ? 'Used 1 hint' : `Used ${lastResult.hintsUsed} hints`}
            </Text>
          )}
        </View>

        <View style={styles.statsBlock}>
          <Stat label="Streak" value={`${currentStreak} ${currentStreak === 1 ? 'day' : 'days'}`} />
          <Stat
            label="Best"
            value={`${longestStreak} ${longestStreak === 1 ? 'day' : 'days'}`}
          />
        </View>

        <View style={styles.countdownBlock}>
          <Text style={styles.countdownLabel}>NEXT PUZZLE</Text>
          <Text style={styles.countdownValue}>tomorrow</Text>
        </View>

        <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
          <PrimaryButton label="SHARE" onPress={onShare} />
          <SecondaryButton label="HOME" onPress={goHome} />
        </View>
      </View>
    </Screen>
  );
}

interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
}

function PrimaryButton({ label, onPress }: ButtonProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && styles.primaryButtonPressed,
      ]}
    >
      <Text style={styles.primaryLabel}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: ButtonProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed && styles.secondaryButtonPressed,
      ]}
    >
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

interface StatProps {
  readonly label: string;
  readonly value: string;
}

function Stat({ label, value }: StatProps): React.JSX.Element {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'stretch',
  },
  dayLabel: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: withAlpha(colors.violet, 0.18),
    borderWidth: 1,
    borderColor: withAlpha(colors.violet, 0.4),
    color: colors.violet,
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  headline: {
    marginTop: 28,
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  headlineWin: {
    color: colors.success,
  },
  headlineLose: {
    color: colors.danger,
  },
  subline: {
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  revealBlock: {
    marginTop: 24,
    alignItems: 'center',
  },
  revealLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  revealValue: {
    marginTop: 6,
    fontFamily: fonts.mono,
    fontSize: 26,
    letterSpacing: 4,
    color: colors.text,
  },
  skillBadge: {
    marginTop: 22,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.4),
    backgroundColor: withAlpha(colors.gold, 0.12),
  },
  skillBadgeText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    letterSpacing: 1.6,
    color: colors.gold,
    textTransform: 'uppercase',
  },
  hintsBadgeText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  statsBlock: {
    marginTop: 32,
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
    letterSpacing: -0.3,
  },
  statLabel: {
    marginTop: 4,
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  countdownBlock: {
    marginTop: 24,
    alignItems: 'center',
  },
  countdownLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  countdownValue: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  actions: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: 10,
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.violet,
    alignItems: 'center',
  },
  primaryButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  primaryLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    letterSpacing: 1.6,
    color: colors.text,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
  },
  secondaryButtonPressed: {
    opacity: 0.7,
  },
  secondaryLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    letterSpacing: 1.6,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
});
