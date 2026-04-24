import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { fonts, withAlpha } from '@theme/tokens';

interface AvatarProps {
  /** Display name; first character is rendered inside the circle. */
  readonly name: string;
  /** Diameter in px. */
  readonly size?: number;
  /** Optional deterministic gradient override. */
  readonly colors?: readonly [string, string];
  readonly style?: ViewStyle;
}

const PALETTE: ReadonlyArray<readonly [string, string]> = [
  ['#a78bfa', '#6d28d9'],
  ['#22d3ee', '#0e7490'],
  ['#f472b6', '#be185d'],
  ['#fbbf24', '#b45309'],
  ['#34d399', '#047857'],
  ['#fb7185', '#be123c'],
  ['#60a5fa', '#1e40af'],
  ['#c084fc', '#7e22ce'],
];

const FALLBACK_GRADIENT: readonly [string, string] = ['#5a5a7a', '#2a2c54'];

function paletteFor(name: string): readonly [string, string] {
  if (name.length === 0) return FALLBACK_GRADIENT;
  let seed = 0;
  for (let i = 0; i < name.length; i += 1) {
    seed += name.charCodeAt(i);
  }
  // Safe with noUncheckedIndexedAccess: seed % PALETTE.length is always in range.
  const picked = PALETTE[seed % PALETTE.length];
  return picked ?? FALLBACK_GRADIENT;
}

function initialFor(name: string): string {
  const first = name.trim()[0];
  return first ? first.toUpperCase() : '?';
}

/**
 * Round gradient avatar with a single glyph. Colour is deterministic
 * from the display name, so the same nickname always paints the same
 * hues across screens.
 */
export function Avatar({
  name,
  size = 40,
  colors: gradientOverride,
  style,
}: AvatarProps): React.JSX.Element {
  const gradient = gradientOverride ?? paletteFor(name);
  const initial = initialFor(name);
  const [, deep] = gradient;

  return (
    <View
      style={[
        styles.shadow,
        style,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          ...Platform.select({
            ios: {
              shadowColor: deep,
              shadowOpacity: 0.5,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 2 },
            },
            android: {
              elevation: 3,
            },
            default: {},
          }),
        },
      ]}
    >
      <LinearGradient
        colors={[gradient[0], gradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.face,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      >
        <Text
          style={[
            styles.initial,
            {
              fontSize: Math.round(size * 0.42),
              textShadowColor: withAlpha('#ffffff', 0.2),
            },
          ]}
          accessibilityLabel={name}
        >
          {initial}
        </Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    alignSelf: 'flex-start',
  },
  face: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: fonts.display,
    fontWeight: '700',
    color: '#ffffff',
  },
});
