import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import * as haptics from '@/lib/haptics';
import { colors, fonts, withAlpha } from '@theme/tokens';

/**
 * Per-digit visual indicator. Phase 7A.4 CP6 introduced the seam
 * for Daily Challenge — `'positive'` flags digits the player has
 * paid to confirm exist (Hint A yellow + Hint B exists), `'negative'`
 * strikethroughs digits Hint B confirmed are NOT in the secret.
 *
 * Optional + screen-driven. SecretSetup + Mode 1-7 paths leave it
 * undefined and the keypad renders neutral.
 */
export type DigitKeypadIndicator = 'positive' | 'negative';

interface DigitKeypadProps {
  /** Called with `0-9` for digit taps. */
  readonly onDigit: (digit: number) => void;
  readonly onBackspace: () => void;
  /** When set, every key ignores taps and dims. */
  readonly disabled?: boolean;
  /**
   * Per-digit visual indicator overlay. Map from `0..9` to either
   * `'positive'` (green dot — digit exists in secret) or
   * `'negative'` (strikethrough — digit confirmed absent). Omitted
   * digits render neutral.
   *
   * Tap behaviour is unchanged — `'negative'` digits are still
   * tappable so the player can still type a guess containing the
   * absent digit (a wrong guess but a legitimate input).
   */
  readonly indicators?: Readonly<Record<number, DigitKeypadIndicator>>;
}

const DIGIT_ROWS: readonly (readonly number[])[] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

/**
 * 3×4 numeric keypad used on Secret Setup + Match input rows. Layout:
 * digits 1-9, an empty placeholder, 0, backspace. Every key is a
 * `Pressable` so hit-slop and ripple come for free.
 */
export function DigitKeypad({
  onDigit,
  onBackspace,
  disabled = false,
  indicators,
}: DigitKeypadProps): React.JSX.Element {
  return (
    <View style={[styles.grid, disabled && styles.disabled]} accessibilityRole="keyboardkey">
      {DIGIT_ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((digit) => (
            <DigitKey
              key={digit}
              label={String(digit)}
              onPress={() => {
                haptics.selection();
                onDigit(digit);
              }}
              disabled={disabled}
              indicator={indicators?.[digit]}
            />
          ))}
        </View>
      ))}
      <View style={styles.row}>
        <View style={styles.keySlot} />
        <DigitKey
          label="0"
          onPress={() => {
            haptics.selection();
            onDigit(0);
          }}
          disabled={disabled}
          indicator={indicators?.[0]}
        />
        <DigitKey
          onPress={() => {
            haptics.selection();
            onBackspace();
          }}
          disabled={disabled}
          icon={
            <Svg width="22" height="16" viewBox="0 0 22 16">
              <Path
                d="M7 1h13a2 2 0 012 2v10a2 2 0 01-2 2H7l-6-7 6-7z"
                stroke={colors.textSecondary}
                strokeWidth="1.8"
                fill="none"
              />
              <Path d="M11 5l6 6M17 5l-6 6" stroke={colors.textSecondary} strokeWidth="1.8" />
            </Svg>
          }
        />
      </View>
    </View>
  );
}

interface DigitKeyProps {
  readonly label?: string;
  readonly icon?: React.JSX.Element;
  readonly onPress: () => void;
  readonly disabled: boolean;
  readonly indicator?: DigitKeypadIndicator;
}

function DigitKey({ label, icon, onPress, disabled, indicator }: DigitKeyProps): React.JSX.Element {
  const a11ySuffix =
    indicator === 'positive'
      ? ' (in secret)'
      : indicator === 'negative'
        ? ' (not in secret)'
        : '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={(label ?? 'Delete digit') + a11ySuffix}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.keySlot,
        styles.key,
        indicator === 'positive' && styles.keyPositive,
        indicator === 'negative' && styles.keyNegative,
        pressed && !disabled ? styles.keyPressed : null,
      ]}
    >
      {icon ?? (
        <Text
          style={[
            styles.keyLabel,
            indicator === 'negative' && styles.keyLabelNegative,
          ]}
        >
          {label}
        </Text>
      )}
      {indicator === 'positive' ? <View style={styles.positiveDot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: 10,
  },
  disabled: {
    opacity: 0.45,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  keySlot: {
    flex: 1,
    height: 52,
  },
  key: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  keyPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
  keyLabel: {
    fontFamily: fonts.mono,
    fontWeight: '700',
    fontSize: 22,
    color: colors.text,
  },
  keyPositive: {
    backgroundColor: withAlpha(colors.success, 0.12),
    borderColor: withAlpha(colors.success, 0.45),
  },
  keyNegative: {
    backgroundColor: withAlpha(colors.danger, 0.06),
    borderColor: withAlpha(colors.danger, 0.28),
  },
  keyLabelNegative: {
    color: withAlpha(colors.text, 0.4),
    textDecorationLine: 'line-through',
  },
  positiveDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.success,
  },
});
