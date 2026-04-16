/**
 * WORDIFI — Motion Language
 * Source of truth: Design Language v1.0 · Section 1.9
 *
 * All animations use react-native-reanimated v3 (NOT the deprecated Animated API).
 * Import: import Animated, { withSpring, withTiming, Easing } from 'react-native-reanimated';
 */

// ─── Durations (ms) ───────────────────────────────────────────────────────────
export const duration = {
  instant:     120,   // Pressed state feedback
  fast:        200,   // Option highlight on answer
  normal:      280,   // Card swipe transitions
  smooth:      300,   // Explanation panel, bottom sheet
  score:       500,   // Progress bar fill
  celebration: 380,   // Celebration card spring
  scoreRing:  1200,   // Score ring + count-up animation
} as const;

// ─── Easing Curves ────────────────────────────────────────────────────────────
// For withTiming() calls
export const easing = {
  // Standard ease — general UI transitions
  standard:     [0.4, 0.0, 0.2, 1.0] as [number, number, number, number],
  // Ease out — elements entering screen (cards sliding in)
  decelerate:   [0.0, 0.0, 0.2, 1.0] as [number, number, number, number],
  // Ease in — elements leaving screen
  accelerate:   [0.4, 0.0, 1.0, 1.0] as [number, number, number, number],
} as const;

// ─── Spring Configs ───────────────────────────────────────────────────────────
// For withSpring() calls in react-native-reanimated
export const springs = {
  // Celebration card — bouncy reward feel
  celebration: {
    damping:   14,
    stiffness: 200,
    mass:       1,
  },
  // Bottom sheet / explanation panel — smooth controlled
  sheet: {
    damping:   20,
    stiffness: 200,
    mass:       1,
  },
  // Option snap-back when trying to swipe unanswered
  snapBack: {
    damping:   18,
    stiffness: 300,
    mass:       1,
  },
  // Card swipe transition
  swipe: {
    damping:   25,
    stiffness: 250,
    mass:       1,
  },
  // Readiness gauge pill colour change
  gauge: {
    damping:   15,
    stiffness: 150,
    mass:       1,
  },
} as const;

// ─── Specific Animation Specs ─────────────────────────────────────────────────

/** CTA Button pressed state */
export const ctaButtonPress = {
  scale:    0.97,
  duration: duration.instant,
  bgColor:  '#1A4BC4',  // Darker blue on press
} as const;

/** Celebration card entrance */
export const celebrationCard = {
  from: { opacity: 0, scale: 0.92, translateY: 8 },
  to:   { opacity: 1, scale: 1.0,  translateY: 0 },
  spring: springs.celebration,
} as const;

/** Card swipe — advance to next question */
export const cardSwipe = {
  exitY:     -999,  // Current card exits upward
  enterY:     999,  // Next card enters from below
  duration:  duration.normal,
  // Easing for withTiming: Easing.bezier(...easing.decelerate)
  easing:    easing.decelerate,
} as const;

/** Explanation panel slide up */
export const explanationPanel = {
  from: { translateY: 400 },
  to:   { translateY: 0 },
  spring: springs.sheet,
} as const;

/** Progress bar fill */
export const progressBar = {
  duration: duration.score,
  // Easing for withTiming: Easing.bezier(...easing.standard)
  easing:   easing.standard,
} as const;

/** Score ring + count-up */
export const scoreReveal = {
  delay:    300,   // Wait for screen transition to complete
  duration: duration.scoreRing,
  easing:   easing.standard,
  startValue: 0,
  endValue:   32,  // Always starts at 32% for new users
} as const;

/** Readiness gauge delta animation */
export const gaugeDelta = {
  duration: 600,   // ms
  easing:   easing.standard,
} as const;

/** Milestone toast entrance + exit */
export const milestoneToast = {
  enterY:      -80,
  exitY:       -80,
  duration:    200,
  holdFor:    3000,  // Auto-dismiss after 3s
  easing:      easing.decelerate,
} as const;

/** Swipe affordance chevron pulse */
export const swipeChevron = {
  opacityFrom: 1.0,
  opacityTo:   0.3,
  pulseDuration: 1000,
  pulseDelay:    3000,  // Wait 3s after answering before first pulse
} as const;

/** Option highlight on answer tap */
export const optionHighlight = {
  duration: duration.fast,
  easing:   easing.standard,
} as const;

/** Bottom sheet drag + dismiss */
export const bottomSheet = {
  spring:          springs.sheet,
  dismissThreshold: 0.35,  // 35% of sheet height — release to dismiss
} as const;
