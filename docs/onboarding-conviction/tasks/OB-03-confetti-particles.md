# OB-03 — Accessibility: reduce-motion + screen reader labels

## Read first (in this order)
1. /docs/onboarding-conviction/AGENT_CONTEXT.md
2. /docs/onboarding-conviction/OB-00-discovery.md
3. Your OB-01 and OB-02 implementations (ConvictionAnswerCard.tsx
   and ConfettiParticles.tsx)
4. Wordifi_Conviction_Card_Implementation_Brief.docx — section 5.5 ONLY

## Goal
Add two accessibility behaviours per brief 5.5:
1. If Reduce Motion is enabled, skip the flip animation — instant colour
   change with no rotation. Press scale, haptic, Continue activation, and
   particles still fire.
2. Conviction card copy readable via screen reader. Only the visible face
   is announced. Particles are not announced.

## Reduce-motion
- Detect via AccessibilityInfo.isReduceMotionEnabled() on mount + listener
  on 'reduceMotionChanged'. Cleanup on unmount.
- When ON: set flipProgress.value = 1/0 directly (no withTiming).
  onFlipComplete and setParticlesActive still fire.
- When OFF: existing OB-01 behaviour unchanged.
- Read reduce-motion via ref (not state) so the flip useEffect
  dependency array stays [isSelected] only.

## Screen reader
- Pressable accessibilityLabel: dynamic — answer label when front face
  showing, conviction copy when back face showing.
- Front face Animated.View: accessibilityElementsHidden +
  importantForAccessibility hidden when back face visible (isSelected true).
- Back face Animated.View: same, hidden when front face visible.
- ConfettiParticles container: always hidden from screen reader.

## IMPORTANT: separate-commits rule
Commit message must be exactly:
  "OB-03: accessibility (reduce-motion + screen reader)"

## Do not touch
- Everything in AGENT_CONTEXT.md "do not touch"
- Flip animation timing/easing, particles, haptics, press scale (OB-01/02)
- Other 7 question screens, all value screens
- onboarding_launch_v1_2026-04-05/
- Onboarding store, empathy bug, Supabase
