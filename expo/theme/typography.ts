/**
 * WORDIFI — Typography System
 * Source of truth: Google Stitch project 17418085725444489838
 *
 * CRITICAL RULES — NON-NEGOTIABLE:
 * 1. SENTENCE CASE everywhere. "Start your journey" not "Start Your Journey".
 * 2. wordmark is always lowercase: "wordifi"
 * 3. Never ALL CAPS except category chip labels (10–11px, intentional).
 * 4. Two typefaces only: Plus Jakarta Sans (display/headlines) + Be Vietnam Pro (body/labels).
 *
 * Font setup:
 *   Loaded in expo/app/_layout.tsx via useFonts()
 *   Packages: @expo-google-fonts/plus-jakarta-sans @expo-google-fonts/be-vietnam-pro
 */

export const fontFamily = {
  display:     'PlusJakartaSans_800ExtraBold', // Headlines, CTAs, scores, wordmark
  displaySemi: 'PlusJakartaSans_600SemiBold',  // Titles, sub-headers
  bodyRegular: 'BeVietnamPro_400Regular',       // Body copy, explanations
  bodyMedium:  'BeVietnamPro_500Medium',        // Option text, sub-labels
  bodyBold:    'BeVietnamPro_700Bold',          // Labels, micro-copy (ALL CAPS)
} as const;

/**
 * Type scale — all sizes in px (React Native points)
 * Use fontFamily.display / displaySemi for displayXl–displaySm
 * Use fontFamily.bodyRegular / bodyMedium / bodyBold for body and labels
 */
export const fontSize = {
  displayXl:  36,  // Hero headlines on Splash
  displayLg:  28,  // Section headlines
  displayMd:  22,  // Screen titles
  displaySm:  18,  // Card titles, question text
  bodyLg:     16,  // Primary body copy, CTA labels, option text
  bodyMd:     14,  // Secondary body, sub-labels
  bodySm:     13,  // Tertiary text, captions
  label:      12,  // Status bar labels, tags
  micro:      11,  // Category chip labels (uppercase permitted here only)
  tiny:       10,  // Timestamps, legal
} as const;

export const fontWeight = {
  display: '800',  // Plus Jakarta Sans ExtraBold
  semi:    '600',  // Plus Jakarta Sans SemiBold
  bold:    '700',  // Be Vietnam Pro Bold (labels)
  medium:  '500',
  regular: '400',
} as const;

export const lineHeight = {
  tight:   1.2,   // Headlines
  normal:  1.5,   // Body copy
  relaxed: 1.7,   // Long-form explanations
} as const;

export const letterSpacing = {
  tight:   -0.5,  // Display headlines
  normal:   0,
  wide:     0.5,  // Uppercase micro labels
  wider:    1.0,  // Category chips (uppercase)
} as const;

/**
 * Predefined text style compositions — use these directly in components
 * to ensure consistency. Never compose text styles ad-hoc.
 */
export const textStyles = {
  heroHeadline: {
    fontFamily:    fontFamily.display,
    fontSize:      fontSize.displayXl,
    fontWeight:    fontWeight.display,
    lineHeight:    fontSize.displayXl * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  screenTitle: {
    fontFamily:    fontFamily.display,
    fontSize:      fontSize.displayMd,
    fontWeight:    fontWeight.display,
    lineHeight:    fontSize.displayMd * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  questionText: {
    fontFamily:  fontFamily.bodyMedium,
    fontSize:    fontSize.displaySm,
    fontWeight:  fontWeight.medium,
    lineHeight:  fontSize.displaySm * lineHeight.normal,
  },
  ctaLabel: {
    fontFamily: fontFamily.display,
    fontSize:   fontSize.bodyLg,
    fontWeight: fontWeight.display,
  },
  optionText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize:   fontSize.bodyLg,
    fontWeight: fontWeight.medium,
    lineHeight: fontSize.bodyLg * lineHeight.normal,
  },
  bodyText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize:   fontSize.bodyMd,
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.bodyMd * lineHeight.relaxed,
  },
  label: {
    fontFamily:    fontFamily.bodyMedium,
    fontSize:      fontSize.label,
    fontWeight:    fontWeight.medium,
    letterSpacing: letterSpacing.normal,
  },
  chipLabel: {
    fontFamily:    fontFamily.bodyBold,
    fontSize:      fontSize.micro,
    fontWeight:    fontWeight.bold,
    // ONLY permitted uppercase usage in the entire app
    textTransform: 'uppercase' as const,
    letterSpacing: letterSpacing.wider,
  },
  scoreDisplay: {
    fontFamily:    fontFamily.display,
    fontSize:      34,
    fontWeight:    fontWeight.display,
    letterSpacing: letterSpacing.tight,
  },
  scoreLabel: {
    fontFamily: fontFamily.bodyRegular,
    fontSize:   fontSize.micro,
    fontWeight: fontWeight.regular,
  },
} as const;
