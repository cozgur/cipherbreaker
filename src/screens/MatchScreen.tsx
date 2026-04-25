/**
 * The match arena. Header (round + mode-specific chips + forfeit X),
 * player area (Mode 1-6 = `PlayerCardPair`, Mode 7 = `SoloRaceBanner`),
 * scrollable timeline rendered through `guessRowRenderers`, and a
 * bottom input region (4 DigitTile + DigitKeypad + Guess CTA).
 *
 * Phase 1B carries no engine, so the Guess CTA opens the in-screen
 * `DevResultPicker` (development builds only) — the player chooses
 * the outcome, we replace into MatchResult. Production builds show a
 * "coming in phase 2" placeholder until Phase 3 wires the engine.
 *
 * Mode 7 (Mirror) re-uses the same screen via a single conditional
 * fork; the only differences are the header sub-chip and the
 * player-area component.
 */

import { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '@components/Avatar';
import { Button } from '@components/Button';
import { DigitKeypad } from '@components/DigitKeypad';
import { DigitTile } from '@components/DigitTile';
import { Screen } from '@components/Screen';
import { SectionLabel } from '@components/SectionLabel';
import { TinyTag } from '@components/TinyTag';
import { TypingIndicator } from '@components/TypingIndicator';
import { findMode } from '@data/modeCatalog';
import { buildMockTimeline } from '@data/mockMatchHistory';
import { chargeTokens, useMockUser } from '@data/mockUser';
import { findOpponent } from '@data/mockOpponents';
import { guessEntryToRowProps } from '@game/adapters/guessEntryToRowProps';
import { getRowRenderer } from '@game/renderers';
import type { GuessEntry, GuessRowAdaptorContext, ModeCatalogEntry } from '@game/types';
import type { MatchResultOutcome, RootStackParamList } from '@navigation/routes';
import { colors, fonts, withAlpha } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Match'>;
type RouteParams = RouteProp<RootStackParamList, 'Match'>;

const SECRET_LENGTH = 4;
const SUDDEN_DEATH_BUDGET = 5;

export function MatchScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteParams>();
  const insets = useSafeAreaInsets();
  const user = useMockUser();
  const { modeId, opponentId } = route.params;

  const mode = useMemo(() => findMode(modeId), [modeId]);
  const opponent = useMemo(() => findOpponent(opponentId), [opponentId]);
  const isMirror = mode?.rules.flags.parallelRace === true;

  const timeline = useMemo(() => buildMockTimeline(modeId), [modeId]);
  const RowRenderer = useMemo(() => getRowRenderer(modeId), [modeId]);
  const adaptorCtx: GuessRowAdaptorContext = useMemo(
    () => ({
      selfAvatar: user.username,
      opponentAvatar: opponent?.username ?? 'Opponent',
      modeId,
    }),
    [user.username, opponent?.username, modeId],
  );

  const [draftDigits, setDraftDigits] = useState<readonly (number | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const filledCount = draftDigits.filter((d) => d != null).length;
  const isComplete = filledCount === SECRET_LENGTH;

  const [pickerOpen, setPickerOpen] = useState<boolean>(false);

  const handleDigit = useCallback((digit: number): void => {
    setDraftDigits((current) => {
      const slot = current.findIndex((d) => d == null);
      if (slot === -1) return current;
      const updated = [...current];
      updated[slot] = digit;
      return updated;
    });
  }, []);

  const handleBackspace = useCallback((): void => {
    setDraftDigits((current) => {
      const lastFilled = [...current].reverse().findIndex((d) => d != null);
      if (lastFilled === -1) return current;
      const updated = [...current];
      updated[current.length - 1 - lastFilled] = null;
      return updated;
    });
  }, []);

  const submitGuess = useCallback((): void => {
    if (!isComplete) return;
    if (__DEV__) {
      setPickerOpen(true);
      return;
    }
    Alert.alert('Coming soon', 'Match logic ships in Phase 3.');
  }, [isComplete]);

  const pickOutcome = useCallback(
    (outcome: MatchResultOutcome): void => {
      setPickerOpen(false);
      navigation.replace('MatchResult', { modeId, outcome });
    },
    [modeId, navigation],
  );

  const closePicker = useCallback(() => setPickerOpen(false), []);

  const confirmForfeit = useCallback((): void => {
    const stake = mode?.meta.stake ?? 0;
    Alert.alert('Forfeit match?', 'You lose your entry stake.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forfeit',
        style: 'destructive',
        onPress: () => {
          chargeTokens(stake);
          navigation.popToTop();
        },
      },
    ]);
  }, [mode?.meta.stake, navigation]);

  const roundLabel = mode != null ? `ROUND ${timeline.length + 1} · ${mode.meta.name}` : 'ROUND';

  return (
    <Screen ambientIntensity={0.15}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <SectionLabel>{roundLabel}</SectionLabel>
        <View style={styles.headerExtras}>
          <MatchHeaderExtras mode={mode} timeline={timeline} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Forfeit match"
            onPress={confirmForfeit}
            style={styles.forfeitChip}
          >
            <Svg width={10} height={10} viewBox="0 0 10 10">
              <Path
                d="M1 1l8 8M9 1l-8 8"
                stroke={colors.textSecondary}
                strokeWidth={1.8}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          </Pressable>
        </View>
      </View>

      {isMirror ? (
        <SoloRaceBanner
          opponentName={opponent?.username ?? 'Rival'}
          opponentLevel={opponent?.level ?? 1}
          opponentFlag={opponent?.flag}
        />
      ) : (
        <PlayerCardPair
          selfName={user.username}
          opponentName={opponent?.username ?? 'Opponent'}
          opponentLevel={opponent?.level ?? 1}
          opponentFlag={opponent?.flag}
          mode={mode}
          timeline={timeline}
        />
      )}

      <ScrollView
        style={styles.timeline}
        contentContainerStyle={styles.timelineContent}
        showsVerticalScrollIndicator={false}
      >
        {RowRenderer != null
          ? timeline.map((entry, index) => (
              <RowRenderer key={index} {...guessEntryToRowProps(entry, adaptorCtx)} />
            ))
          : null}
      </ScrollView>

      <View style={[styles.inputArea, { paddingBottom: insets.bottom + 18 }]}>
        <View style={styles.turnHeader}>
          <SectionLabel color={isMirror ? '#14b8a6' : colors.violet}>
            {isMirror ? 'RACING' : 'YOUR TURN'}
          </SectionLabel>
          <Text style={styles.guessCounter}>Guess #{timeline.length + 1}</Text>
        </View>

        <BotTypingFooter
          name={opponent?.username ?? 'Opponent'}
          verb={isMirror ? 'is guessing' : 'is typing'}
        />

        <View style={styles.draftTiles}>
          {draftDigits.map((digit, index) => (
            <DigitTile
              key={index}
              digit={digit}
              state={digit != null ? 'violet' : 'neutral'}
              size={44}
            />
          ))}
        </View>

        <DigitKeypad onDigit={handleDigit} onBackspace={handleBackspace} disabled={pickerOpen} />

        <Button
          onPress={submitGuess}
          disabled={!isComplete || pickerOpen}
          size="lg"
          style={styles.guessButton}
        >
          {__DEV__ ? 'Guess' : 'Coming in Phase 2'}
        </Button>
      </View>

      <DevResultPicker visible={pickerOpen} onPick={pickOutcome} onClose={closePicker} />
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────
// Mode-specific header extras
// ─────────────────────────────────────────────────────────────

interface ModeExtrasProps {
  readonly mode: ModeCatalogEntry | undefined;
  readonly timeline: readonly GuessEntry[];
}

function MatchHeaderExtras({ mode, timeline }: ModeExtrasProps): React.JSX.Element | null {
  if (mode == null) return null;
  if (mode.rules.flags.perPlayerClock === true) {
    // Mode 4 — static clock readout in Phase 1B; the live tick lands
    // alongside the Blitz engine in Phase 5.
    return <Text style={[styles.headerStat, { color: colors.warning }]}>0:28 · 0:45</Text>;
  }
  if (mode.rules.flags.suddenDeath === true) {
    const used = countTurns(timeline);
    return (
      <Text style={[styles.headerStat, { color: colors.danger }]}>
        {used.self}/{SUDDEN_DEATH_BUDGET} · {used.opponent}/{SUDDEN_DEATH_BUDGET}
      </Text>
    );
  }
  return null;
}

interface PlayerCardPairProps {
  readonly selfName: string;
  readonly opponentName: string;
  readonly opponentLevel: number;
  readonly opponentFlag?: string;
  readonly mode: ModeCatalogEntry | undefined;
  readonly timeline: readonly GuessEntry[];
}

function PlayerCardPair({
  selfName,
  opponentName,
  opponentLevel,
  opponentFlag,
  mode,
  timeline,
}: PlayerCardPairProps): React.JSX.Element {
  const turns = countTurns(timeline);
  const showClock = mode?.rules.flags.perPlayerClock === true;
  const showLives = mode?.rules.flags.suddenDeath === true;

  return (
    <View style={styles.playerRow}>
      <PlayerCard
        name={selfName}
        level={1}
        active
        clockText={showClock ? '0:58' : undefined}
        livesLeft={showLives ? SUDDEN_DEATH_BUDGET - turns.self : undefined}
      />
      <Text style={styles.vs}>VS</Text>
      <PlayerCard
        name={opponentName}
        level={opponentLevel}
        flag={opponentFlag}
        active={false}
        clockText={showClock ? '0:32' : undefined}
        livesLeft={showLives ? SUDDEN_DEATH_BUDGET - turns.opponent : undefined}
      />
    </View>
  );
}

interface PlayerCardProps {
  readonly name: string;
  readonly level: number;
  readonly active: boolean;
  readonly flag?: string;
  readonly clockText?: string;
  readonly livesLeft?: number;
}

function PlayerCard({
  name,
  level,
  active,
  flag,
  clockText,
  livesLeft,
}: PlayerCardProps): React.JSX.Element {
  return (
    <View
      style={[
        styles.playerCard,
        active && styles.playerCardActive,
        active &&
          Platform.select({
            ios: {
              shadowColor: colors.violet,
              shadowOpacity: 0.35,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 0 },
            },
            android: { elevation: 6 },
            default: {},
          }),
      ]}
    >
      <View style={styles.playerHeader}>
        <Avatar name={name} size={34} />
        <View style={styles.playerInfo}>
          <Text style={styles.playerName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.playerMeta}>
            Lv. {level}
            {flag != null ? ` · ${flag}` : ''}
          </Text>
        </View>
      </View>
      {clockText != null ? (
        <Text style={[styles.playerClock, { color: active ? colors.warning : colors.text }]}>
          {clockText}
        </Text>
      ) : null}
      {livesLeft != null ? <LivesRow remaining={livesLeft} /> : null}
    </View>
  );
}

