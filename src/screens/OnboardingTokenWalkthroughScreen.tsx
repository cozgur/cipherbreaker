/**
 * Phase 7A.6 CP4 — 3-slide token economy walkthrough.
 *
 * Mirrors the OnboardingIntroScreen architecture (FlatList horizontal
 * + paginated dots + Skip floater + slide-aware footer CTA). Three
 * slides explain the post-tutorial token economy:
 *
 *   1. Earn — "Tokens for every win". Bridges to the +50 the player
 *      just received in CP3 tutorial.
 *   2. Spend — "Spend on hints". Closes the auto-hint gap from CP3
 *      (production Mode 1 has no auto-hint; hints exist on Daily
 *      Challenge and cost tokens). Surfaces Hint A / B prices and
 *      teases the free-hint streak path on slide 3.
 *   3. Streak — "Daily streaks unlock free hints". Anchors the
 *      earned-hint pool (current Daily reward design).
 *
 * Two exit paths:
 *   - Skip (any slide) → `completeOnboarding(today)` → Home (matches
 *     CP2 OnboardingIntro semantics: Skip = full skip).
 *   - Start playing (slide 3) → `completeOnboarding(today)` → Home
 *     (CP7 wiring: linear completion stamps the full flow done).
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { Button } from '@components/Button';
import { Screen } from '@components/Screen';
import { TokenCoin } from '@components/TokenCoin';
import { formatDailyDate } from '@game/daily/dailyDate';
import type { RootStackParamList } from '@navigation/routes';
import { useUserStore } from '@state/userStore';
import { colors, fonts, withAlpha } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'OnboardingTokenWalkthrough'>;

interface WalkthroughSlide {
  readonly key: 'earn' | 'spend' | 'streak';
  readonly title: string;
  readonly body: string;
  readonly gradient: readonly [string, string];
}

const SLIDES: readonly WalkthroughSlide[] = [
  {
    key: 'earn',
    title: 'Tokens for every win',
    body: 'Win matches, earn tokens. Faster wins earn more.',
    gradient: [colors.gold, colors.goldDeep],
  },
  {
    key: 'spend',
    title: 'Spend on hints',
    body: 'Stuck? Spend tokens for hints. Or earn them free through daily streaks →',
    gradient: [colors.violet, colors.cyan],
  },
  {
    key: 'streak',
    title: 'Daily streaks unlock free hints',
    body: 'Play Daily Challenge each day. Every 7-day streak earns a free hint.',
    gradient: [colors.pink, colors.violet],
  },
];

const SLIDE_COUNT = SLIDES.length;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FEEDBACK_DOT_STYLES: Readonly<
  Record<'exact' | 'present' | 'absent', { backgroundColor: string; borderColor: string }>
> = {
  exact: { backgroundColor: '#000000', borderColor: '#000000' },
  present: { backgroundColor: '#ffffff', borderColor: '#000000' },
  absent: { backgroundColor: 'transparent', borderColor: withAlpha('#ffffff', 0.4) },
};

export function OnboardingTokenWalkthroughScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);

  const flatListRef = useRef<FlatList<WalkthroughSlide>>(null);
  // Lazy-init Animated.Value via useState — same pattern as
  // OnboardingIntroScreen (the `react-hooks/refs` rule rejects reading
  // `useRef(...).current` during render).
  const [scrollX] = useState(() => new Animated.Value(0));
  const [currentSlide, setCurrentSlide] = useState(0);

  const isLast = currentSlide === SLIDE_COUNT - 1;

  const handleSkip = useCallback((): void => {
    completeOnboarding(formatDailyDate(new Date()));
    navigation.replace('Home');
  }, [completeOnboarding, navigation]);

  const handleContinue = useCallback((): void => {
    const next = currentSlide + 1;
    if (next >= SLIDE_COUNT) return;
    setCurrentSlide(next);
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
  }, [currentSlide]);

  const handleStartPlaying = useCallback((): void => {
    // Phase 7A.6 CP7 — linear-completion endpoint. CP4 is the last
    // pre-Home onboarding step, so finishing it stamps the full
    // `completedAt` flag (via `completeOnboarding`) and forwards
    // to Home. `completeOnboarding` is idempotent on the
    // already-stamped path, so a re-render race can't double-flip.
    //
    // Side-effect note (CP7 pre-impl finding): `completeOnboarding`
    // flips ALL onboarding flags including `blitzTeaserSeen`,
    // `mirrorTeaserSeen`, `notificationOptInAsked`. Linearly-
    // completing users will not see CP5 teasers or CP6 push opt-in
    // — accepted asymmetry: CP4 already covered tokens / hints /
    // streaks at length, so the further nudges would be redundant.
    // Existing v4 upgrade users (hasOnboarded=true via migration
    // without `completedAt`) still get the CP5/CP6 nudges.
    completeOnboarding(formatDailyDate(new Date()));
    navigation.replace('Home');
  }, [completeOnboarding, navigation]);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      const clamped = Math.max(0, Math.min(SLIDE_COUNT - 1, idx));
      setCurrentSlide(clamped);
    },
    [],
  );

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: false,
      }),
    [scrollX],
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<WalkthroughSlide>): React.JSX.Element => (
      <SlideView slide={item} index={index} />
    ),
    [],
  );

  const keyExtractor = useCallback((item: WalkthroughSlide): string => item.key, []);

  const getItemLayout = useCallback(
    (_: ArrayLike<WalkthroughSlide> | null | undefined, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    [],
  );

  return (
    <Screen ambientIntensity={0.18}>
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
            onPress={handleSkip}
            style={({ pressed }) => [styles.skip, pressed && styles.skipPressed]}
          >
            <Text style={styles.skipLabel}>Skip</Text>
          </Pressable>
        </View>

        <FlatList
          ref={flatListRef}
          data={SLIDES}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          onScroll={onScroll}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          getItemLayout={getItemLayout}
          scrollEventThrottle={16}
          testID="onboarding-token-walkthrough-list"
        />

        <View style={styles.footer}>
          <PaginationDots scrollX={scrollX} count={SLIDE_COUNT} currentSlide={currentSlide} />
          <Button
            onPress={isLast ? handleStartPlaying : handleContinue}
            size="lg"
            style={styles.cta}
          >
            {isLast ? 'Start playing →' : 'Continue →'}
          </Button>
        </View>
      </View>
    </Screen>
  );
}

interface SlideViewProps {
  readonly slide: WalkthroughSlide;
  readonly index: number;
}

function SlideView({ slide, index }: SlideViewProps): React.JSX.Element {
  // Strip a trailing period from the title before joining so the
  // composed a11y label reads cleanly even when the title already
  // ends in punctuation (matches OnboardingIntro's CP2 convention).
  const labelTitle = slide.title.replace(/\.$/, '');
  const composedLabel = `${labelTitle}. ${slide.body}`;
  return (
    <View
      style={styles.slide}
      accessibilityRole="text"
      accessibilityLabel={composedLabel}
    >
      <View style={styles.heroWrap}>
        <LinearGradient
          colors={slide.gradient as unknown as readonly [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {index === 0 ? (
            <MatchWinMockup />
          ) : index === 1 ? (
            <DailyHintMockup />
          ) : (
            <StreakRewardMockup />
          )}
        </LinearGradient>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Slide 1 — Match win celebration mockup
// ─────────────────────────────────────────────────────────────
//
// Stylized reference for what the post-match reward screen looks like.
// VICTORY pill (TinyTag-style, gold-tinted), 4 cracked-code pegs in
// distinct colors (Mastermind metaphor — diverges from production's
// digit tiles, see CP4.1 pre-impl finding (a)), token chip with
// real `TokenCoin` + "+120", and a small XP bar.
//
// `+120` is forward-looking (Mode 1 normal-band win = Math.floor(100 ×
// 1.2) = 120). LEVEL 3 / 55%-fill XP bar is illustrative; intentionally
// inconsistent with the player's actual fresh-install state (level 1)
// because the mockup shows "what you'll see down the road," not "your
// current state."

const MOCKUP_PEG_COLORS = ['#10b981', '#06b6d4', '#ec4899', '#f59e0b'] as const;

function MatchWinMockup(): React.JSX.Element {
  return (
    <View style={styles.matchMockupRoot} testID="match-win-mockup">
      <View style={styles.victoryPill}>
        <Text style={styles.victoryCheck}>✓</Text>
        <Text style={styles.victoryLabel}>VICTORY</Text>
      </View>

      <View style={styles.pegRow}>
        {MOCKUP_PEG_COLORS.map((color, i) => (
          <View key={i} style={[styles.peg, { backgroundColor: color }]} />
        ))}
      </View>

      <View style={styles.tokenChip}>
        <TokenCoin size={20} />
        <Text style={styles.tokenChipValue}>+120</Text>
        <Text style={styles.tokenChipLabel}>TOKENS</Text>
      </View>

      <View style={styles.xpRow}>
        <Text style={styles.xpLabel}>LEVEL 3</Text>
        <View style={styles.xpTrack}>
          <View style={styles.xpFill} />
        </View>
        <Text style={styles.xpDelta}>+20 XP</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Slide 2 — Daily Challenge with hint UI mockup
// ─────────────────────────────────────────────────────────────
//
// Two attempted guess rows (filled pegs + B/W feedback dots) plus one
// empty next-guess row, then two stylized hint buttons that mirror
// `DailyMatchScreen`'s real `HintButton` styling (violet-tinted REVEAL,
// warning-tinted PROBE).
//
// Feedback dots: black = exact match, white = right-color-wrong-place,
// gray-empty = no match. Classic Mastermind feedback — diverges from
// production's Wordle-style tile color but matches the spec's "small
// black/white dots" language.

interface MockGuessRow {
  readonly pegs: readonly string[];
  readonly feedback: readonly ('exact' | 'present' | 'absent')[];
}

const MOCKUP_GUESS_ROWS: readonly MockGuessRow[] = [
  {
    pegs: [MOCKUP_PEG_COLORS[0], MOCKUP_PEG_COLORS[2], MOCKUP_PEG_COLORS[1], MOCKUP_PEG_COLORS[3]],
    feedback: ['exact', 'absent', 'present', 'absent'],
  },
  {
    pegs: [MOCKUP_PEG_COLORS[0], MOCKUP_PEG_COLORS[1], MOCKUP_PEG_COLORS[2], MOCKUP_PEG_COLORS[3]],
    feedback: ['exact', 'exact', 'present', 'absent'],
  },
];

function DailyHintMockup(): React.JSX.Element {
  return (
    <View style={styles.hintMockupRoot} testID="daily-hint-mockup">
      <View style={styles.miniBoard}>
        {MOCKUP_GUESS_ROWS.map((row, i) => (
          <View key={i} style={styles.miniBoardRow}>
            <View style={styles.miniPegRow}>
              {row.pegs.map((color, j) => (
                <View key={j} style={[styles.miniPeg, { backgroundColor: color }]} />
              ))}
            </View>
            <View style={styles.feedbackCluster}>
              {row.feedback.map((f, j) => (
                <View key={j} style={[styles.feedbackDot, FEEDBACK_DOT_STYLES[f]]} />
              ))}
            </View>
          </View>
        ))}
        <View style={styles.miniBoardRow}>
          <View style={styles.miniPegRow}>
            {Array.from({ length: 4 }, (_, j) => (
              <View key={j} style={[styles.miniPeg, styles.miniPegEmpty]} />
            ))}
          </View>
          <View style={styles.feedbackCluster} />
        </View>
      </View>

      <View style={styles.hintButtonRow}>
        <View style={[styles.hintButton, styles.hintButtonReveal]}>
          <Text style={styles.hintButtonGlyph}>💡</Text>
          <Text style={styles.hintButtonLabel}>REVEAL</Text>
          <View style={styles.priceChip}>
            <TokenCoin size={11} />
            <Text style={styles.priceChipText}>100</Text>
          </View>
        </View>
        <View style={[styles.hintButton, styles.hintButtonProbe]}>
          <Text style={styles.hintButtonGlyph}>🔍</Text>
          <Text style={styles.hintButtonLabel}>PROBE</Text>
          <View style={styles.priceChip}>
            <TokenCoin size={11} />
            <Text style={styles.priceChipText}>50</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Slide 3 — Daily streak reward mockup
// ─────────────────────────────────────────────────────────────
//
// Flame focal point + "7 DAY STREAK" dark pill + "+1 FREE HINT" gold
// chip + "COMES BACK TOMORROW" muted teaser. The 7-dot row from CP4 is
// dropped — the streak badge already conveys the day count explicitly,
// and dots competed with the flame for focal attention.

function StreakRewardMockup(): React.JSX.Element {
  return (
    <View style={styles.streakMockupRoot} testID="streak-reward-mockup">
      <Flame size={84} />
      <View style={styles.streakBadge}>
        <Text style={styles.streakBadgeText}>7 DAY STREAK</Text>
      </View>
      <View style={styles.freeHintChip}>
        <Text style={styles.freeHintSparkle}>✨</Text>
        <Text style={styles.freeHintText}>+1 FREE HINT</Text>
      </View>
      <Text style={styles.tomorrowTeaser}>COMES BACK TOMORROW</Text>
    </View>
  );
}

interface FlameProps {
  readonly size: number;
}

function Flame({ size }: FlameProps): React.JSX.Element {
  return (
    <Svg width={size} height={(size * 84) / 68} viewBox="0 0 68 84">
      <Path
        d="M34 6c4 8-2 14-2 22s10 10 10 22-7 24-20 24-20-12-13-26 4-22 13-26 6-8 12-16z"
        fill="#fb923c"
        stroke="#9a3412"
        strokeWidth={2}
      />
      <Path
        d="M34 34c2 6-2 8-2 12s5 7 5 14-6 12-12 12-12-7-9-15 5-12 9-14 5-4 9-9z"
        fill="#fde68a"
      />
    </Svg>
  );
}

interface PaginationDotsProps {
  readonly scrollX: Animated.Value;
  readonly count: number;
  readonly currentSlide: number;
}

function PaginationDots({
  scrollX,
  count,
  currentSlide,
}: PaginationDotsProps): React.JSX.Element {
  return (
    <View style={styles.dots} accessibilityRole="tablist">
      {Array.from({ length: count }, (_, index) => {
        const inputRange = [
          (index - 1) * SCREEN_WIDTH,
          index * SCREEN_WIDTH,
          (index + 1) * SCREEN_WIDTH,
        ];
        const width = scrollX.interpolate({
          inputRange,
          outputRange: [6, 22, 6],
          extrapolate: 'clamp',
        });
        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.35, 1, 0.35],
          extrapolate: 'clamp',
        });
        return (
          <Animated.View
            key={`dot-${index}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: index === currentSlide }}
            style={[styles.dot, { width, opacity }]}
            testID={`onboarding-token-walkthrough-dot-${index}`}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  skip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  skipPressed: { opacity: 0.55 },
  skipLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'stretch',
  },
  heroWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
  },
  hero: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Slide 1 — Match win mockup
  matchMockupRoot: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 20,
  },
  victoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: withAlpha(colors.gold, 0.18),
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.55),
  },
  victoryCheck: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    color: colors.gold,
  },
  victoryLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.gold,
  },
  pegRow: {
    flexDirection: 'row',
    gap: 8,
  },
  peg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: withAlpha('#000000', 0.35),
  },
  tokenChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha('#000000', 0.55),
    borderWidth: 1,
    borderColor: colors.gold,
  },
  tokenChipValue: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.gold,
    letterSpacing: -0.2,
  },
  tokenChipLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: withAlpha(colors.gold, 0.75),
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    paddingTop: 4,
  },
  xpLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: '#ffffff',
    opacity: 0.85,
  },
  xpTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: withAlpha('#000000', 0.4),
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    width: '55%',
    backgroundColor: colors.gold,
    borderRadius: 3,
  },
  xpDelta: {
    fontFamily: fonts.bodySemibold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: '#ffffff',
    opacity: 0.85,
  },

  // Slide 2 — Daily hint UI mockup
  hintMockupRoot: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 16,
    width: '100%',
  },
  miniBoard: {
    gap: 6,
  },
  miniBoardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniPegRow: {
    flexDirection: 'row',
    gap: 4,
  },
  miniPeg: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: withAlpha('#000000', 0.35),
  },
  miniPegEmpty: {
    backgroundColor: withAlpha('#ffffff', 0.18),
    borderStyle: 'dashed',
    borderColor: withAlpha('#ffffff', 0.5),
  },
  feedbackCluster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 18,
    gap: 2,
  },
  feedbackDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 0.6,
  },
  hintButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  hintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  hintButtonReveal: {
    backgroundColor: withAlpha(colors.violet, 0.22),
    borderColor: withAlpha(colors.violet, 0.55),
  },
  hintButtonProbe: {
    backgroundColor: withAlpha(colors.warning, 0.22),
    borderColor: withAlpha(colors.warning, 0.55),
  },
  hintButtonGlyph: {
    fontSize: 16,
  },
  hintButtonLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: '#ffffff',
  },
  priceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: withAlpha('#000000', 0.45),
  },
  priceChipText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    color: colors.gold,
    letterSpacing: 0.2,
  },

  // Slide 3 — Streak reward mockup
  streakMockupRoot: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  streakBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: withAlpha('#000000', 0.55),
    borderWidth: 1,
    borderColor: withAlpha('#ffffff', 0.25),
  },
  streakBadgeText: {
    fontFamily: fonts.display,
    fontSize: 14,
    letterSpacing: 1.6,
    color: '#ffffff',
  },
  freeHintChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: withAlpha(colors.gold, 0.2),
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.6),
  },
  freeHintSparkle: {
    fontSize: 12,
  },
  freeHintText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.gold,
  },
  tomorrowTeaser: {
    marginTop: 6,
    fontFamily: fonts.bodySemibold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: '#ffffff',
    opacity: 0.6,
  },
  copy: {
    paddingTop: 28,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  body: {
    marginTop: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 18,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.violet,
  },
  cta: {
    width: '100%',
  },
});
