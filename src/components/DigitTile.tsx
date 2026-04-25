import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, fonts, withAlpha } from '@theme/tokens';

/** Feedback palette drives DigitTile appearance — one per mode flavour. */
export type DigitTileState = 'neutral' | 'green' | 'yellow' | 'gray' | 'violet' | 'blackout';

interface DigitTileProps {
  /** Single digit 0–9. Renders `—` when `null`/`undefined` (empty slot). */
  readonly digit?: number | null;
  readonly state?: DigitTileState;
  /** Pixel size; the tile is always square. */
  readonly size?: number;
  readonly style?: ViewStyle;
}

interface TilePaint {
  readonly background: string;
  readonly border: string;
  readonly foreground: string;
  readonly glow?: string;
}

const PALETTE: Record<DigitTileState, TilePaint> = {
  neutral: {
    background: colors.bgElevated,
    border: colors.borderSubtle,
    foreground: colors.text,
  },
  green: {
    background: 'rgba(16,185,129,0.18)',
    border: colors.success,
    foreground: '#d1fae5',
    glow: withAlpha(colors.success, 0.55),
  },
  yellow: {
    background: 'rgba(245,158,11,0.2)',
    border: colors.warning,
    foreground: '#fde68a',
    glow: withAlpha(colors.warning, 0.4),
  },
  gray: {
    background: 'rgba(90,90,122,0.2)',
    border: colors.textDim,
    foreground: colors.textDim,
  },
  violet: {
    background: 'rgba(139,92,246,0.15)',
    border: colors.violet,
    foreground: '#ede9fe',
    glow: withAlpha(colors.violet, 0.4),
  },
  blackout: {
    background: 'rgba(31,33,66,0.6)',
    border: '#4c1d95',
    foreground: colors.text,
  },
};

/**
 * Single-digit tile rendered in the secret input, guess timeline, and
 * result reveal. Colour + glow are driven by `state`; `—` is shown
 * when no digit has been filled yet.
 */
export function DigitTile({
  digit,
  state = 'neutral',
  size = 48,
  style,
}: DigitTileProps): React.JSX.Element {
  const paint = PALETTE[state];
  const shadow = paint.glow
    ? Platform.select({
        ios: {
          shadowColor: paint.glow,
          shadowOpacity: 1,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
        },
        android: { elevation: 4 },
        default: {},
      })
    : null;

  return (
    <View
      style={[
        styles.root,
        shadow,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.21),
          backgroundColor: paint.background,
          borderColor: paint.border,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.digit,
          {
            color: paint.foreground,
            fontSize: Math.round(size * 0.48),
          },
        ]}
      >
        {digit == null ? '—' : digit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    fontFamily: fonts.mono,
    fontWeight: '700',
  },
});
