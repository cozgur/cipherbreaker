/**
 * Phase 7A.6 CP3 — Top-anchored toast for tutorial cues.
 *
 * Two flavours of cue both ride this component:
 *   - First-guess prompt: "Tap pegs to build your guess." Plain text.
 *     Auto-dismisses on the player's first peg tap (caller-driven).
 *   - Auto-hint announcement: a short "Tutorial:" line plus an inline
 *     `children` slot the caller fills with a coloured DigitTile so
 *     the player sees the revealed peg in the same visual language as
 *     the board (per Codex round 2 guidance — peg over text).
 *
 * The toast does NOT trap focus — it's an announcement, not a dialog.
 * `accessibilityLiveRegion="polite"` lets a screen reader speak the
 * text without yanking focus out of the input area.
 *
 * Phase 7A.8 CP3 — `variant` prop extends the component with a second
 * styling mode for just-in-time tooltips that surface outside the
 * tutorial context:
 *
 *   - `variant="tutorial"` (default): existing Phase 7A.6 CP3
 *     behaviour. Caller controls `visible`; the toast is a passive
 *     render slot with no internal timer or tap handler. Lives
 *     inside TutorialMatchScreen's tutorial flow.
 *   - `variant="jit"`: just-in-time educational tooltips. Renders
 *     with a filled gold-tinted bubble (no "TUTORIAL" pill — these
 *     fire post-onboarding and shouldn't pose as tutorial). Owns
 *     its own dismiss lifecycle: 5s auto-dismiss timer + tap-
 *     anywhere overlay. `onDismiss` notifies the caller so the
 *     orchestrator (jitTooltipManager) can advance its queue.
 *
 * The two variants differ in vertical anchoring:
 *
 *   - Tutorial variant is TOP-anchored (`insets.top +
 *     TUTORIAL_HEADER_CLEARANCE`) because TutorialMatchScreen's UI
 *     flow concentrates user attention on the board / keyboard at
 *     the top-to-middle band, and the toast pairs with the
 *     SectionLabel-plus-Skip header above the board.
 *
 *   - JIT variant is BOTTOM-anchored (`insets.bottom +
 *     JIT_BOTTOM_CLEARANCE`). The three JIT trigger screens
 *     (HomeScreen / MatchResultScreen / DailyMatchScreen) each have
 *     distinct top areas (HomeScreen top bar with avatar/tokens at
 *     `insets.top + 12`; MatchResultScreen's stat header; Daily's
 *     custom header) — a single shared top offset can't clear all
 *     three without either overlapping headers or floating too far
 *     below the safe area. Bottom-anchoring is geometry-stable
 *     across the trigger surfaces, treats JIT as a notification
 *     pattern (distinct from tutorial's overlay pattern), and
 *     surfaces near the user's likely point of attention
 *     (post-Continue / post-hint / post-match-return-to-Home).
 */

import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, withAlpha } from '@theme/tokens';

/**
 * Phase 7A.8 CP2 — vertical offset that clears TutorialMatchScreen's
 * top header (`TutorialMatchScreen.tsx` renders `<View paddingTop:
 * insets.top + 14>` containing a `SectionLabel` ~28pt tall plus an
 * absolute-positioned Skip floater also at `insets.top + 14`).
 * Pre-CP2 the toast anchored at `insets.top + 12` and rendered on
 * top of both the label and the Skip button (zIndex 50 hid them
 * visually). CP2's pre-commit hotfix pushes the toast below the
 * header so all three elements coexist.
 *
 * Sized empirically: 14 (header paddingTop) + 28 (SectionLabel
 * height) + ~14 (vertical breathing) ≈ 56. Component-local rather
 * than promoted to `@theme/spacing` because the constant is
 * specifically about clearing TutorialMatchScreen's header — not a
 * general layout token.
 */
const TUTORIAL_HEADER_CLEARANCE = 56;
/**
 * Phase 7A.8 CP3 — JIT variant bottom clearance. Worst-case constraint
 * is MatchResultScreen's Continue CTA: footer `paddingBottom:
 * insets.bottom + 24` plus a `size="lg"` button (~52pt) puts the
 * button's top edge at `insets.bottom + 76`. DailyMatchScreen's
 * SUBMIT button (`marginBottom: insets.bottom + 16` + ~52pt) tops out
 * at `insets.bottom + 68`. A 96-pt clearance anchors the toast's
 * bottom edge ~20pt above MatchResult's Continue with breathing room.
 * On HomeScreen, which has no sticky bottom CTA (`paddingBottom:
 * insets.bottom + 48` on the ScrollView content only), the toast
 * lands cleanly above the LevelBar tail. The previous top-anchored
 * approach (`insets.top + 16`) systematically overlapped each
 * screen's top bar — see the variant-positioning rationale in the
 * file-level docstring.
 */
