/**
 * Matchmaking — a randomised search delay (2200–3200ms) followed by a
 * 1-second opponent reveal, then auto-navigation to the next route.
 * The next route is decided by `modeRouter` so Mode 7 (Mirror) skips
 * SecretSetup and lands straight on Match.
 *
 * The randomised delay is intentional: a fixed 2.5s search felt
 * mechanical in playtests. Math.random keeps it organic without
 * needing a real backend; Phase 7A's real matchmaking will swap the
 * timer for a server roundtrip without changing the screen state.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '@components/Avatar';
import { GlassCard } from '@components/GlassCard';
import { RadarAnimation } from '@components/RadarAnimation';
import { Screen } from '@components/Screen';
import { TinyTag } from '@components/TinyTag';
import { findMode } from '@data/modeCatalog';
import { pickRandomOpponent, type MockOpponent } from '@data/mockOpponents';
import { nextRouteAfterMatchmaking } from '@game/modeRouter';
import type { RootStackParamList } from '@navigation/routes';
import { colors, fonts, withAlpha } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Matchmaking'>;
type RouteParams = RouteProp<RootStackParamList, 'Matchmaking'>;

const SEARCH_MIN_MS = 2200;
const SEARCH_MAX_MS = 3200;
const REVEAL_MS = 1000;

function rollSearchDelay(): number {
  return SEARCH_MIN_MS + Math.random() * (SEARCH_MAX_MS - SEARCH_MIN_MS);
}

export function MatchmakingScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteParams>();
  const insets = useSafeAreaInsets();
  const { modeId } = route.params;

  const mode = useMemo(() => findMode(modeId), [modeId]);
  // Mirror copy ("Solo race · same code, different minds") is keyed
  // off `sharedSecret`, not `parallelRace`. Phase 6's flag split lets
  // Mode 6 ride parallelEngine without taking on Mirror's UX.
  const isMirror = mode?.rules.flags.sharedSecret === true;

  const [opponent, setOpponent] = useState<MockOpponent | null>(null);
  const opponentRef = useRef<MockOpponent | null>(null);

  useEffect(() => {
    let cancelled = false;
    const searchTimer = setTimeout(() => {
      if (cancelled) return;
      const picked = pickRandomOpponent();
      opponentRef.current = picked;
      setOpponent(picked);
    }, rollSearchDelay());

    return (): void => {
      cancelled = true;
      clearTimeout(searchTimer);
    };
  }, []);

  useEffect(() => {
    if (opponent == null) return;
    const revealTimer = setTimeout(() => {
      const target = nextRouteAfterMatchmaking(modeId);
      const params = {
        modeId,
        opponentId: opponent.id,
      };
      // `replace` so the back gesture cannot rewind to Matchmaking.
      if (target === 'Match') {
        navigation.replace('Match', params);
      } else {
        navigation.replace('SecretSetup', params);
      }
    }, REVEAL_MS);

    return (): void => clearTimeout(revealTimer);
  }, [opponent, modeId, navigation]);

  const headline = opponent
    ? 'Opponent found!'
    : isMirror
      ? 'Finding a rival to race'
      : 'Searching for opponent';

  const subline = opponent
    ? `${mode?.meta.name ?? 'Match'} — ready to play`
    : isMirror
      ? 'Solo race · same code, different minds'
      : 'Matching by skill level';

  return (
    <Screen ambientIntensity={0.22}>
      <View style={[styles.tagWrap, { top: insets.top + 16 }]}>
        <TinyTag>MATCHMAKING</TinyTag>
      </View>

      <View style={styles.radarWrap}>
        <RadarAnimation size={260} />
      </View>

      <View style={[styles.copy, { top: insets.top + 380 }]}>
        <Text style={styles.headline}>
          {headline}
          {opponent ? null : <Text style={styles.dots}>...</Text>}
        </Text>
        <Text style={styles.subline}>{subline}</Text>
      </View>

      {opponent ? (
        <MotiView
          from={{ opacity: 0, translateY: 12, scale: 0.96 }}
          animate={{ opacity: 1, translateY: 0, scale: 1 }}
          transition={{ type: 'timing', duration: 320 }}
          style={[styles.opponentWrap, { bottom: insets.bottom + 80 }]}
        >
          <GlassCard padding={18}>
            <View style={styles.opponentRow}>
              <Avatar name={opponent.username} size={56} />
              <View style={styles.opponentInfo}>
                <Text style={styles.opponentName} numberOfLines={1}>
                  {opponent.username}
                </Text>
                <View style={styles.opponentMeta}>
                  <Text style={styles.opponentLevel}>
                    Lv. {opponent.level}
                    {opponent.flag != null ? ` · ${opponent.flag}` : ''}
                  </Text>
                  {opponent.isOnline ? (
                    <View style={styles.onlineWrap}>
                      <View style={styles.onlineDot} />
                      <Text style={styles.onlineText}>Online</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <Text style={styles.vs}>VS</Text>
            </View>
          </GlassCard>
        </MotiView>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tagWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 6,
  },
  radarWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 6,
  },
  headline: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  dots: {
    color: colors.violet,
  },
  subline: {
    marginTop: 10,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  opponentWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    zIndex: 7,
  },
  opponentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  opponentInfo: {
    flex: 1,
    minWidth: 0,
  },
  opponentName: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.text,
    letterSpacing: -0.3,
  },
  opponentMeta: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  opponentLevel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  onlineWrap: {
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
  onlineText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.success,
  },
  vs: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.pink,
    letterSpacing: -0.3,
    transform: [{ rotate: '-6deg' }],
    // `withAlpha` import keeps tokens consistent — unused here but
    // referenced by the screen's pink VS shadow on iOS.
    ...Platform.select({
      ios: {
        textShadowColor: withAlpha(colors.pink, 0.4),
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
      },
      default: {},
    }),
  },
});
