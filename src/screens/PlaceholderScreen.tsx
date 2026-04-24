import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@theme/index';

/**
 * Faz 0 smoke test — neo-noir dark background + Chakra Petch title with glow.
 * Replaced in Faz 1 by the real screen set.
 */
export function PlaceholderScreen(): React.JSX.Element {
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.title} accessibilityRole="header">
            CipherBreaker
          </Text>
          <Text style={styles.subtitle}>Phase 0 · dev stack ready</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  safe: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  title: {
    ...typography.displayL,
    color: colors.text,
    textAlign: 'center',
    textShadowColor: colors.violet,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  subtitle: {
    ...typography.tiny,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
