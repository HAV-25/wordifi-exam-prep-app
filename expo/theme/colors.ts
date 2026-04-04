/**
 * WORDIFI — Colour System
 * Master source: Wordifi Brand Brief (Wordifi_Stitch_Doc1_Base_Brief.docx)
 *
 * RULES:
 * - Never hardcode hex values anywhere in the app — import from here.
 * - No 1px solid borders. Use surface colour shifts or cardBorder/outlineVariant at low opacity.
 * - German flag palette (flag*) ONLY used as abstract decorative confetti — never for UI.
 * - CTAs use flat primaryBlue (#2B70EF) — no gradients.
 * - Body copy always uses bodyText (#374151 Mid Gray) — never dark navy.
 */

export const colors = {
  // ─── Brand Colours (Master Brief) ───────────────────────────────────────────
  primaryBlue:   '#2B70EF',  // CTA buttons, progress elements, question screen headers
  accentTeal:    '#00E5B6',  // Success states, celebration, one highlight word — sparingly
  bodyBackground:'#F8FAFF',  // Base of every light screen — never pure white
  darkNavy:      '#0A0E1A',  // Full-bleed hero screens + headline text on light screens
  midGray:       '#374151',  // Body copy on all light screens
  mutedGray:     '#9CA3AF',  // Hints, micro-copy, placeholder text
  flagGold:      '#F5C400',  // Confetti accents in header zone only — never UI
  flagRed:       '#DD0000',  // Confetti accents in header zone only — never UI
  white:         '#FFFFFF',  // Cards, input fields, modal surfaces
  cardBorder:    '#E5E7EB',  // Default answer card border

  // ─── Semantic Aliases (maps to Brand Colours above) ─────────────────────────
  // These keep existing components working without requiring mass rename.
  primary:       '#2B70EF',  // = primaryBlue
  blue:          '#2B70EF',  // = primaryBlue
  teal:          '#00E5B6',  // = accentTeal
  navy:          '#0A0E1A',  // = darkNavy
  background:    '#F8FAFF',  // = bodyBackground
  surface:       '#F8FAFF',  // = bodyBackground
  text:          '#0A0E1A',  // = darkNavy — for headlines on light screens
  bodyText:      '#374151',  // = midGray — for body copy
  muted:         '#9CA3AF',  // = mutedGray
  border:        '#E5E7EB',  // = cardBorder
  outlineVariant:'#E5E7EB',  // = cardBorder (ghost border use only)

  // ─── Surface Hierarchy ──────────────────────────────────────────────────────
  surfaceBright:           '#F8FAFF',
  surfaceDim:              '#D6D9EB',
  surfaceVariant:          '#DFE2F3',
  surfaceContainerLowest:  '#FFFFFF',  // Cards, input fields
  surfaceContainerLow:     '#F2F4FF',  // Secondary content grouping
  surfaceContainer:        '#EEF3FD',  // Soft selected/tinted bg (answer card selected)
  surfaceContainerHigh:    '#E5E7EB',  // Elevated containers
  surfaceContainerHighest: '#DFE2F3',
  onSurface:               '#0A0E1A',  // = darkNavy — headline text
  onSurfaceVariant:        '#374151',  // = midGray — body text (updated from #424654)
  inverseSurface:          '#2C303D',
  inverseOnSurface:        '#EEF0FF',
  inversePrimary:          '#B1C5FF',
  surfaceTint:             '#2B70EF',  // = primaryBlue

  // ─── Legacy MD3 Tokens (kept for backward compat — gradual migration) ────────
  primaryContainer:  '#2B70EF',  // = primaryBlue
  onPrimary:         '#FFFFFF',
  onPrimaryContainer: '#0A0E1A', // = darkNavy
  secondary:          '#006B54',
  secondaryContainer: '#42FECD',
  secondaryFixed:     '#42FECD',
  secondaryFixedDim:  '#00E0B2',
  onSecondary:        '#FFFFFF',
  onSecondaryContainer: '#007259',
  tertiary:           '#745B00',
  tertiaryContainer:  '#D0A600',
  tertiaryFixed:      '#FFE08B',
  tertiaryFixedDim:   '#F1C100',
  onTertiary:         '#FFFFFF',
  onTertiaryContainer:'#4F3E00',

  // ─── Outline ────────────────────────────────────────────────────────────────
  outline: '#737786',

  // ─── Semantic States ────────────────────────────────────────────────────────
  green: '#14B86A',   // Success — used in score ring gradient end, gauge
  red:   '#EF4444',   // Error/incorrect
  amber: '#F4B942',   // Warning

  // ─── Preparedness Gauge ─────────────────────────────────────────────────────
  gaugeRed:   '#EF4444',   // < 40%
  gaugeAmber: '#F4B942',   // 40–69%
  gaugeGreen: '#14B86A',   // ≥ 70%

  // ─── Error ──────────────────────────────────────────────────────────────────
  error:          '#BA1A1A',
  errorContainer: '#FFDAD6',
  onError:        '#FFFFFF',

  // ─── German Flag — DECORATIVE CONFETTI ONLY ──────────────────────────────────
  // Subtle scattered shapes in header/question zones — NOT UI colours.
  flagBlack:       'rgba(45, 45, 45, 0.12)',
  flagRedAlpha:    'rgba(221, 0, 0, 0.25)',
  flagGoldAlpha:   'rgba(245, 196, 0, 0.35)',
  // Solid stripes — GermanFlagBadge only
  flagStripeBlack: '#2D2D2D',
  flagStripeRed:   '#DD0000',
  flagStripeGold:  '#F5C400',

  // ─── Overlay & Glass ────────────────────────────────────────────────────────
  scrim:           'rgba(0,0,0,0.3)',   // Modal/tooltip overlay
  overlayDark:     'rgba(0, 0, 0, 0.5)',
  glassShine:      'rgba(255, 255, 255, 0.07)',
  glassShineLight: 'rgba(255, 255, 255, 0.08)',
  blueShadow:      'rgba(43, 112, 239, 0.30)',  // CTA button glow — primaryBlue based
  progressTrack:   'rgba(255, 255, 255, 0.22)', // Progress bar track on blue bg

  // ─── Score Ring ─────────────────────────────────────────────────────────────
  ringTrack: '#ECF2FE',

  // ─── Icon State Tokens ───────────────────────────────────────────────────────
  iconActive:      '#00E5B6',  // Accent Teal — active/selected tab or icon
  iconInactive:    '#9CA3AF',  // Muted Gray — unselected/default state
  iconInactiveAlt: '#374151',  // Mid Gray — alternate inactive (darker contexts)

  // ─── Answer State Tokens ─────────────────────────────────────────────────────
  answerCorrect:   '#00E5B6',  // Teal = correct answer reveal
  answerIncorrect: '#EF4444',  // Red = incorrect answer reveal
  answerSelected:  '#2B70EF',  // Primary Blue = user-selected, pre-submit
} as const;

export type ColorKey = keyof typeof colors;
