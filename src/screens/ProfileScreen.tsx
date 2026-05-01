/**
 * Profile hub — identity + tabbed Stats / Settings panes. Phase 7A.3
 * polish:
 *   - Stats / Settings split behind a `SegmentedToggle` (KI #5
 *     "tek butonla geçilsin" feedback). Tab state is screen-local
 *     (intentional — no persist; the panel a player just left isn't
 *     load-bearing context).
 *   - Last-10 outcome strip surfaces the Phase 7A.1 `recentMatches`
 *     window. Four shape variants (filled / hollow / ringed /
 *     squared) so colour-blind readers can disambiguate without
 *     relying on hue alone.
 *   - Per-mode trend caret: ▲ when a mode's win rate is at least 5
 *     points above lifetime, ▼ when 5 below. Suppressed below an
 *     estimated 3 games per mode (`gamesPlayed/7 < 3` ≈ <21 lifetime
 *     games) — small samples are noise, not signal.
 *
 * Settings list still hosts the username/notifications/sound/
 * haptics/privacy/terms/support rows. Phase 7A.5 (Economy polish)
 * is the slot where Notifications + Privacy + Terms + Support stop
 * being placeholder alerts.
 */

import { useCallback, useState } from 'react';
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
import { SegmentedToggle, type SegmentedToggleOption } from '@components/SegmentedToggle';
import { TokenBadge } from '@components/TokenBadge';
import { modeCatalog } from '@data/modeCatalog';
import { toggleSetting, useMockUser } from '@data/mockUser';
import type { MockUserSettings } from '@data/mockUser';
import type { MatchResultOutcome, RootStackParamList } from '@navigation/routes';
import { colors, fonts, withAlpha } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Profile'>;

const TAB_OPTIONS: readonly [SegmentedToggleOption, SegmentedToggleOption] = [
  { key: 'stats', label: 'Stats' },
  { key: 'settings', label: 'Settings' },
];

const RECENT_WINDOW = 10;
const TREND_DELTA_THRESHOLD = 5;
const TREND_MIN_GAMES_PER_MODE = 3;

