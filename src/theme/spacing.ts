/**
 * 4px-base spacing scale. Use these literals across screens/components
 * instead of raw numbers so layout stays consistent.
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  xxxxl: 64,
} as const;

export type SpacingToken = keyof typeof spacing;
