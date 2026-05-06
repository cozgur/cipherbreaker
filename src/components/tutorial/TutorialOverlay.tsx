/**
 * Phase 7A.6 CP3 — Bottom-sheet overlay for tutorial guidance.
 *
 * Used by Welcome, Feedback Teaching, and Win Celebration overlays.
 * The board stays visible behind a dimmed-but-transparent backdrop so
 * the player keeps spatial context while reading the instructions.
 *
 * Dismissal contract: CTA only — backdrop tap is intentionally inert.
 * The overlays are part of the tutorial's pacing and a stray tap
 * shouldn't skip past the explanation.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@components/Button';
import { colors, fonts, withAlpha } from '@theme/tokens';

interface TutorialOverlayProps {
  readonly visible: boolean;
  readonly title: string;
  readonly body: string;
  readonly ctaLabel: string;
  readonly onDismiss: () => void;
  readonly testID?: string;
}

export function TutorialOverlay({
  visible,
  title,
  body,
  ctaLabel,
  onDismiss,
  testID,
}: TutorialOverlayProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      testID={testID}
      accessibilityRole="alert"
    >
      {/* Backdrop is intentionally non-dismissive (CTA only). The
          Pressable still captures presses to prevent input bleed-through
          to the board behind. */}
      <Pressable
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={styles.backdrop}
        onPress={() => {}}
      />
      {/*
        `accessibilityViewIsModal` is on the inner sheet only — putting
        it on the outer wrapper would hide the sibling Skip button
        from RN's accessibility tree (and therefore from
        `getByLabelText` queries in v13+). The sheet itself is the
        modal-equivalent surface; the outer wrapper is just a
        presentation chrome.
      */}
      <View
        style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}
        accessible
        accessibilityViewIsModal
        accessibilityLabel={`${title}. ${body}`}
      >
        <View style={styles.handle} />
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.body}>{body}</Text>
        <Button onPress={onDismiss} size="lg" style={styles.cta}>
          {ctaLabel}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha('#000000', 0.55),
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 14,
    paddingHorizontal: 24,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: colors.borderSubtle,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textDim,
    marginBottom: 18,
    opacity: 0.6,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  body: {
    marginTop: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  cta: {
    marginTop: 20,
  },
});
