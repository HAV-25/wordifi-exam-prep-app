# OB-02 — Confetti particle layer on the yellow conviction face

## Read first (in this order)
1. /docs/onboarding-conviction/AGENT_CONTEXT.md
2. /docs/onboarding-conviction/OB-00-discovery.md
3. Your own OB-01 implementation (ConvictionAnswerCard.tsx) and OB-01
   task report — you need to build on top of this component
4. Wordifi_Conviction_Card_Implementation_Brief.docx
   — section 4.4 ONLY

DO NOT read brief 4.3 (hold timer) or 5.5 (accessibility). Those are
OB-04 and OB-03.

## Goal
Add a subtle confetti particle layer to the yellow conviction face
of ConvictionAnswerCard per brief section 4.4. 5 particles float
upward and fade out, staggered, staying contained within the card.

## Current state to build on
OB-01 established:
- Reanimated 4.1.7 installed and working
- ConvictionAnswerCard at expo/components/onboarding/ConvictionAnswerCard.tsx
- Screen 02 (cert.tsx) uses the component with 4 options
- Yellow face holds indefinitely (no auto flip-back — that's OB-04)

## Explicitly OUT of scope
- Auto flip-back timer — OB-04 still owns this
- Particle cleanup on flip-back — there IS no flip-back yet. For this
  task, particles animate on flip-TO-yellow and then stay in their
  final (faded-out, invisible) state. OB-04 will wire the reset when
  the flip-back is implemented.
- Reduce-motion handling for particles — OB-03 owns this
- Wiring into other screens — OB-05+
- Changing the front face, the flip animation, the haptics, the press
  feedback, or the Continue button behaviour — all OB-01 work, leave it alone

## Particle specification (brief 4.4, verbatim)
- Count: 5
- Size: random between 3px and 6px
- Colours: rotate through rgba(255,255,255,0.4) and rgba(201,168,0,0.6)
- Shape: small circles (border radius = half of size)
- Float distance: 7px upward (translateY 0 → -7)
- Opacity animation: 0.8 → 0 over the same duration
- Duration: 2500ms
- Stagger: each particle starts with a random delay between 0ms and 400ms
- Positions (absolute, per brief):
    { top: '15%', left: '8%' }
    { top: '20%', right: '10%' }
    { bottom: '25%', left: '15%' }
    { bottom: '20%', right: '8%' }
    { top: '50%', right: '5%' }

## Architecture
Create ConfettiParticles as either:
- A sub-component inside ConvictionAnswerCard.tsx, OR
- A separate file at expo/components/onboarding/ConfettiParticles.tsx

Use your judgement based on the current file's size and existing
patterns. Document the choice.

Particles render ONLY on the yellow (back) face. zIndex 0 or below
the text. overflow: 'hidden' on parent clips to card bounds.

## When do particles animate?
Trigger when the flip-to-yellow animation completes (same moment
Continue activates). Do NOT trigger on every render.

## Performance
One shared value per particle. Drive translateY and opacity from a
single progress value via interpolate. No setInterval, no
requestAnimationFrame, no JS-thread loop.

## Acceptance
- 5 particles on yellow face after flip completes
- Random size 3–6px, correct colours, circle shape
- Float 7px up, fade 0.8 → 0 over 2500ms, staggered 0–400ms
- Clipped to card bounds
- Other 3 cards do not render particles
- Card dimensions unchanged vs OB-01 baseline
- TC-012 still passes

## Do not touch
- Everything in AGENT_CONTEXT.md "do not touch"
- Front face, flip animation, haptics, press scale, Continue button (OB-01)
- All other question and value screens
- onboarding_launch_v1_2026-04-05/
- Onboarding store / OnboardingAnswers type
- Supabase, Edge Functions, migrations
