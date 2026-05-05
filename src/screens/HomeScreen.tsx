/**
 * Home hub — token wallet, settings access, and the seven-mode list.
 * Tapping a ModeCard either dispatches into Matchmaking (balance
 * covers the stake) or the InsufficientTokens modal (it doesn't).
 * The CLASSIC vs ADVANCED split is driven off the mode catalog's
 * `meta.section` — adding a new mode needs no changes here.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '@components/Avatar';
import { LevelBar } from '@components/LevelBar';
import { LowBalanceToast } from '@components/LowBalanceToast';
import { ModeCard } from '@components/ModeCard';
import { Screen } from '@components/Screen';
import { SectionLabel } from '@components/SectionLabel';
import { TokenBadge } from '@components/TokenBadge';
import { modeCatalog } from '@data/modeCatalog';
import { useMockUser } from '@data/mockUser';
import {
  buildBannerCopy,
  getDailyBannerState,
  timeUntilNextDaily,
  type DailyBannerState,
} from '@game/daily/banner';
import { calendarDayIndex, getDailyConfig } from '@game/daily/dailyConfig';
import { formatDailyDate } from '@game/daily/dailyDate';
import { LOW_BALANCE_THRESHOLD } from '@game/economy/constants';
import type { ModeCatalogEntry } from '@game/types';
import type { RootStackParamList } from '@navigation/routes';
import { useUserStore } from '@state/userStore';
import { colors, fonts, withAlpha } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export function HomeScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const user = useMockUser();
  const insets = useSafeAreaInsets();
  const dailyState = useUserStore((s) => s.dailyChallenge);

  // Phase 7A.5 Codex finding 3 fix — `today` is now mutable. The
  // pre-fix code captured the date once at mount, so a player who
  // left the app open across midnight (or backgrounded it past
  // midnight) saw a stale banner against yesterday's calendar
  // day. The 60s countdown ticker below now also re-evaluates
  // `today` and updates state when the calendar string changes;
  // an AppState listener catches the foreground-return case for
  // backgrounded apps that miss the in-app tick entirely.
  const [today, setToday] = useState(() => formatDailyDate(new Date()));
  const dayNumber = useMemo(() => calendarDayIndex(today), [today]);
  const dailyConfig = useMemo(() => getDailyConfig(today, dailyState), [today, dailyState]);
  const bannerState: DailyBannerState = getDailyBannerState(today, dailyState.lastResult);

  const [countdown, setCountdown] = useState(() => timeUntilNextDaily(new Date()));
  useEffect(() => {
    // 60s tick — minute granularity is enough for the "Resets in
    // 14h 32m" surface. Bundles two state refreshes:
    //   1. Countdown re-format (every minute).
    //   2. Cross-midnight `today` re-evaluation. When the calendar
    //      string flips, banner state recomputes via the existing
    //      memos; HomeScreen is back to the fresh-day branch.
    const interval = setInterval(() => {
      const now = new Date();
      setCountdown(timeUntilNextDaily(now));
      setToday((prev) => {
        const next = formatDailyDate(now);
        return next === prev ? prev : next;
      });
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Phase 7A.5 Codex finding 3 fix — AppState listener for the
  // backgrounded-past-midnight case. The 60s in-app tick won't
  // fire while suspended; on `'active'` we re-pull today's
  // calendar string and the countdown so the banner reflects the
  // current day even if the user was away for hours.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const now = new Date();
      setCountdown(timeUntilNextDaily(now));
      setToday((prev) => {
        const next = formatDailyDate(now);
        return next === prev ? prev : next;
      });
    });
    return () => sub.remove();
  }, []);

  const bannerCopy = useMemo(
    () =>
      buildBannerCopy(
        bannerState,
        dailyConfig,
        dayNumber,
        countdown,
        dailyState.lastResult,
        dailyState.currentStreak,
      ),
    [
      bannerState,
      dailyConfig,
      dayNumber,
      countdown,
      dailyState.lastResult,
      dailyState.currentStreak,
    ],
  );

  const onDailyPress = useCallback(() => {
    // 3-state navigation guard. Cracked or failed today → DailyResult
    // (Wordle pattern — no replay). Otherwise → DailyMatchScreen
    // (which itself handles fresh vs resume via the store).
    if (dailyState.lastResult !== null && dailyState.lastResult.date === today) {
      navigation.navigate('DailyResult');
      return;
    }
    navigation.navigate('Daily');
  }, [dailyState.lastResult, today, navigation]);

  const openProfile = useCallback(() => navigation.navigate('Profile'), [navigation]);
  const openShop = useCallback(() => navigation.navigate('Shop'), [navigation]);

  // Phase 7A.5 CP4 — low-balance toast. Visible when wallet drops
  // below `LOW_BALANCE_THRESHOLD` and the player has not dismissed
  // it for the current session. Dismiss state is screen-local on
  // purpose (brainstorm decision): a fresh mount re-evaluates so a
  // returning player still sees the recovery prompt.
  const [lowBalanceDismissed, setLowBalanceDismissed] = useState(false);
  const showLowBalanceToast = user.tokens < LOW_BALANCE_THRESHOLD && !lowBalanceDismissed;
  const onLowBalanceWatchAd = useCallback(
    () => navigation.navigate('AdWatch'),
    [navigation],
  );
  const onLowBalanceDismiss = useCallback(() => setLowBalanceDismissed(true), []);

  const playMode = useCallback(
    (entry: ModeCatalogEntry) => {
      if (user.tokens < entry.meta.stake) {
        navigation.navigate('InsufficientTokens', { modeId: entry.id });
        return;
      }
      navigation.navigate('Matchmaking', { modeId: entry.id });
    },
    [navigation, user.tokens],
  );

  const classicModes = modeCatalog.filter((entry) => entry.meta.section === 'CLASSIC');
  const advancedModes = modeCatalog.filter((entry) => entry.meta.section === 'ADVANCED');

  return (
    <Screen>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={openProfile}
          style={styles.userTap}
        >
          <Avatar name={user.username} size={36} />
          <Text style={styles.username}>{user.username}</Text>
        </Pressable>
        <View style={styles.topRight}>
          <Pressable accessibilityRole="button" accessibilityLabel="Open shop" onPress={openShop}>
            <TokenBadge amount={user.tokens} size="sm" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={openProfile}
            style={styles.settingsChip}
          >
            <SettingsIcon />
          </Pressable>
        </View>
      </View>

      <Text style={styles.title}>CipherBreaker</Text>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Daily challenge — ${bannerCopy.headline}`}
          onPress={onDailyPress}
          style={({ pressed }) => [
            styles.dailyBanner,
            bannerStateStyle(bannerState),
            pressed && styles.dailyBannerPressed,
          ]}
        >
          <Text style={styles.dailyBannerHeadline} numberOfLines={1}>
            {bannerCopy.headline}
          </Text>
          <Text style={styles.dailyBannerSubline} numberOfLines={1}>
            {bannerCopy.subline}
          </Text>
        </Pressable>

        {showLowBalanceToast ? (
          <LowBalanceToast
            onWatchAd={onLowBalanceWatchAd}
            onDismiss={onLowBalanceDismiss}
          />
        ) : null}

        <View style={styles.sectionHeader}>
          <SectionLabel>CLASSIC</SectionLabel>
        </View>
        <View style={styles.cards}>
          {classicModes.map((entry) => (
            <ModeCard key={entry.id} meta={entry.meta} onPress={() => playMode(entry)} />
          ))}
        </View>

        <View style={[styles.sectionHeader, styles.sectionGap]}>
          <SectionLabel color={colors.pink}>ADVANCED</SectionLabel>
        </View>
        <View style={styles.cards}>
          {advancedModes.map((entry) => (
            <ModeCard key={entry.id} meta={entry.meta} onPress={() => playMode(entry)} />
          ))}
        </View>

        <View style={styles.levelBarWrap}>
          <LevelBar level={user.level} currentXP={user.currentXP} targetXP={user.targetXP} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function SettingsIcon(): React.JSX.Element {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={3} stroke={colors.textSecondary} strokeWidth={2} fill="none" />
      <Path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9 1.65 1.65 0 0 0 4.27 7.18l-.06-.06A2 2 0 1 1 7.04 4.29l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke={colors.textSecondary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userTap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  username: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.text,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingsChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.text,
    textAlign: 'center',
    paddingTop: 28,
    paddingBottom: 20,
    letterSpacing: -0.6,
    textShadowColor: withAlpha(colors.violet, 0.6),
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  list: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionGap: {
    marginTop: 22,
  },
  cards: {
    gap: 12,
  },
  levelBarWrap: {
    marginTop: 28,
  },
  dailyBanner: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    backgroundColor: colors.bgElevated,
    borderColor: colors.borderSubtle,
  },
  dailyBannerFresh: {
    backgroundColor: withAlpha(colors.violet, 0.16),
    borderColor: withAlpha(colors.violet, 0.4),
    shadowColor: colors.violet,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  dailyBannerCracked: {
    backgroundColor: withAlpha(colors.success, 0.14),
    borderColor: withAlpha(colors.success, 0.4),
  },
  dailyBannerFailed: {
    backgroundColor: withAlpha(colors.danger, 0.12),
    borderColor: withAlpha(colors.danger, 0.34),
  },
  dailyBannerPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  dailyBannerHeadline: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.text,
    letterSpacing: -0.2,
  },
  dailyBannerSubline: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
});

function bannerStateStyle(state: DailyBannerState) {
  if (state === 'cracked') return styles.dailyBannerCracked;
  if (state === 'failed') return styles.dailyBannerFailed;
  return styles.dailyBannerFresh;
}
