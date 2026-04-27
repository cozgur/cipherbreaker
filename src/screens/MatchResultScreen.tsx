/**
 * Match epilogue. Variant-driven layout (`outcome` route param drives
 * everything: tint, title, copy, reward, XP). The reward token grant,
 * stat record, and XP gain all fire once per mount via the same
 * `grantedRef`-guarded `useEffect` so a re-render (e.g. after a font
 * load tick) cannot double-pay the player or double-bump stats.
 *
 * Engine path (Mode 1 today; Modes 2-7 land in Phase 4-5) delivers the
 * real opponent secret, the winner's per-side guess count, the reward,
 * and the XP gain on the route params. Mock path leaves them
 * undefined; we fall back to the catalog defaults so the dev-picker
 * loop still grants the tokens it always did, and stats updates are
 * skipped entirely (the mock player isn't really playing a match).
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
import { secretFor } from '@data/mockSecrets';
import { findOpponent } from '@data/mockOpponents';
import { grantTokens, useMockUser } from '@data/mockUser';
import type { MatchResultOutcome, RootStackParamList } from '@navigation/routes';
import { useUserStore } from '@state/userStore';
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
}

/**
 * The secret reveal renders as `'neutral'` on every outcome. VICTORY
 * previously used `'green'` (Mode 1's Wordle palette) — fine for
 * Mode 1, misleading for Modes 2/3 which paint no per-digit colours
 * in the timeline. Confetti + the gold VICTORY title + the token
 * chip are already enough win-state signal; the tile colour adds
 * inconsistency without information.
 */
const SECRET_TILE_STATE = 'neutral' as const;

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
  },
};

export function MatchResultScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteParams>();
  const insets = useSafeAreaInsets();
  const user = useMockUser();
  const { modeId, outcome, secret: routeSecret } = route.params;

  const view = OUTCOMES[outcome];
  const mode = useMemo(() => findMode(modeId), [modeId]);
  const opponent = useMemo(() => findOpponent(`opp-1`), []);

  const fallbackReward = view.tokens({
    rewardWin: mode?.meta.rewardWin ?? 0,
    rewardDraw: mode?.meta.rewardDraw ?? 0,
    stake: mode?.meta.stake ?? 0,
  });
  const reward = route.params.reward ?? fallbackReward;
  const xpGain = route.params.xpGain ?? view.xp;
  const turns = route.params.guessCount ?? 6;
  const isEnginePath = route.params.guessCount !== undefined;

  // Idempotent post-match grants — single ref guards all three writes
  // so a re-mount under React Strict Mode (or any future Suspense
  // boundary) never double-pays, double-bumps, or double-records.
  const grantedRef = useRef<boolean>(false);
  useEffect(() => {
    if (grantedRef.current) return;
    grantedRef.current = true;
    if (reward > 0) grantTokens(reward);
    // Stats + XP only fire on the engine path. The mock dev-picker
    // path is a synthetic outcome — recording it would inflate
    // gamesPlayed every time the developer opens the result screen.
    if (isEnginePath) {
      useUserStore.getState().recordMatchResult({ modeId, outcome, turns });
      if (xpGain > 0) useUserStore.getState().addXp(xpGain);
    }
  }, [reward, xpGain, isEnginePath, modeId, outcome, turns]);

  const playAgain = useCallback(
    () => navigation.replace('Matchmaking', { modeId }),
    [navigation, modeId],
  );
  const goHome = useCallback(() => navigation.popToTop(), [navigation]);

  const revealSecret = routeSecret ?? secretFor(modeId);
  const digits = useMemo(
    () => Array.from(revealSecret, (c) => Number.parseInt(c, 10)),
    [revealSecret],
  );
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
              <DigitTile key={i} digit={digit} state={SECRET_TILE_STATE} size={52} />
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
          <RewardChip value={`+${xpGain}`} color={colors.violet} label="XP" />
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
