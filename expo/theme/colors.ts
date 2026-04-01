/**
 * WORDIFI — Colour System
 * Source of truth: Google Stitch project 17418085725444489838
 *
 * RULES:
 * - German flag palette (flag*) ONLY used as abstract decorative elements
 *   on Splash and Question screens. Never for UI, text, or backgrounds.
 * - Never hardcode hex values anywhere in the app — import from here.
 * - No 1px solid borders. Use surface color shifts or outlineVariant at 10–20% opacity.
 */

export const colors = {
  // ─── Primary ────────────────────────────────────────────────────────────────
  primary:          '#0057CD',   // Base primary — gradients, active states
  primaryContainer: '#2B70EF',   // Gradient end for CTAs (also: blue alias)
  onPrimary:        '#FFFFFF',   // Text on primary surfaces
  onPrimaryContainer: '#000415', // Deep navy — "Power Moment" text on primary-container

  // Convenience alias — keeps existing components working
  navy: '#0A0E1A',   // Neutral override — deep dark canvas, status bars
  blue: '#2B70EF',   // primaryContainer alias — CTAs, active states

  // ─── Secondary ──────────────────────────────────────────────────────────────
  secondary:          '#006B54',
  secondaryContainer: '#42FECD', // "Soul" reveal / success full-bleed backgrounds
  secondaryFixed:     '#42FECD', // Teal Highlight — progress bar glow
  secondaryFixedDim:  '#00E0B2',
  onSecondary:        '#FFFFFF',
  onSecondaryContainer: '#007259',

  // Convenience alias
  teal: '#00E5B6',   // Secondary override alias — score ring, highlights

  // ─── Tertiary ───────────────────────────────────────────────────────────────
  tertiary:          '#745B00',
  tertiaryContainer: '#D0A600',
  tertiaryFixed:     '#FFE08B', // Confetti / micro-interactions ONLY — never structural UI
  tertiaryFixedDim:  '#F1C100',
  onTertiary:        '#FFFFFF',
  onTertiaryContainer: '#4F3E00',

  // ─── Surface Hierarchy ──────────────────────────────────────────────────────
  // Layer order: background → surfaceContainerLow → surfaceContainerLowest
  background:              '#FAF8FF', // Warm off-white canvas base
  surface:                 '#FAF8FF', // Default surface (same as background)
  surfaceBright:           '#FAF8FF',
  surfaceDim:              '#D6D9EB',
  surfaceVariant:          '#DFE2F3',
  surfaceContainerLowest:  '#FFFFFF', // Cards, input field backgrounds
  surfaceContainerLow:     '#F2F3FF', // Secondary content grouping sections
  surfaceContainer:        '#EAEDFF', // Mid-level grouping
  surfaceContainerHigh:    '#E5E7F9', // Elevated containers
  surfaceContainerHighest: '#DFE2F3', // Interactive elements that pop
  onSurface:               '#171B28', // Primary text
  onSurfaceVariant:        '#424654', // Body copy — use this, never dark navy
  inverseSurface:          '#2C303D',
  inverseOnSurface:        '#EEF0FF',
  inversePrimary:          '#B1C5FF',
  surfaceTint:             '#0057CE',

  // Convenience aliases for existing components
  white: '#FFFFFF',   // surfaceContainerLowest alias
  text:  '#171B28',   // onSurface alias
  muted: '#424654',   // onSurfaceVariant alias

  // ─── Outline ────────────────────────────────────────────────────────────────
  // Ghost borders only — use outlineVariant at 10–20% opacity. Never 1px solid.
  outline:        '#737786',
  outlineVariant: '#C2C6D7',

  // Legacy alias — kept for backward compatibility (maps to outlineVariant)
  border: '#C2C6D7',

  // ─── Semantic Palette ───────────────────────────────────────────────────────
  green: '#14B86A',   // Correct answer, success states
  red:   '#E24D4D',   // Wrong answer, error states
  amber: '#F4B942',   // Warning, amber preparedness state

  // ─── Preparedness Gauge ─────────────────────────────────────────────────────
  gaugeRed:   '#E24D4D',   // < 40%
  gaugeAmber: '#F4B942',   // 40–69%
  gaugeGreen: '#14B86A',   // ≥ 70%

  // ─── Error ──────────────────────────────────────────────────────────────────
  error:          '#BA1A1A',
  errorContainer: '#FFDAD6',
  onError:        '#FFFFFF',

  // ─── German Flag Palette — DECORATIVE ONLY ──────────────────────────────────
  // These appear ONLY as abstract confetti/badge elements on Splash + Question screens.
  // NEVER use for UI components, text, backgrounds, or functional elements.
  flagBlack: 'rgba(45, 45, 45, 0.12)',
  flagRed:   'rgba(221, 0, 0, 0.25)',
  flagGold:  'rgba(245, 196, 0, 0.35)',

  // Solid flag stripe values — used only in GermanFlagBadge component
  flagStripeBlack: '#2D2D2D',
  flagStripeRed:   '#DD0000',
  flagStripeGold:  '#F5C400',

  // ─── Overlay & Glass ────────────────────────────────────────────────────────
  overlayDark:     'rgba(0, 0, 0, 0.5)',
  glassShine:      'rgba(255, 255, 255, 0.07)',
  glassShineLight: 'rgba(255, 255, 255, 0.08)',
  blueShadow:      'rgba(0, 87, 205, 0.35)',    // CTA button glow (primary color)
  progressTrack:   'rgba(255, 255, 255, 0.22)', // Progress bar track on blue bg

  // ─── Score Ring ─────────────────────────────────────────────────────────────
  ringTrack: '#ECF2FE',
} as const;

export type ColorKey = keyof typeof colors;
