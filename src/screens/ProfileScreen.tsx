/**
 * Profile hub — identity, lifetime stats, per-mode win rate, and the
 * settings list. The settings list is mostly stub taps in Phase 1B
 * (Notifications/Privacy/Support → placeholder alerts); Sound and
 * Haptics toggle the persisted `mockUser.settings` bits in place so
 * the row value updates live. Username edit opens the dedicated
 * `ChangeUsername` transparent-modal route — same UX on both
 * platforms, unlike `Alert.prompt` (iOS-only).
 */

import { useCallback } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '@components/Avatar';
import { Screen } from '@components/Screen';
import { SectionLabel } from '@components/SectionLabel';
import { TokenBadge } from '@components/TokenBadge';
import { modeCatalog } from '@data/modeCatalog';
import { toggleSetting, useMockUser } from '@data/mockUser';
import type { MockUserSettings } from '@data/mockUser';
import type { RootStackParamList } from '@navigation/routes';
import { colors, fonts, withAlpha } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Profile'>;

function formatK(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

export function ProfileScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const user = useMockUser();
  const insets = useSafeAreaInsets();

  const back = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  }, [navigation]);

  const openShop = useCallback(() => navigation.navigate('Shop'), [navigation]);
  const openUsernameEdit = useCallback(() => navigation.navigate('ChangeUsername'), [navigation]);

  const stubAlert = useCallback((title: string) => {
    Alert.alert(title, 'Coming in Phase 7A.');
  }, []);

  const stats: ReadonlyArray<{ label: string; value: string }> = [
    { label: 'Games Played', value: user.stats.gamesPlayed.toLocaleString() },
    { label: 'Win Rate', value: `${user.stats.winRate}%` },
    { label: 'Current Streak', value: user.stats.currentStreak.toString() },
    { label: 'Best Streak', value: user.stats.bestStreak.toString() },
    { label: 'Avg Turns', value: user.stats.avgTurns.toFixed(1) },
    { label: 'Tokens Earned', value: formatK(user.stats.tokensEarned) },
  ];

  return (
    <Screen>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={back}
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
        <Pressable accessibilityRole="button" accessibilityLabel="Open shop" onPress={openShop}>
          <TokenBadge amount={user.tokens.toLocaleString()} size="sm" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.identityBlock}>
          <View>
            <Avatar name={user.username} size={92} />
            <View style={styles.levelPill}>
              <Text style={styles.levelPillText}>LV. {user.level}</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change username"
            onPress={openUsernameEdit}
            style={styles.usernameRow}
          >
            <Text style={styles.usernameLabel}>{user.username}</Text>
            <Svg width={14} height={14} viewBox="0 0 14 14">
              <Path
                d="M10 2l2 2-7 7H3v-2l7-7z"
                stroke={colors.textSecondary}
                strokeWidth={1.8}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          </Pressable>

          <Text style={styles.xpLabel}>
            {user.currentXP.toLocaleString()} / {user.targetXP.toLocaleString()} XP
          </Text>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <SectionLabel>BY MODE</SectionLabel>
          <View style={styles.modeGrid}>
            {modeCatalog.map((entry) => {
              const perMode = user.perMode[entry.id];
              const winRate = perMode != null ? perMode.winRate : 0;
              return (
                <View key={entry.id} style={styles.modeTile}>
                  <Text
                    style={[styles.modeRate, { color: entry.meta.gradient[0] }]}
                    numberOfLines={1}
                  >
                    {winRate}%
                  </Text>
                  <Text style={styles.modeName} numberOfLines={1}>
                    {entry.meta.shortLabel}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel>SETTINGS</SectionLabel>
          <View style={styles.settingsList}>
            <SettingsRow label="Change Username" onPress={openUsernameEdit} isLast={false} />
            <SettingsRow
              label="Notifications"
              onPress={() => stubAlert('Notifications')}
              isLast={false}
            />
            <SettingsToggleRow
              label="Sound"
              settingKey="sound"
              value={user.settings.sound}
              isLast={false}
            />
            <SettingsToggleRow
              label="Haptics"
              settingKey="haptics"
              value={user.settings.haptics}
              isLast={false}
            />
            <SettingsRow
              label="Privacy Policy"
              onPress={() => stubAlert('Privacy Policy')}
              isLast={false}
            />
            <SettingsRow
              label="Terms of Service"
              onPress={() => stubAlert('Terms of Service')}
              isLast={false}
            />
            <SettingsRow label="Support" onPress={() => stubAlert('Support')} isLast />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

interface SettingsRowProps {
  readonly label: string;
  readonly value?: string;
  readonly onPress?: (event: GestureResponderEvent) => void;
  readonly isLast: boolean;
}

function SettingsRow({ label, value, onPress, isLast }: SettingsRowProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        !isLast && styles.settingsRowBorder,
        pressed && styles.settingsRowPressed,
      ]}
    >
      <Text style={styles.settingsLabel}>{label}</Text>
      {value != null ? <Text style={styles.settingsValue}>{value}</Text> : null}
      <Svg width={8} height={12} viewBox="0 0 8 12">
        <Path
          d="M1 1l6 5-6 5"
          stroke={colors.textDim}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </Pressable>
  );
}

interface SettingsToggleRowProps {
  readonly label: string;
  readonly settingKey: keyof MockUserSettings;
  readonly value: boolean;
  readonly isLast: boolean;
}

function SettingsToggleRow({
  label,
  settingKey,
  value,
  isLast,
}: SettingsToggleRowProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => toggleSetting(settingKey)}
      style={({ pressed }) => [
        styles.settingsRow,
        !isLast && styles.settingsRowBorder,
        pressed && styles.settingsRowPressed,
      ]}
    >
      <Text style={styles.settingsLabel}>{label}</Text>
      <Text style={[styles.settingsValue, { color: value ? colors.success : colors.textDim }]}>
        {value ? 'On' : 'Off'}
      </Text>
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
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  identityBlock: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 20,
  },
  levelPill: {
    position: 'absolute',
    bottom: -4,
    right: -14,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  levelPillText: {
    fontFamily: fonts.display,
    fontSize: 12,
    color: '#1a1205',
    letterSpacing: -0.1,
  },
  usernameRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  usernameLabel: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
    letterSpacing: -0.3,
  },
  xpLabel: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '48%',
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  statValue: {
    fontFamily: fonts.mono,
    fontSize: 20,
    color: colors.text,
  },
  statLabel: {
    marginTop: 2,
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  section: {
    marginTop: 20,
  },
  modeGrid: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeTile: {
    width: '31.5%',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
  },
  modeRate: {
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: -0.3,
  },
  modeName: {
    marginTop: 2,
    fontFamily: fonts.bodySemibold,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  settingsList: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  settingsRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: withAlpha(colors.borderSubtle, 0.8),
  },
  settingsRowPressed: {
    backgroundColor: withAlpha(colors.violet, 0.06),
  },
  settingsLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  settingsValue: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
});
