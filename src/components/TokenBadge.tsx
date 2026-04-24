import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, withAlpha } from '@theme/tokens';
import { fonts } from '@theme/tokens';
import { TokenCoin } from './TokenCoin';

export type TokenBadgeSize = 'sm' | 'md' | 'lg';

interface TokenBadgeProps {
  /** Display amount — pre-formatted (e.g. `"1,840"`). */
  readonly amount: number | string;
  readonly size?: TokenBadgeSize;
  readonly style?: ViewStyle;
}

interface SizeSpec {
  readonly paddingVertical: number;
  readonly paddingHorizontal: number;
  readonly fontSize: number;
  readonly coin: number;
}

const SIZE_SPEC: Record<TokenBadgeSize, SizeSpec> = {
  sm: { paddingVertical: 4, paddingHorizontal: 10, fontSize: 12, coin: 14 },
  md: { paddingVertical: 5, paddingHorizontal: 12, fontSize: 14, coin: 16 },
  lg: { paddingVertical: 8, paddingHorizontal: 16, fontSize: 18, coin: 20 },
};

/**
 * Gold pill with the C-coin glyph and a monospace amount. Rendered
 * across Home (top-right wallet), Shop (header), Result (reward).
 */
export function TokenBadge({
  amount,
  size = 'md',
  style,
}: TokenBadgeProps): React.JSX.Element {
  const spec = SIZE_SPEC[size];
  return (
    <View style={[styles.shadow, style]}>
      <LinearGradient
        colors={['rgba(251,191,36,0.15)', 'rgba(217,119,6,0.08)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[
          styles.pill,
          {
            paddingVertical: spec.paddingVertical,
            paddingHorizontal: spec.paddingHorizontal,
          },
        ]}
      >
        <TokenCoin size={spec.coin} />
        <Text style={[styles.amount, { fontSize: spec.fontSize }]}>{amount}</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    ...Platform.select({
      ios: {
        shadowColor: colors.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 14,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.45),
  },
  amount: {
    fontFamily: fonts.mono,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 0.28,
  },
});