function LivesRow({ remaining }: { readonly remaining: number }): React.JSX.Element {
  return (
    <View style={styles.livesRow}>
      {Array.from({ length: SUDDEN_DEATH_BUDGET }).map((_, i) => {
        const alive = i < remaining;
        return (
          <View
            key={i}
            style={[
              styles.lifeDot,
              {
                backgroundColor: alive ? colors.danger : withAlpha(colors.textDim, 0.4),
                borderColor: alive ? colors.danger : colors.textDim,
                ...(alive
                  ? Platform.select({
                      ios: {
                        shadowColor: colors.danger,
                        shadowOpacity: 1,
                        shadowRadius: 5,
                        shadowOffset: { width: 0, height: 0 },
                      },
                      default: {},
                    })
                  : null),
              },
            ]}
          />
        );
      })}
    </View>
  );
}

interface SoloRaceBannerProps {
  readonly opponentName: string;
  readonly opponentLevel: number;
  readonly opponentFlag?: string;
}

function SoloRaceBanner({
  opponentName,
  opponentLevel,
  opponentFlag,
}: SoloRaceBannerProps): React.JSX.Element {
  return (
    <View style={styles.soloBanner}>
      <TinyTag color={'#14b8a6'}>SOLO RACE</TinyTag>
      <Text style={styles.soloHeadline}>Both solving the same code</Text>
      <View style={styles.soloOpponentRow}>
        <Avatar name={opponentName} size={28} />
        <Text style={styles.soloSub}>
          {opponentName} · Lv. {opponentLevel}
          {opponentFlag != null ? ` · ${opponentFlag}` : ''}
        </Text>
      </View>
    </View>
  );
}

