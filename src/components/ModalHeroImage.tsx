/**
 * Phase 7A.8 CP4 — shared hero-image block for the three CP1
 * AI-generated modal assets (Blitz teaser, Mirror teaser,
 * NotificationOptIn). Centralises the Image + bottom-fade
 * LinearGradient pair so per-modal sizing tweaks discovered
 * during manual sanity (Step B) land in one place.
 *
 * NOT used by `OnboardingHeroScreen`. That screen's hero is a
 * section-of-screen layout (flex weights, asset at 65% width,
 * fade at 40% of section height) — different enough from the
 * card-hero shape these modals use that forcing a single
 * component would over-constrain both call sites.
 */

import { Image, type ImageSourcePropType, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ModalHeroImageProps {
  readonly source: ImageSourcePropType;
  readonly accessibilityLabel: string;
}

export function ModalHeroImage({
  source,
  accessibilityLabel,
}: ModalHeroImageProps): React.JSX.Element {
  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Image source={source} style={styles.image} resizeMode="contain" />
      <LinearGradient
        colors={['transparent', 'rgba(0, 0, 0, 0.35)']}
        style={styles.fade}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '35%',
  },
});
