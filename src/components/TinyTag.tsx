import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, withAlpha } from '@theme/tokens';
import { typography } from '@theme/typography';

interface TinyTagProps {
  readonly children: ReactNode;
  /** Text / border / wash colour. Defaults to the app violet. */
  readonly color?: string;
  readonly style?: ViewStyle;
}

/**
 * Uppercase pill used for mode badges ("PRESTIGE", "TIMED"), section
 * labels, and match-state callouts. Wash is derived from `color` at
 * 12% alpha; border at 35%.
 */
export function TinyTag({
  children,
  color = colors.violet,
  style,
}: TinyTagProps): React.JSX.Element {
  return (
    <View
      style={[
        styles.root,
        { backgroundColor: withAlpha(color, 0.12), borderColor: withAlpha(color, 0.35) },
        style,
      ]}
    >
      <Text style={[styles.label, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  label: {
    ...typography.tiny,
    fontSize: 10,
    letterSpacing: 1.2,
  },
});
