import type { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, fonts, withAlpha } from '@theme/tokens';

export type ButtonVariant = 'primary' | 'cyan' | 'outline';
export type ButtonSize = 'md' | 'lg';

interface ButtonProps {
  readonly children: ReactNode;
  readonly onPress?: () => void;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  /** Optional leading glyph (SVG element). */
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
  readonly fullWidth?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

interface VariantPaint {
  readonly gradient?: readonly [string, string];
  readonly background?: string;
  readonly border?: string;
  readonly foreground: string;
  readonly shadow?: string;
}

const VARIANT: Record<ButtonVariant, VariantPaint> = {
  primary: {
    gradient: [colors.violet, colors.violetDeep],
    border: withAlpha(colors.violet, 0.8),
    foreground: '#ffffff',
    shadow: withAlpha(colors.violet, 0.45),
  },
  cyan: {
    gradient: [colors.cyan, colors.cyanDeep],
    foreground: '#ffffff',
    shadow: withAlpha(colors.cyan, 0.4),
  },
  outline: {
    background: 'transparent',
    border: colors.borderSubtle,
    foreground: colors.text,
  },
};

const SIZE: Record<
  ButtonSize,
  { readonly height: number; readonly fontSize: number; readonly padding: number }
> = {
  md: { height: 50, fontSize: 14, padding: 22 },
  lg: { height: 56, fontSize: 15, padding: 24 },
};

/**
 * Gradient-backed pill CTA. Only the three variants actually used in
 * reference/ are shipped — primary (violet), cyan (Watch Ad), and
 * outline (secondary / "Home"). Additional variants should be
 * introduced alongside a real call site.
 */
export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  fullWidth = true,
  style,
}: ButtonProps): React.JSX.Element {
  const paint = VARIANT[variant];
  const spec = SIZE[size];

  const shadowStyle = paint.shadow
    ? Platform.select({
        ios: {
          shadowColor: paint.shadow,
          shadowOpacity: 1,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 4 },
        },
        android: { elevation: 6 },
        default: {},
      })
    : null;

  const content = (
    <View style={styles.content}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text
        style={[styles.label, { color: paint.foreground, fontSize: spec.fontSize }]}
        numberOfLines={1}
      >
        {children}
      </Text>
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.root,
        shadowStyle,
        fullWidth ? styles.fullWidth : null,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}
    >
      {paint.gradient ? (
        <LinearGradient
          colors={[paint.gradient[0], paint.gradient[1]]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[
            styles.surface,
            {
              height: spec.height,
              paddingHorizontal: spec.padding,
              borderColor: paint.border ?? 'transparent',
              borderWidth: paint.border ? 1 : 0,
            },
          ]}
        >
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.surface,
            {
              height: spec.height,
              paddingHorizontal: spec.padding,
              backgroundColor: paint.background ?? 'transparent',
              borderColor: paint.border ?? 'transparent',
              borderWidth: paint.border ? 1 : 0,
            },
          ]}
        >
          {content}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: 16,
    alignSelf: 'stretch',
    overflow: 'visible',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  surface: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.bodySemibold,
    fontWeight: '600',
    letterSpacing: 1.12,
    textTransform: 'uppercase',
  },
});
