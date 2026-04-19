# Agent Context — Onboarding Conviction Card Workstream

This file is the persistent briefing document for any agent working on the
`onboarding-conviction` workstream. Read this first, before any task file.

Last updated: OB-10 (2026-04-19).

---

## What this workstream is

A micro-interaction feature: conviction card flip across 8 onboarding question
screens. When a user taps an answer card during onboarding, the card flips to a
yellow "conviction" face showing a Wordifi-branded affirmation, holds for 2.5s,
then flips back to a selected state. This replaces the original plain tap-to-select.

The workstream runs OB-00 through OB-10 (complete). It is **finished** after OB-10.
Any follow-on work needs a new task assignment.

---

## Source of truth documents

| Document | Location | What it defines |
|---|---|---|
| `Wordifi_Conviction_Card_Implementation_Brief.docx` | repo root | Full interaction spec: timing, easing, colours, accessibility, edge cases |
| `Wordifi_Conviction_Cards (1).docx` | repo root | 37 conviction copy entries across all 8 screens (the actual text shown on the yellow face) |

If there is ever a conflict between these docs and the code, the brief is correct unless
a task file explicitly overrides it.

---

## Tech stack

- **React Native** + **Expo SDK 54** (managed workflow)
- **Expo Router** (file-based, `expo/app/` directory)
- **`react-native-reanimated` v4.1.7** — animation engine for the flip
  - Shared values, `withTiming`, `withDelay`, `interpolate`, `Easing`, `runOnJS`
  - `backfaceVisibility: 'hidden'` + `rotateY` for the 3D flip
  - `perspective: 1000` on the transform
- **`expo-haptics` v15.0.8** — light impact on card tap
- **`AccessibilityInfo`** — reduce motion detection via `isReduceMotionEnabled()` and `addEventListener`
- Platform target: **mobile (iOS + Android)**, 390px design width
- Build tooling: **EAS Build** (preview profile, internal distribution, Android APK; iOS requires interactive credential setup)

---

## Architecture of the conviction card system

```
expo/components/onboarding/
  ConvictionAnswerCard.tsx   — the shared card flip component
  ConfettiParticles.tsx      — 5-particle sub-component on the yellow face
  convictionLookup.ts        — 37 entries across 8 screens (data only, no React)

expo/app/onboarding_launch/
  cert.tsx         (Screen 02 · Step 1)
  level.tsx        (Screen 03 · Step 2)
  empathy.tsx      (Screen 04 · Step 3)
  timeline.tsx     (Screen 05 · Step 4)
  readiness.tsx    (Screen 06 · Step 5)
  hardest.tsx      (Screen 07 · Step 6)
  daily-commitment.tsx  (Screen 11 · Step 7)
  learner-style.tsx     (Screen 13 · Step 8)
  _store.ts        — module-level answer accumulator, 7 typed fields
```

All 8 question screens follow an identical pattern:
- `[selected, setSelected]` — which card is currently selected
- `[continueActive, setContinueActive]` — gates the Continue button
- `cancelFlipBackRef` — holds cancel handle from card's flip-back timer
- `isNavigatingRef` — prevents double-navigate on rapid Continue tap
- `handleContinue` — calls cancel, writes to store, pushes next route
- `ConvictionAnswerCard` wired with `conviction`, `isSelected`, `onPress`, `onFlipComplete`, `cardStyle`, `cardBorderRadius`, `accessibilityLabel`

---

## Non-negotiable rules

1. **One task at a time. Stop after each and wait for PO review.**
2. **One git commit per task** (unless a task explicitly says multiple commits).
3. **TypeScript must be clean before each commit** — run `npx tsc --noEmit` in `expo/`.
   Pre-existing errors in `_archive/`, `backups/`, `onboarding_launch_v1_2026-04-05/` are exempt.
4. **Follow the Wordifi Design System** (`DESIGN_SYSTEM.md` in repo root). Exact token values.
   No arbitrary hex colours. No gradients on CTAs. No 1px borders.
5. **Do not fix bugs silently.** If a bug is found during a task, document it. Only auto-fix if
   it is under 5 lines, obviously correct, and the alternative is a broken app — and even then,
   flag it explicitly in the task report.
6. **Brief timings are constants.** Do not "tune" `HOLD_DURATION` (2500ms) or flip animation
   duration (300ms). These are spec, not approximations.
7. **Do not touch value screens** (splash, plan-builder, gap-analysis, leaderboard, notification,
   plan-summary, trial-transparency) — they were not modified by this workstream and carry
   no regression risk.

---

## Per-task loop

For each task:
1. Read AGENT_CONTEXT.md (this file)
2. Read the specific task file in `docs/onboarding-conviction/tasks/`
3. Read the brief sections called out by the task
4. Read all relevant existing code before touching anything
5. Implement, checking TypeScript after changes
6. Commit with the exact message specified in the task
7. Update `BACKLOG.md` to mark the task complete
8. Write the task report if required
9. Stop. Wait for PO review.

---

## Scope

**In scope:** All 8 question screens + `ConvictionAnswerCard` + `ConfettiParticles` + `convictionLookup`.

**Out of scope (do not touch):**
- `onboarding_launch_v1_2026-04-05/` — versioned backup, do not modify or delete
- Auth screens (`/auth`, `/check-email`)
- Paywall routes (`/onboarding_launch/paywall`, `trial-transparency`)
- Post-onboarding screens (Stream tab, Sections, Mock Test, Sprechen, Profile)
- Supabase tables, migrations, Edge Functions
- `backups/` and `_archive/` directories
- `expo-notifications` wiring (already complete, out of scope)

---

## Known deferred items

These are intentionally NOT fixed by this workstream:

### empathy.tsx persistence bug
`empathy.tsx` line 46: `onboardingStore.readiness = null` — writes to the wrong field.
The empathy answer (exam motivation reason) is never persisted. The `null` is subsequently
overwritten correctly by `readiness.tsx`, so the readiness field is unaffected.
**Status:** Deferred post-launch. Commented in code. See `OB-00b-empathy-fix-plan.md`.

### Paywall routes D1/D2
The paywall (`/onboarding_launch/paywall`) and trial transparency screens have known UX
issues flagged in earlier investigation work. Out of scope for this workstream.

### Auth bugs A1/A2/A3
Known auth flow issues (sign-in edge cases, password reset) tracked separately. Out of scope.

---

## Communication preferences

- Commit messages use the format: `OB-XX: brief description in plain English`
- Task reports go in `docs/onboarding-conviction/` with filename `OB-XX-[slug]-report.md`
- Bugs found during a task are reported with severity P0 (blocker) / P1 (should-fix) / P2 (polish) / P3 (cosmetic)
- When in doubt about scope, stop and ask. Do not expand scope unilaterally.

---

## Workstream status (as of OB-10)

| Task | Title | Status |
|---|---|---|
| OB-00 | Codebase investigation | ✅ |
| OB-01 | Install Reanimated + conviction copy data file | ✅ |
| OB-02 | ConvictionCard flip component | ✅ |
| OB-03 | ConfettiParticles sub-component | ✅ |
| OB-04 | Wire Screen 02 — cert.tsx + auto flip-back | ✅ |
| OB-05 | Shared conviction lookup — 8 screens, 37 entries | ✅ |
| OB-06 | Screen 02 refactor + Screen 03 wiring | ✅ |
| OB-07 | Screens 04+05 (empathy + timeline) | ✅ |
| OB-08 | Screens 06, 07, 11, 13 | ✅ |
| OB-09 | Regression pass | ✅ |
| OB-10 | Visual QA + targeted fixes | ✅ |
