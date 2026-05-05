/**
 * Reward-ad placeholder. Five-second countdown with a Skip button
 * that arms once two seconds remain (industry-standard min-watch
 * window). On completion the player's wallet credit + the daily-
 * cap state both update atomically through `userStore.watchAdAction(today)`
 * — Phase 7A.5 CP5 rewire that replaced the legacy `grantTokens`
 * direct call. The action is gated by `canWatchAd` from CP1, so a
 * cap-reached state never double-credits even if the screen
 * somehow mounted past the gate (defensive — the
 * InsufficientTokensModal already disables its Watch Ad CTA when
 * the cap is hit; CP5 also surfaces a LowBalanceToast on Home
 * which routes here).
 *
 * On finish we `goBack()` rather than `popToTop()`. The two
 * production entry points to AdWatch are:
 *   - InsufficientTokensModal "Watch ad · +50" — goBack returns
 *     to the modal so it can re-evaluate the (now potentially
 *     sufficient) balance against the stake.
 *   - HomeScreen LowBalanceToast — goBack returns to Home with
 *     the new balance reflected in the top-bar TokenBadge and the
 *     toast re-evaluated against `LOW_BALANCE_THRESHOLD`.
 *
 * `fullScreenModal` + `gestureEnabled: false` (set in RootNavigator)
 * mean a player cannot dismiss the ad until Skip arms or it
 * auto-completes — preventing free-token exploits in the prototype.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Screen } from '@components/Screen';
import { TokenCoin } from '@components/TokenCoin';
import { formatDailyDate } from '@game/daily/dailyDate';
import { AD_REWARD_TOKENS } from '@game/economy/constants';
import type { RootStackParamList } from '@navigation/routes';
import { useUserStore } from '@state/userStore';
import { colors, fonts, withAlpha } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AdWatch'>;

const COUNTDOWN_SECONDS = 5;
const SKIP_AVAILABLE_AT = 2;

export function AdWatchScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [secondsLeft, setSecondsLeft] = useState<number>(COUNTDOWN_SECONDS);
  const completedRef = useRef<boolean>(false);

  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return (): void => clearInterval(tick);
  }, []);

  const finish = useCallback(
    (reason: 'skipped' | 'completed'): void => {
      if (completedRef.current) return;
      completedRef.current = true;
      // CP5 — gated reward via watchAdAction. The action runs the
      // canWatchAd cap check; a cap-reached state returns
      // {success:false, reward:0} without crediting tokens. In
      // production the calling surfaces (modal + toast) prevent the
      // tap from launching this screen at all when the cap is hit,
      // so the false branch is purely defensive.
      const today = formatDailyDate(new Date());
      const result = useUserStore.getState().watchAdAction(today);
      // Phase 7B replaces this with a real analytics provider.
      console.log('[analytics] ad_watch_completed', {
        tokens: result.reward,
        reason,
        success: result.success,
      });
      navigation.goBack();
    },
    [navigation],
  );

  useEffect(() => {
    if (secondsLeft === 0) {
      finish('completed');
    }
  }, [secondsLeft, finish]);

  const skipArmed = secondsLeft <= SKIP_AVAILABLE_AT;
  const skipLabel = useMemo(() => {
    if (skipArmed) return 'Skip';
    return `Skip in ${secondsLeft - SKIP_AVAILABLE_AT}`;
  }, [skipArmed, secondsLeft]);

  return (
    <Screen ambientIntensity={0.05}>
      <View style={[styles.skipWrap, { top: insets.top + 16 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            skipArmed ? 'Skip ad' : `Skip available in ${secondsLeft - SKIP_AVAILABLE_AT} seconds`
          }
          accessibilityState={{ disabled: !skipArmed }}
          disabled={!skipArmed}
          onPress={() => finish('skipped')}
          style={({ pressed }) => [
            styles.skipChip,
            !skipArmed ? styles.skipChipDisabled : null,
            pressed && skipArmed ? styles.skipChipPressed : null,
          ]}
        >
          <Text style={[styles.skipLabel, !skipArmed ? styles.skipLabelDim : null]}>
            {skipLabel}
          </Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.adFrame,
          {
            top: insets.top + 80,
            bottom: insets.bottom + 160,
          },
        ]}
      >
        <View style={styles.adBadge}>
          <Text style={styles.adBadgeLabel}>AD</Text>
        </View>
        <View style={styles.adBody}>
          <Text style={styles.adKicker}>Advertisement Area</Text>
          <View style={styles.adArt} />
          <Text style={styles.adTitle}>Sponsored Content</Text>
          <Text style={styles.adSub}>Watch to earn {AD_REWARD_TOKENS} tokens</Text>
        </View>
      </View>

      <View style={[styles.rewardWrap, { bottom: insets.bottom + 64 }]}>
        <View style={styles.rewardPill}>
          <TokenCoin size={16} />
          <Text style={styles.rewardAmount}>+{AD_REWARD_TOKENS}</Text>
          <Text style={styles.rewardLabel}>on finish</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skipWrap: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
  },
  skipChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  skipChipDisabled: {
    opacity: 0.85,
  },
  skipChipPressed: {
    opacity: 0.78,
  },
  skipLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.text,
  },
  skipLabelDim: {
    fontFamily: fonts.mono,
    color: colors.textSecondary,
  },
  adFrame: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
  },
  adBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  adBadgeLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.textSecondary,
  },
  adBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  adKicker: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textDim,
    marginBottom: 14,
  },
  adArt: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  adTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.textSecondary,
  },
  adSub: {
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textDim,
  },
  rewardWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  rewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: withAlpha(colors.gold, 0.1),
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.4),
    ...Platform.select({
      ios: {
        shadowColor: colors.gold,
        shadowOpacity: 0.4,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  rewardAmount: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.gold,
  },
  rewardLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
});
