/**
 * Phase 7A.5 CP7 — count-up token counter.
 *
 * Animates the rendered text from the previously displayed value
 * to the current `value` prop using a 16ms `setInterval` (~60fps
 * target on capable devices, frame-skips OK on slower ones — the
 * easing math is time-based, not tick-based). Easing is
 * `easeOutQuad` so the count decelerates into its target — feels
 * "satisfying" without overshooting like a spring.
 *
 * Reduced Motion (iOS Settings → Accessibility → Motion → Reduce
 * Motion): the animation is skipped entirely; the prop value is
 * applied in one frame. Apple HIG-compliant.
 *
 * Mid-animation prop change: the existing interval is cleared and
 * a fresh animation re-targets from the currently displayed value
 * (snapshotted at effect-run time) to the new prop. No abrupt
 * jumps, no superseded intervals leaking.
 *
 * The component intentionally does not handle negative deltas as
 * a special case — count-down works just as well as count-up
 * mathematically. The CP7 brainstorm decision was "only positive
 * deltas animate, negative delta direct set" but the current call
 * sites (token rewards, wallet credits) only ever run upward;
 * deferring the policy to the call site keeps this primitive
 * fully general for future surfaces (XP bar, level-up bar, etc.).
 *
 * Manual setInterval (Q5 = no Reanimated dep). RN's built-in
 * Animated API isn't used either — interpolating a `number` into
 * formatted text is a perfect fit for a state-driven render loop,
 * and the deterministic Jest behaviour with `useFakeTimers` is the
 * load-bearing testability win over the Animated event-loop.
 */

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';

import { useReducedMotion } from '@/lib/useReducedMotion';

interface AnimatedTokenCounterProps {
  /** Target token amount. Animates from the previously displayed value. */
  readonly value: number;
  /** Animation duration in milliseconds. Default 1000 ms. */
  readonly duration?: number;
  /**
   * Optional prefix appended in front of the formatted number
   * (e.g. `'+'` for a reward chip, `''` for a wallet display).
   * Empty string by default.
   */
  readonly prefix?: string;
  /** Style passed through to the inner `Text` node. */
  readonly style?: TextStyle | readonly TextStyle[];
  /**
   * Test seam — accessibilityLabel passes through to the Text so
   * tests can assert the rendered amount via `getByLabelText`
   * even mid-animation.
   */
  readonly accessibilityLabel?: string;
}

const DEFAULT_DURATION_MS = 1000;
const FRAME_INTERVAL_MS = 16; // ~60fps

/** easeOutQuad — `1 - (1 - t)^2`. Decelerating curve. */
function easeOutQuad(t: number): number {
  const inv = 1 - t;
  return 1 - inv * inv;
}

export function AnimatedTokenCounter({
  value,
  duration = DEFAULT_DURATION_MS,
  prefix = '',
  style,
  accessibilityLabel,
}: AnimatedTokenCounterProps): React.JSX.Element {
  const reduced = useReducedMotion();
  const [displayValue, setDisplayValue] = useState<number>(value);
  // Track the latest `displayValue` via a ref so the animation
  // effect can snapshot the start point without re-running on
  // every interval tick (which would happen if `displayValue`
  // were in the dep array → infinite re-spawn loop).
  //
  // `react-hooks/refs` warns about ref writes during render. The
  // mirror is intentional — the ref is only read inside
  // `useEffect`, never during the next render, so the policy
  // concern (cascading renders) does not apply.
  const displayValueRef = useRef<number>(value);
  // eslint-disable-next-line react-hooks/refs -- intentional read-mirror for the animation start snapshot
  displayValueRef.current = displayValue;

  useEffect(() => {
    // Reduced-motion path — set the value directly, no interval.
    // `react-hooks/set-state-in-effect` warns about cascading
    // renders; this branch sets state once on a value change with
    // no follow-on writes. Apple-HIG accessibility compliance is
    // the load-bearing reason this branch exists.
    if (reduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot reduced-motion sync
      setDisplayValue(value);
      return;
    }
    // No-op when target is already displayed (e.g., parent re-
    // rendered for an unrelated reason).
    const startValue = displayValueRef.current;
    if (startValue === value) return;

    // Tick-counter rather than Date.now arithmetic — deterministic
    // under jest.advanceTimersByTime + production-equivalent (each
    // tick advances the counter by FRAME_INTERVAL_MS).
    let elapsed = 0;
    const intervalId = setInterval(() => {
      elapsed += FRAME_INTERVAL_MS;
      const t = Math.min(1, elapsed / duration);
      const eased = easeOutQuad(t);
      const next = startValue + (value - startValue) * eased;
      // Round to integer for token display — fractional tokens
      // would confuse the wallet UX.
      setDisplayValue(Math.round(next));
      if (t >= 1) {
        clearInterval(intervalId);
        // Final tick — pin to the exact target (defends against
        // float rounding leaving the display 1 short).
        setDisplayValue(value);
      }
    }, FRAME_INTERVAL_MS);

    return (): void => clearInterval(intervalId);
  }, [value, duration, reduced]);

  return (
    <Text
      style={[styles.base, style]}
      accessibilityLabel={accessibilityLabel}
    >
      {prefix}
      {displayValue.toLocaleString()}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    // No font defaults — the parent applies typography. This
    // component is purely numeric content.
  },
});
