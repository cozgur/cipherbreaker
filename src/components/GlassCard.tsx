import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

import { withAlpha } from '@theme/tokens';

interface GlassCardProps {
  readonly children: ReactNode;
  /** Inner padding. Default 24 tracks reference/. */
  readonly padding?: number;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * Blurred translucent sheet used for modals (InsufficientTokens) and
 * the matchmaking opponent reveal. Falls back gracefully on Android
 * where `BlurView` maps to a translucent colour tint.
 */
export function GlassCard({
  children,
  padding = 24,
  style,
}: GlassCardProps): React.JSX.Element {
  return (
    <View style={[styles.shadow, style]}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 40 : 20}
        tint="dark"
        style={styles.surface}
      >
        <View style={[styles.inner, { padding }]}>{children}</View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.5,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 20 },
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  surface: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  inner: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: withAlpha('#ffffff', 0.08),
    backgroundColor: 'rgba(31,33,66,0.6)',
  },
});
