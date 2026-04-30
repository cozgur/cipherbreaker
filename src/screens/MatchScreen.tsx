/**
 * The match arena. Header (round + mode-specific chips + forfeit X),
 * player area (Mode 1-6 = `PlayerCardPair`, Mode 7 = `SoloRaceBanner`),
 * scrollable timeline rendered through `guessRowRenderers`, and a
 * bottom input region (4 DigitTile + DigitKeypad + Guess CTA).
 *
 * The screen runs in two modes:
 *
 *   - **engine path** — `modeRegistry.getOrNull(modeId) !== null` AND
 *     `useMatchStore.matchState.modeId === modeId`. The Guess CTA goes
 *     through `matchStore.submitGuess('self')`; the bot turn is driven
 *     by an effect that calls `mode.bot.thinkingTime` to pick a delay,
 *     surfaces the typing indicator on the back 60%, then fires
 *     `matchStore.runOpponentTurn`. Validation errors surface inline
 *     and `draftDigits` is preserved. Phase=`'completed'` triggers a
 *     navigation replace into MatchResult.
 *
 *   - **mock path (Phase 1B legacy)** — DevResultPicker overlay; the
 *     player picks an outcome and we replace into MatchResult. This
 *     stays alive for Modes 2-7 until Phase 4-5-6 register them.
 *
 * Mode 7 (Mirror) re-uses the same screen via a single conditional
 * fork; the only differences are the header sub-chip and the
 * player-area component.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useMockUser } from '@data/mockUser';
import { findOpponent } from '@data/mockOpponents';
import {
  currentGuessNumberFromMatch,
  currentGuessNumberFromMockTimeline,
} from '@game/adapters/currentGuessNumber';
import { guessEntryToRowProps } from '@game/adapters/guessEntryToRowProps';
import { interleaveTimeline } from '@game/adapters/interleaveTimeline';
import { matchOutcomeToRoute } from '@game/adapters/matchOutcomeToRoute';
import { subscribeBlitzLifecycle } from '@/lib/appLifecycle';
import { modeRegistry } from '@game/modeRegistry';
import { getRowRenderer } from '@game/renderers';
import type {
  BotContext,
  GuessEntry,
  GuessRowAdaptorContext,
  MatchResult as EngineMatchResult,
  ModeCatalogEntry,
} from '@game/types';
import { createRNG } from '@/lib/random';
import type { MatchResultOutcome, RootStackParamList } from '@navigation/routes';
import { useLiveMatchStore } from '@state/liveMatchStore';
import { useMatchStore } from '@state/matchStore';
import { colors, fonts, withAlpha } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Match'>;
type RouteParams = RouteProp<RootStackParamList, 'Match'>;

const SECRET_LENGTH = 4;
const SUDDEN_DEATH_BUDGET = 5;
/** Tick cadence for the Mode 4 Blitz clock — see ROADMAP §State Ayrımı. */
const BLITZ_TICK_INTERVAL_MS = 100;

