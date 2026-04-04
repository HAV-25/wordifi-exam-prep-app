/**
 * WORDIFI — Typography System
 * Master source: Wordifi Brand Brief (Wordifi_Stitch_Doc1_Base_Brief.docx)
 *
 * CRITICAL RULES — NON-NEGOTIABLE:
 * 1. SENTENCE CASE everywhere. "Start your journey" not "Start Your Journey".
 * 2. wordmark is always lowercase: "wordifi"
 * 3. Never ALL CAPS except category chip labels (10–11px, intentional).
 * 4. Two typefaces only: Outfit (headlines/CTAs) + Nunito Sans (body/labels).
 * 5. NEVER use more than three text sizes on a single screen.
 *
 * Font setup:
 *   Loaded in expo/app/_layout.tsx via useFonts()
 *   Packages: @expo-google-fonts/outfit @expo-google-fonts/nunito-sans
 */

export const fontFamily = {
  display:      'Outfit_800ExtraBold',      // Headlines, CTAs, scores, wordmark
  displaySemi:  'Outfit_800ExtraBold',      // Outfit has one display weight; same as display
  bodyRegular:  'NunitoSans_400Regular',    // Body copy, option labels, explanatory text
  bodyMedium:   'NunitoSans_400Regular',    // Alias — Nunito Sans has no 500; mapped to 400
  bodySemiBold: 'NunitoSans_600SemiBold',   // Sub-headlines, card titles, emphasis
  bodyBold:     'NunitoSans_700Bold',       // Labels, micro-copy (ALL CAPS permitted here only)
} as const;

/**
 * Type scale — all sizes in px (React Native points)
 * Use fontFamily.display for displayXl–displaySm
 * Use fontFamily.bodyRegular / bodySemiBold / bodyBold for body and labels
 *
 * RULE: never use more than 3 of these sizes on a single screen.
 */
export const fontSize = {
  displayXl:  40,  // Score reveal, splash heroes
  displayLg:  28,  // Primary screen headline (h1)
  displayMd:  22,  // Screen titles
  displaySm:  20,  // Section titles, card headers (h2)
  bodyLg:     16,  // Primary body copy, CTA labels, option text
  bodyMd:     14,  // Secondary body, sub-labels
  bodySm:     13,  // Tertiary text, captions
  label:      12,  // Status bar labels, tags
  micro:      11,  // Category chip labels (uppercase permitted here only)
  tiny:       10,  // Timestamps, legal
} as const;

export const fontWeight = {
  display: '800',  // Outfit ExtraBold
  semi:    '600',  // Nunito Sans SemiBold
  bold:    '700',  // Nunito Sans Bold
  medium:  '500',  // Semantic alias — maps to Regular in Nunito Sans
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
 * Predefined text style compositions — use these directly in components.
 * Never compose text styles ad-hoc.
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
    fontSize:      fontSize.displayLg,
    fontWeight:    fontWeight.display,
    lineHeight:    fontSize.displayLg * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  sectionTitle: {
    fontFamily:    fontFamily.display,
    fontSize:      fontSize.displayMd,
    fontWeight:    fontWeight.display,
    lineHeight:    fontSize.displayMd * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  cardTitle: {
    fontFamily:  fontFamily.bodySemiBold,
    fontSize:    fontSize.displaySm,
    fontWeight:  fontWeight.semi,
    lineHeight:  fontSize.displaySm * lineHeight.normal,
  },
  questionText: {
    fontFamily:  fontFamily.bodySemiBold,
    fontSize:    fontSize.displaySm,
    fontWeight:  fontWeight.semi,
    lineHeight:  fontSize.displaySm * lineHeight.normal,
  },
  ctaLabel: {
    fontFamily: fontFamily.display,
    fontSize:   fontSize.bodyLg,
    fontWeight: fontWeight.display,
  },
  optionText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize:   fontSize.bodyLg,
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.bodyLg * lineHeight.normal,
  },
  bodyText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize:   fontSize.bodyMd,
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.bodyMd * lineHeight.relaxed,
  },
  label: {
    fontFamily:    fontFamily.bodyRegular,
    fontSize:      fontSize.label,
    fontWeight:    fontWeight.regular,
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
    fontSize:      64,
    fontWeight:    fontWeight.display,
    letterSpacing: letterSpacing.tight,
  },
  scoreLabel: {
    fontFamily: fontFamily.bodyRegular,
    fontSize:   fontSize.micro,
    fontWeight: fontWeight.regular,
  },
} as const;
