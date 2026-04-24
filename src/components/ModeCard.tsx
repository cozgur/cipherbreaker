import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import type { ModeMeta } from '@game/types';
import { colors, fonts, withAlpha } from '@theme/tokens';
import { typography } from '@theme/typography';
import { ModeIcon } from './ModeIcon';
import { TokenCoin } from './TokenCoin';

interface ModeCardProps {
  readonly meta: ModeMeta;
  readonly onPress?: () => void;
  readonly disabled?: boolean;
}

/**
 * Home-screen list item for a single mode. Gradient disc + icon on
 * the left, full-width title + description in the middle, stake +
 * chevron on the right. Any advanced-mode badge is painted as a
 * corner ribbon so the title never has to share horizontal space
 * with a growing tag (SUDDEN DEATH + HIGH RISK was clipping).
 */
export function ModeCard({
  meta,
  onPress,
  disabled = false,
}: ModeCardProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meta.name} — ${meta.stake} tokens`}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && !disabled ? styles.cardPressed : null,
        disabled ? styles.cardDisabled : null,
      ]}
    >
      <View
        style={[
          styles.iconShadow,
          Platform.select({
            ios: {
              shadowColor: meta.gradient[0],
              shadowOpacity: 0.45,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 0 },
            },
            android: { elevation: 6 },
            default: {},
          }),
        ]}
      >
        <LinearGradient
          colors={[meta.gradient[0], meta.gradient[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconDisc}
        >
          <ModeIcon iconKey={meta.iconKey} size={40} />
        </LinearGradient>
      </View>

      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1}>
          {meta.name}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {meta.description}
        </Text>
      </View>

      <View style={styles.right}>
        <View style={styles.stakeRow}>
          <TokenCoin size={14} />
          <Text style={styles.stake}>{meta.stake}</Text>
        </View>
        <Svg width="14" height="14" viewBox="0 0 14 14">
          <Path
            d="M5 3l4 4-4 4"
            stroke={colors.textDim}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </View>

      {meta.badge ? (
        <View
          style={[
            styles.ribbon,
            {
              backgroundColor: withAlpha(meta.badge.color, 0.14),
              borderColor: withAlpha(meta.badge.color, 0.45),
            },
          ]}
        >
          <Text style={[styles.ribbonLabel, { color: meta.badge.color }]}>
            {meta.badge.label}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    height: 96,
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 14,
    borderRadius: 16,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    borderColor: withAlpha(colors.violet, 0.6),
  },
  cardDisabled: {
    opacity: 0.5,
  },
  iconShadow: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  iconDisc: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.18,
    marginBottom: 4,
  },
  description: {
    ...typography.bodyS,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  stakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stake: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    color: colors.gold,
  },
  ribbon: {
    position: 'absolute',
    top: 0,
    right: 14,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
  },
  ribbonLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    lineHeight: 12,
  },
});
