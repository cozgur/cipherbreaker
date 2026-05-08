/**
 * Phase 7A.7 CP4 — generic per-mode tutorial scaffold.
 *
 * Reusable 3-slide carousel keyed by `modeId`. CP4 ships Mode 2
 * content (`@components/modeTutorial/mode2`); CP5 adds Modes 3+4
 * by extending the `slidesByMode` switch; CP6 adds Modes 5+6+7.
 * Mode 1 is intentionally excluded — Phase 7A.6 CP3's
 * `TutorialMatchScreen` is its bespoke equivalent.
 *
 * Pattern lineage: cloned from `OnboardingTokenWalkthroughScreen`
 * (CP4 of Phase 7A.6 — same horizontal-FlatList + Skip floater +
 * pagination dots + footer Button shape). Two deliberate
 * divergences:
 *
 *   - No `aspectRatio: 1` gradient hero. The Mode 2 slide-3 visual
 *     is `DemoBoard`, which is an interactive board (history rows
 *     + draft + DigitKeypad + Guess CTA). Forcing a square would
 *     clip the keypad. Slides 1 & 2 visuals are compact and sit
 *     naturally without the hero frame.
 *
 *   - Skip + Start CTAs both call `markModeTutorialSeen(modeId)`
 *     and replace into `Matchmaking` with the same modeId. The
 *     user tapped a mode tile on Home; both exits respect that
 *     intent. Skip = "don't show this tutorial again" (matches
 *     `markModeTutorialSeen`'s semantic), NOT "abandon the mode
 *     I just picked." Going to Home would punish the tap.
 *
 * Defensive validation: this CP only ships Mode 2 content. If
 * `modeId` is anything other than `2`, the screen calls
 * `navigation.replace('Matchmaking', { modeId })` on mount — the
 * tutorial degrades to a passthrough rather than rendering an
 * empty 3-slide carousel. CP5/CP6 expand the accepted set as
 * content lands. There is no production caller until CP7; this
 * defends against programmer error / bad deep links.
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
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import * as haptics from '@/lib/haptics';
import { Button } from '@components/Button';
import { Screen } from '@components/Screen';
import { slides as mode2Slides, type ModeTutorialSlide } from '@components/modeTutorial/mode2';
import { slides as mode3Slides } from '@components/modeTutorial/mode3';
import { slides as mode4Slides } from '@components/modeTutorial/mode4';
import { findMode } from '@data/modeCatalog';
import type { RootStackParamList } from '@navigation/routes';
import { useUserStore } from '@state/userStore';
import { colors, fonts, withAlpha } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ModeTutorial'>;
type Route = RouteProp<RootStackParamList, 'ModeTutorial'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * CP4 shipped Mode 2; CP5 adds Modes 3 + 4; CP6 will add Modes
 * 5 + 6 + 7. Returns `null` for unsupported modes so the
 * mount-time guard can route past us without rendering empty.
 */
function slidesForMode(modeId: number): readonly ModeTutorialSlide[] | null {
  switch (modeId) {
    case 2:
      return mode2Slides;
    case 3:
      return mode3Slides;
    case 4:
      return mode4Slides;
    default:
      return null;
  }
}

export function ModeTutorialScreen(): React.JSX.Element | null {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const markModeTutorialSeen = useUserStore((s) => s.markModeTutorialSeen);

  const { modeId } = route.params;
  const slides = slidesForMode(modeId);
  const slideCount = slides?.length ?? 0;

  const flatListRef = useRef<FlatList<ModeTutorialSlide>>(null);
  const [scrollX] = useState(() => new Animated.Value(0));
  const [currentSlide, setCurrentSlide] = useState(0);

  // Mount-time defensive: unsupported modeId → fall through to
  // Matchmaking. Mode 1 is the canonical case (Phase 7A.6 CP3's
  // TutorialMatchScreen handles it) plus any modeId that hasn't
  // had its content authored yet (CP5/CP6 backfill).
  useEffect(() => {
    if (slides === null) {
      navigation.replace('Matchmaking', { modeId });
    }
  }, [slides, modeId, navigation]);

  const advanceToMatchmaking = useCallback((): void => {
    markModeTutorialSeen(modeId);
    navigation.replace('Matchmaking', { modeId });
  }, [markModeTutorialSeen, modeId, navigation]);

  const handleSkip = useCallback((): void => {
    haptics.selection();
    advanceToMatchmaking();
  }, [advanceToMatchmaking]);

  const handleContinue = useCallback((): void => {
    const next = currentSlide + 1;
    if (next >= slideCount) return;
    haptics.impact('light');
    setCurrentSlide(next);
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
  }, [currentSlide, slideCount]);

  const handleStart = useCallback((): void => {
    haptics.impact('light');
    advanceToMatchmaking();
  }, [advanceToMatchmaking]);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      const clamped = Math.max(0, Math.min(slideCount - 1, idx));
      setCurrentSlide((prev) => {
        if (prev !== clamped) haptics.selection();
        return clamped;
      });
    },
    [slideCount],
  );

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: false,
      }),
    [scrollX],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ModeTutorialSlide>): React.JSX.Element => (
      <SlideView slide={item} />
    ),
    [],
  );

  const keyExtractor = useCallback(
    (_: ModeTutorialSlide, index: number): string => `slide-${index}`,
    [],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<ModeTutorialSlide> | null | undefined, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    [],
  );

  // Render nothing while the redirect effect runs. The effect
  // fires synchronously on mount; the placeholder shows for one
  // frame max.
  if (slides === null) return null;

  const isLast = currentSlide === slideCount - 1;
  const modeName = findMode(modeId)?.meta.name ?? 'MODE';

  return (
    <Screen ambientIntensity={0.18}>
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.modeLabel} accessibilityRole="header">
            {modeName}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Skip ${modeName} tutorial`}
            onPress={handleSkip}
            style={({ pressed }) => [styles.skip, pressed && styles.skipPressed]}
            testID="mode-tutorial-skip"
          >
            <Text style={styles.skipLabel}>Skip</Text>
          </Pressable>
        </View>

        <FlatList
          ref={flatListRef}
          data={slides}
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
          testID="mode-tutorial-list"
        />

        <View style={styles.footer}>
          <PaginationDots scrollX={scrollX} count={slideCount} currentSlide={currentSlide} />
          <View testID={isLast ? 'mode-tutorial-start' : 'mode-tutorial-continue'}>
            <Button
              onPress={isLast ? handleStart : handleContinue}
              size="lg"
              style={styles.cta}
            >
              {isLast ? 'Start match →' : 'Continue →'}
            </Button>
          </View>
        </View>
      </View>
    </Screen>
  );
}

interface SlideViewProps {
  readonly slide: ModeTutorialSlide;
}

function SlideView({ slide }: SlideViewProps): React.JSX.Element {
  const labelTitle = slide.title.replace(/\.$/, '');
  const composedLabel = `${labelTitle}. ${slide.body}`;
  return (
    <View
      style={styles.slide}
      accessibilityRole="text"
      accessibilityLabel={composedLabel}
    >
      <View style={styles.visual}>{slide.visual}</View>
      <View style={styles.copy}>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>
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
            testID={`mode-tutorial-dot-${index}`}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  modeLabel: {
    fontFamily: fonts.display,
    fontSize: 13,
    letterSpacing: 1.8,
    color: withAlpha(colors.text, 0.85),
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
    justifyContent: 'center',
  },
  visual: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  copy: {
    paddingTop: 24,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 30,
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