/** Mode 4 — `M:SS` formatter used by the header chip + player clock chip. */
function formatClock(ms: number): string {
  const safe = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Pick which side of the `PlayerCardPair` glows. Turn-based modes
 * track the active turn; parallel modes (Mode 6 post-CP3 — Mode 7
 * uses `SoloRaceBanner`, not this code path) light *both* cards
 * because neither side waits on the other. Mode 6 edge case: when
 * the player has drained their 5-guess budget but the match
 * continues (opponent still racing), we drop their glow back to
 * 'opponent' — a glowing self-card while the keypad is dead would
 * otherwise read as "your turn" and confuse the player.
 */
function resolveActiveSide(args: {
  readonly isEngineMode: boolean;
  readonly phase: string | undefined;
  readonly playerExhausted: boolean;
}): 'self' | 'opponent' | 'both' {
  if (!args.isEngineMode) return 'self';
  if (args.phase === 'active_parallel') {
    return args.playerExhausted ? 'opponent' : 'both';
  }
  if (args.phase === 'active_turn_opponent') return 'opponent';
  return 'self';
}

export function MatchScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteParams>();
  const insets = useSafeAreaInsets();
  const user = useMockUser();
  const { modeId, opponentId } = route.params;

  const mode = useMemo(() => findMode(modeId), [modeId]);
  const opponent = useMemo(() => findOpponent(opponentId), [opponentId]);
  // `isMirror` = Mode 7 (Mirror, sharedSecret) specifically — drives
  // SoloRaceBanner + the single-column timeline + opponent-guess
  // hiding. `isParallel` (below) = "rides parallelEngine" — Mode 6 +
  // Mode 7 both, so it gates the bot driver effect and the typing
  // verb. Phase 6 split the two flags; do not collapse them back.
  const isMirror = mode?.rules.flags.sharedSecret === true;
  const isParallel = mode?.rules.flags.parallelRace === true;

  // Engine cutover gate — engine path lights up only when the mode is
  // registered AND the live `matchState` belongs to this mode. The
  // second guard catches the navigation re-entry where SecretSetup
  // hasn't yet seeded the store (e.g. unregistered modes still use the
  // mock path, no store entry exists).
  const matchState = useMatchStore((s) => s.matchState);
  const isEngineMode =
    modeRegistry.getOrNull(modeId) !== null && matchState?.modeId === modeId;
  const definition = isEngineMode ? modeRegistry.get(modeId) : null;
  // Mode 4 — live clock subscription. Subscribes only to the slice
  // we render so a `tickClock` 10×/sec doesn't churn the rest of
  // the screen. Returns null on non-Blitz modes.
  const liveClocks = useLiveMatchStore((s) => s.liveClocks);
  const isBlitzActive =
    isEngineMode &&
    mode?.rules.flags.perPlayerClock === true &&
    matchState !== null &&
    matchState.phase !== 'completed';

  const mockTimeline = useMemo(() => buildMockTimeline(modeId), [modeId]);
  // Mode 7 (Mirror) Bug 3 fix — Mirror is single-perspective: the
  // player races their own copy of the shared secret and never sees
  // the rival's feedback rows. Interleaving would leak the rival's
  // guesses + colour states into the player's timeline. Other engine
  // modes (1-6) keep the interleaved chronology so both sides remain
  // visible. CP4 verification suite includes a leak regression test
  // that seeds `opponentGuesses` and asserts those digits don't
  // render — snapshot alone wouldn't catch a future regression.
  // Mode 6 (parallel) — chronological merge by entry timestamp because
  // both sides may submit out of strict alternation. Turn-based modes
  // (1-5) keep the round-robin alternation default — it's the resume-
  // identity-stable ordering the rest of Phase 3-5 depends on. Mirror
  // (Mode 7) doesn't reach this branch (single-perspective).
  const timeline: readonly GuessEntry[] =
    isEngineMode && matchState
      ? isMirror
        ? matchState.playerGuesses
        : interleaveTimeline(matchState, { chronological: isParallel })
      : mockTimeline;

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
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showTyping, setShowTyping] = useState<boolean>(false);

  // In engine mode the player can only type when it's their turn;
  // mock mode keeps the legacy "always allow" behaviour because the
  // DevResultPicker is the substitute for turn rotation.
  //
  // Parallel modes (Mode 6 + Mode 7) collapse "your turn" into the
  // single `'active_parallel'` phase — both sides may submit at any
  // time. The player budget guard is *here*: the engine appends a
  // 6th-budget guess for Mode 6 (decrement floors at 0) without
  // terminating, so the UI is the only thing keeping the player in
  // budget. Mode 7 has no `guessLimits` → optional chain falls back
  // to `Infinity` → guard is a no-op.
  const playerRemaining = matchState?.guessLimits?.playerRemaining ?? Infinity;
  const playerBudgetExhausted = isEngineMode && playerRemaining <= 0;
  const isPlayerTurn = isEngineMode
    ? matchState?.phase === 'active_turn_player' ||
      (matchState?.phase === 'active_parallel' && !playerBudgetExhausted)
    : true;
  const isOpponentTurn = isEngineMode && matchState?.phase === 'active_turn_opponent';

  const handleDigit = useCallback((digit: number): void => {
    setDraftDigits((current) => {
      const slot = current.findIndex((d) => d == null);
      if (slot === -1) return current;
      const updated = [...current];
      updated[slot] = digit;
      return updated;
    });
    setValidationError(null);
  }, []);

  const handleBackspace = useCallback((): void => {
    setDraftDigits((current) => {
      const lastFilled = [...current].reverse().findIndex((d) => d != null);
      if (lastFilled === -1) return current;
      const updated = [...current];
      updated[current.length - 1 - lastFilled] = null;
      return updated;
    });
    setValidationError(null);
  }, []);

  const submitGuess = useCallback((): void => {
    if (!isComplete) return;
    if (isEngineMode) {
      if (!isPlayerTurn) return;
      const guessStr = draftDigits.map((d) => String(d ?? 0)).join('');
      void useMatchStore
        .getState()
        .submitGuess(guessStr, 'self')
        .then((out) => {
          if (out.error !== null) {
            // ValidationError is structured data — surface the message
            // and keep `draftDigits` so the player can correct in place.
            setValidationError(out.error.message);
            return;
          }
          setValidationError(null);
          setDraftDigits([null, null, null, null]);
        });
      return;
    }
    if (__DEV__) {
      setPickerOpen(true);
      return;
    }
    Alert.alert('Coming soon', 'This mode is still on the Phase 1B mock path.');
  }, [isComplete, isEngineMode, isPlayerTurn, draftDigits]);

  const pickOutcome = useCallback(
    (outcome: MatchResultOutcome): void => {
      setPickerOpen(false);
      navigation.replace('MatchResult', { modeId, outcome });
    },
    [modeId, navigation],
  );

  // Auto-scroll the timeline to the latest entry whenever a new guess
  // lands. Mirrors the chat-app convention — the player should not have
  // to scroll manually to see the freshest feedback. Mock-mode timeline
  // is static, so this only fires on the engine path; the small delay
  // gives RN a frame to lay out the newly-mounted row before we measure.
  const timelineRef = useRef<ScrollView>(null);
  const playerGuessCount = matchState?.playerGuesses.length ?? 0;
  const opponentGuessCount = matchState?.opponentGuesses.length ?? 0;
  useEffect(() => {
    const id = setTimeout(() => {
      timelineRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(id);
  }, [playerGuessCount, opponentGuessCount]);

  const closePicker = useCallback(() => setPickerOpen(false), []);

  // Engine path — drive the bot turn. Phase change `→ active_turn_opponent`
  // schedules typing-indicator + runOpponentTurn timers; cleanup on phase
  // change / unmount cancels them so a forfeit-then-restart can't fire
  // a stale bot turn into the new match.
  //
  // `setShowTyping(false)` lives in the cleanup function (not the body
  // early-returns) — React's `react-hooks/set-state-in-effect` rule
  // forbids in-body setState. Cleanup runs before every re-execution
  // and on unmount, so the previous turn's `showTyping=true` always
  // gets cleared as soon as the dependency array changes.
  useEffect(() => {
    if (!isEngineMode || matchState === null || definition === null) {
      return undefined;
    }
    if (matchState.phase !== 'active_turn_opponent') {
      return undefined;
    }

    // BotContext.rng is required by the type, but `thinkingTime`
    // deliberately does NOT consume it (UI delay is decoupled from
    // resume identity). Hand the bot a throwaway RNG snapshot here;
    // the deterministic instance lives inside `runOpponentTurn`.
    const ctx: BotContext = {
      previousGuesses: matchState.opponentGuesses,
      mySecret: matchState.opponentSecret,
      difficulty: matchState.botDifficulty ?? 'normal',
      turnNumber: matchState.opponentGuesses.length + 1,
      solverState:
        matchState.solverStates?.opponent ??
        definition.bot.initSolverState(matchState.opponentSecret, definition.rules),
      rng: createRNG(matchState.rngState),
    };
    const delay = definition.bot.thinkingTime(ctx);

    const typingId = setTimeout(() => setShowTyping(true), Math.floor(delay * 0.4));
    const turnId = setTimeout(() => {
      void useMatchStore.getState().runOpponentTurn();
    }, delay);

    return () => {
      clearTimeout(typingId);
      clearTimeout(turnId);
      setShowTyping(false);
    };
  }, [
    isEngineMode,
    definition,
    matchState,
  ]);

  // Parallel-mode bot driver (Mode 6 + Mode 7). Same shape as the
  // turn-based effect above, but the dep array is deliberately
  // narrower: keying on `opponentGuessLength` (and budget /
  // engine-flip flags) is what prevents player guesses from
  // cancelling the in-flight bot timer. The turn-based effect can
  // safely depend on `matchState` because phase flips between
  // `active_turn_player` ↔ `active_turn_opponent` keep the
  // re-execution scope tight; parallel mode keeps phase glued at
  // `active_parallel` between turns, so we have to be specific
  // about which mutations should re-fire the effect.
  //
  // Re-fires when:
  //   - opponent submits → `opponentGuessLength` increments → new
  //     timer scheduled (bot self-reschedule).
  //   - opponent budget hits 0 → `opponentBudgetRemaining` flips →
  //     effect re-runs and the early-return clears the timer.
  //   - phase leaves `active_parallel` (cracks/exhausted/forfeit)
  //     → early-return clears the timer.
  //
  // Does NOT re-fire on:
  //   - player guess submit (player's history grows but the dep
  //     array doesn't read it). Critical: a re-fire here would
  //     reset `setShowTyping(true)` mid-thinking and the player
  //     would see the typing indicator stutter on every keystroke.
  const phase = matchState?.phase;
  const opponentGuessLength = matchState?.opponentGuesses.length ?? 0;
  const opponentBudgetRemaining = matchState?.guessLimits?.opponentRemaining;
  const opponentBotExhausted =
    opponentBudgetRemaining !== undefined && opponentBudgetRemaining <= 0;
  useEffect(() => {
    if (!isEngineMode || definition === null) {
      return undefined;
    }
    if (phase !== 'active_parallel') {
      return undefined;
    }
    if (opponentBotExhausted) {
      return undefined;
    }
    // Read fresh state inside the effect (closure) — `matchState` is
    // intentionally absent from deps to satisfy the no-cancel-on-
    // player-guess invariant. The bot context built here is a
    // snapshot at schedule time; `runOpponentTurn` reads the
    // latest state again at fire time, so this snapshot is only
    // used to compute the thinking delay.
    const snapshot = useMatchStore.getState().matchState;
    if (snapshot === null) return undefined;
    const ctx: BotContext = {
      previousGuesses: snapshot.opponentGuesses,
      mySecret: snapshot.opponentSecret,
      difficulty: snapshot.botDifficulty ?? 'normal',
      turnNumber: snapshot.opponentGuesses.length + 1,
      solverState:
        snapshot.solverStates?.opponent ??
        definition.bot.initSolverState(snapshot.opponentSecret, definition.rules),
      rng: createRNG(snapshot.rngState),
    };
    const delay = definition.bot.thinkingTime(ctx);

    const typingId = setTimeout(() => setShowTyping(true), Math.floor(delay * 0.4));
    const turnId = setTimeout(() => {
      void useMatchStore.getState().runOpponentTurn();
    }, delay);

    return () => {
      clearTimeout(typingId);
      clearTimeout(turnId);
      setShowTyping(false);
    };
    // `matchState` deliberately excluded — see header comment. The
    // narrower dep array is the whole point of this effect; the
    // exhaustive-deps lint rule would re-introduce the player-guess
    // cancellation we're trying to avoid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEngineMode, definition, phase, opponentGuessLength, opponentBotExhausted]);

  // Mode 4 — sync the live clock store from the durable snapshot on
  // mount/match-state change. `matchStore.startMatch` already calls
  // this on a fresh match; the explicit sync here covers the cold-
  // hydrate path (persist middleware re-loads `matchState` before the
  // screen mounts, so the live store would otherwise stay empty).
  // No-op for non-Blitz modes — `syncFromMatchState` clears liveClocks
  // when `clockSnapshot` is undefined.
  useEffect(() => {
    if (!isEngineMode) return;
    useLiveMatchStore.getState().syncFromMatchState(matchState);
  }, [isEngineMode, matchState]);

  // Mode 4 — Blitz clock tick. Decrements the active side's live
  // clock every 100ms; when a side hits zero, fires
  // `matchStore.applyTimeout(snapshot)` once and lets the completion
  // watcher below replace into MatchResult.
  //
  // Cleanup contract:
  //   - on phase → completed: dependency array carries phase, the
  //     effect re-fires and the early-return clears the interval.
  //   - on unmount: the cleanup function does the same.
  //   - in-tick guard: bails if `liveClocks` is null OR the match
  //     was already completed by another path (e.g. opponent crack);
  //     prevents the 10Hz spam-after-completion the advisor warned
  //     about during the CP3b plan review.
  useEffect(() => {
    if (!isBlitzActive) return undefined;
    const id = setInterval(() => {
      const live = useLiveMatchStore.getState().liveClocks;
      if (live === null) return;
      const current = useMatchStore.getState().matchState;
      if (current === null || current.phase === 'completed') return;
      useLiveMatchStore.getState().tickClock(BLITZ_TICK_INTERVAL_MS);
      const post = useLiveMatchStore.getState().liveClocks;
      if (post === null) return;
      const playerOut = post.activeOwner === 'player' && post.playerMs <= 0;
      const opponentOut = post.activeOwner === 'opponent' && post.opponentMs <= 0;
      if (!playerOut && !opponentOut) return;
      useMatchStore.getState().applyTimeout({
        playerMs: post.playerMs,
        opponentMs: post.opponentMs,
        activeOwner: post.activeOwner,
        snapshotTimestamp: Date.now(),
      });
    }, BLITZ_TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isBlitzActive]);

  // Mode 4 — AppState subscription. Hands off background-grace
  // logic (5s tolerance + auto-forfeit) to `appLifecycle.ts`.
  // Subscription lives only while Blitz is active so non-Blitz
  // sessions never wire a global listener; the cleanup path
  // (`unsubscribeFn`) clears any pending grace timer too — the
  // listener module's `__resetForTests` covers the same in tests.
  useEffect(() => {
    if (!isBlitzActive) return undefined;
    const unsubscribe = subscribeBlitzLifecycle();
    return () => unsubscribe();
  }, [isBlitzActive]);

  // Engine path — completion watcher. Engine writes phase='completed'
  // and a `MatchResult` on the same submitGuess; mirror it into the
  // route params the MatchResultScreen consumes. Reward + XP + the
  // opponent's generated secret + the winner's per-side guess count
  // ride along so the result screen never has to re-derive any of it
  // (and the mock-path fallback keeps Modes 2-7 intact).
  useEffect(() => {
    if (!isEngineMode || matchState === null) return;
    if (matchState.phase !== 'completed' || matchState.result === null) return;
    if (mode === undefined) return;
    const outcome = matchOutcomeToRoute(matchState.result);
    navigation.replace('MatchResult', {
      modeId,
      outcome,
      secret: matchState.opponentSecret,
      guessCount: matchState.result.turns,
      reward: rewardForOutcome(matchState.result, mode),
      xpGain: XP_BY_OUTCOME[outcome],
    });
  }, [isEngineMode, matchState, modeId, mode, navigation]);

  // Stake is debited at `matchStore.createMatch`, so forfeit no longer
  // touches tokens — doing so would double-charge. The Alert copy still
  // surfaces the consequence ("you lose your entry stake") because from
  // the player's perspective the stake is forfeited (no refund); the
  // bookkeeping just happened earlier.
  const confirmForfeit = useCallback((): void => {
    Alert.alert('Forfeit match?', 'You lose your entry stake.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forfeit',
        style: 'destructive',
        onPress: () => {
          if (isEngineMode) {
            useMatchStore.getState().clearMatch();
          }
          navigation.popToTop();
        },
      },
    ]);
  }, [navigation, isEngineMode]);

  // Both ROUND (header chip) and "Guess #N" (sub-counter) read the
  // same active-side count so the number you see while playing equals
  // the number `MatchResultScreen` reports as `in N guesses`. See
  // `currentGuessNumber.ts` for the rationale.
  const guessNumber =
    isEngineMode && matchState !== null
      ? currentGuessNumberFromMatch(matchState)
      : currentGuessNumberFromMockTimeline(timeline);
  const roundLabel = mode != null ? `ROUND ${guessNumber} · ${mode.meta.name}` : 'ROUND';
  // Parallel mode (Mode 6 + Mode 7) → "RACING" everywhere; the phrase
  // "your turn" doesn't apply when both sides submit independently.
  // Mode 7 also paints the chip in its accent teal (matches catalog
  // gradient); Mode 6 stays violet so the existing Sudden Death
  // visual identity (red lives + violet active glow) is undisturbed.
  const isParallelActive = isEngineMode && matchState?.phase === 'active_parallel';
  const turnLabel = isMirror || isParallelActive
    ? 'RACING'
    : isOpponentTurn
      ? "OPPONENT'S TURN"
      : 'YOUR TURN';
  const turnColor = isMirror
    ? '#14b8a6'
    : isParallelActive
      ? colors.violet
      : isOpponentTurn
        ? colors.textSecondary
        : colors.violet;
  const keypadDisabled = pickerOpen || (isEngineMode ? !isPlayerTurn : false);
  const showBotTyping = isEngineMode ? showTyping : true;

  return (
    <Screen ambientIntensity={0.15}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <SectionLabel>{roundLabel}</SectionLabel>
        <View style={styles.headerExtras}>
          <MatchHeaderExtras mode={mode} timeline={timeline} liveClocks={liveClocks} />
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
          opponentGuessCount={isEngineMode ? opponentGuessCount : undefined}
        />
      ) : (
        <PlayerCardPair
          selfName={user.username}
          opponentName={opponent?.username ?? 'Opponent'}
          opponentLevel={opponent?.level ?? 1}
          opponentFlag={opponent?.flag}
          mode={mode}
          timeline={timeline}
          activeSide={resolveActiveSide({
            isEngineMode,
            phase: matchState?.phase,
            playerExhausted: playerBudgetExhausted,
          })}
          liveClocks={liveClocks}
        />
      )}

      <ScrollView
        ref={timelineRef}
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
          <SectionLabel color={turnColor}>{turnLabel}</SectionLabel>
          <Text style={styles.guessCounter}>Guess #{guessNumber}</Text>
        </View>

        {showBotTyping ? (
          <BotTypingFooter
            name={opponent?.username ?? 'Opponent'}
            verb={isParallel ? 'is guessing' : 'is typing'}
          />
        ) : null}

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

        {validationError !== null ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {validationError}
          </Text>
        ) : null}

        <DigitKeypad
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          disabled={keypadDisabled}
        />

        <Button
          onPress={submitGuess}
          disabled={!isComplete || keypadDisabled}
          size="lg"
          style={styles.guessButton}
        >
          {isEngineMode ? 'Guess' : __DEV__ ? 'Guess' : 'Coming soon'}
        </Button>
      </View>

      {!isEngineMode ? (
        <DevResultPicker visible={pickerOpen} onPick={pickOutcome} onClose={closePicker} />
      ) : null}
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────
// Mode-specific header extras
// ─────────────────────────────────────────────────────────────

interface ModeExtrasProps {
  readonly mode: ModeCatalogEntry | undefined;
  readonly timeline: readonly GuessEntry[];
  /** Mode 4 live clock subscription (null on non-engine + non-Blitz). */
  readonly liveClocks: LiveClockValues | null;
}

interface LiveClockValues {
  readonly playerMs: number;
  readonly opponentMs: number;
  readonly activeOwner: 'player' | 'opponent' | null;
}

function MatchHeaderExtras({
  mode,
  timeline,
  liveClocks,
}: ModeExtrasProps): React.JSX.Element | null {
  if (mode == null) return null;
  if (mode.rules.flags.perPlayerClock === true) {
    // Mode 4 — engine path reads from `liveClocks`; the Phase 1B
    // mock fallback keeps the hardcoded readout for unregistered
    // sessions (dev picker path stays intact).
    const text =
      liveClocks !== null
        ? `${formatClock(liveClocks.playerMs)} · ${formatClock(liveClocks.opponentMs)}`
        : '0:28 · 0:45';
    return <Text style={[styles.headerStat, { color: colors.warning }]}>{text}</Text>;
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
  /**
   * Which side currently holds the turn — drives the active glow.
   * `'self' | 'opponent'` for turn-based modes (Modes 1-5); `'both'`
   * for parallel modes where neither side waits on the other (Mode 6
   * post-CP3, Mode 7 — though Mode 7 uses SoloRaceBanner, not this
   * component). CP4 will wire `'both'` from the MatchScreen call site
   * once parallel-mode UI lands; CP3 just makes the prop accept it.
   */
  readonly activeSide: 'self' | 'opponent' | 'both';
  readonly liveClocks: LiveClockValues | null;
}

export function PlayerCardPair({
  selfName,
  opponentName,
  opponentLevel,
  opponentFlag,
  mode,
  timeline,
  activeSide,
  liveClocks,
}: PlayerCardPairProps): React.JSX.Element {
  const turns = countTurns(timeline);
  const showClock = mode?.rules.flags.perPlayerClock === true;
  const showLives = mode?.rules.flags.suddenDeath === true;
  // Engine path reads live values; mock path keeps hardcoded
  // placeholders so the dev-picker walkthrough still looks like Mode 4.
  const selfClock = showClock
    ? liveClocks !== null
      ? formatClock(liveClocks.playerMs)
      : '0:58'
    : undefined;
  const opponentClock = showClock
    ? liveClocks !== null
      ? formatClock(liveClocks.opponentMs)
      : '0:32'
    : undefined;

  return (
    <View style={styles.playerRow}>
      <PlayerCard
        name={selfName}
        level={1}
        active={activeSide === 'self' || activeSide === 'both'}
        clockText={selfClock}
        livesLeft={showLives ? SUDDEN_DEATH_BUDGET - turns.self : undefined}
      />
      <Text style={styles.vs}>VS</Text>
      <PlayerCard
        name={opponentName}
        level={opponentLevel}
        flag={opponentFlag}
        active={activeSide === 'opponent' || activeSide === 'both'}
        clockText={opponentClock}
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
  /**
   * Engine-path live count of opponent guesses. Surfaces a "N
   * guesses" badge so the racing player has a sense of how close
   * the rival is without leaking individual guesses or feedback
   * (Bug 3 invariant — see `timeline` ternary in `MatchScreen`).
   * `undefined` on the mock path → the badge is suppressed entirely
   * (the count would be a stale fixture, not live state).
   */
  readonly opponentGuessCount?: number;
}

export function SoloRaceBanner({
  opponentName,
  opponentLevel,
  opponentFlag,
  opponentGuessCount,
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
      {opponentGuessCount !== undefined ? (
        <View style={styles.soloOpponentCountBadge}>
          <Text style={styles.soloOpponentCountText}>
            {opponentName}: {opponentGuessCount} {opponentGuessCount === 1 ? 'guess' : 'guesses'}
          </Text>
        </View>
      ) : null}
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

// Reward + XP table (mirrors MatchResultScreen OUTCOMES so the engine
// path computes the same numbers the mock fallback already shows).
const XP_BY_OUTCOME: Readonly<Record<MatchResultOutcome, number>> = {
  victory: 30,
  draw: 15,
  defeat: 5,
  stalemate: 0,
};

function rewardForOutcome(
  result: EngineMatchResult,
  mode: ModeCatalogEntry,
): number {
  switch (result.outcome) {
    case 'player_won':
      return mode.meta.rewardWin;
    case 'draw':
      return mode.meta.rewardDraw;
    case 'stalemate':
      return mode.meta.stake;
    case 'opponent_won':
      return 0;
  }
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
  soloOpponentCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: withAlpha('#14b8a6', 0.5),
    backgroundColor: withAlpha('#14b8a6', 0.12),
  },
  soloOpponentCountText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    color: '#14b8a6',
    letterSpacing: 0.4,
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
  errorText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.danger,
    textAlign: 'center',
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
