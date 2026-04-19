# OB-10 — Visual QA + Targeted Fixes Report

**Date:** 2026-04-19  
**Agent:** Claude / OB-10 task  
**Status:** Parts 0 and 1 complete · Part 2 blocked (see below)

---

## Part 0 — AGENT_CONTEXT.md

**Status: RESTORED.**

File did not exist when OB-10 began. Created from:
- Task file history (OB-00 through OB-09)
- Commit log and code inspection
- Brief cross-reference

Committed: `8a1b500` — "OB-10: restore AGENT_CONTEXT.md (housekeeping)"

Content covers: tech stack, source-of-truth docs, component architecture,
non-negotiable rules, per-task loop, scope, do-not-touch list, known deferred items,
communication preferences, and workstream status table.

---

## Part 1 — Targeted fixes

### F-01: cert.tsx CTA borderRadius
**Commit:** `f378845` — "OB-10: F-01 cert.tsx CTA borderRadius matches other screens"

**Investigation:** All 7 other screens audited:

| Screen | CTA borderRadius |
|---|---|
| level.tsx | 100 |
| empathy.tsx | 100 |
| timeline.tsx | 100 |
| readiness.tsx | 100 |
| hardest.tsx | 100 |
| learner-style.tsx | 100 |
| daily-commitment.tsx | 999 |

6 of 7 use `100`. `999` (daily-commitment) is functionally identical (any value ≥ 50% of height
renders a pill on a standard CTA height). `100` is the design system standard. cert.tsx was
the only screen with a visually distinct `16` (rounded rect, not pill).

**Change:** `cert.tsx` `styles.ctaButton.borderRadius`: `16` → `100`

**Note:** This mismatch predated OB work — `git show 9638d20` confirms cert.tsx already had
`borderRadius: 16` on the CTA before any OB task touched it.

---

### F-02: cert.tsx cardBorderRadius
**Commit:** `c2fc0d3` — "OB-10: F-02 cert.tsx cardBorderRadius confirmed intentional at 12"

**Investigation:** `git show 9638d20:expo/app/onboarding_launch/cert.tsx` shows `borderRadius: 12`
in `styles.card` at the pre-OB-06 snapshot. The 12px card corner radius was the original cert
screen design — it was not introduced by any OB task.

**Decision:** No change. `cardBorderRadius={12}` is intentional. Added a documentary JSX comment:
```tsx
cardBorderRadius={12} /* intentional: cert screen uses 12px cards; all others 16px — original design, verified OB-10 */
```

cert.tsx also uses `padding: 16` and `borderWidth: 1` where other screens use `padding: 20` and
`borderWidth: 1.5` — the cert screen was designed with slightly more compact cards throughout.
Changing cardBorderRadius to 16 would create a 4px mismatch between the card's front face
(12px) and its yellow back face (hypothetical 16px). Not a safe change without a design revision.

---

### F-04: accessibilityLabel reads answer in selected state
**Commit:** `c49b753` — "OB-10: F-04 accessibilityLabel reads answer in selected state"

**Change in `ConvictionAnswerCard.tsx`:**

Before:
```tsx
accessibilityLabel={
  isSelected
    ? `${conviction.emoji} ${conviction.copy}`
    : accessibilityLabel
}
```

After:
```tsx
accessibilityLabel={
  // Yellow face is showing → read conviction copy.
  // Default or selected-state front face → read the answer label.
  // accessibilityState.selected handles the "selected" announcement
  // natively on both iOS (VoiceOver) and Android (TalkBack).
  particlesActive
    ? `${conviction.emoji} ${conviction.copy}`
    : accessibilityLabel
}
```

**Rationale:** `particlesActive` is true exactly while the yellow face is visible (set to `true`
in the flip-complete callback, set to `false` when the flip-back completes). This gates the
conviction copy announcement to the right window:

| State | `particlesActive` | `accessibilityLabel` |
|---|---|---|
| Default (not tapped) | false | answer label (e.g. "Goethe-Institut") |
| Yellow face showing | true | conviction copy (e.g. "🎓 Perfect. Wordifi has every Goethe section covered.") |
| Selected state (post flip-back) | false | answer label (e.g. "Goethe-Institut") |

`accessibilityState={{ selected: isSelected }}` (unchanged) causes iOS VoiceOver to append
"selected" after the label when `isSelected=true`, giving the correct final announcement:
*"Goethe-Institut, selected"* — which is what a screen reader user expects when re-focusing
a card they've already chosen.

