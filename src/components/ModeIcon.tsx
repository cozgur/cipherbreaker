import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';

import type { ModeIconKey } from '@game/types';

interface ModeIconProps {
  readonly iconKey: ModeIconKey;
  readonly size?: number;
}

/**
 * SVG dispatch for the small icon painted on the mode card's gradient
 * disc. Every mode has a bespoke glyph — no shared Lucide here — and
 * the switch is exhaustive so adding a new mode breaks the build
 * until an icon is provided.
 */
export function ModeIcon({ iconKey, size = 44 }: ModeIconProps): React.JSX.Element {
  switch (iconKey) {
    case 'color-match':
      return (
        <Svg width={size} height={size} viewBox="0 0 44 44">
          <Circle cx="14" cy="22" r="9" fill="#10b981" />
          <Circle cx="22" cy="22" r="9" fill="#f59e0b" />
          <Circle cx="30" cy="22" r="9" fill="#5a5a7a" opacity="0.85" />
        </Svg>
      );
    case 'high-low':
      return (
        <Svg width={size} height={size} viewBox="0 0 44 44">
          <Path d="M22 8l-7 7h14l-7-7z" fill="#fff" />
          <Path d="M22 36l7-7H15l7 7z" fill="#fff" />
        </Svg>
      );
    case 'precision':
      return (
        <Svg width={size} height={size} viewBox="0 0 44 44">
          <Path d="M10 15h10M15 10v10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <Path d="M24 29h10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </Svg>
      );
    case 'blitz':
      return (
        <Svg width={size} height={size} viewBox="0 0 44 44">
          <Circle cx="22" cy="24" r="12" fill="none" stroke="#fff" strokeWidth="2.2" />
          <Path
            d="M22 17v7l4 3"
            fill="none"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M18 8h8M22 8v4"
            fill="none"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'blackout':
      return (
        <Svg width={size} height={size} viewBox="0 0 44 44">
          <Path
            d="M22 14c-6 0-11 8-11 8s5 8 11 8 11-8 11-8-5-8-11-8z"
            fill="none"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="22" cy="22" r="3.2" fill="#fff" />
          <Path d="M10 10l24 24" stroke="#fff" strokeWidth="2.5" />
        </Svg>
      );
    case 'sudden-death':
      return (
        <Svg width={size} height={size} viewBox="0 0 44 44">
          <Circle cx="22" cy="22" r="13" fill="none" stroke="#fff" strokeWidth="2.2" />
          <SvgText
            x="22"
            y="28"
            textAnchor="middle"
            fontFamily="ChakraPetch-Bold"
            fontSize={17}
            fontWeight="900"
            fill="#fff"
          >
            5
          </SvgText>
        </Svg>
      );
    case 'mirror':
      return (
        <Svg width={size} height={size} viewBox="0 0 44 44">
          <G
            stroke="#fff"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <Path d="M8 14h20l-4-4M8 14l4 4" />
            <Path d="M36 30H16l4-4M36 30l-4 4" />
          </G>
        </Svg>
      );
    default: {
      const exhaustiveCheck: never = iconKey;
      throw new Error(`ModeIcon: unsupported iconKey ${exhaustiveCheck as string}`);
    }
  }
}
