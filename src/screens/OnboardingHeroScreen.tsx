/**
 * Phase 7A.8 CP2 — single-slide onboarding hero.
 *
 * Replaces Phase 7A.6 CP2's three-slide intro carousel + CP4's
 * token economy walkthrough with one brand-defining slide:
 * hero illustration + title + sub + primary CTA.
 *
 * Why the rework: TestFlight feedback ("çok uzun ve görseller
 * amatör") — the original 3-slide intro felt long; the inline
 * walkthrough illustrations read as stock onboarding clipart.
 * CP2 collapses both surfaces into a single hero powered by
 * the CP1 AI asset (`assets/onboarding/hero-pure-deduction.png`,
 * Flux Pro 1.1 Ultra). Token economy moves from an explicit
 * walkthrough to discovery-driven nudges (CP3 just-in-time
 * tooltips at first earn / first hint spend / streak milestone).
 *
 * Flow contract:
 *   - Mount: gated by `RootNavigator.pickInitialRoute` on
 *     `!onboarding.introSeen`. Existing users with
 *     `introSeen=true` never see this screen.
 *   - CTA tap: `markIntroSeen()` + `navigation.replace('TutorialMatch')`.
 *     No Skip path — TutorialMatch is mandatory (Phase 9
 *     backlog has "Replay tutorial" Settings entry for
 *     repeat access).
 *   - `stampOnboardingComplete` is NOT called here. The hero is
 *     the first step in a 2-step linear flow; TutorialMatch is
 *     the second step and owns the completion stamp (CP2 moved
 *     it there from the deleted token walkthrough).
 */

import { useCallback } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import * as haptics from '@/lib/haptics';
import { Button } from '@components/Button';
import { Screen } from '@components/Screen';
import type { RootStackParamList } from '@navigation/routes';
import { useUserStore } from '@state/userStore';
import { colors, fonts } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'OnboardingHero'>;

// `require` resolves the bundled PNG to a Metro asset number at
// build time. The image is committed at
// `assets/onboarding/hero-pure-deduction.png` (CP1, Flux Pro Ultra
// round 2). Replacement workflow is documented in
// `assets/onboarding/ATTRIBUTION.md` — drop a new file at the
// same path, no code change needed.
const HERO_IMAGE = require('../../assets/onboarding/hero-pure-deduction.png');

export function OnboardingHeroScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const markIntroSeen = useUserStore((s) => s.markIntroSeen);

  const handleGetStarted = useCallback((): void => {
    haptics.impact('light');
    markIntroSeen();
    navigation.replace('TutorialMatch');
  }, [markIntroSeen, navigation]);

  return (
    <Screen ambientIntensity={0.18}>
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        {/*
          Explicit proportional layout (CP2 pre-commit hotfix):
          heroSection (50%) / copySection (30%) / ctaSection (20%).
          Earlier draft used `flex:1 + justifyContent:space-between`
          which produced an unbounded hero area; the explicit
          flex weights lock the hero illustration to the upper
          half with a comfortable copy hierarchy below.
        */}
        <View
          style={styles.heroSection}
          accessible
          accessibilityRole="image"
          accessibilityLabel="Pure deduction hero illustration"
        >
          <Image source={HERO_IMAGE} style={styles.hero} resizeMode="contain" />
          {/*
            CP2 pre-commit contrast fix — subtle dark gradient over
            the bottom 40% of the hero section. Pairs with the
            `textShadow*` properties on `title` + `sub` below: the
            gradient grounds the transition into the copy region;
            the shadows handle local contrast where the hero
            asset's violet zone bleeds toward the section edge.
            `pointerEvents="none"` so the CTA / image stay tappable.
          */}
          <LinearGradient
            colors={['transparent', 'rgba(0, 0, 0, 0.45)']}
            style={styles.heroFade}
            pointerEvents="none"
          />
        </View>

        <View style={styles.copySection} accessibilityRole="text">
          <Text style={styles.title} accessibilityRole="header">
            Pure deduction.
          </Text>
          <Text style={styles.sub}>Crack codes. Earn tokens. Build streaks.</Text>
        </View>

        <View style={styles.ctaSection} testID="onboarding-hero-cta">
          <Button onPress={handleGetStarted} size="lg" style={styles.cta}>
            Get started
          </Button>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
  },
  // 50% of available vertical space for the hero illustration.
  // The image inside uses `width: 65%` + `aspectRatio: 1` so it
  // never fills the section — the section frames the image with
  // breathing room top + bottom regardless of device height.
  heroSection: {
    flex: 5,
    alignItems: 'center',
    justifyContent: 'center',
    // `position: 'relative'` is the default in React Native, but
    // declaring it explicitly here documents the intent — the
    // `heroFade` LinearGradient below uses `position: 'absolute'`
    // and relies on this container as its positioning ancestor.
    position: 'relative',
  },
  hero: {
    width: '65%',
    aspectRatio: 1,
  },
  // Absolute-positioned fade at the bottom of heroSection that
  // darkens the transition into the copy region. 40% height feels
  // unobtrusive while still providing enough contrast against the
  // asset's brighter violet zones for the title to read cleanly.
  heroFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
  },
  // 30% for title + sub. `justifyContent: 'flex-start'` so the
  // title sits close to the image rather than floating in the
  // middle of the copy section.
  copySection: {
    flex: 3,
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.8,
    lineHeight: 40,
    // CP2 pre-commit contrast fix — drop shadow gives the title
    // enough local contrast to read against the asset's violet
    // bleed even when the gradient fade is too subtle.
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  sub: {
    marginTop: 12,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    // Lighter shadow on the sub — it's a paler grey on a paler
    // backdrop and the heavier title shadow would overpower the
    // visual hierarchy.
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  // 20% for the CTA section. `justifyContent: 'flex-end'` pins
  // the button to the bottom of its section so it sits just
  // above the safe-area bottom-inset padding applied on `root`.
  ctaSection: {
    flex: 2,
    justifyContent: 'flex-end',
  },
  cta: {
    width: '100%',
  },
});
