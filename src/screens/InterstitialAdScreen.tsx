/**
 * Phase 7A.5 CP3 — periodic interstitial ad placeholder.
 *
 * Routes from `MatchResultScreen` after every Nth Mode 1-7 match
 * (`INTERSTITIAL_MATCH_THRESHOLD = 3`, gated by
 * `canShowInterstitial` from `@game/economy/iap`). Mirrors the
 * structural shape of `AdWatchScreen` (5-second countdown, Skip
 * arming, full-screen modal, no swipe-back) but with a different
 * exit policy: this screen pops back to the underlying
 * MatchResultScreen rather than `popToTop` — the player should
 * see their result chip + Play Again CTA after the ad, not get
 * dropped on Home.
 *
 * Differences from AdWatchScreen:
 *   - `navigation.goBack()` on completion (not `popToTop`).
 *   - No token reward (this is the forced layer; rewarded paths
 *     keep their own AdWatchScreen flow).
 *   - Brand-tinted ad frame (violet → pink gradient feel) so
 *     QA can visually distinguish "this is the periodic
 *     interstitial" from "this is the rewarded ad."
 *
 * Skip arms at second 0 (full 5-second watch required) — slightly
 * stricter than AdWatchScreen's 2-second skip. Rationale: the
 * forced layer should feel like a real interstitial; the rewarded
 * layer is user-elective and arms early to feel responsive.
 *
 * `presentation: 'fullScreenModal' + gestureEnabled: false` (set
 * in RootNavigator) prevents the player from swipe-dismissing
 * mid-watch.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Screen } from '@components/Screen';
import type { RootStackParamList } from '@navigation/routes';
import { colors, fonts, withAlpha } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'InterstitialAd'>;

const COUNTDOWN_SECONDS = 5;

export function InterstitialAdScreen(): React.JSX.Element {
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
      // Phase 7B replaces this with a real analytics provider —
      // matches the AdWatchScreen seam so both layers report into
      // the same event sink eventually.
      console.log('[analytics] interstitial_completed', { reason });
      navigation.goBack();
    },
    [navigation],
  );

  useEffect(() => {
    if (secondsLeft === 0) {
      finish('completed');
    }
  }, [secondsLeft, finish]);

  const skipArmed = secondsLeft <= 0;
  const skipLabel = useMemo(() => {
    if (skipArmed) return 'Skip';
    return `Skip in ${secondsLeft}`;
  }, [skipArmed, secondsLeft]);

  return (
    <Screen ambientIntensity={0.05}>
      <View style={[styles.skipWrap, { top: insets.top + 16 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={skipArmed ? 'Skip ad' : `Skip available in ${secondsLeft} seconds`}
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
            bottom: insets.bottom + 80,
          },
        ]}
      >
        <View style={styles.adBadge}>
          <Text style={styles.adBadgeLabel}>AD</Text>
        </View>
        <View style={styles.adBody}>
          <Text style={styles.adKicker}>Sponsored</Text>
          <View style={styles.adArt} />
          <Text style={styles.adTitle}>Interstitial Placeholder</Text>
          <Text style={styles.adSub}>Real ad inventory in Phase 7B</Text>
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
    borderColor: withAlpha(colors.violet, 0.35),
    overflow: 'hidden',
    backgroundColor: '#1a1530',
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
    color: withAlpha(colors.pink, 0.7),
    marginBottom: 14,
  },
  adArt: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: withAlpha(colors.violet, 0.16),
    borderWidth: 1,
    borderColor: withAlpha(colors.violet, 0.4),
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  adTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.text,
    letterSpacing: -0.2,
  },
  adSub: {
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textDim,
  },
});
