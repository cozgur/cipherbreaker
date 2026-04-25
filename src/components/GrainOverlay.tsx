import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

interface GrainOverlayProps {
  /** Film-grain opacity. DESIGN-PROMPT pins the default at 0.02. */
  readonly opacity?: number;
  /** Deterministic seed so tests / repeated renders produce the same dots. */
  readonly seed?: number;
}

const DOT_COUNT = 260;
const CELL = 260;

/**
 * Subtle film-grain overlay. react-native-svg (iOS) does not yet
 * implement `feTurbulence` (see its USAGE.md note that logs a warning
 * at startup), so instead we paint a fixed pseudo-random scatter of
 * 1px dots inside a tiled SVG cell. The result is comparable in feel
 * to the reference `CBGrain` noise without the native-only filter.
 */
export function GrainOverlay({ opacity = 0.02, seed = 1 }: GrainOverlayProps): React.JSX.Element {
  const dots = useMemo(() => {
    // Small deterministic LCG so we never pull Math.random into tests.
    let state = seed * 1013904223 + 1664525;
    const result: Array<readonly [number, number]> = [];
    for (let i = 0; i < DOT_COUNT; i += 1) {
      state = (state * 1664525 + 1013904223) >>> 0;
      const x = state % CELL;
      state = (state * 1664525 + 1013904223) >>> 0;
      const y = state % CELL;
      result.push([x, y]);
    }
    return result;
  }, [seed]);

  return (
    <View pointerEvents="none" style={[styles.fill, { opacity }]}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${CELL} ${CELL}`}
        preserveAspectRatio="xMidYMid slice"
      >
        {dots.map(([x, y], index) => (
          <Rect key={index} x={x} y={y} width={1} height={1} fill="#ffffff" />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
});