function formatK(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

/**
 * `null` when the sample is too small (estimated games-per-mode <
 * `TREND_MIN_GAMES_PER_MODE`) OR the delta between this mode's win
 * rate and the lifetime average is inside the dead band. The
 * games-per-mode estimate mirrors the heuristic `matchStore`'s
 * `recordMatchResult` already uses (gamesPlayed / 7) — both seams
 * lack a real per-mode count today.
 */
function trendDirection(
  perModeRate: number,
  lifetimeRate: number,
  lifetimeGames: number,
): 'up' | 'down' | null {
  const estPerModeGames = Math.max(1, Math.round(lifetimeGames / 7));
  if (estPerModeGames < TREND_MIN_GAMES_PER_MODE) return null;
  if (perModeRate >= lifetimeRate + TREND_DELTA_THRESHOLD) return 'up';
  if (perModeRate <= lifetimeRate - TREND_DELTA_THRESHOLD) return 'down';
  return null;
}

export function ProfileScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const user = useMockUser();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<string>('stats');

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
    { label: 'Tokens Earned', value: formatK(user.stats.totalTokensEarned) },
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

        <SegmentedToggle options={TAB_OPTIONS} value={tab} onChange={setTab} />

        {tab === 'stats' ? (
          <StatsPanel
            stats={stats}
            recentMatches={user.stats.recentMatches}
            lifetimeWinRate={user.stats.winRate}
            lifetimeGames={user.stats.gamesPlayed}
            perMode={user.perMode}
          />
        ) : (
          <SettingsPanel
            settings={user.settings}
            openUsernameEdit={openUsernameEdit}
            stubAlert={stubAlert}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────
// Stats panel — lifetime grid + recentMatches strip + by-mode tiles
// ─────────────────────────────────────────────────────────────

interface StatsPanelProps {
  readonly stats: ReadonlyArray<{ label: string; value: string }>;
  readonly recentMatches: readonly MatchResultOutcome[];
  readonly lifetimeWinRate: number;
  readonly lifetimeGames: number;
  readonly perMode: Readonly<Record<number, { winRate: number }>>;
}

function StatsPanel({
  stats,
  recentMatches,
  lifetimeWinRate,
  lifetimeGames,
  perMode,
}: StatsPanelProps): React.JSX.Element {
  return (
    <View>
      <View style={styles.statsGrid}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.statCard}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <SectionLabel>RECENT MATCHES</SectionLabel>
        <RecentMatchesStrip recentMatches={recentMatches} />
      </View>

      <View style={styles.section}>
        <SectionLabel>BY MODE</SectionLabel>
        <View style={styles.modeGrid}>
          {modeCatalog.map((entry) => {
            const perModeEntry = perMode[entry.id];
            const winRate = perModeEntry != null ? perModeEntry.winRate : 0;
            const trend = trendDirection(winRate, lifetimeWinRate, lifetimeGames);
            return (
              <View key={entry.id} style={styles.modeTile}>
                <View style={styles.modeRateRow}>
                  <Text
                    style={[styles.modeRate, { color: entry.meta.gradient[0] }]}
                    numberOfLines={1}
                  >
                    {winRate}%
                  </Text>
                  {trend !== null ? <TrendCaret direction={trend} /> : null}
                </View>
                <Text style={styles.modeName} numberOfLines={1}>
                  {entry.meta.shortLabel}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

interface RecentMatchesStripProps {
  readonly recentMatches: readonly MatchResultOutcome[];
}

function RecentMatchesStrip({ recentMatches }: RecentMatchesStripProps): React.JSX.Element {
  // Render exactly RECENT_WINDOW slots; pad missing ones with empty
  // placeholders so the strip is dimensionally stable across users
  // who have played 0, 5, or 10+ matches.
  const slots: Array<MatchResultOutcome | null> = Array.from({ length: RECENT_WINDOW }, () => null);
  const window = recentMatches.slice(-RECENT_WINDOW);
  for (let i = 0; i < window.length; i += 1) {
    slots[RECENT_WINDOW - window.length + i] = window[i] ?? null;
  }
  const wins = window.reduce((acc, o) => acc + (o === 'victory' ? 1 : 0), 0);
  const caption =
    window.length === 0
      ? 'No matches yet'
      : `Last ${window.length} — ${wins} ${wins === 1 ? 'win' : 'wins'}`;

  return (
    <View>
      <View style={styles.recentRow} accessibilityLabel="Recent match outcomes">
        {slots.map((outcome, index) => (
          <RecentCell key={index} outcome={outcome} index={index} />
        ))}
      </View>
      <Text style={styles.recentCaption}>{caption}</Text>
    </View>
  );
}

interface RecentCellProps {
  readonly outcome: MatchResultOutcome | null;
  readonly index: number;
}

function RecentCell({ outcome, index }: RecentCellProps): React.JSX.Element {
  const a11y = outcome === null ? `Match ${index + 1}: empty slot` : `Match ${index + 1}: ${outcome}`;
  if (outcome === null) {
    return <View accessibilityLabel={a11y} style={[styles.cellBase, styles.cellEmpty]} />;
  }
  if (outcome === 'victory') {
    return <View accessibilityLabel={a11y} style={[styles.cellBase, styles.cellVictory]} />;
  }
  if (outcome === 'defeat') {
    return <View accessibilityLabel={a11y} style={[styles.cellBase, styles.cellDefeat]} />;
  }
  if (outcome === 'draw') {
    // Concentric ring — outer outline + inner dot; reads as a target
    // glyph at glance, distinct from filled / hollow circles.
    return (
      <View accessibilityLabel={a11y} style={[styles.cellBase, styles.cellDraw]}>
        <View style={styles.cellDrawInner} />
      </View>
    );
  }
  // stalemate
  return <View accessibilityLabel={a11y} style={[styles.cellBase, styles.cellStalemate]} />;
}

interface TrendCaretProps {
  readonly direction: 'up' | 'down';
}

function TrendCaret({ direction }: TrendCaretProps): React.JSX.Element {
  const color = direction === 'up' ? colors.success : colors.danger;
  // Single-stroke chevron — up: M2 6L5 3L8 6, down: M2 4L5 7L8 4.
  const path = direction === 'up' ? 'M2 6L5 3L8 6' : 'M2 4L5 7L8 4';
  return (
    <Svg
      width={10}
      height={10}
      viewBox="0 0 10 10"
      accessibilityLabel={direction === 'up' ? 'trend up' : 'trend down'}
    >
      <Path d={path} stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Settings panel — list rows
// ─────────────────────────────────────────────────────────────

interface SettingsPanelProps {
  readonly settings: MockUserSettings;
  readonly openUsernameEdit: () => void;
  readonly stubAlert: (title: string) => void;
}

function SettingsPanel({
  settings,
  openUsernameEdit,
  stubAlert,
}: SettingsPanelProps): React.JSX.Element {
  return (
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
          value={settings.sound}
          isLast={false}
        />
        <SettingsToggleRow
          label="Haptics"
          settingKey="haptics"
          value={settings.haptics}
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
    paddingBottom: 16,
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
    marginTop: 16,
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
    marginTop: 18,
  },
  recentRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recentCaption: {
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  cellBase: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellEmpty: {
    borderWidth: 1,
    borderRadius: 999,
    borderStyle: 'dashed',
    borderColor: withAlpha(colors.textDim, 0.6),
  },
  cellVictory: {
    borderRadius: 999,
    backgroundColor: colors.success,
  },
  cellDefeat: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.danger,
  },
  cellDraw: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellDrawInner: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.warning,
  },
  cellStalemate: {
    borderRadius: 3,
    borderWidth: 2,
    borderColor: colors.textSecondary,
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
  modeRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
