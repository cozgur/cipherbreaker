import type { ReactNode } from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';

import { colors } from '@theme/tokens';
import { typography } from '@theme/typography';

interface SectionLabelProps {
  readonly children: ReactNode;
  readonly color?: string;
  readonly style?: TextStyle;
}

/**
 * Tiny uppercase heading used above mode lists, settings groups, and
 * stat grids. Slightly looser tracking than `TinyTag`.
 */
export function SectionLabel({
  children,
  color = colors.textSecondary,
  style,
}: SectionLabelProps): React.JSX.Element {
  return <Text style={[styles.label, { color }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    ...typography.tiny,
    fontSize: 11,
    letterSpacing: 1.54,
  },
});
