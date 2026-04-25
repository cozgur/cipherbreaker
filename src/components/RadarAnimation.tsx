import { StyleSheet, View } from 'react-native';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { colors } from '@theme/tokens';

interface RadarAnimationProps {
  readonly size?: number;
}

/**
 * Matchmaking radar: pulsing concentric rings + a sweeping violet wedge.
 * The sweep rotates the whole Svg via Moti so nothing touches the
 * JS thread mid-frame; rings are CSS-like Moti loops.
 */
export function RadarAnimation({ size = 260 }: RadarAnimationProps): React.JSX.Element {
  const rings = [30, 60, 90, 120] as const;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 260 260" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="radar-glow" cx="50%" cy="50%" rx="60%" ry="60%">
            <Stop offset="0%" stopColor={colors.violet} stopOpacity={0.25} />
            <Stop offset="100%" stopColor={colors.violet} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="260" height="260" fill="url(#radar-glow)" />
      </Svg>

      {rings.map((radius, index) => (
        <MotiView
          key={radius}
          from={{ opacity: 0.5, scale: 1 }}
          animate={{ opacity: 0, scale: 1.5 }}
          transition={{
            type: 'timing',
            duration: 3000,
            loop: true,
            delay: index * 400,
            easing: Easing.out(Easing.ease),
          }}
          style={[
            styles.ringWrap,
            {
              width: size,
              height: size,
            },
          ]}
        >
          <Svg width={size} height={size} viewBox="0 0 260 260">
            <Circle
              cx="130"
              cy="130"
              r={radius}
              fill="none"
              stroke={colors.violet}
              strokeOpacity={0.5}
              strokeWidth={1}
            />
          </Svg>
        </MotiView>
      ))}

      <MotiView
        from={{ rotate: '0deg' }}
        animate={{ rotate: '360deg' }}
        transition={{
          type: 'timing',
          duration: 2800,
          loop: true,
          easing: Easing.linear,
        }}
        style={[styles.sweep, { width: size, height: size }]}
      >
        <Svg width={size} height={size} viewBox="0 0 260 260">
          <Defs>
            <SvgLinearGradient id="radar-sweep" x1="0" y1="0.5" x2="1" y2="0.5">
              <Stop offset="0%" stopColor={colors.violet} stopOpacity={0} />
              <Stop offset="100%" stopColor={colors.violet} stopOpacity={0.65} />
            </SvgLinearGradient>
          </Defs>
          <Path d="M130 130 L250 130 A120 120 0 0 0 190 26 Z" fill="url(#radar-sweep)" />
        </Svg>
      </MotiView>

      <Svg width={size} height={size} viewBox="0 0 260 260" style={StyleSheet.absoluteFill}>
        <Circle cx="130" cy="130" r="4" fill="#fff" />
        <Circle cx="130" cy="130" r="10" fill="none" stroke={colors.violet} strokeWidth="1.5" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sweep: {
    position: 'absolute',
  },
});
