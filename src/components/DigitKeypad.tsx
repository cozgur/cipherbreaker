import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, fonts } from '@theme/tokens';

interface DigitKeypadProps {
  /** Called with `0-9` for digit taps. */
  readonly onDigit: (digit: number) => void;
  readonly onBackspace: () => void;
  /** When set, every key ignores taps and dims. */
  readonly disabled?: boolean;
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
}: DigitKeypadProps): React.JSX.Element {
  return (
    <View style={[styles.grid, disabled && styles.disabled]} accessibilityRole="keyboardkey">
      {DIGIT_ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((digit) => (
            <DigitKey
              key={digit}
              label={String(digit)}
              onPress={() => onDigit(digit)}
              disabled={disabled}
            />
          ))}
        </View>
      ))}
      <View style={styles.row}>
        <View style={styles.keySlot} />
        <DigitKey label="0" onPress={() => onDigit(0)} disabled={disabled} />
        <DigitKey
          onPress={onBackspace}
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
}

function DigitKey({ label, icon, onPress, disabled }: DigitKeyProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? 'Delete digit'}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.keySlot,
        styles.key,
        pressed && !disabled ? styles.keyPressed : null,
      ]}
    >
      {icon ?? <Text style={styles.keyLabel}>{label}</Text>}
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
});
