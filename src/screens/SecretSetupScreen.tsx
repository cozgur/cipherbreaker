/**
 * Secret-setup keypad. The local player picks a 4-digit code; the
 * opponent will try to crack it. Validates against the mode's
 * `digitsUnique` rule (Modes 3 + 5 reject repeats) with an inline
 * error so the player sees the constraint *before* trying to lock in.
 *
 * Lock In replaces the stack with Match — back gesture cannot return
 * to setup mid-match (`gestureEnabled: false` on Match also blocks
 * an iOS edge swipe out of Match later).
 *
 * Mode 7 (Mirror) never reaches this screen; `modeRouter` skips it.
 */

import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button } from '@components/Button';
import { DigitKeypad } from '@components/DigitKeypad';
import { DigitTile } from '@components/DigitTile';
import { Screen } from '@components/Screen';
import { TinyTag } from '@components/TinyTag';
import { findMode } from '@data/modeCatalog';
import { modeRegistry } from '@game/modeRegistry';
import { ERROR_NOT_UNIQUE } from '@game/shared/validation';
import type { RootStackParamList } from '@navigation/routes';
import { useMatchStore } from '@state/matchStore';
import { colors, fonts } from '@theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SecretSetup'>;
type RouteParams = RouteProp<RootStackParamList, 'SecretSetup'>;

const SECRET_LENGTH = 4;

export function SecretSetupScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteParams>();
  const insets = useSafeAreaInsets();
  const { modeId, opponentId } = route.params;

  const mode = useMemo(() => findMode(modeId), [modeId]);
  const requiresUnique = mode?.rules.digitsUnique === true;
  const tagLabel = mode != null ? `MODE ${mode.id} · ${mode.meta.name}` : 'MODE';

  const [digits, setDigits] = useState<readonly (number | null)[]>([null, null, null, null]);

  const filledCount = digits.filter((d) => d != null).length;
  const isComplete = filledCount === SECRET_LENGTH;

  const hasUniquenessViolation = useMemo(() => {
    if (!requiresUnique) return false;
    const filled = digits.filter((d): d is number => d != null);
    return new Set(filled).size !== filled.length;
  }, [digits, requiresUnique]);

  const canSubmit = isComplete && !hasUniquenessViolation;

  const handleDigit = useCallback((digit: number): void => {
    setDigits((current) => {
      const nextSlot = current.findIndex((d) => d == null);
      if (nextSlot === -1) return current;
      const updated = [...current];
      updated[nextSlot] = digit;
      return updated;
    });
  }, []);

  const handleBackspace = useCallback((): void => {
    setDigits((current) => {
      const lastFilled = [...current].reverse().findIndex((d) => d != null);
      if (lastFilled === -1) return current;
      const indexToClear = current.length - 1 - lastFilled;
      const updated = [...current];
      updated[indexToClear] = null;
      return updated;
    });
  }, []);

  const handleLockIn = useCallback((): void => {
    if (!canSubmit) return;
    // Engine cutover gate: if the mode is registered with the runtime
    // registry, wire the secret into `matchStore` (engine-driven path).
    // Otherwise fall through to navigation only — Phase 1B's mock
    // timeline + DevResultPicker still runs for unregistered modes.
    // Phase 4-5 will register the remaining modes incrementally; each
    // registration flips the corresponding flow into the engine path
    // without changes here.
    if (modeRegistry.getOrNull(modeId) !== null) {
      const secretStr = digits.map((d) => String(d ?? 0)).join('');
      const store = useMatchStore.getState();
      store.clearMatch();
      store.createMatch(modeId, secretStr);
      store.startMatch();
    }
    navigation.replace('Match', { modeId, opponentId });
  }, [canSubmit, digits, navigation, modeId, opponentId]);

  const handleBack = useCallback((): void => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  }, [navigation]);

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={handleBack}
          style={styles.backChip}
        >
          <Svg width={14} height={14} viewBox="0 0 14 14">
            <Path
              d="M9 3L5 7l4 4"
              stroke={colors.textSecondary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </Pressable>
        <TinyTag>{tagLabel}</TinyTag>
        <View style={styles.spacer} />
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>Choose Your Secret Code</Text>
        <Text style={styles.subtitle}>Your opponent will try to crack this.</Text>
      </View>

      <View style={styles.tiles}>
        {digits.map((digit, index) => (
          <DigitTile
            key={index}
            digit={digit}
            state={digit != null ? 'violet' : 'neutral'}
            size={62}
          />
        ))}
      </View>

      {hasUniquenessViolation ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {ERROR_NOT_UNIQUE}
        </Text>
      ) : null}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <DigitKeypad onDigit={handleDigit} onBackspace={handleBackspace} />
        <Button onPress={handleLockIn} disabled={!canSubmit} size="lg" style={styles.lockButton}>
          Lock In Code
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    gap: 14,
  },
  backChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    width: 36,
  },
  copy: {
    paddingTop: 24,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  tiles: {
    marginTop: 36,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  error: {
    marginTop: 16,
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    letterSpacing: 1.32,
    textTransform: 'uppercase',
    color: colors.danger,
    textAlign: 'center',
  },
  footer: {
    marginTop: 'auto',
    paddingHorizontal: 20,
    gap: 14,
  },
  lockButton: {
    marginTop: 6,
  },
});
