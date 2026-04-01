/**
 * WORDIFI — Spacing, Radius & Elevation
 * Source of truth: Design Language v1.0 · Sections 1.5–1.6
 */

import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Screen Dimensions ──────────────────────────────────────────────────────
export const screen = {
  width:  SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
} as const;

// ─── Spacing Scale ───────────────────────────────────────────────────────────
// Base unit: 4px. All spacing is a multiple of 4.
export const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  xxxl: 32,
  huge: 48,
} as const;

// ─── Screen Zone Proportions (Section 1.5) ───────────────────────────────────
// Every onboarding screen: blue header zone + white body zone + CTA zone
export const zones = {
  headerHeight:     SCREEN_HEIGHT * 0.55,  // ~55% — blue header
  bodyHeight:       SCREEN_HEIGHT * 0.45,  // ~45% — white body
  statusBarHeight:  52,                     // Test Stream status bar
  ctaHeight:        80,                     // CTA zone minimum height
  tabBarHeight:     56,                     // Bottom nav bar
} as const;

// ─── Horizontal Padding ──────────────────────────────────────────────────────
export const layout = {
  screenPadding:  24,   // Standard horizontal padding for all screens
  cardPadding:    20,   // Internal card padding
  optionPadding:  16,   // Option row padding
  chipPaddingH:   12,   // Horizontal chip/pill padding
  chipPaddingV:    6,   // Vertical chip/pill padding
} as const;

// ─── Border Radius ───────────────────────────────────────────────────────────
export const radius = {
  xs:      4,    // Small chips, German flag badge
  sm:      8,    // Small elements
  md:      12,   // Cards, panels
  lg:      16,   // Large cards, explanation panel top corners
  xl:      20,   // Option cards
  pill:    28,   // Pills, gauge chips, progress indicators
  full:    9999, // Perfect circles, round buttons
} as const;

// ─── Elevation Techniques (Section 1.6) ──────────────────────────────────────
// React Native shadows — use these objects directly in StyleSheet
export const shadows = {
  // CTA button blue glow — essential, defines the premium feel
  ctaButton: {
    shadowColor:   '#0057CD',   // primary
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius:  24,
    elevation:     12,
  },
  // Subtle card lift — ambient, should be felt not seen
  card: {
    shadowColor:   '#171B28',   // onSurface
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius:  8,
    elevation:     3,
  },
  // Floating sheet — bottom sheet, modals
  sheet: {
    shadowColor:   '#171B28',   // onSurface
    shadowOffset:  { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius:  16,
    elevation:     8,
  },
  // Explanation panel
  panel: {
    shadowColor:   '#171B28',   // onSurface
    shadowOffset:  { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius:  12,
    elevation:     6,
  },
} as const;

// ─── Touch Targets ───────────────────────────────────────────────────────────
// Minimum per Apple/Google guidelines + Tech Path Section 2.2
export const touchTargets = {
  minimum:   44,   // Absolute minimum per platform guidelines
  option:    52,   // Answer option rows (exceeds minimum)
  cta:       56,   // Primary CTA buttons
  icon:      44,   // Icon buttons
  chip:      36,   // Small chips and pills
} as const;

// ─── Z-Index ─────────────────────────────────────────────────────────────────
export const zIndex = {
  base:        0,
  card:       10,
  overlay:    20,
  panel:      30,
  sheet:      40,
  toast:      50,
  modal:      60,
} as const;
