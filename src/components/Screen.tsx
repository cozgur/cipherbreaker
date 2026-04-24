import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { colors } from '@theme/tokens';
import { AmbientBackground } from './AmbientBackground';
import { GrainOverlay } from './GrainOverlay';

interface ScreenProps {
  readonly children?: ReactNode;
  readonly ambientTint?: string;
  readonly ambientIntensity?: number;
  readonly grainOpacity?: number;
  readonly style?: ViewStyle;
}

/**
 * Standard screen frame: base colour + ambient wash + film grain +
 * foreground content. Children are rendered above the grain so taps
 * and focus hit the intended target.
 */
export function Screen({
  children,
  ambientTint,
  ambientIntensity,
  grainOpacity,
  style,
}: ScreenProps): React.JSX.Element {
  return (
    <View style={[styles.root, style]}>
      <AmbientBackground tint={ambientTint} intensity={ambientIntensity} />
      <GrainOverlay opacity={grainOpacity} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgBase,
    overflow: 'hidden',
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
});
