import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors, withAlpha } from '@theme/tokens';

interface AmbientBackgroundProps {
  /** Tint colour for the radial glow pouring from the top of the screen. */
  readonly tint?: string;
  /** 0–1 strength of the radial wash; defaults track reference/tokens.jsx. */
  readonly intensity?: number;
}

/**
 * Two-layer backdrop: a linear fade from `#0a0b1e` → `#070816`, with a
 * centred radial tint on top. Mirrors the web prototype's `CBAmbient`.
 */
export function AmbientBackground({
  tint = colors.violet,
  intensity = 0.18,
}: AmbientBackgroundProps): React.JSX.Element {
  return (
    <View pointerEvents="none" style={styles.fill}>
      <LinearGradient
        colors={[colors.bgBase, '#070816']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.fill}
      />
      <Svg style={styles.fill}>
        <Defs>
          <RadialGradient id="amb" cx="50%" cy="0%" rx="60%" ry="60%" fx="50%" fy="0%">
            <Stop offset="0%" stopColor={tint} stopOpacity={intensity} />
            <Stop offset="60%" stopColor={tint} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#amb)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
});

// Exposed so callers building a custom CTA glow can mix tint with alpha
// without re-importing from the theme.
export const ambientHelpers = { withAlpha };
