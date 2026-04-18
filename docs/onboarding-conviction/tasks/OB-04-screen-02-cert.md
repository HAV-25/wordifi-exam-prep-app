# OB-04 — Auto flip-back timer + Continue cancels flip-back

## Read first (in this order)
1. /docs/onboarding-conviction/AGENT_CONTEXT.md
2. /docs/onboarding-conviction/OB-00-discovery.md
3. Your OB-01, OB-02, OB-03 implementations:
   - ConvictionAnswerCard.tsx
   - ConfettiParticles.tsx
   - cert.tsx
4. Wordifi_Conviction_Card_Implementation_Brief.docx — sections 4.3 
   AND 5.4 in full (5.4 was partially implemented in OB-01; complete 
   it now)

## Goal
Add the auto flip-back behaviour that completes the conviction card 
interaction. After the yellow face has been visible for 2.5 seconds, 
the card automatically flips back to its SELECTED state (not its 
default state) — Primary Blue border, soft Primary Blue tint background.

Plus: if the user taps Continue while the yellow face is showing, the 
flip-back is cancelled and navigation happens immediately.

This task closes the loop on the conviction card interaction. After 
OB-04, the card behaviour matches the brief end-to-end on Screen 02.

## IMPORTANT: separate-commits rule
This task lands in its own git commit, separate from OB-02 and OB-03. 
Commit message: "OB-04: auto flip-back timer + Continue cancels"

The product owner is batching OB-02–04 into a single device build for 
testing. Per-task commits let her revert individually. Do NOT amend 
or squash with prior commits.

## Specification (brief 4.3 + 5.4 + step 6 of section 2)

### Hold timer
- Hold duration: 2500ms (constant — already used by particles in OB-02)
- Timer starts when the flip-to-yellow animation completes (the same 
  moment Continue activates and particles trigger — reuse OB-01's 
  flip-complete callback, do not add a new detection point)
- After 2500ms: trigger the flip-back animation
- Flip-back: same 300ms duration, same spring easing as the forward flip, 
  but interpolating flipProgress from 1 → 0
- At the 50% midpoint (invisible to user) the face content swaps from 
  yellow to the SELECTED-state front face

