/**
 * Home hub — token wallet, settings access, and the seven-mode list.
 * Tapping a ModeCard either dispatches into Matchmaking (balance
 * covers the stake) or the InsufficientTokens modal (it doesn't).
 * The CLASSIC vs ADVANCED split is driven off the mode catalog's
 * `meta.section` — adding a new mode needs no changes here.
 */

import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '@components/Avatar';
import { LevelBar } from '@components/LevelBar';
import { ModeCard } from '@components/ModeCard';
import { Screen } from '@components/Screen';
import { SectionLabel } from '@components/SectionLabel';
import { TokenBadge } from '@components/TokenBadge';
import { modeCatalog } from '@data/modeCatalog';
import { useMockUser } from '@data/mockUser';
import type { ModeCatalogEntry } from '@game/types';
import type { RootStackParamList } from '@navigation/routes';
import { colors, fonts, withAlpha } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export function HomeScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const user = useMockUser();
  const insets = useSafeAreaInsets();

  const openProfile = useCallback(() => navigation.navigate('Profile'), [navigation]);
  const openShop = useCallback(() => navigation.navigate('Shop'), [navigation]);

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
            <TokenBadge amount={user.tokens.toLocaleString()} size="sm" />
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
});
