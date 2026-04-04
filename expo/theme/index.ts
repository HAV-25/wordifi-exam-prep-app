/**
 * WORDIFI — Theme
 * Single import point for all design tokens.
 *
 * Usage:
 *   import { colors, textStyles, spacing, radius, shadows, motion, constants } from '@/theme';
 *
 * NEVER import from individual theme files directly in components.
 * Always import from this barrel so the path is always '@/theme'.
 */

export * from './colors';
export * from './typography';
export * from './spacing';
export * from './motion';
export * from './constants';

// ─── Convenience re-export of the full theme object ──────────────────────────
import { colors } from './colors';
import { fontFamily, fontSize, fontWeight, lineHeight, textStyles } from './typography';
import { spacing, layout, radius, shadows, screen, zones, touchTargets, zIndex, componentSizes } from './spacing';
import * as motion from './motion';
import * as constants from './constants';

export const theme = {
  colors,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  textStyles,
  spacing,
  layout,
  radius,
  shadows,
  screen,
  zones,
  touchTargets,
  zIndex,
  componentSizes,
  motion,
  constants,
} as const;

export type Theme = typeof theme;
