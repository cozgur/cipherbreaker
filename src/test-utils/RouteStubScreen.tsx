/**
 * Test-only stand-in. The production navigator wires every route to
 * a real screen as of Phase 1B Checkpoint 3. Tests still need a
 * passive component to fill auxiliary routes — so navigation can
 * `replace`/`navigate` without crashing while the test only cares
 * about the focused screen. Not consumed by production code; lives
 * under `src/test-utils/` so no app bundle ever imports it.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';

import { Screen } from '@components/Screen';
import { colors, fonts } from '@theme/tokens';

export function RouteStubScreen(): React.JSX.Element {
  const route = useRoute();
  const insets = useSafeAreaInsets();
  return (
    <Screen>
      <View
        style={[styles.center, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
      >
        <Text style={styles.label}>ROUTE STUB</Text>
        <Text style={styles.name}>{route.name}</Text>
        <Text style={styles.hint}>Lands in Phase 1B · Checkpoint 2/3</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  label: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.text,
    letterSpacing: -0.6,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textDim,
  },
});
