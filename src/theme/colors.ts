/**
 * WORDIFI — Colour System
 * Source of truth: Design Language v1.0 · Section 1.3
 *
 * RULES:
 * - German flag palette (flag*) ONLY used as abstract decorative elements
 *   on Splash and Question screens. Never for UI, text, or backgrounds.
 * - Never hardcode hex values anywhere in the app — import from here.
 */

export const colors = {
  // ─── Primary Palette ────────────────────────────────────────────────
  navy:    '#0A1628',   // Deep navy — primary background, dark surfaces
  blue:    '#2B70EF',   // Brand blue — CTAs, header zones, active states
  teal:    '#00E5B6',   // Teal accent — score ring end gradient, highlights

  // ─── Neutral & Surface ──────────────────────────────────────────────
  white:   '#FFFFFF',   // Pure white — cards, body zones, text on dark
  surface: '#F4F7FF',   // Off-white surface — option card backgrounds
  border:  '#E2E8F0',   // Subtle border — dividers, input outlines
  muted:   '#9CA3AF',   // Muted grey — secondary text, labels, placeholders
  text:    '#0A0E1A',   // Near-black — primary body text

  // ─── Semantic Palette ───────────────────────────────────────────────
  green:   '#14B86A',   // Correct answer, success states
  red:     '#E24D4D',   // Wrong answer, error states
  amber:   '#F4B942',   // Warning, amber preparedness state

  // ─── Preparedness Gauge ─────────────────────────────────────────────
  gaugeRed:   '#E24D4D',   // < 40%
  gaugeAmber: '#F4B942',   // 40–69%
  gaugeGreen: '#14B86A',   // ≥ 70%

  // ─── German Flag Palette — DECORATIVE ONLY ──────────────────────────
  // These appear ONLY as abstract confetti/badge elements on Splash + Question screens.
  // NEVER use for UI components, text, backgrounds, or functional elements.
  flagBlack: 'rgba(45, 45, 45, 0.12)',
  flagRed:   'rgba(221, 0, 0, 0.25)',
  flagGold:  'rgba(245, 196, 0, 0.35)',

  // Solid flag stripe values — used only in GermanFlagBadge component
  flagStripeBlack: '#2D2D2D',
  flagStripeRed:   '#DD0000',
  flagStripeGold:  '#F5C400',

  // ─── Overlay & Glass ────────────────────────────────────────────────
  overlayDark:     'rgba(0, 0, 0, 0.5)',
  glassShine:      'rgba(255, 255, 255, 0.07)',
  glassShineLight: 'rgba(255, 255, 255, 0.08)',
  blueShadow:      'rgba(43, 112, 239, 0.35)',  // CTA button glow
  progressTrack:   'rgba(255, 255, 255, 0.22)', // Progress bar track on blue bg

  // ─── Score Ring ─────────────────────────────────────────────────────
  ringTrack: '#ECF2FE',
} as const;

export type ColorKey = keyof typeof colors;
