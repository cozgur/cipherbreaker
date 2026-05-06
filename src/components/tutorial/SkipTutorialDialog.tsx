/**
 * Phase 7A.6 CP3 — Confirm dialog for the mid-match Skip affordance.
 *
 * Cancel-as-default: visually emphasised + first in the row. Skip is
 * the destructive option (skips ahead in onboarding without learning
 * the mechanic) so it sits second and uses the outline variant.
 *
 * Backdrop tap dismisses to Cancel — accidental dismissal of a confirm
 * dialog should be safe (no progression).
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@components/Button';
import { colors, fonts, withAlpha } from '@theme/tokens';

interface SkipTutorialDialogProps {
  readonly visible: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly testID?: string;
}

export function SkipTutorialDialog({
  visible,
  onCancel,
  onConfirm,
  testID,
}: SkipTutorialDialogProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      testID={testID}
      accessibilityViewIsModal
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel skip tutorial"
        style={styles.backdrop}
        onPress={onCancel}
      />
      <View style={[styles.shell, { paddingTop: insets.top + 80 }]} pointerEvents="box-none">
        <View style={styles.card} accessibilityRole="alert">
          <Text style={styles.title} accessibilityRole="header">
            Skip tutorial match?
          </Text>
          <Text style={styles.body}>You&apos;ll continue to the next step of onboarding.</Text>
          <View style={styles.row}>
            <Button onPress={onCancel} size="md" style={styles.cancel}>
              Cancel
            </Button>
            <Button onPress={onConfirm} variant="outline" size="md" style={styles.confirm}>
              Skip
            </Button>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha('#000000', 0.6),
  },
  shell: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    paddingVertical: 22,
    paddingHorizontal: 22,
    backgroundColor: colors.bgElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.text,
    letterSpacing: -0.3,
  },
  body: {
    marginTop: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  row: {
    marginTop: 22,
    flexDirection: 'row',
    gap: 10,
  },
  cancel: {
    flex: 1.2,
  },
  confirm: {
    flex: 1,
  },
});
