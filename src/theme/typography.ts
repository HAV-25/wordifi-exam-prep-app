/**
 * WORDIFI — Typography System
 * Source of truth: Design Language v1.0 · Section 1.4
 *
 * CRITICAL RULES — NON-NEGOTIABLE:
 * 1. SENTENCE CASE everywhere. "Start your journey" not "Start Your Journey".
 * 2. wordmark is always lowercase: "wordifi"
 * 3. Never ALL CAPS except category chip labels (10–11px, intentional).
 * 4. Two typefaces only: BricolageGrotesque (display) + DMSans (body).
 *
 * Font setup required:
 *   expo install @expo-google-fonts/bricolage-grotesque @expo-google-fonts/dm-sans
 *   import { useFonts, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
 *   import { DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans';
 */

export const fontFamily = {
  display: 'BricolageGrotesque_800ExtraBold', // Headlines, CTAs, scores, wordmark
  bodyRegular: 'DMSans_400Regular',            // Body copy, explanations, labels
  bodyMedium:  'DMSans_500Medium',             // Sub-labels, option text, tags
} as const;

/**
 * Type scale — all sizes in px (React Native points)
 * Use fontFamily.display for displayXl/displayLg/displayMd
 * Use fontFamily.bodyRegular or bodyMedium for everything below
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
  display: '800',  // BricolageGrotesque only
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
    fontFamily:   fontFamily.bodyMedium,
    fontSize:     fontSize.label,
    fontWeight:   fontWeight.medium,
    letterSpacing: letterSpacing.normal,
  },
  chipLabel: {
    fontFamily:    fontFamily.bodyMedium,
    fontSize:      fontSize.micro,
    fontWeight:    fontWeight.medium,
    // ONLY permitted uppercase usage in the entire app
    textTransform: 'uppercase' as const,
    letterSpacing: letterSpacing.wider,
  },
  scoreDisplay: {
    fontFamily:  fontFamily.display,
    fontSize:    34,
    fontWeight:  fontWeight.display,
    letterSpacing: letterSpacing.tight,
  },
  scoreLabel: {
    fontFamily: fontFamily.bodyRegular,
    fontSize:   fontSize.micro,
    fontWeight: fontWeight.regular,
  },
} as const;
