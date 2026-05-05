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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AnimatedTokenCounter } from '@components/AnimatedTokenCounter';
import { Button } from '@components/Button';
import { ConfettiOverlay } from '@components/ConfettiOverlay';
import { DigitTile } from '@components/DigitTile';
import { Screen } from '@components/Screen';
import { TinyTag } from '@components/TinyTag';
import { TokenCoin } from '@components/TokenCoin';
import { TokenRewardFloater } from '@components/TokenRewardFloater';
import { findMode } from '@data/modeCatalog';
import { secretFor } from '@data/mockSecrets';
import { findOpponent } from '@data/mockOpponents';
import { grantTokens, useMockUser } from '@data/mockUser';
import { formatDailyDate } from '@game/daily/dailyDate';
import { canWatchAd } from '@game/economy/adCap';
import { canShowInterstitial } from '@game/economy/iap';
import { shouldShowInterstitial } from '@game/economy/interstitial';
import type { MatchResultOutcome, RootStackParamList } from '@navigation/routes';
import { useMatchStore } from '@state/matchStore';
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
  const { modeId, outcome, opponentId, secret: routeSecret } = route.params;

  const view = OUTCOMES[outcome];
  const mode = useMemo(() => findMode(modeId), [modeId]);
  const opponent = useMemo(() => findOpponent(opponentId), [opponentId]);

  const fallbackReward = view.tokens({
    rewardWin: mode?.meta.rewardWin ?? 0,
    rewardDraw: mode?.meta.rewardDraw ?? 0,
    stake: mode?.meta.stake ?? 0,
  });
  const reward = route.params.reward ?? fallbackReward;
  const xpGain = route.params.xpGain ?? view.xp;
  const turns = route.params.guessCount ?? 6;
  const isEnginePath = route.params.guessCount !== undefined;

  // Idempotent post-match grants — single ref guards every write
  // so a re-mount under React Strict Mode (or any future Suspense
  // boundary) never double-pays, double-bumps, or double-records.
  // Phase 7A.5 CP3 layered three new responsibilities into the same
  // guarded block: increment the periodic-interstitial counter,
  // check the canShowInterstitial gate, and (if true) navigate +
  // reset the counter on a 1.5s delay so the player sees the
  // result chip before the ad lands.
  //
  // Phase 7A.5 CP6 lifted the timer id into a component-scope ref
  // so the Double-tap handler can cancel a pending interstitial
  // before it fires (Q9 priority — Double > Interstitial). The
  // timer callback also re-reads state at fire time and re-checks
  // the gate, defending against the race where the user takes the
  // double a hair before the timer schedules.
  const grantedRef = useRef<boolean>(false);
  const interstitialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // useState (not useRef) for the "interstitial fired" flag because
  // its flip needs to re-render the Double UI gate. A ref would
  // satisfy the lifecycle but the lint rule (react-hooks/refs)
  // correctly flags "accessing ref during render" — and the UI
  // gate IS render-time. State change triggers the re-render that
  // hides the Double affordance once the interstitial has covered
  // the screen.
  const [interstitialFired, setInterstitialFired] = useState(false);
  useEffect(() => {
    if (grantedRef.current) return;
    grantedRef.current = true;
    if (reward > 0) grantTokens(reward);
    // Stats + XP + interstitial counter only fire on the engine
    // path. The mock dev-picker path is a synthetic outcome —
    // recording it would inflate gamesPlayed every time the
    // developer opens the result screen, AND would let the dev
    // picker advance the interstitial counter.
    if (!isEnginePath) return;

    useUserStore.getState().recordMatchResult({
      modeId,
      outcome,
      turns,
      tokensEarnedThisMatch: reward,
    });
    if (xpGain > 0) useUserStore.getState().addXp(xpGain);

    // Increment the Mode 1-7 match counter for the periodic
    // interstitial. Daily Challenge does NOT reach this seam (Daily
    // never uses MatchResultScreen — pinned by CP1's invariant
    // tests), so the ad-free invariant holds at the call site, not
    // just at the action boundary.
    useUserStore.getState().incrementMatchCounter();

    // Re-read state AFTER the increment so the gate sees the new
    // counter value. canShowInterstitial composes adsRemoved + ad
    // cap with the threshold — if the player has Remove Ads, the
    // counter still increments (correct state if they ever lose
    // the IAP via cancellation/refund) but no ad fires.
    const snapshot = useUserStore.getState();
    const today = formatDailyDate(new Date());
    const gateOpen = canShowInterstitial(
      {
        adsWatchedToday: snapshot.adsWatchedToday,
        adsWatchedLastDate: snapshot.adsWatchedLastDate,
        adsRemoved: snapshot.adsRemoved,
      },
      today,
    );
    if (!gateOpen) return;
    if (!shouldShowInterstitial(snapshot.matchesSinceLastInterstitial)) return;

    // Delay the navigation so the result chip has a beat to land
    // before the interstitial covers it. Reset the counter
    // optimistically — if the player force-quits during the
    // delay, they re-enter at 0 and accumulate again, which is
    // the desired behaviour (no farming via interrupt).
    interstitialTimerRef.current = setTimeout(() => {
      // CP6 — re-check the gate at fire time. Between scheduling
      // and firing the user may have taken Double, which resets
      // matchesSinceLastInterstitial via applyRewardedDouble. A
      // fresh read short-circuits the trigger so no interstitial
      // covers the AdWatch / result screen.
      const fresh = useUserStore.getState();
      if (!shouldShowInterstitial(fresh.matchesSinceLastInterstitial)) return;
      setInterstitialFired(true);
      navigation.navigate('InterstitialAd');
      useUserStore.getState().resetMatchCounter();
    }, 1500);
    return () => {
      if (interstitialTimerRef.current !== null) {
        clearTimeout(interstitialTimerRef.current);
        interstitialTimerRef.current = null;
      }
    };
  }, [reward, xpGain, isEnginePath, modeId, outcome, turns, navigation]);

  const playAgain = useCallback(
    () => navigation.replace('Matchmaking', { modeId }),
    [navigation, modeId],
  );
  const goHome = useCallback(() => navigation.popToTop(), [navigation]);

  // Phase 7A.5 CP6 + Codex finding 2 fix — rewarded "Double"
  // eligibility + handlers. The Double UI shows when ALL of:
  //   - outcome is win or draw (loss has no reward to double;
  //     stalemate refunds the raw stake — no multiplier path).
  //   - reward > 0 (defensive — a 0-reward outcome shouldn't
  //     surface a Double CTA).
  //   - isEnginePath (mock dev-picker has no real reward to double).
  //   - matchState.doubledReward !== true (idempotency — once
  //     redeemed, the option vanishes for this match).
  //   - Daily ad cap has headroom for one more watch.
  //   - This match's interstitial has not already fired (Q9 —
  //     Çift ad ASLA yok; once interstitial covered the screen,
  //     the rewarded path is locked for this match).
  //   - The user has not tapped "Skip" for this match (local
  //     dismiss state — once skipped, the affordance hides).
  //
  // Note: Remove Ads (`adsRemoved` IAP) does NOT gate this surface
  // anymore. Q11=B reading — Remove Ads only removes FORCED ad
  // layers (CP3 interstitial); user-elective rewarded paths stay
  // available so paying players keep the same earning ceiling.
  const matchState = useMatchStore((s) => s.matchState);
  const adsWatchedToday = useUserStore((s) => s.adsWatchedToday);
  const adsWatchedLastDate = useUserStore((s) => s.adsWatchedLastDate);
  const [skipDoubleTapped, setSkipDoubleTapped] = useState(false);
  // Phase 7A.5 CP7 — TokenRewardFloater shows the "+N" pill that
  // translates upward + fades out. Mounted on win/draw paths
  // when there's a positive reward; the floater itself fires
  // `onComplete` to dismiss after the 1.5s animation. The
  // mock-path doesn't grant tokens (no engine reward), so the
  // floater also gates on `isEnginePath`.
  const [showRewardFloater, setShowRewardFloater] = useState<boolean>(
    isEnginePath && reward > 0,
  );

  const isWinOrDraw = outcome === 'victory' || outcome === 'draw';
  const alreadyDoubled = matchState?.doubledReward === true;
  const adCapAvailable = useMemo(() => {
    const today = formatDailyDate(new Date());
    return canWatchAd({ adsWatchedToday, adsWatchedLastDate }, today);
  }, [adsWatchedToday, adsWatchedLastDate]);

  // Phase 7A.5 Codex finding 2 fix — Q11=B contract: Remove Ads
  // IAP gates only the FORCED interstitial layer. The rewarded
  // double is user-elective, so paying users keep the option to
  // double their match reward. Pre-fix the gate included
  // `!adsRemoved` and silently disabled this surface for paying
  // users — wrong reading of Q11. The interstitial gate (CP3)
  // still respects adsRemoved correctly via canShowInterstitial.
  const doubleEligible =
    isEnginePath &&
    isWinOrDraw &&
    reward > 0 &&
    !alreadyDoubled &&
    adCapAvailable &&
    !interstitialFired &&
    !skipDoubleTapped;

  // Fire the offered analytics once per mount when the UI actually
  // renders the Double CTA. Console-log analytics today; Phase 7B
  // swaps this for the real provider.
  const offeredLoggedRef = useRef<boolean>(false);
  useEffect(() => {
    if (doubleEligible && !offeredLoggedRef.current) {
      offeredLoggedRef.current = true;
      console.log('[analytics] rewarded_double_offered', { modeId, outcome, reward });
    }
  }, [doubleEligible, modeId, outcome, reward]);

  const onDoublePress = useCallback(() => {
    // Cancel any pending interstitial trigger — Q9 priority,
    // Double > Interstitial. The applyRewardedDouble action will
    // also reset the counter so the timer's re-check at fire
    // time short-circuits, but cancelling here is the
    // belt-and-braces guard.
    if (interstitialTimerRef.current !== null) {
      clearTimeout(interstitialTimerRef.current);
      interstitialTimerRef.current = null;
    }
    // Codex finding 1 fix — pass matchId, NOT a credit amount.
    // The user-supplied amount path was a token-mint exploit; the
    // action now reads the reward authoritatively from matchState.
    // If matchState somehow has no id (legacy persisted match),
    // skip — applyRewardedDouble would reject with `wrong_id`.
    const id = matchState?.id;
    if (id === undefined) return;
    navigation.navigate('AdWatch', { mode: 'double', matchId: id });
  }, [navigation, matchState?.id]);

  const onSkipDouble = useCallback(() => {
    console.log('[analytics] rewarded_double_skipped', { modeId, outcome });
    setSkipDoubleTapped(true);
  }, [modeId, outcome]);

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
            // Phase 7A.5 CP7 — animate the token count up from 0
            // to `reward` on mount. XP chip stays static (small
            // number, less impact from animation).
            value={{ animateNumber: reward, prefix: '+' }}
            color={colors.gold}
            label={view.tokenLabel}
          />
          <RewardChip value={`+${xpGain}`} color={colors.violet} label="XP" />
          {showRewardFloater ? (
            <View style={styles.floaterAnchor} pointerEvents="none">
              <TokenRewardFloater
                amount={reward}
                onComplete={() => setShowRewardFloater(false)}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Games" value={user.stats.gamesPlayed.toLocaleString()} />
          <StatCard label="Win Rate" value={`${user.stats.winRate}%`} />
          <StatCard label="Best Streak" value={user.stats.bestStreak.toString()} />
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        {doubleEligible ? (
          <View style={styles.doubleRow}>
            <Button
              onPress={onDoublePress}
              variant="cyan"
              size="lg"
              style={styles.doubleButton}
              icon={
                <View style={styles.doubleIconWrap}>
                  <TokenCoin size={14} />
                </View>
              }
            >
              Double with ad?
            </Button>
            <Button
              onPress={onSkipDouble}
              variant="outline"
              size="lg"
              style={styles.skipDoubleButton}
            >
              Skip
            </Button>
          </View>
        ) : null}
        <View style={styles.primaryRow}>
          <Button onPress={playAgain} size="lg" style={styles.playAgain}>
            Play again
          </Button>
          <Button onPress={goHome} variant="outline" size="lg" style={styles.home}>
            Home
          </Button>
        </View>
      </View>
    </Screen>
  );
}

interface RewardChipProps {
  readonly icon?: React.JSX.Element;
  /**
   * Phase 7A.5 CP7 — `value` accepts either a pre-formatted
   * string (XP chip stays static) or an animated token amount
   * (`{ animateNumber: number }`) which renders an
   * `AnimatedTokenCounter` so the count-up animation lands on
   * mount. The chip framing is unchanged in either branch.
   */
  readonly value: string | { readonly animateNumber: number; readonly prefix?: string };
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
        {typeof value === 'string' ? (
          <Text style={[styles.chipValue, { color }]}>{value}</Text>
        ) : (
          <AnimatedTokenCounter
            value={value.animateNumber}
            prefix={value.prefix ?? '+'}
            style={[styles.chipValue, { color }]}
          />
        )}
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
  floaterAnchor: {
    position: 'absolute',
    top: -14,
    alignSelf: 'center',
    zIndex: 10,
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
    flexDirection: 'column',
    gap: 10,
  },
  primaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  doubleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  doubleButton: {
    flex: 1.6,
  },
  doubleIconWrap: {
    marginRight: 2,
  },
  skipDoubleButton: {
    flex: 1,
  },
  playAgain: {
    flex: 1.4,
  },
  home: {
    flex: 1,
  },
});
