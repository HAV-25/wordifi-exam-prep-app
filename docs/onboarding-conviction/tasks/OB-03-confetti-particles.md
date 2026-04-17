# OB-03 — ConfettiParticles Sub-component

**Status:** [ ]  
**Brief sections:** §4.4

---

## Objective
Build `expo/components/onboarding/ConfettiParticles.tsx` and wire it into the yellow face of `ConvictionCard`.

---

## Spec from brief §4.4

```
5 particles, absolutely positioned within the card
Each floats upward and fades out over the hold duration

count: 5
size: 3–6px (random per particle)
colors: ['rgba(255,255,255,0.4)', 'rgba(201,168,0,0.6)']
floatDistance: 7px upward (translateY 0 → -7)
duration: 2500ms (matches hold duration)
staggerDelay: 0–400ms random per particle
positions:
  { top: '15%', left: '8%' }
  { top: '20%', right: '10%' }
  { bottom: '25%', left: '15%' }
  { bottom: '20%', right: '8%' }
  { top: '50%', right: '5%' }

opacity: 0.8 → 0
```

---

## Component API

```ts
type ConfettiParticlesProps = {
  // When true, starts the animation. When false, resets all particles.
  active: boolean;
};
```

Parent (`ConvictionCard`) passes `active={isShowingYellowFace}`. When `active` flips to false (flip-back triggers), all particles reset to their initial positions instantly.

---

## Implementation notes

- One `useSharedValue` per particle for both `translateY` and `opacity`
- Use `withDelay(staggerDelay, withTiming(...))` from Reanimated
- On `active = false`: reset shared values to initial immediately (no animation)
- Wrap in `position: absolute, top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none'`
- Each particle is a `View` with fixed width/height, `borderRadius: size/2`

---

## Acceptance criteria
- [ ] 5 particles, correct positions, correct size range
- [ ] Float upward 7px and fade to 0 over 2500ms
- [ ] Staggered starts (random 0–400ms delay)
- [ ] Reset instantly when `active` goes false
- [ ] `pointerEvents: 'none'` — never blocks taps
- [ ] No crash when card re-selected (animation restarts cleanly)
