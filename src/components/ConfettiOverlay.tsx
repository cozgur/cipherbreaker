/**
 * Victory burst — 36 gold particles falling from a deterministic
 * scatter. Same LCG seeding strategy as `GrainOverlay` so snapshot
 * tests stay stable across runs and devices.
 *
 * Animation runs through Moti / Reanimated v4. In Jest both are
 * mocked to plain Views (see `jest.setup.js`), which is fine — we
 * snapshot the layout, not the motion.
 */

import { StyleSheet, View, type ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';

import { colors, withAlpha } from '@theme/tokens';

interface ConfettiOverlayProps {
  /** Seed for the deterministic scatter. Default tracks the
   * "victory celebration" pose; tests can pass a stable seed too. */
  readonly seed?: number;
  /** When false, returns null — used when reduced motion is
   * detected upstream. */
  readonly enabled?: boolean;
  readonly style?: ViewStyle;
}

const PARTICLE_COUNT = 36;
const VIEWPORT_WIDTH = 390;
const VIEWPORT_HEIGHT = 844;
const FALL_DURATION_MS = 2400;

/** 32-bit Linear Congruential Generator — same constants as GrainOverlay. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return (): number => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0xffff_ffff;
  };
}

interface Particle {
  readonly x: number;
  readonly startY: number;
  readonly size: number;
  readonly delay: number;
  readonly drift: number;
}

function generateParticles(seed: number): readonly Particle[] {
  const random = lcg(seed);
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    particles.push({
      x: random() * VIEWPORT_WIDTH,
      startY: -20 - random() * 60,
      size: 3 + Math.floor(random() * 4),
      delay: Math.floor(random() * 800),
      drift: (random() - 0.5) * 60,
    });
  }
  return particles;
}

export function ConfettiOverlay({
  seed = 0xc1be_b1ea,
  enabled = true,
  style,
}: ConfettiOverlayProps): React.JSX.Element | null {
  if (!enabled) return null;
  const particles = generateParticles(seed);

  return (
    <View pointerEvents="none" style={[styles.fill, style]}>
      {particles.map((p, i) => (
        <MotiView
          key={i}
          from={{ translateX: p.x, translateY: p.startY, opacity: 0 }}
          animate={{
            translateX: p.x + p.drift,
            translateY: VIEWPORT_HEIGHT + 40,
            opacity: 1,
          }}
          transition={{
            type: 'timing',
            duration: FALL_DURATION_MS,
            delay: p.delay,
            easing: Easing.in(Easing.quad),
            loop: false,
          }}
          style={[
            styles.particle,
            {
              width: p.size * 2,
              height: p.size * 2,
              borderRadius: p.size,
              backgroundColor: colors.gold,
              shadowColor: colors.gold,
              shadowOpacity: 1,
              shadowRadius: p.size * 2,
              shadowOffset: { width: 0, height: 0 },
            },
          ]}
        />
      ))}
      {/* Soft gold tint behind the burst so the screen feels brighter
          even before the first particle reaches the centre line. */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(colors.gold, 0.04) }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
  },
});
