/**
 * Phase 7A.6 CP2 — 3-slide intro carousel. Showcases Daily Challenge,
 * the seven competitive modes, and the token + streak economy. Three
 * exit paths: Skip (any slide) commits the full Skip-All flow via
 * `completeOnboarding(today)`; Start Playing (slide 3) commits only
 * `markIntroSeen()` so subsequent CPs (tutorial match, token
 * walkthrough, mode teasers, push opt-in) can still fire at their
 * milestones. Both replace the stack with Home so the back gesture
 * cannot re-enter the carousel.
 *
 * CP2 ships the screen + route registration only; RootNavigator
 * stays on the legacy `mockUser.hasOnboarded` gate. CP7 wires the
 * conditional entry from `onboarding.introSeen` / `completedAt`.
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
import Svg, { Circle, Path } from 'react-native-svg';

import * as haptics from '@/lib/haptics';
import { Button } from '@components/Button';
import { ModeIcon } from '@components/ModeIcon';
import { Screen } from '@components/Screen';
import { formatDailyDate } from '@game/daily/dailyDate';
import type { RootStackParamList } from '@navigation/routes';
import { useUserStore } from '@state/userStore';
import { colors, fonts, withAlpha } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'OnboardingIntro'>;

interface IntroSlide {
  readonly key: 'daily' | 'modes' | 'tokens';
  readonly title: string;
  readonly body: string;
  readonly gradient: readonly [string, string];
}

const SLIDES: readonly IntroSlide[] = [
  {
    key: 'daily',
    title: 'A new code every day',
    body: 'Crack it in 10 guesses or fewer.',
    gradient: [colors.violet, colors.cyan],
  },
  {
    key: 'modes',
    title: '7 unique modes',
    body: 'Speed, prestige, mirror battles.',
    gradient: [colors.pink, colors.violet],
  },
  {
    key: 'tokens',
    title: 'Earn tokens. Build streaks.',
    body: 'Pure deduction. Daily challenge.',
    gradient: [colors.gold, colors.goldDeep],
  },
];

const SLIDE_COUNT = SLIDES.length;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function OnboardingIntroScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);
  const markIntroSeen = useUserStore((s) => s.markIntroSeen);

  const flatListRef = useRef<FlatList<IntroSlide>>(null);
  // Lazy-init via useState — `react-hooks/refs` rejects reading
  // `useRef(...).current` during render, and the Animated.Value
  // only needs to live for the component's lifetime, so a single
  // memoised instance via state suffices.
  const [scrollX] = useState(() => new Animated.Value(0));
  const [currentSlide, setCurrentSlide] = useState(0);

  const isLast = currentSlide === SLIDE_COUNT - 1;

  const handleSkip = useCallback((): void => {
    haptics.selection();
    completeOnboarding(formatDailyDate(new Date()));
    navigation.replace('Home');
  }, [completeOnboarding, navigation]);

  const handleContinue = useCallback((): void => {
    const next = currentSlide + 1;
    if (next >= SLIDE_COUNT) return;
    haptics.impact('light');
    // Update state immediately so the footer label + dot selection
    // change on press, even before the FlatList momentum settles.
    // `onMomentumScrollEnd` is idempotent — if the user swipes
    // mid-animation, both code paths converge on the same index.
    setCurrentSlide(next);
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
  }, [currentSlide]);

  const handleStartPlaying = useCallback((): void => {
    // Phase 7A.6 CP7 — soft completion + linear forward to the
    // tutorial match (CP3). Only `introSeen` is marked; the rest
    // of the onboarding flags stay false so the next step's gate
    // engages as the user lands on TutorialMatch. CP7 wiring
    // replaces the prior CP2-shipped `'Home'` placeholder.
    haptics.impact('light');
    markIntroSeen();
    navigation.replace('TutorialMatch');
  }, [markIntroSeen, navigation]);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      const clamped = Math.max(0, Math.min(SLIDE_COUNT - 1, idx));
      setCurrentSlide((prev) => {
        if (prev !== clamped) haptics.selection();
        return clamped;
      });
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
    ({ item, index }: ListRenderItemInfo<IntroSlide>): React.JSX.Element => (
      <SlideView slide={item} index={index} />
    ),
    [],
  );

  const keyExtractor = useCallback((item: IntroSlide): string => item.key, []);

  const getItemLayout = useCallback(
    (_: ArrayLike<IntroSlide> | null | undefined, index: number) => ({
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
          testID="onboarding-intro-list"
        />

        <View style={styles.footer}>
          <PaginationDots scrollX={scrollX} count={SLIDE_COUNT} currentSlide={currentSlide} />
          <Button
            onPress={isLast ? handleStartPlaying : handleContinue}
            size="lg"
            style={styles.cta}
          >
            {isLast ? 'Start Playing →' : 'Continue →'}
          </Button>
        </View>
      </View>
    </Screen>
  );
}

interface SlideViewProps {
  readonly slide: IntroSlide;
  readonly index: number;
}

function SlideView({ slide, index }: SlideViewProps): React.JSX.Element {
  // Strip a trailing period from the title before joining so the
  // composed a11y label reads cleanly even when the title already
  // ends in punctuation (e.g. "Earn tokens. Build streaks.").
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
            <DailyCardMock />
          ) : index === 1 ? (
            <ModeRow />
          ) : (
            <TokenStreakIcons />
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

function DailyCardMock(): React.JSX.Element {
  return (
    <View style={styles.dailyCard}>
      <Text style={styles.dailyLabel}>DAILY</Text>
      <Text style={styles.dailyDigits}>4 · 7 · 1 · 9</Text>
      <Text style={styles.dailyHint}>10 guesses</Text>
    </View>
  );
}

function ModeRow(): React.JSX.Element {
  return (
    <View style={styles.modeRow}>
      <View style={styles.modeIconWrap}>
        <ModeIcon iconKey="color-match" size={48} />
      </View>
      <View style={styles.modeIconWrap}>
        <ModeIcon iconKey="blitz" size={48} />
      </View>
      <View style={styles.modeIconWrap}>
        <ModeIcon iconKey="mirror" size={48} />
      </View>
    </View>
  );
}

function TokenStreakIcons(): React.JSX.Element {
  return (
    <View style={styles.tokenWrap}>
      <Svg width={84} height={84} viewBox="0 0 84 84">
        <Circle cx={42} cy={42} r={34} fill="#fde68a" stroke="#b45309" strokeWidth={2.4} />
        <Circle cx={42} cy={42} r={24} fill="#fbbf24" />
        <Path d="M35 34h14v3H35zM35 41h14v3H35zM35 48h14v3H35z" fill="#78350f" />
      </Svg>
      <Svg width={68} height={84} viewBox="0 0 68 84">
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
    </View>
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
            testID={`onboarding-intro-dot-${index}`}
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
  dailyCard: {
    backgroundColor: withAlpha('#000000', 0.35),
    paddingVertical: 26,
    paddingHorizontal: 32,
    borderRadius: 18,
    alignItems: 'center',
  },
  dailyLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    letterSpacing: 2,
    color: '#ffffff',
    opacity: 0.85,
  },
  dailyDigits: {
    marginTop: 8,
    fontFamily: fonts.mono,
    fontSize: 36,
    letterSpacing: 6,
    color: '#ffffff',
  },
  dailyHint: {
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#ffffff',
    opacity: 0.8,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 16,
  },
  modeIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: withAlpha('#000000', 0.28),
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenWrap: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
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
