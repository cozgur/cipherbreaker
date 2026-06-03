/**
 * Matchmaking — a skewed search delay (Phase 7A.8 CP5) followed by a
 * 1-second opponent reveal, then auto-navigation to the next route.
 * The next route is decided by `modeRouter` so Mode 7 (Mirror) skips
 * SecretSetup and lands straight on Match.
 *
 * The search delay is drawn from `pickMatchmakingDuration` — skewed so
 * most matches resolve in 4-8s with the occasional 8-15s wait, capped
 * at 15s (no phone-down outlier). A fixed delay read as mechanical in
 * playtests and broke the "real opponent" illusion. The duration is
 * picked ONCE on mount and held in a ref so the same match never
 * re-rolls its wait on re-render. Phase 7A's real matchmaking will
 * swap the timer for a server roundtrip without changing screen state.
 *
 * Progressive wait copy (CP5): while still searching, an apologetic
 * note fades in at the 10s and 15s thresholds so a longer-than-usual
 * wait is acknowledged rather than left silent. The 0-10s window keeps
 * the existing headline/subline untouched (including Mode 7's
 * race-specific copy). The 15s note is defensive — the duration cap is
 * <15s, so it only surfaces if a future change lifts the ceiling.
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
import { modeRegistry } from '@game/modeRegistry';
import { pickMatchmakingDuration } from '@/lib/matchmaking';
import type { RootStackParamList } from '@navigation/routes';
import { useMatchStore } from '@state/matchStore';
import { colors, fonts, withAlpha } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Matchmaking'>;
type RouteParams = RouteProp<RootStackParamList, 'Matchmaking'>;

const REVEAL_MS = 1000;

// Wait-note threshold (ms from mount). Only matters while still
// searching; once an opponent is found the headline switches to
// "Opponent found!" and the note is unmounted.
//
// CP5.1 tuning: bumped 10s → 12s. At 10s the note fired on ~25% of
// matches (all of the 12-15s bucket + half the 8-12s bucket of the
// skewed distribution) — too frequent for an "occasional" apologetic
// beat. At 12s only the 12-15s bucket trips it (~10%), which is the
// intended "rare longer wait" cadence. The old 15s "almost there"
// stage was removed: the duration is capped under 15s, so it was
// dead code in practice.
const WAIT_NOTE_MS = 12000;

// English per app locale (the screen's other copy is English; the TR
// draft from the CP5 brief was reverted after a locale survey). No
// i18n system exists yet, so this stays inline like the other literals.
// Casual + lightly apologetic to match the app's tone.
const WAIT_COPY_LONG = 'Taking longer than usual...';

// 0: initial copy ("Searching..." / "Finding a rival to race")
// 1: 12s+ longer-than-usual note
type WaitStage = 0 | 1;

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

  // Pick the search duration once per mount and hold it in a ref so a
  // re-render never re-rolls the wait. Lazy-init guard is the standard
  // React idiom for a ref that should be computed exactly once.
  const searchDelayRef = useRef<number | null>(null);
  if (searchDelayRef.current === null) {
    searchDelayRef.current = pickMatchmakingDuration();
  }

  const [waitStage, setWaitStage] = useState<WaitStage>(0);

  useEffect(() => {
    let cancelled = false;
    const searchTimer = setTimeout(() => {
      if (cancelled) return;
      const picked = pickRandomOpponent();
      opponentRef.current = picked;
      setOpponent(picked);
    }, searchDelayRef.current ?? 0);

    return (): void => {
      cancelled = true;
      clearTimeout(searchTimer);
    };
  }, []);

  // Wait-note timer, independent of the search timer. The render gate
  // on `opponent == null` means a timer that fires after the match is
  // found leaves no visible trace.
  useEffect(() => {
    const t = setTimeout(() => setWaitStage(1), WAIT_NOTE_MS);
    return (): void => clearTimeout(t);
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
        // Mode 7 (sharedSecret) — engine generates the secret, no
        // SecretSetup step. Seed the store here so MatchScreen mounts
        // with `matchState.modeId === modeId` and the engine path
        // lights up; otherwise the gate at MatchScreen:131 falls back
        // to the DevResultPicker mock flow. Modes 1-6 still seed
        // inside SecretSetup.handleLockIn — this branch only fires
        // when `nextRouteAfterMatchmaking` returns 'Match' (Mirror).
        // Stake debit happens inside `matchStore.createMatch`; the
        // debit timing is documented in ARCHITECTURE.md (Mode 7
        // commits at the reveal moment because there is no later
        // confirmation gesture; replace-navigation also forecloses
        // a "back out before lock-in" path).
        if (modeRegistry.getOrNull(modeId) !== null) {
          const store = useMatchStore.getState();
          store.clearMatch();
          // '_' is the documented placeholder for sharedSecret modes
          // (see mode7Integration.test.ts) — the engine generates the
          // real code and overwrites it during `startMatch`.
          store.createMatch(modeId, '_');
          store.startMatch();
        }
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

        {opponent == null && waitStage >= 1 ? (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 400 }}
          >
            <Text style={styles.waitNote}>{WAIT_COPY_LONG}</Text>
          </MotiView>
        ) : null}
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
  waitNote: {
    marginTop: 14,
    fontFamily: fonts.body,
    fontSize: 12,
    color: withAlpha(colors.text, 0.55),
    textAlign: 'center',
    fontStyle: 'italic',
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
