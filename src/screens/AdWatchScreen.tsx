/**
 * Reward-ad placeholder. Five-second countdown with a Skip button
 * that arms once two seconds remain (industry-standard min-watch
 * window). On completion the player gets +50 tokens, a console
 * analytics line is logged (replaced by a real provider in Phase 7B),
 * and the stack is popped to the top — this clears both AdWatch and
 * the underlying InsufficientTokens modal so the player lands back
 * on Home with the new balance visible.
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
import { grantTokens } from '@data/mockUser';
import type { RootStackParamList } from '@navigation/routes';
import { colors, fonts, withAlpha } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AdWatch'>;

const COUNTDOWN_SECONDS = 5;
const SKIP_AVAILABLE_AT = 2;
const REWARD = 50;

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
      grantTokens(REWARD);
      // Phase 7B replaces this with a real analytics provider.
      console.log('[analytics] ad_watch_completed', { tokens: REWARD, reason });
      navigation.popToTop();
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
          <Text style={styles.adSub}>Watch to earn {REWARD} tokens</Text>
        </View>
      </View>

      <View style={[styles.rewardWrap, { bottom: insets.bottom + 64 }]}>
        <View style={styles.rewardPill}>
          <TokenCoin size={16} />
          <Text style={styles.rewardAmount}>+{REWARD}</Text>
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
