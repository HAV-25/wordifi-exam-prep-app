# OB-01 — Build the core ConvictionAnswerCard component

## Read first (in this order)
1. /docs/onboarding-conviction/AGENT_CONTEXT.md
2. /docs/onboarding-conviction/OB-00-discovery.md (your own output)
3. Wordifi_Conviction_Card_Implementation_Brief.docx 
   — sections 4.1, 4.2, 5.1, 5.2, 5.3, 5.4
4. Wordifi_Conviction_Cards.docx — Screen 02 row only for this task

DO NOT read brief section 4.3 (hold timer), 4.4 (confetti), or 5.5 
(accessibility) for this task. Those are OB-04, OB-02, and OB-03.

## Goal
Produce a reusable ConvictionAnswerCard component that replaces the 
existing answer-card rendering inside Screen 02 only, as a proof-of-concept. 
The component must:
- Flip on tap (3D Y-axis, 300ms, spring easing per brief 4.1)
- Apply press scale feedback (0.97, per brief 4.2)
- Fire a light haptic on press down (per brief 5.3)
- Render the yellow conviction face per brief 5.2 (emoji + copy only)
- Land in the "selected" state after flip (Primary Blue border + 
  #ECF2FE tint, per brief step 6)
- Activate the Continue button when flip completes (per brief 5.4, 
  first two bullets only — auto flip-back and cancel-on-continue are OB-04)
- Maintain pixel-identical width and height to other answer cards on 
  the screen (brief 5.1 — NON-NEGOTIABLE)

## Explicitly OUT of scope
- Auto flip-back after 2.5s — OB-04
- Confetti particles — OB-02
- Reduce-motion handling — OB-03
- Screen reader accessibilityLabel — OB-03
- Wiring into screens other than Screen 02 — OB-05+
- The copy lookup object with all 37 entries — OB-05
- Any fix to the empathy.tsx persistence bug — OB-00b handled separately

For this task the card flips and stays on yellow. Flipping back and 
timer logic come in OB-04.

## Dependency: install Reanimated via Expo-managed install
OB-00 confirmed react-native-reanimated is not installed. Install it 
with the Expo-managed command:

    npx expo install react-native-reanimated

Do NOT use plain `npm install react-native-reanimated`. The Expo 
command picks the version compatible with the current Expo SDK. If 
Expo complains or the command fails, stop and report — do not 
improvise with a different install method.

After installation:
- Add the Reanimated Babel plugin to babel.config.js (it MUST be the 
  last plugin in the plugins array — this is a common gotcha)
- Do a full clean restart: clear Metro cache and restart the Expo dev 
  server to verify the plugin is picked up
- Verify the app still boots on the simulator before writing any 
  animation code

If babel.config.js already has a Reanimated plugin entry (shouldn't, 
but check), leave it alone. If it has unrelated plugins, append 
Reanimated at the end and do not reorder the existing ones.

## Proof-of-concept screen: Screen 02 (Certification)
File: expo/app/onboarding_launch/cert.tsx (confirmed in OB-00)

Answer options: 4 cards, in this order per the cards doc:
  1. goethe   — 🎓 Goethe-Institut  — "Perfect. Wordifi has every Goethe section covered."
  2. telc     — ✅ TELC             — "Smart. Wordifi's mock tests are built for TELC."
  3. osd      — 🏅 ÖSD              — "Exactly right. Wordifi knows every ÖSD section."
  4. not_sure — 💡 Not sure yet     — "No problem. Wordifi will find the right exam for you."

For THIS task only, hardcode these 4 conviction entries inline in 
cert.tsx. The lookup object lives in OB-05.

## Component location
Use the existing shared-components convention discovered in OB-00. 
Do NOT create a new top-level directory. Document your chosen path 
in the task report.

## Props shape (minimum)
- answer: { key: string; emoji: string; label: string }
- conviction: { emoji: string; copy: string }
- isSelected: boolean
- onPress: () => void

Keep props minimal. Add new props in the tasks that need them 
(OB-02, OB-03, OB-04).

## Behavioural rules — selection and reselect
- Tapping a different answer after one is already flipped: the new 
  card flips, the previously-flipped card returns to its default 
  (non-selected) front face. Only one card shows the flipped/selected 
  state at a time.
- If the brief is ambiguous on any behaviour, make a choice, document 
  it in the task report under "Assumptions," and flag it.

## Card dimensions — NON-NEGOTIABLE (brief 5.1)
Measure an existing non-flipped answer card's rendered width and 
height BEFORE making any changes. Record the numbers. After your 
changes, re-measure both the front and flipped faces. All three must 
match exactly. If they don't, stop and report — do not ship a drift.

## Do not touch
- Everything in AGENT_CONTEXT.md "do not touch" list
- onboarding_launch_v1_2026-04-05/ — the versioned backup, stays 
  completely untouched
- All 7 other question screens (level.tsx, empathy.tsx, timeline.tsx, 
  readiness.tsx, hardest.tsx, daily-commitment.tsx, learner-style.tsx)
- All value screens (splash, plan builder, gap analysis, leaderboard, 
  notification buy-in, plan summary, trial transparency)
- The onboarding store / OnboardingAnswers type
- empathy.tsx persistence bug — ignore entirely, OB-00b owns it
- Supabase: no DB changes, no Edge Function changes, no migrations

## Acceptance
- react-native-reanimated installed via `npx expo install`, Babel 
  plugin registered as last plugin, app boots cleanly
- ConvictionAnswerCard component created at chosen path
- cert.tsx renders all 4 options using ConvictionAnswerCard
- On tap: haptic fires, card scales to 0.97, flips on Y-axis over 
  300ms with spring easing, yellow face shown and held (no auto 
  flip-back)
- Yellow face contains: raw Text emoji (30px, marginRight 12), 
  conviction copy (Outfit_800ExtraBold, 16px, #374151, lineHeight 22), 
  background #F0C808, border radius matching existing answer cards
- Continue button activates the moment the flip completes
- Other 3 cards on the screen do NOT move, resize, or change opacity 
  when one is tapped
- Tapping a different card: new card flips, previous card reverts 
  (behaviour documented in report)
- Card width and height identical before, during (where measurable), 
  and after flip — report the measured numbers
- Existing Supabase save behaviour for cert.tsx unchanged (if it 
  writes to user_profiles on answer or on Continue, that write still 
  fires and still writes the same value)
- TC-012 from Wordifi_UX_Test_Cases.docx still passes (exam type 
  selection saves)

## Deliverable in task report
- PR-style diff
- Path of the new component
- Path of cert.tsx (modified)
- babel.config.js diff
- package.json diff (Reanimated version added)
- One screenshot: front face of cert.tsx with all 4 cards, default state
- One screenshot: one card tapped, showing yellow conviction face, 
  other 3 cards unchanged
- One 3–5 second screen recording: tap → scale → flip → rest on yellow
- Measured card dimensions (width × height) for: original answer card, 
  flipped yellow face. Both numbers.
- Assumptions section: every choice made where the brief or existing 
  code was ambiguous
- Confirmation that TC-012 still passes
- Mark OB-01 complete in BACKLOG.md

## If blocked
Stop and report. Acceptable blockers:
- `npx expo install react-native-reanimated` fails
- Babel config cannot be updated without touching unrelated config
- Cannot achieve pixel-identical card dimensions without layout change
- cert.tsx answer-card rendering is too coupled to the screen to extract 
  cleanly without refactoring
- App fails to boot after Reanimated install and you've exhausted the 
  standard fixes (clear Metro cache, clean build, plugin at end of array)
