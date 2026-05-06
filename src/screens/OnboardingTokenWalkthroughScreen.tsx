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
 *   - Start playing (slide 3) → `markTokenWalkthroughSeen()` → Home
 *     so subsequent CPs (mode-variety teasers, push opt-in) can
 *     still fire at their milestones. CP7 swaps Home for the next
 *     onboarding step.
 *
 * CP4 ships the screen + route registration only; RootNavigator
 * still gates initial route on `mockUser.hasOnboarded`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    body: 'Crack codes faster, earn more. You just earned 50.',
    gradient: [colors.gold, colors.goldDeep],
  },
  {
    key: 'spend',
    title: 'Spend on hints',
    body: "In real matches, hints aren't free anymore. Reveal a digit (100 tokens) or check one (50). Or earn free hints with daily streaks →",
    gradient: [colors.violet, colors.cyan],
  },
  {
    key: 'streak',
    title: 'Daily streaks unlock free hints',
    body: 'Play Daily Challenge each day. 7-day streak earns 1 free hint, up to 3.',
    gradient: [colors.pink, colors.violet],
  },
];

const SLIDE_COUNT = SLIDES.length;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function OnboardingTokenWalkthroughScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);
  const markTokenWalkthroughSeen = useUserStore((s) => s.markTokenWalkthroughSeen);

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
    // Soft completion — only the token walkthrough is marked seen.
    // Mode-variety teasers / push opt-in stay false so their CP-driven
    // milestones fire post-walkthrough.
    markTokenWalkthroughSeen();
    navigation.replace('Home');
  }, [markTokenWalkthroughSeen, navigation]);

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
            <EarnVisual />
          ) : index === 1 ? (
            <SpendVisual />
          ) : (
            <StreakVisual />
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

/**
 * Slide 1 — single hero coin with a "+50" badge that pops in on
 * mount (scale + opacity over ~400ms). The badge anchors to the
 * coin so the player reads "earned 50" as one unit.
 */
function EarnVisual(): React.JSX.Element {
  const [scale] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // Pop-in on first render; non-blocking — even if the user swipes
    // immediately to slide 2 the animation completes silently.
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, opacity]);

  return (
    <View style={styles.earnRoot} testID="earn-visual">
      <View style={styles.coinWrap}>
        <TokenCoin size={120} />
        <Animated.View
          style={[
            styles.earnBadge,
            { opacity, transform: [{ scale }] },
          ]}
        >
          <Text style={styles.earnBadgeText}>+50</Text>
        </Animated.View>
      </View>
    </View>
  );
}

/**
 * Slide 2 — two balanced hint tiles. Emoji glyphs match what
 * `DailyMatchScreen` already renders for the player's HINT / PROBE
 * buttons, so the walkthrough's visual language matches what the
 * player sees in production.
 */
function SpendVisual(): React.JSX.Element {
  return (
    <View style={styles.spendRoot} testID="spend-visual">
      <View style={styles.spendTile}>
        <Text style={styles.spendEmoji}>💡</Text>
        <Text style={styles.spendPrice}>100</Text>
        <Text style={styles.spendLabel}>REVEAL</Text>
      </View>
      <View style={styles.spendTile}>
        <Text style={styles.spendEmoji}>🔍</Text>
        <Text style={styles.spendPrice}>50</Text>
        <Text style={styles.spendLabel}>PROBE</Text>
      </View>
    </View>
  );
}

/**
 * Slide 3 — flame icon + 7-dot streak row, last dot rendered as a
 * smaller flame so the eye reads "streak 7 → unlocks something." The
 * flame SVG paths mirror `OnboardingIntroScreen`'s flame visual so
 * the broader onboarding flow shares one streak idiom.
 */
function StreakVisual(): React.JSX.Element {
  return (
    <View style={styles.streakRoot} testID="streak-visual">
      <Flame size={80} />
      <View style={styles.streakDots}>
        {Array.from({ length: 7 }, (_, i) => (
          <View key={i} style={i === 6 ? styles.streakFinalDot : styles.streakDot} />
        ))}
      </View>
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
  earnRoot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  earnBadge: {
    position: 'absolute',
    top: -10,
    right: -28,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: withAlpha('#000000', 0.6),
    borderWidth: 1,
    borderColor: colors.gold,
  },
  earnBadgeText: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.gold,
    letterSpacing: 0.4,
  },
  spendRoot: {
    flexDirection: 'row',
    gap: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spendTile: {
    width: 110,
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: withAlpha('#000000', 0.32),
    alignItems: 'center',
    gap: 4,
  },
  spendEmoji: {
    fontSize: 36,
  },
  spendPrice: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: '#ffffff',
    letterSpacing: -0.4,
    marginTop: 4,
  },
  spendLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: '#ffffff',
    opacity: 0.85,
    textTransform: 'uppercase',
  },
  streakRoot: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  streakDots: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  streakDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
    opacity: 0.85,
  },
  streakFinalDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fb923c',
    borderWidth: 1.5,
    borderColor: '#9a3412',
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
