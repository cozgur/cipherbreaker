/**
 * Phase 7A.5 CP7 — floating "+N" token chip.
 *
 * Renders a "+amount" overlay that translates upward and fades
 * out over 1500ms. Used by `MatchResultScreen` on the win path
 * to surface the reward grant as a satisfying visual moment. The
 * call site supplies `onComplete` to clean up state after the
 * animation finishes (e.g., remove the floater from the tree so
 * a re-mount doesn't double-show).
 *
 * Implementation: state-driven `progress` (0..1) interpolated via
 * a 16ms `setInterval` — same primitive as `AnimatedTokenCounter`.
 * Manual setInterval (Q5 = no Reanimated, no RN Animated) keeps
 * the testing harness deterministic via `jest.useFakeTimers`. The
 * trade-off is that we lose the native-driver perf optimisation
 * RN's Animated would offer, but the floater is a one-shot, low-
 * intensity visual; JS-driven interpolation is plenty.
 *
 * Reduced Motion (Apple HIG): skip the animation entirely. The
 * `onComplete` callback fires on the next tick so the parent's
 * cleanup runs without leaving a stale floater on screen.
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useReducedMotion } from '@/lib/useReducedMotion';
import { formatNumber } from '@/lib/formatNumber';
import { colors, fonts, withAlpha } from '@theme/tokens';

interface TokenRewardFloaterProps {
  /** Reward amount to render. Rendered as `+{amount}`. */
  readonly amount: number;
  /** Fired exactly once after the animation completes (or
   *  immediately on the next tick under reduced-motion). */
  readonly onComplete: () => void;
  /** Animation duration in milliseconds. Default 1500 ms. */
  readonly duration?: number;
  /** Optional positioning override (parent decides where it
   *  starts on screen — the component handles only translateY +
   *  opacity from that point). */
  readonly style?: ViewStyle;
  /** Distance the floater translates upward by, in dp. Default 40. */
  readonly translateDistance?: number;
}

const DEFAULT_DURATION_MS = 1500;
const DEFAULT_TRANSLATE_DISTANCE_DP = 40;
const FRAME_INTERVAL_MS = 16;

export function TokenRewardFloater({
  amount,
  onComplete,
  duration = DEFAULT_DURATION_MS,
  style,
  translateDistance = DEFAULT_TRANSLATE_DISTANCE_DP,
}: TokenRewardFloaterProps): React.JSX.Element {
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    if (reduced) {
      // Reduced Motion — fire onComplete next tick so the parent
      // can unmount the floater. No translate, no fade — the
      // text just disappears with the next render cycle.
      const timeoutId = setTimeout(onComplete, 0);
      return (): void => clearTimeout(timeoutId);
    }

    // Tick-counter rather than Date.now arithmetic — deterministic
    // under `jest.advanceTimersByTime` regardless of whether the
    // test environment also mocks `Date.now`. Production behaviour
    // is identical: each interval tick advances the counter by
    // FRAME_INTERVAL_MS, hits the duration, fires onComplete.
    let elapsed = 0;
    const intervalId = setInterval(() => {
      elapsed += FRAME_INTERVAL_MS;
      const t = Math.min(1, elapsed / duration);
      setProgress(t);
      if (t >= 1) {
        clearInterval(intervalId);
        onComplete();
      }
    }, FRAME_INTERVAL_MS);

    return (): void => clearInterval(intervalId);
  }, [duration, onComplete, reduced]);

  // Linear interpolation — easing on a fade-out pop is overkill;
  // the visual is short and a straight-line ramp reads cleanly.
  const translateY = -translateDistance * progress;
  const opacity = 1 - progress;

  return (
    <View
      style={[styles.wrap, style, { transform: [{ translateY }], opacity }]}
      pointerEvents="none"
      accessibilityLabel={`Reward earned: +${amount} tokens`}
    >
      <Text style={styles.label}>+{formatNumber(amount)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: withAlpha(colors.gold, 0.18),
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.45),
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.bodySemibold,
    fontSize: 16,
    color: colors.gold,
    letterSpacing: 0.4,
  },
});
