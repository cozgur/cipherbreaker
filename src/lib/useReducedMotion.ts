/**
 * Phase 7A.5 CP7 — Reduced Motion accessibility hook.
 *
 * Wraps `AccessibilityInfo.isReduceMotionEnabled()` + the
 * `'reduceMotionChanged'` event so any component animating values
 * can short-circuit the animation when the player has the iOS
 * "Reduce Motion" toggle enabled (Settings → Accessibility →
 * Motion → Reduce Motion). Apple HIG mandates this respect for
 * any non-essential animation; CP7's count-up + floater both
 * fall under that policy.
 *
 * Returns the live boolean. The first render returns `false`
 * (the initial state) and updates after the async
 * `isReduceMotionEnabled()` resolves on mount — components must
 * tolerate this transient false-then-true flip on a cold start
 * with the OS toggle on. In practice the resolve is one tick;
 * the worst case is a single animation frame fires before the
 * hook flips. Acceptable.
 *
 * Jest behaviour: `isReduceMotionEnabled()` resolves to `false`
 * by default in the testing harness (the RN Jest preset stubs
 * AccessibilityInfo to return false). Tests that need the
 * reduced-motion branch override the resolve via spy.
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!cancelled) setReducedMotion(enabled);
      })
      .catch(() => {
        // Defensive — if the platform throws, default to "not
        // reduced" (i.e., animations on). The risk profile is
        // smaller than the alternative (silently disabling
        // animation on a clean device because of a transient
        // platform error).
      });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        if (!cancelled) setReducedMotion(enabled);
      },
    );
    return (): void => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return reducedMotion;
}