**Note:** During the 300ms forward flip animation (before `particlesActive` turns true),
`accessibilityLabel` reads the answer label. This is a brief, acceptable window.

---

### F-05: Continue button navigation lock
**Commit:** `d7cd278` — "OB-10: F-05 Continue button lock during navigation"

**Change:** Added `isNavigatingRef` to all 8 question screens. Pattern applied uniformly:

```tsx
// Declaration (added alongside existing refs)
const isNavigatingRef = useRef(false);

// Guard (first 2 lines of handleContinue)
function handleContinue() {
  if (isNavigatingRef.current) return;
  isNavigatingRef.current = true;
  // ... rest unchanged
}
```

**Why `useRef` and not `useState`:** A state update would cause a re-render; a ref mutation
does not. The guard only needs to prevent a second call, not update UI. `useRef` is the
correct tool.

**Why it resets correctly:** The ref is declared inside the screen component function. When
the user navigates away and returns (or the screen remounts fresh), a new ref is created with
`current = false`. No manual reset needed.

**Screens patched:** cert, level, empathy, timeline, readiness, hardest, daily-commitment, learner-style (all 8).

---

## Part 2 — Visual QA on device

### BLOCKED

**Reason:** No simulator or physical device is accessible from the agent environment.

- `xcrun` is not available (Windows host, not macOS — iOS simulator requires macOS).
- `adb devices` reports no attached devices (`List of devices attached` with empty list —
  no Android emulator running, no physical Android connected).

Per the task instructions: *"Do not substitute static analysis. This task's entire purpose is
device verification."*

**Stopping here. Part 2 cannot proceed without:**
- A running iOS simulator (macOS only) or connected iOS device
- OR a running Android emulator or connected Android device with `adb` access

### What remains to be done by PO or on a device

| Check | How to verify |
|---|---|
| **Measurements table** (8 screens × 3 states) | `onLayout` logging in a dev build, or React DevTools layout inspector |
| **Timing verification** (Screens 02 and 07) | Screen recording + frame analysis (flip ≈300ms, hold ≈2500ms) |
| **Colour hex verification** | Screenshot from simulator → eyedropper in Figma or macOS Digital Color Meter |
| **Cross-screen consistency** | Manual walkthrough — feel for timing and haptic uniformity |
| **Accessibility / VoiceOver** | iOS Simulator Cmd+F5 to enable VoiceOver; walk Screen 02 and Screen 07 |
| **TC-014 end-state** | Complete full flow cold, confirm onboarding doesn't re-trigger on home |
| **EC-01 background/foreground** | App home → return, confirm timer behaviour on resume |

The EAS Android build from OB-08 (`24ae3971`) included all OB-01–OB-08 changes. The fixes
from OB-10 are NOT yet in a build. A new EAS build is needed before device QA.

---

## Summary

### Changes landed (Part 0 + Part 1)

| Commit | Change | Status |
|---|---|---|
| `8a1b500` | AGENT_CONTEXT.md restored | ✅ |
| `f378845` | F-01: cert.tsx CTA borderRadius 16 → 100 | ✅ |
| `c2fc0d3` | F-02: cert.tsx cardBorderRadius confirmed intentional at 12 | ✅ (doc only) |
| `c49b753` | F-04: accessibilityLabel reads answer label in selected state | ✅ |
| `d7cd278` | F-05: Continue button lock (isNavigatingRef) on all 8 screens | ✅ |

### Residual issues after OB-10 fixes

| Finding | Status after OB-10 |
|---|---|
| F-01 cert CTA borderRadius | ✅ Fixed |
| F-02 cert cardBorderRadius | ✅ Confirmed intentional, documented |
| F-03 empathy persistence bug | ⏳ Deferred (separate post-launch task) |
| F-04 accessibilityLabel | ✅ Fixed |
| F-05 double-navigate | ✅ Fixed |
| Part 2 visual QA | ⏳ Blocked — needs device/simulator run by PO |

### Recommendation

**The conviction card workstream is code-complete.** All 4 targeted fixes are applied and
TypeScript-clean. Device QA (Part 2) cannot be completed from this environment.

**Suggested next step:** PO runs the updated build on device, completes the measurements table
and timing/colour checks. If the PO tested the flow after OB-08 and found it consistent, the
remaining checks are confirmatory rather than gating — the F-01/F-04/F-05 fixes are low-risk
changes (1-line radius, accessibility text, 2-line guard).

The empathy.tsx persistence bug (F-03) remains deferred and should be scheduled as a
separate post-launch task when product decides what field should receive the exam
motivation answer.