interface BotTypingFooterProps {
  readonly name: string;
  readonly verb: 'is typing' | 'is guessing';
}

function BotTypingFooter({ name, verb }: BotTypingFooterProps): React.JSX.Element {
  return (
    <View style={styles.typingRow}>
      <TypingIndicator />
      <Text style={styles.typingLabel}>
        {name} {verb}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// DevResultPicker (in-screen overlay)
// ─────────────────────────────────────────────────────────────

interface DevResultPickerProps {
  readonly visible: boolean;
  readonly onPick: (outcome: MatchResultOutcome) => void;
  readonly onClose: () => void;
}

function DevResultPicker({
  visible,
  onPick,
  onClose,
}: DevResultPickerProps): React.JSX.Element | null {
  if (!visible) return null;

  return (
    <View style={styles.pickerRoot} pointerEvents="box-none">
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel="Dismiss outcome picker"
        onPress={onClose}
      />
      <View style={styles.pickerSheet}>
        <Text style={styles.pickerTitle}>Pick a result</Text>
        <Text style={styles.pickerSub}>Dev only — phase 2 wires the engine.</Text>
        <View style={styles.pickerGrid}>
          <PickerButton label="Victory" outcome="victory" tint={colors.gold} onPick={onPick} />
          <PickerButton label="Defeat" outcome="defeat" tint={colors.danger} onPick={onPick} />
          <PickerButton label="Draw" outcome="draw" tint={colors.violet} onPick={onPick} />
          <PickerButton
            label="Stalemate"
            outcome="stalemate"
            tint={colors.textSecondary}
            onPick={onPick}
          />
        </View>
      </View>
    </View>
  );
}

interface PickerButtonProps {
  readonly label: string;
  readonly outcome: MatchResultOutcome;
  readonly tint: string;
  readonly onPick: (outcome: MatchResultOutcome) => void;
}

function PickerButton({ label, outcome, tint, onPick }: PickerButtonProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Pick outcome ${label}`}
      onPress={() => onPick(outcome)}
      style={({ pressed }) => [
        styles.pickerButton,
        {
          backgroundColor: withAlpha(tint, 0.12),
          borderColor: withAlpha(tint, 0.45),
        },
        pressed ? styles.pickerButtonPressed : null,
      ]}
    >
      <Text style={[styles.pickerButtonLabel, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────

function countTurns(timeline: readonly GuessEntry[]): { self: number; opponent: number } {
  let self = 0;
  let opponent = 0;
  for (const entry of timeline) {
    if (entry.side === 'self') self += 1;
    else opponent += 1;
  }
  return { self, opponent };
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerExtras: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerStat: {
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  forfeitChip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  vs: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.pink,
    transform: [{ rotate: '-6deg' }],
  },
  playerCard: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
  },
  playerCardActive: {
    borderColor: colors.violet,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerInfo: {
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    color: colors.text,
  },
  playerMeta: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 0.6,
  },
  playerClock: {
    marginTop: 6,
    fontFamily: fonts.mono,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  livesRow: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
  },
  lifeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1,
  },
  soloBanner: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 10,
  },
  soloHeadline: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.text,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  soloSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  soloOpponentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeline: {
    flex: 1,
  },
  timelineContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  inputArea: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.bgBase,
    gap: 10,
  },
  turnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  guessCounter: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textDim,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typingLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textDim,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  draftTiles: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  guessButton: {
    marginTop: 4,
  },
  pickerRoot: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,11,30,0.55)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  pickerSheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  pickerTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.text,
    letterSpacing: -0.3,
  },
  pickerSub: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  pickerGrid: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pickerButton: {
    flexBasis: '47%',
    flexGrow: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  pickerButtonPressed: {
    opacity: 0.78,
  },
  pickerButtonLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});
