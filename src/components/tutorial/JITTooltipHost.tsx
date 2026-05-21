/**
 * Phase 7A.8 CP3 — render slot for just-in-time tooltips.
 *
 * Mounted on each of the three trigger screens (MatchResultScreen /
 * DailyMatchScreen / HomeScreen). Subscribes to the JIT tooltip
 * queue and surfaces the active tooltip via `TutorialToast
 * variant="jit"`. Renders nothing when no tooltip is active — the
 * host is cheap to mount on every screen it might appear on.
 *
 * Why per-screen rather than a single host above the navigator?
 *   - The toast's positioning uses `useSafeAreaInsets()` and
 *     anchors to `insets.top + 16`. Putting the host above the
 *     navigator would position it relative to the navigator's
 *     safe area, which already accounts for nav-stack insets and
 *     would land in the right place for most screens — but the
 *     three screens have different presentation modes (Home is a
 *     standard push, MatchResult is push with gestureEnabled false,
 *     Daily is push). All three share the same safe area, so a
 *     root-level host would work. CP3 chooses per-screen for the
 *     simpler mental model: "tooltip is part of the screen that
 *     fires it." Promotion to root-level is a Phase 9 backlog item.
 *
 * `pointerEvents="box-none"` on the host wrapper means the toast
 * intercepts taps (for tap-anywhere dismiss) but empty space below
 * the toast passes touches through to the screen underneath.
 */

import { TutorialToast } from './TutorialToast';
import { useJITTooltip } from '@/lib/jitTooltipManager';

export function JITTooltipHost(): React.JSX.Element | null {
  const { config, dismiss } = useJITTooltip();
  if (config === null) return null;
  return (
    <TutorialToast
      visible
      variant="jit"
      message={config.message}
      onDismiss={dismiss}
      testID={config.testID}
    />
  );
}
