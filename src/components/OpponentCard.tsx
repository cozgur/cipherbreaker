import { Platform, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@theme/tokens';
import { typography } from '@theme/typography';
import { Avatar } from './Avatar';

interface OpponentCardProps {
  readonly name: string;
  readonly level: number;
  /** Emoji flag (e.g. `"🇩🇪"`). Falsy skips the chip. */
  readonly flag?: string;
  readonly isOnline?: boolean;
  /** Highlights the card with a violet glow — used on the active player during a match. */
  readonly active?: boolean;
}

/**
 * Matchmaking / match-header card showing the opponent (or the active
 * player) at a glance: avatar, name, level, country, online state.
 */
export function OpponentCard({
  name,
  level,
  flag,
  isOnline = false,
  active = false,
}: OpponentCardProps): React.JSX.Element {
  return (
    <View
      style={[
        styles.card,
        active && styles.cardActive,
        active &&
          Platform.select({
            ios: {
              shadowColor: colors.violet,
              shadowOpacity: 0.35,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 0 },
            },
            android: { elevation: 6 },
            default: {},
          }),
      ]}
    >
      <Avatar name={name} size={34} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>Lv. {level}</Text>
          {flag ? <Text style={styles.metaText}>· {flag}</Text> : null}
          {isOnline ? (
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineLabel}>Online</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
  },
  cardActive: {
    borderColor: colors.violet,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...typography.bodyS,
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    color: colors.text,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  metaText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 0.6,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    ...Platform.select({
      ios: {
        shadowColor: colors.success,
        shadowOpacity: 1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  onlineLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: colors.success,
    letterSpacing: 0.6,
  },
});
