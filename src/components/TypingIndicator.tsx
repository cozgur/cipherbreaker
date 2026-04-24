import { StyleSheet, View } from 'react-native';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';

import { colors } from '@theme/tokens';

interface TypingIndicatorProps {
  /** Dot colour; defaults to the app violet. */
  readonly color?: string;
  /** Diameter of each dot. Spacing scales with it. */
  readonly size?: number;
}

const DOT_COUNT = 3;
const STAGGER_MS = 180;
const DURATION_MS = 700;

/**
 * Three-dot bouncing indicator — used on the match screen while the
 * opponent is composing a guess. Each dot offsets vertically with a
 * staggered loop; scale pulses slightly so the motion reads even at
 * very small sizes.
 */
export function TypingIndicator({
  color = colors.violet,
  size = 8,
}: TypingIndicatorProps): React.JSX.Element {
  const dots = Array.from({ length: DOT_COUNT });
  const travel = Math.max(3, Math.round(size * 0.6));

  return (
    <View style={[styles.row, { gap: size / 1.5, height: size + travel * 2 }]}>
      {dots.map((_, index) => (
        <MotiView
          key={index}
          from={{ translateY: 0, scale: 1 }}
          animate={{ translateY: -travel, scale: 1.1 }}
          transition={{
            type: 'timing',
            duration: DURATION_MS,
            loop: true,
            repeatReverse: true,
            delay: index * STAGGER_MS,
            easing: Easing.inOut(Easing.sin),
          }}
          style={[
            styles.dot,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    alignSelf: 'center',
  },
});
