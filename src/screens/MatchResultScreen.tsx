/**
 * Match epilogue. Variant-driven layout (`outcome` route param drives
 * everything: tint, title, copy, reward, XP). The reward token grant
 * fires once per mount via a ref-guarded `useEffect` so a re-render
 * (e.g. after a font load tick) cannot double-pay the player.
 *
 * Phase 1B carries no engine, so the secret reveal pulls from
 * `mockSecretByMode`. Phase 2 will deliver the secret on the route
 * params; the consumer change is one `secretFor(modeId)` swap for
 * `route.params.secret`.
 *
 * Reward policy (sourced from SPEC §6 and §7.2):
 *   victory   → +rewardWin tokens, +30 XP
 *   draw      → +rewardDraw tokens, +15 XP
 *   stalemate → +stake tokens (refund), +0 XP
 *   defeat    → +0 tokens,           +5 XP
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button } from '@components/Button';
import { ConfettiOverlay } from '@components/ConfettiOverlay';
import { DigitTile } from '@components/DigitTile';
import { Screen } from '@components/Screen';
import { TinyTag } from '@components/TinyTag';
import { TokenCoin } from '@components/TokenCoin';
import { findMode } from '@data/modeCatalog';
import { secretDigits } from '@data/mockSecrets';
import { findOpponent } from '@data/mockOpponents';
import { grantTokens, useMockUser } from '@data/mockUser';
import type { MatchResultOutcome, RootStackParamList } from '@navigation/routes';
import { colors, fonts, withAlpha } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MatchResult'>;
type RouteParams = RouteProp<RootStackParamList, 'MatchResult'>;

interface OutcomeViewModel {
  readonly title: string;
  readonly tint: string;
  readonly subTemplate: (ctx: { opponentName: string; turns: number }) => string;
  readonly secretLabel: string;
  readonly tokens: (ctx: { rewardWin: number; rewardDraw: number; stake: number }) => number;
  readonly tokenLabel: string;
  readonly xp: number;
  readonly confetti: boolean;
  readonly tagLabel: string;
  readonly secretTileState: 'green' | 'gray';
}

const OUTCOMES: Readonly<Record<MatchResultOutcome, OutcomeViewModel>> = {
  victory: {
    title: 'VICTORY',
    tint: colors.gold,
    subTemplate: (c) => `You cracked the code in ${c.turns} guesses`,
    secretLabel: 'The secret was',
    tokens: (c) => c.rewardWin,
    tokenLabel: 'tokens',
    xp: 30,
    confetti: true,
    tagLabel: 'MATCH RESULT',
    secretTileState: 'green',
  },
  defeat: {
    title: 'DEFEAT',
    tint: '#fca5a5',
    subTemplate: (c) => `${c.opponentName} cracked it in ${c.turns}`,
    secretLabel: "Opponent's code",
    tokens: () => 0,
    tokenLabel: 'tokens',
    xp: 5,
    confetti: false,
    tagLabel: 'MATCH RESULT',
    secretTileState: 'gray',
  },
  draw: {
    title: 'DRAW',
    tint: colors.violet,
    subTemplate: (c) => `Both cracked the code in ${c.turns} guesses`,
    secretLabel: 'The secret was',
    tokens: (c) => c.rewardDraw,
    tokenLabel: 'tokens',
    xp: 15,
    confetti: false,
    tagLabel: 'DRAW',
    secretTileState: 'gray',
  },
  stalemate: {
    title: 'STALEMATE',
    tint: '#c4b5fd',
    subTemplate: () => 'Neither of you could crack the code',
    secretLabel: 'The code was',
    tokens: (c) => c.stake,
    tokenLabel: 'refunded',
    xp: 0,
    confetti: false,
    tagLabel: 'STALEMATE',
    secretTileState: 'gray',
  },
};

export function MatchResultScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteParams>();
  const insets = useSafeAreaInsets();
  const user = useMockUser();
  const { modeId, outcome } = route.params;

  const view = OUTCOMES[outcome];
  const mode = useMemo(() => findMode(modeId), [modeId]);
  // Phase 1B: opponent name + turn count come from the mock layer.
  // Phase 2 routes the real engine summary in via params.
  const opponent = useMemo(() => findOpponent(`opp-1`), []);
  const turns = 6;

  const reward = view.tokens({
    rewardWin: mode?.meta.rewardWin ?? 0,
    rewardDraw: mode?.meta.rewardDraw ?? 0,
    stake: mode?.meta.stake ?? 0,
  });

  // Idempotent reward grant — guarded so a re-mount under React Strict
  // Mode (or any future Suspense boundary) never double-pays.
  const grantedRef = useRef<boolean>(false);
  useEffect(() => {
    if (grantedRef.current) return;
    grantedRef.current = true;
    if (reward > 0) grantTokens(reward);
  }, [reward]);

  const playAgain = useCallback(
    () => navigation.replace('Matchmaking', { modeId }),
    [navigation, modeId],
  );
  const goHome = useCallback(() => navigation.popToTop(), [navigation]);

  const digits = secretDigits(modeId);
  const sub = view.subTemplate({
    opponentName: opponent?.username ?? 'Opponent',
    turns,
  });

  return (
    <Screen ambientTint={view.tint} ambientIntensity={outcome === 'defeat' ? 0.12 : 0.26}>
      {view.confetti ? <ConfettiOverlay /> : null}

      <View style={[styles.body, { paddingTop: insets.top + 60 }]}>
        <View style={styles.tagRow}>
          <TinyTag color={view.tint}>{view.tagLabel}</TinyTag>
        </View>
        <Text
          accessibilityRole="header"
          style={[
            styles.title,
            {
              color: view.tint,
              ...Platform.select({
                ios: {
                  textShadowColor: withAlpha(view.tint, 0.7),
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 40,
                },
                default: {},
              }),
            },
          ]}
        >
          {view.title}
        </Text>
        <Text style={styles.subtitle}>{sub}</Text>

        <View style={styles.secretBlock}>
          <Text style={styles.secretLabel}>{view.secretLabel}</Text>
          <View style={styles.secretRow}>
            {digits.map((digit, i) => (
              <DigitTile key={i} digit={digit} state={view.secretTileState} size={52} />
            ))}
          </View>
        </View>

        <View style={styles.rewardRow}>
          <RewardChip
            icon={<TokenCoin size={18} />}
            value={`+${reward.toLocaleString()}`}
            color={colors.gold}
            label={view.tokenLabel}
          />
          <RewardChip value={`+${view.xp}`} color={colors.violet} label="XP" />
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Games" value={user.stats.gamesPlayed.toLocaleString()} />
          <StatCard label="Win Rate" value={`${user.stats.winRate}%`} />
          <StatCard label="Best Streak" value={user.stats.bestStreak.toString()} />
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <Button onPress={playAgain} size="lg" style={styles.playAgain}>
          Play again
        </Button>
        <Button onPress={goHome} variant="outline" size="lg" style={styles.home}>
          Home
        </Button>
      </View>
    </Screen>
  );
}

interface RewardChipProps {
  readonly icon?: React.JSX.Element;
  readonly value: string;
  readonly color: string;
  readonly label: string;
}

function RewardChip({ icon, value, color, label }: RewardChipProps): React.JSX.Element {
  return (
    <View
      style={[
        styles.chip,
        {
          borderColor: withAlpha(color, 0.4),
          ...Platform.select({
            ios: {
              shadowColor: color,
              shadowOpacity: 0.2,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 0 },
            },
            default: {},
          }),
        },
      ]}
    >
      {icon}
      <View>
        <Text style={[styles.chipValue, { color }]}>{value}</Text>
        <Text style={styles.chipLabel}>{label}</Text>
      </View>
    </View>
  );
}

interface StatCardProps {
  readonly label: string;
  readonly value: string;
}

function StatCard({ label, value }: StatCardProps): React.JSX.Element {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  tagRow: {
    alignItems: 'center',
  },
  title: {
    marginTop: 16,
    fontFamily: fonts.display,
    fontSize: 56,
    letterSpacing: -1.12,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 14,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  secretBlock: {
    marginTop: 28,
    alignItems: 'center',
    gap: 10,
  },
  secretLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textDim,
  },
  secretRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rewardRow: {
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
  },
  chipValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  chipLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textDim,
    marginTop: 2,
  },
  statsGrid: {
    marginTop: 28,
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  statCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.text,
  },
  statLabel: {
    marginTop: 2,
    fontFamily: fonts.bodySemibold,
    fontSize: 9.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  footer: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    gap: 10,
  },
  playAgain: {
    flex: 1.4,
  },
  home: {
    flex: 1,
  },
});
