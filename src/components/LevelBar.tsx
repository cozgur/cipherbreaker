import { Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, fonts, withAlpha } from '@theme/tokens';
import { SectionLabel } from './SectionLabel';

interface LevelBarProps {
  readonly level: number;
  readonly currentXP: number;
  readonly targetXP: number;
}

/**
 * Gold progress card used on Home under the mode list. Shows the
 * level label, XP counter, and a glowing gradient fill. Progress is
 * clamped to `[0, 1]` so a degenerate target doesn't produce a
 * negative width.
 */
export function LevelBar({ level, currentXP, targetXP }: LevelBarProps): React.JSX.Element {
  const ratio = targetXP > 0 ? Math.min(1, Math.max(0, currentXP / targetXP)) : 0;
  const percent = `${Math.round(ratio * 100)}%` as const;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <SectionLabel>LEVEL {level}</SectionLabel>
        <Text style={styles.counter}>
          {currentXP.toLocaleString()} / {targetXP.toLocaleString()} XP
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fillWrapper, { width: percent }]}>
          <LinearGradient
            colors={[colors.goldDeep, colors.gold]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.fill}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  counter: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: withAlpha(colors.gold, 0.15),
    overflow: 'hidden',
  },
  fillWrapper: {
    height: '100%',
    ...Platform.select({
      ios: {
        shadowColor: colors.gold,
        shadowOpacity: 0.6,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  fill: {
    flex: 1,
    borderRadius: 3,
  },
});