const JIT_BOTTOM_CLEARANCE = 96;
/** Phase 7A.8 CP3 — JIT auto-dismiss duration. Matches the spec. */
const JIT_AUTO_DISMISS_MS = 5000;

export type TutorialToastVariant = 'tutorial' | 'jit';

interface TutorialToastProps {
  readonly visible: boolean;
  readonly message: string;
  readonly badge?: string;
  /** Optional inline content rendered after `message` — used by the
   *  auto-hint variant to show a coloured DigitTile next to the
   *  copy. */
  readonly children?: React.ReactNode;
  readonly style?: ViewStyle;
  readonly testID?: string;
  /**
   * Phase 7A.8 CP3 — styling + lifecycle variant.
   *   `'tutorial'` (default): caller-driven visibility, no internal
   *     timer. Phase 7A.6 CP3 behaviour preserved byte-for-byte.
   *   `'jit'`: filled gold bubble, no badge, owns 5s auto-dismiss +
   *     tap-anywhere via Pressable overlay. Calls `onDismiss` on
   *     either path.
   */
  readonly variant?: TutorialToastVariant;
  /** JIT variant only — leading icon (e.g. coin / sparkle / flame). */
  readonly icon?: React.ReactNode;
  /** JIT variant only — fires on auto-dismiss timeout OR tap-anywhere. */
  readonly onDismiss?: () => void;
}

export function TutorialToast({
  visible,
  message,
  badge,
  children,
  style,
  testID,
  variant = 'tutorial',
  icon,
  onDismiss,
}: TutorialToastProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  const isJIT = variant === 'jit';

  // JIT variant owns its dismiss lifecycle. Mount → 5s timer →
  // onDismiss. The timer also clears on unmount so a parent that
  // hides the toast (e.g. by removing it from the queue) doesn't
  // leak a delayed callback into the next mount.
  useEffect(() => {
    if (!isJIT || !visible || onDismiss === undefined) return undefined;
    const id = setTimeout(onDismiss, JIT_AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [isJIT, visible, onDismiss]);

  if (!visible) return null;

  const anchorStyle: ViewStyle = isJIT
    ? { bottom: insets.bottom + JIT_BOTTOM_CLEARANCE }
    : { top: insets.top + TUTORIAL_HEADER_CLEARANCE };

  const a11yLabel = badge != null ? `${badge}: ${message}` : message;

  return (
    <View
      // Tutorial variant: passive announcement (no pointer events).
      // JIT variant: needs taps to dismiss → `box-none` so the bubble
      // is tappable but empty space around it falls through.
      pointerEvents={isJIT ? 'box-none' : 'none'}
      style={[styles.root, anchorStyle, style]}
      testID={testID}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      accessible
      accessibilityLabel={a11yLabel}
    >
      {isJIT ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${a11yLabel} (tap to dismiss)`}
          onPress={onDismiss}
          style={({ pressed }) => [styles.jitBubble, pressed && styles.jitBubblePressed]}
        >
          {icon != null ? <View style={styles.jitIcon}>{icon}</View> : null}
          <Text style={styles.jitMessage} numberOfLines={3}>
            {message}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.bubble}>
          {badge != null ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
          <Text style={styles.message} numberOfLines={2}>
            {message}
          </Text>
          {children != null ? <View style={styles.tail}>{children}</View> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 50,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: withAlpha(colors.violet, 0.5),
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: withAlpha(colors.violet, 0.18),
  },
  badgeText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 9.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.violet,
  },
  message: {
    flexShrink: 1,
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
    color: colors.text,
    letterSpacing: 0.2,
  },
  tail: {
    marginLeft: 'auto',
  },
  // JIT variant — distinct visual identity vs the tutorial variant
  // so the user reads it as "educational tooltip" not "still in
  // tutorial." Gold tint hooks into the token-economy palette
  // (TokenCoin / TokenBadge / RewardChip already use gold).
  jitBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: withAlpha(colors.gold, 0.14),
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.5),
  },
  jitBubblePressed: {
    opacity: 0.78,
  },
  jitIcon: {
    flexShrink: 0,
  },
  jitMessage: {
    flexShrink: 1,
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
    color: colors.text,
    letterSpacing: 0.2,
    lineHeight: 18,
  },
});
