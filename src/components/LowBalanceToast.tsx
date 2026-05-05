/**
 * Phase 7A.5 CP4 — HomeScreen low-balance toast.
 *
 * Surfaces a dismissible "Low on tokens?" banner above the mode
 * cards when the player's wallet drops below `LOW_BALANCE_THRESHOLD`
 * (currently 100, set just above the lowest competitive stake of
 * 50 so the gate fires *before* the player can't afford a single
 * match). Tapping "Watch Ad" routes to `AdWatchScreen`; tapping
 * the X dismisses the toast for the current session.
 *
 * Dismiss policy (brainstorm decision — session-scoped):
 *   The dismiss state lives on the parent screen, not on
 *   `userStore`. A new app launch (or HomeScreen remount after a
 *   match) re-evaluates the threshold and re-shows the toast if
 *   the balance is still low. Persisting "dismissed forever"
 *   would defeat the recovery loop the toast exists to surface.
 *
 * Why no `useUserStore` read inside this component: the toast is
 * a presentational shell. The parent (HomeScreen) reads tokens,
 * decides visibility, and passes the CTA + close handlers in.
 * That keeps this component reusable if a future "low Daily
 * Challenge tokens" or "low XP" variant lands.
 *
 * Tap targets:
 *   - The banner body is informational (not a tap target).
 *   - "Watch Ad" — primary CTA, navigates the parent to AdWatch.
 *   - "X" close button — dismiss for the session.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { TokenCoin } from '@components/TokenCoin';
import { colors, fonts, withAlpha } from '@theme/tokens';

interface LowBalanceToastProps {
  readonly onWatchAd: () => void;
  readonly onDismiss: () => void;
}

export function LowBalanceToast({
  onWatchAd,
  onDismiss,
}: LowBalanceToastProps): React.JSX.Element {
  return (
    <View
      style={styles.toast}
      accessibilityRole="alert"
      accessibilityLabel="Low balance"
    >
      <View style={styles.coinWrap}>
        <TokenCoin size={18} />
      </View>
      <View style={styles.body}>
        <Text style={styles.headline} numberOfLines={1}>
          Low on tokens?
        </Text>
        <Text style={styles.subline} numberOfLines={1}>
          Watch a quick ad to earn 50.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Watch ad"
        onPress={onWatchAd}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
      >
        <Text style={styles.ctaLabel}>Watch Ad</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss low balance toast"
        onPress={onDismiss}
        style={({ pressed }) => [styles.closeChip, pressed && styles.closeChipPressed]}
      >
        <Svg width={10} height={10} viewBox="0 0 10 10">
          <Path
            d="M1 1l8 8M9 1l-8 8"
            stroke={colors.textSecondary}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: withAlpha(colors.gold, 0.1),
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.32),
    gap: 10,
  },
  coinWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: withAlpha(colors.gold, 0.18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    flexDirection: 'column',
  },
  headline: {
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
    color: colors.text,
  },
  subline: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textSecondary,
  },
  cta: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: withAlpha(colors.cyan, 0.18),
    borderWidth: 1,
    borderColor: withAlpha(colors.cyan, 0.45),
  },
  ctaPressed: {
    opacity: 0.78,
  },
  ctaLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.cyan,
    textTransform: 'uppercase',
  },
  closeChip: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  closeChipPressed: {
    opacity: 0.7,
  },
});
