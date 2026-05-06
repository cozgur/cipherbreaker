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
 */

import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, withAlpha } from '@theme/tokens';

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
}

export function TutorialToast({
  visible,
  message,
  badge,
  children,
  style,
  testID,
}: TutorialToastProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.root, { top: insets.top + 12 }, style]}
      testID={testID}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      accessible
      accessibilityLabel={badge != null ? `${badge}: ${message}` : message}
    >
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
});
