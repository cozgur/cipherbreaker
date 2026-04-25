/**
 * Username-edit sheet rendered as a `transparentModal` route so the
 * Profile screen stays dimmed behind it. Phase 1B intentionally
 * skips validation (length, uniqueness) — those land in Phase 7A
 * with the real account service. Save trims whitespace, blocks an
 * empty result, and closes; Cancel discards.
 */

import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button } from '@components/Button';
import { GlassCard } from '@components/GlassCard';
import { mockUser, setUsername } from '@data/mockUser';
import type { RootStackParamList } from '@navigation/routes';
import { colors, fonts } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ChangeUsername'>;

export function ChangeUsernameModal(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const [value, setValue] = useState<string>(mockUser.username);

  const close = useCallback(() => navigation.goBack(), [navigation]);

  const save = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    setUsername(trimmed);
    navigation.goBack();
  }, [navigation, value]);

  const canSave = value.trim().length > 0 && value.trim() !== mockUser.username;

  return (
    <View style={styles.root}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheet}
      >
        <GlassCard padding={24} style={styles.card}>
          <Text style={styles.title}>Change Username</Text>
          <Text style={styles.hint}>How other codebreakers see you.</Text>

          <TextInput
            accessibilityLabel="Username"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            maxLength={20}
            onChangeText={setValue}
            placeholder="nova_code"
            placeholderTextColor={colors.textDim}
            returnKeyType="done"
            onSubmitEditing={save}
            style={styles.input}
            value={value}
          />

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={close}
              style={({ pressed }) => [styles.cancel, pressed && styles.cancelPressed]}
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
            <Button onPress={save} disabled={!canSave} style={styles.save}>
              Save
            </Button>
          </View>
        </GlassCard>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(10,11,30,0.55)',
  },
  sheet: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    // GlassCard manages its own background; we just pass layout hooks.
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
    letterSpacing: -0.3,
  },
  hint: {
    marginTop: 6,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  input: {
    marginTop: 18,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 14,
    color: colors.text,
    fontFamily: fonts.mono,
    fontSize: 16,
  },
  actions: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 12,
  },
  cancel: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPressed: {
    opacity: 0.6,
  },
  cancelLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  save: {
    flex: 1.2,
  },
});
