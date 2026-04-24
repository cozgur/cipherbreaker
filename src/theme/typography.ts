/**
 * Type scale — DESIGN-PROMPT §Typography.
 * Each entry returns a style object consumable by <Text style={...}>.
 */

import type { TextStyle } from 'react-native';

import { fonts } from './tokens';

export const typography = {
  displayXL: {
    fontFamily: fonts.display,
    fontSize: 48,
    letterSpacing: -0.96,
  },
  displayL: {
    fontFamily: fonts.display,
    fontSize: 32,
    letterSpacing: -0.64,
  },
  displayM: {
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: -0.48,
  },
  bodyL: {
    fontFamily: fonts.bodyMedium,
    fontSize: 17,
  },
  bodyM: {
    fontFamily: fonts.body,
    fontSize: 15,
  },
  bodyS: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  tiny: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.32,
    textTransform: 'uppercase',
  },
  digitL: {
    fontFamily: fonts.mono,
    fontSize: 40,
  },
  digitM: {
    fontFamily: fonts.mono,
    fontSize: 28,
  },
  digitS: {
    fontFamily: fonts.mono,
    fontSize: 17,
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;
