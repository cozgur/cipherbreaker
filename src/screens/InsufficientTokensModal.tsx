/**
 * Soft-block modal when the player taps a mode they cannot afford.
 * Phase 7A.5 CP4 reshape:
 *   - Body now reads `"You have X tokens. This match costs Y."` so
 *     the player sees both sides of the gap, not just the
 *     destination cost.
 *   - "Buy tokens" → "Cancel" (Q6=A, brainstorm decision —
 *     dismissing returns to HomeScreen rather than offering a
 *     paid path inside this surface; the Shop is reachable from
 *     the home top-bar TokenBadge).
 *   - "Watch ad · +50" CTA disables when the player has hit the
 *     `AD_CAP_PER_DAY` ceiling for the current local-calendar day
 *     (CP1 cap state). Disabled label flips to "Daily ad limit
 *     reached" so the affordance is honest about why it can't be
 *     tapped.
 *
 * The backdrop tap, the X chip, and Cancel all `goBack` to the
 * dimmed Home behind. Stake comes from the catalog so the copy
 * stays accurate when a mode's stake re-balances. Wallet read is
 * direct from `useUserStore` so a token credit elsewhere (e.g.
 * the player just earned an ad reward and came back to this
 * modal via navigation pop) re-renders the body in real time.
 */

import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button } from '@components/Button';
import { GlassCard } from '@components/GlassCard';
import { Screen } from '@components/Screen';
import { findMode } from '@data/modeCatalog';
import { formatDailyDate } from '@game/daily/dailyDate';
import { canWatchAd } from '@game/economy/adCap';
import type { RootStackParamList } from '@navigation/routes';
import { useUserStore } from '@state/userStore';
import { colors, fonts, withAlpha } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'InsufficientTokens'>;
type RouteParams = RouteProp<RootStackParamList, 'InsufficientTokens'>;

export function InsufficientTokensModal(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteParams>();
  const { modeId } = route.params;

  const stake = useMemo(() => findMode(modeId)?.meta.stake ?? 50, [modeId]);
  const tokens = useUserStore((s) => s.tokens);
  const adsWatchedToday = useUserStore((s) => s.adsWatchedToday);
  const adsWatchedLastDate = useUserStore((s) => s.adsWatchedLastDate);

  // Cap-aware Watch Ad gate. The cap module compares
  // `adsWatchedLastDate` against today's local-calendar string so
  // a stale day implicitly resets the quota. Ad-cap reach disables
  // the CTA but leaves the modal usable (Cancel still works).
  const canEarnAdNow = useMemo(() => {
    const today = formatDailyDate(new Date());
    return canWatchAd({ adsWatchedToday, adsWatchedLastDate }, today);
  }, [adsWatchedToday, adsWatchedLastDate]);

  const close = useCallback(() => navigation.goBack(), [navigation]);
  const watchAd = useCallback(() => navigation.navigate('AdWatch'), [navigation]);

  return (
    <Screen>
      <View style={styles.dim}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.cardWrap} pointerEvents="box-none">
          <GlassCard padding={26}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={close}
              style={styles.closeChip}
            >
              <Svg width={10} height={10} viewBox="0 0 10 10">
                <Path
                  d="M1 1l8 8M9 1l-8 8"
                  stroke={colors.textSecondary}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>

            <View style={styles.iconWrap}>
              <View style={styles.iconCircle}>
                <BrokenCoinIcon />
              </View>
            </View>

            <Text style={styles.title}>Need more tokens</Text>
            <Text style={styles.subtitle}>
              You have {tokens.toLocaleString()} tokens. This match costs {stake}.
            </Text>

            <View style={styles.actions}>
              {canEarnAdNow ? (
                <Button
                  onPress={watchAd}
                  variant="cyan"
                  icon={
                    <Svg width={16} height={16} viewBox="0 0 16 16">
                      <Path d="M6 3l7 5-7 5V3z" fill="#ffffff" />
                    </Svg>
                  }
                >
                  Watch ad · +50
                </Button>
              ) : (
                <Button onPress={() => undefined} disabled>
                  Daily ad limit reached
                </Button>
              )}
              <Button onPress={close}>Cancel</Button>
            </View>
          </GlassCard>
        </View>
      </View>
    </Screen>
  );
}

function BrokenCoinIcon(): React.JSX.Element {
  return (
    <Svg width={38} height={38} viewBox="0 0 38 38">
      <Defs>
        <RadialGradient id="brkn" cx="0.35" cy="0.3" rx="0.7" ry="0.7">
          <Stop offset="0" stopColor="#fde68a" />
          <Stop offset="0.6" stopColor="#fbbf24" />
          <Stop offset="1" stopColor="#b45309" />
        </RadialGradient>
      </Defs>
      <Path
        d="M19 3 A16 16 0 0 1 35 19 L22 22 L19 3Z"
        fill="url(#brkn)"
        stroke="#78350f"
        strokeWidth={0.8}
      />
      <Path
        d="M19 3 L22 22 L2 21 A16 16 0 0 1 19 3Z"
        fill="url(#brkn)"
        opacity={0.55}
        stroke="#78350f"
        strokeWidth={0.8}
      />
      <Path
        d="M19 22 L22 22 L14 35"
        stroke={colors.warning}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  dim: {
    flex: 1,
    backgroundColor: 'rgba(10,11,30,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  cardWrap: {
    // pointerEvents='box-none' on parent so the absolute-fill backdrop
    // press still fires; the GlassCard itself catches its own taps.
  },
  closeChip: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: withAlpha(colors.warning, 0.12),
    borderWidth: 1,
    borderColor: withAlpha(colors.warning, 0.35),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.warning,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  actions: {
    marginTop: 20,
    gap: 10,
  },
});
