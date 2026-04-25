import { useMemo } from 'react';
import Svg, { Circle, Defs, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

interface TokenCoinProps {
  /** Pixel diameter. */
  readonly size?: number;
}

let uidCounter = 0;

/**
 * Circular gold coin icon with a centred "C" glyph. The inner gradient
 * id is hashed per-instance so two coins on the same screen can't
 * collide in the SVG `<defs>` namespace.
 */
export function TokenCoin({ size = 16 }: TokenCoinProps): React.JSX.Element {
  const gradientId = useMemo(() => `cb-coin-${++uidCounter}`, []);

  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Defs>
        <RadialGradient id={gradientId} cx="35%" cy="30%" rx="70%" ry="70%">
          <Stop offset="0%" stopColor="#fde68a" />
          <Stop offset="60%" stopColor="#fbbf24" />
          <Stop offset="100%" stopColor="#b45309" />
        </RadialGradient>
      </Defs>
      <Circle
        cx="10"
        cy="10"
        r="9"
        fill={`url(#${gradientId})`}
        stroke="#78350f"
        strokeWidth="0.6"
      />
      <Circle
        cx="10"
        cy="10"
        r="6.5"
        fill="none"
        stroke="#78350f"
        strokeWidth="0.6"
        opacity="0.5"
      />
      <SvgText
        x="10"
        y="13.5"
        textAnchor="middle"
        fontFamily="ChakraPetch-Bold"
        fontSize={8.5}
        fontWeight="900"
        fill="#78350f"
      >
        C
      </SvgText>
    </Svg>
  );
}
