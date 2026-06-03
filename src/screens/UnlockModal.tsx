/**
 * Phase 7A.8 CP7 — one-time mode purchase modal.
 *
 * Reached from HomeScreen's `playMode` unlock gate when a player taps
 * a locked Mode 2-7 card. A stack route (transparent-modal + fade),
 * not an inline overlay — it's tap-driven like InsufficientTokens,
 * whose GlassCard styling this mirrors.
 *
 * Layout (top→bottom): mode icon disc · name · description · cost
 * chip · current balance · primary CTA · Cancel.
 *
 * Primary CTA branches on affordability:
 *   - balance >= cost → "UNLOCK". Tap → `unlockMode(modeId)`, then a
 *     seamless `navigation.replace` into ModeTutorial (tutorial
 *     unseen) or Matchmaking (seen). `replace` (not navigate) so the
 *     back gesture can't rewind to this now-spent modal — the user
 *     experiences "tap locked card → unlock → straight into the mode."
 *   - balance < cost → "NEED Y MORE TOKENS". Tap → existing
 *     InsufficientTokens modal (don't reinvent the earn-tokens
 *     surface). It's a live button, not a dead disabled one, so the
 *     player has an actionable next step (decision 4).
 *
 * Mode 1 never reaches here — HomeScreen's gate hard-skips it. The
 * defensive `unlockMode` guards (already_unlocked / invalid_mode)
 * still apply if a corrupt route param ever arrives.
 */

import { useCallback, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import * as haptics from '@/lib/haptics';
import { Button } from '@components/Button';
import { GlassCard } from '@components/GlassCard';
import { ModeIcon } from '@components/ModeIcon';
import { Screen } from '@components/Screen';
import { TokenCoin } from '@components/TokenCoin';
import { findMode, MODE_UNLOCK_COSTS } from '@data/modeCatalog';
import type { RootStackParamList } from '@navigation/routes';
import { useUserStore } from '@state/userStore';
import { colors, fonts, withAlpha } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Unlock'>;
type RouteParams = RouteProp<RootStackParamList, 'Unlock'>;

export function UnlockModal(): React.JSX.Element | null {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteParams>();
  const { modeId } = route.params;

  const mode = useMemo(() => findMode(modeId), [modeId]);
  const cost = MODE_UNLOCK_COSTS[modeId] ?? 0;
  const tokens = useUserStore((s) => s.tokens);
  const unlockMode = useUserStore((s) => s.unlockMode);

  const affordable = tokens >= cost;
  const shortfall = Math.max(0, cost - tokens);

  const close = useCallback(() => navigation.goBack(), [navigation]);

  const handleUnlock = useCallback(() => {
    haptics.impact('medium');
    const result = unlockMode(modeId);
    if (!result.success) {
      // Defensive — the affordable gate above should make
      // insufficient_balance unreachable here, but if it (or an
      // already_unlocked race) fires, fall back rather than stranding
      // the user on a dead modal.
      if (result.error === 'insufficient_balance') {
        navigation.replace('InsufficientTokens', { modeId });
      } else {
        navigation.goBack();
      }
      return;
    }
    // Post-unlock routing mirrors HomeScreen.playMode's remaining
    // gates (balance → tutorial → matchmaking). The auto-flow bypasses
    // playMode, so without this re-check a player who can afford the
    // unlock COST but not the match STAKE (e.g. 300-349 tokens → Mode
    // 2: cost 300, stake 50) would be routed straight into a match
    // they can't pay for (createMatch's subtractTokens clamps at zero,
    // so it silently under-charges). Read fresh state — the unlock
    // debit already landed.
    const after = useUserStore.getState();
    const stake = mode?.meta.stake ?? 0;
    if (after.tokens < stake) {
      navigation.replace('InsufficientTokens', { modeId });
      return;
    }
    // `replace` so back can't return to the spent modal. Tutorial-
    // unseen modes get their teaching detour (the tutorial's own CTA
    // replaces into Matchmaking); seen modes go straight there.
    const tutorialSeen = after.modeTutorialsSeen[modeId] === true;
    if (!tutorialSeen) {
      navigation.replace('ModeTutorial', { modeId });
    } else {
      navigation.replace('Matchmaking', { modeId });
    }
  }, [unlockMode, modeId, navigation, mode]);

  // Fail-safe — a corrupt modeId with no catalog entry must not leave
  // the player stranded on a transparent, undismissable modal. Bounce
  // back rather than rendering nothing.
  useEffect(() => {
    if (mode === undefined) navigation.goBack();
  }, [mode, navigation]);

  const handleNeedMore = useCallback(() => {
    haptics.selection();
    navigation.navigate('InsufficientTokens', { modeId });
  }, [navigation, modeId]);

  // Defensive — a corrupt modeId (no catalog entry) should not crash;
  // bounce back to Home rather than render a broken card.
  if (mode === undefined) return null;

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
              <LinearGradient
                colors={[mode.meta.gradient[0], mode.meta.gradient[1]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconDisc}
              >
                <ModeIcon iconKey={mode.meta.iconKey} size={44} />
              </LinearGradient>
            </View>

            <Text style={styles.title}>{mode.meta.name}</Text>
            <Text style={styles.description} numberOfLines={2}>
              {mode.meta.description}
            </Text>

            <View style={styles.costChip}>
              <TokenCoin size={16} />
              <Text style={styles.costText}>{cost.toLocaleString()} TOKENS</Text>
            </View>

            <Text style={styles.balance}>You have {tokens.toLocaleString()} tokens</Text>

            <View style={styles.actions}>
              {affordable ? (
                <Button onPress={handleUnlock}>Unlock</Button>
              ) : (
                <Button variant="outline" onPress={handleNeedMore}>
                  Need {shortfall.toLocaleString()} more tokens
                </Button>
              )}
              <Button variant="outline" onPress={close}>
                Cancel
              </Button>
            </View>
          </GlassCard>
        </View>
      </View>
    </Screen>
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
    // press still fires; the GlassCard catches its own taps.
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
  iconDisc: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  description: {
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  costChip: {
    alignSelf: 'center',
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha(colors.gold, 0.12),
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.4),
  },
  costText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.gold,
  },
  balance: {
    marginTop: 10,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actions: {
    marginTop: 20,
    gap: 10,
  },
});