### Selected state (NEW visual — implement now)
After flip-back completes, the front face is in its SELECTED state, 
which is visually distinct from the DEFAULT (untapped) state. Per brief 
step 6:
- Border: Primary Blue (#2B70EF)
- Background: soft Primary Blue tint (#ECF2FE)
- Letter circle: filled Primary Blue (IF the card has a letter circle 
  — this is brief language. The current cert.tsx may or may not have 
  letter circles. CHECK FIRST. If letter circles do not exist in the 
  current design, do NOT invent them. Skip that bullet, document in 
  the report.)
- Answer text: dark colour (current colour is fine if it's already dark)

The selected state was scaffolded in OB-01 (`styles.cardSelected` 
exists but unused). Wire it now. If the existing style differs from 
the brief's spec (#2B70EF border, #ECF2FE background), use the brief's 
values — but flag the diff in the report.

The selected state PERSISTS until the user taps Continue or selects 
a different card. It does not auto-clear.

### Re-tap behaviour (now more nuanced)
Re-read brief 5.4 carefully. With selected-state visuals now real, 
re-tap behaviour:
- Tapping the SAME card while it's in selected state: re-triggers the 
  flip — yellow face shows, hold timer restarts, particles replay, 
  flip-back lands on selected state again. (Effectively a re-affirmation.)
- Tapping a DIFFERENT card: the previously-selected card reverts to 
  its DEFAULT state (not selected — only one card holds selected at a 
  time). The new card flips to yellow, holds 2500ms, flips back to 
  its selected state.
- Particle reset: when a card flips again, particles must replay fresh 
  (not show their previous faded-out final state). The OB-02 hook 
  comment marks where to reset.
- This re-tap behaviour was partially implemented in OB-01 — verify 
  it still works correctly with the new selected-state visuals layered in.

### Continue button — full spec (completing OB-01's partial)
Brief 5.4 in full:
1. Inactive (greyed out, non-tappable) until user has selected an 
   answer AND the flip animation has completed — DONE in OB-01
2. Activates immediately when the yellow face is visible — the user 
   does not need to wait the full 2500ms — DONE in OB-01
3. If tapped while yellow face is still showing: cancel the auto 
   flip-back timer and navigate directly to the next screen WITHOUT 
   completing the flip-back animation — NEW IN OB-04
4. Once active, remains active — selecting a different answer 
   re-triggers the flip but does not deactivate Continue — already 
   active in OB-01

For point 3: cancel the setTimeout, do not trigger the flip-back, 
proceed directly to the existing handleContinue navigation logic. 
The user will see the yellow face vanish along with the screen 
transition — that's correct.

### Reduce-motion compatibility (with OB-03)
Brief 5.5: "The auto flip-back timer still fires after 2.5 seconds 
regardless of reduce motion setting."

So under reduce-motion:
- Tap → instant yellow (OB-03 behaviour)
- 2500ms timer still runs
- Flip-back fires after 2500ms — but as an instant transition, not 
  a 300ms rotation. Yellow face vanishes, selected-state front face 
  appears in the same frame.
- Continue cancels the timer the same way

Reuse the reduce-motion ref from OB-03. Do not add a new detection.

### Particle reset
Per OB-02's hook comment: when flip-back fires (or when re-tapping 
the same card), particles must reset so they replay fresh on the 
next flip-to-yellow. Two changes flagged in OB-02:
1. In ConvictionAnswerCard.tsx flip useEffect's else branch: call 
   setParticlesActive(false)
2. In ConfettiParticles.tsx Particle's useEffect: add `else { 
   progress.value = 0; }` to reset shared values

Make both changes.

### Cleanup
- clearTimeout on unmount (essential — leaked timers cause warnings 
  and can fire setState on unmounted components)
- clearTimeout when re-tapping (any tap, same or different card) — 
  cancel any in-flight flip-back timer before starting the new flip
- clearTimeout when Continue is tapped during the hold

## Out of scope
- Wiring into other 7 screens — OB-05+
- The copy lookup object for all 37 conviction cards — OB-05
- Any change to the navigation logic or store writes
- Changing brief-defined timings (300ms flip, 2500ms hold) — these 
  are constants per the brief

## Acceptance
End-to-end on Screen 02:
- Tap any card → light haptic, scale to 0.97, flip to yellow over 300ms
- Yellow face holds for exactly 2.5 seconds (not 2.4, not 2.6 — within 
  reasonable tolerance of timer accuracy)
- After 2.5s: flip-back animation, lands on the SELECTED state with 
  Primary Blue border (#2B70EF) and soft tint background (#ECF2FE)
- Selected state PERSISTS — does not revert to default
- Continue button is active throughout
- Tap Continue during yellow hold: timer cancels, no flip-back animation, 
  immediate navigation to Screen 03
- Tap a different card while another is in selected state: previous 
  card reverts to default, new card flips to yellow, holds, flips back 
  to selected
- Tap the same card again after it's already selected: re-flips, 
  re-holds, particles replay fresh, flips back to selected
- Particles reset and replay fresh on every flip-to-yellow (verified 
  by visual inspection of the screen recording)
- With Reduce Motion ON: tap → instant yellow, 2.5s wait, instant 
  flip-back to selected state, no rotation animation, particles still play
- No timer leaks on unmount (no warnings in Metro console when 
  navigating away during hold)
- Card dimensions still identical across default, yellow, and selected 
  states (measure ALL THREE this time, report numbers)
- TC-012 still passes
- Committed as a single git commit with message "OB-04: auto flip-back 
  timer + Continue cancels"

## Deliverable in task report
- PR-style diff
- Files modified
- Three screen recordings:
    1. Full happy path (Reduce Motion OFF): tap → flip → particles → 
       2.5s hold → flip back → selected state visible → tap Continue → 
       navigate
    2. Continue-cancels-flip-back (Reduce Motion OFF): tap → yellow 
       visible → tap Continue immediately → navigates without flip-back
    3. Reduce Motion ON full path: tap → instant yellow → 2.5s wait → 
       instant flip-back to selected state → tap Continue → navigate
- Re-tap behaviour shown in any of the above (or a 4th short clip)
- Measured card dimensions: default state, yellow state, selected state. 
  All three numbers.
- Confirmation that the brief's "letter circle" detail was checked — 
  if the design has letter circles, they fill blue in selected state; 
  if not, document what the brief is referring to that doesn't exist 
  in the codebase
- Assumptions section
- Confirm no Metro warnings during hold + navigate-away test
- Confirm git commit exists with the specified message
- Mark OB-04 complete in BACKLOG.md

## Do not touch
- Everything in AGENT_CONTEXT.md "do not touch"
- Forward flip animation timing or easing (OB-01) — only ADD the 
  flip-back; do not touch the forward direction
- Particle visual spec (OB-02) — only add the reset hook
- Reduce-motion detection (OB-03) — reuse the existing ref
- Haptics, press scale — do not modify
- Other 7 question screens
- All value screens
- onboarding_launch_v1_2026-04-05/ versioned backup
- The onboarding store / OnboardingAnswers type — handleContinue still 
  writes the same thing the same way
- empathy.tsx persistence bug
- Supabase

## If blocked
- Letter circle ambiguity — flag and proceed without it
- Selected-state styling clashes with existing card hover/focus styles 
  — use brief values, document the conflict, do not modify other states
- Timer accuracy under load (e.g. consistently fires at 2.7s) — document, 
  do not "tune" by setting timer to 2300ms; that's not a fix
- Continue tapped during the FORWARD flip (before yellow is visible) 
  — brief is silent on this. The button shouldn't be tappable yet 
  per OB-01's gate. If somehow it is, document and report.
