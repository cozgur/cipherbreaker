/**
 * Neo-Noir Casino Arcade design tokens.
 * Single source of truth for colors, font families, elevation, radii.
 * Derived from reference/tokens.jsx + specs/CipherBreaker-DESIGN-PROMPT.md.
 */

export const colors = {
  // base
  bgBase: '#0a0b1e',
  bgElevated: '#15172e',
  bgOverlay: '#1f2142',

  // accents
  violet: '#8b5cf6',
  violetDeep: '#6d28d9',
  cyan: '#06b6d4',
  cyanDeep: '#0891b2',
  pink: '#ec4899',

  // currency
  gold: '#fbbf24',
  goldDeep: '#d97706',
  goldGlow: 'rgba(251,191,36,0.4)',

  // semantic
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',

  // text
  text: '#f5f5f7',
  textSecondary: '#a1a1b5',
  textDim: '#5a5a7a',

  // border
  borderSubtle: '#2a2c54',
  borderBright: '#8b5cf6',
} as const;

export type ColorToken = keyof typeof colors;

export const fonts = {
  display: 'ChakraPetch-Bold',
  body: 'Inter-Regular',
  bodyMedium: 'Inter-Medium',
  bodySemibold: 'Inter-SemiBold',
  mono: 'JetBrainsMono-Bold',
} as const;

export type FontToken = keyof typeof fonts;

export const radii = {
  tight: 8,
  default: 16,
  loose: 24,
  pill: 999,
} as const;

export const elevation = {
  low: {
    shadowColor: colors.violet,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  medium: {
    shadowColor: colors.violet,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 4,
  },
  high: {
    shadowColor: colors.violet,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 40,
    elevation: 8,
  },
  gold: {
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 6,
  },
} as const;

export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
