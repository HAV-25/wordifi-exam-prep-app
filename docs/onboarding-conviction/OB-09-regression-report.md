# OB-09 — Regression Report

**Date:** 2026-04-19  
**Agent:** Claude / OB-09 task  
**Scope:** Onboarding question screens 02, 03, 04, 05, 06, 07, 11, 13 · ConvictionAnswerCard · ConfettiParticles · convictionLookup  
**Method:** Static code analysis + TypeScript compiler check. Device execution is noted where required for definitive verification.

---

## Pre-flight notes

Two referenced artefacts were not found in the repository:

| Artefact | Referenced by | Status |
|---|---|---|
| `docs/onboarding-conviction/AGENT_CONTEXT.md` | Every OB-01 – OB-09 task doc | **File does not exist.** Presumably never committed. No runtime impact. |
| `Wordifi_UX_Test_Cases.docx` | Part 1 of this task | **File does not exist** in repo root or anywhere on the search path. TC-011 – TC-015 evaluated from code logic and routing inspection. |

---

## Part 1 — TC-011 through TC-015

*Evaluated via code tracing, not live device execution. Flag any result marked ⚠️ for device confirmation.*

| TC | Title | Code finding | Result |
|---|---|---|---|
| TC-011 | Onboarding Q1 (level select) — selection saves, user can proceed | `level.tsx`: `onboardingStore.level = selected` in `handleContinue`; gate is `if (!selected) return` (never reached when `continueActive` is true, since `continueActive` is only set after a successful flip). Routing to `/onboarding_launch/empathy` confirmed. | **PASS (static)** |
| TC-012 | Onboarding Q2 (exam type / cert select) — selection saves, user can proceed | `cert.tsx`: `onboardingStore.cert = selected` in `handleContinue`; same gate pattern. Routing to `/onboarding_launch/level` confirmed. | **PASS (static)** |
| TC-013 | Onboarding Q3 (exam date / timeline) — **TC wording is stale** | TC referenced a "date picker". Screen 05 (`timeline.tsx`) uses 5 categorical options (`lt4w`, `1to3m`, `3to6m`, `gt6m`, `none`). No date picker exists. Tested against actual behaviour: `onboardingStore.timeline = selected` in `handleContinue`; routing to `/onboarding_launch/readiness` confirmed. | **PASS (static) — TC wording stale, see below** |
| TC-014 | Onboarding complete — profile updated, lands on home, no loop | Full routing chain verified: cert → level → empathy → timeline → readiness → hardest → daily-commitment → learner-style → leaderboard → plan-builder → gap-analysis → notifications → plan-summary → trial-transparency → paywall → auth. All `router.push` targets exist in the file system. Store populated for 6 of 7 fields (see edge case #8). | **PASS (static) ⚠️ device confirm end-state** |
| TC-015 | Onboarding skip — skip option works | No skip button exists in any of the 8 question screens. The only skip-adjacent behaviour is the back button (`router.back()`). No skip routes declared anywhere in `onboarding_launch/`. | **N/A — no skip functionality in scope** |

**TC-013 stale wording note:** The test case mentions a "date picker" that was presumably part of an earlier design. The current implementation uses categorical timeline cards. The underlying test intent (does the timeline answer save and navigation proceed?) passes.

---

## Part 2 — Conviction card behavioural sweep (48 cells)

All 8 screens use identical `ConvictionAnswerCard` integration. The component logic is centralised — per-screen variation is data only (convictionLookup, option arrays, store field written). Static analysis covers the entire component once; results apply uniformly unless a per-screen exception is noted.

| Behaviour | S02 cert | S03 level | S04 empathy | S05 timeline | S06 readiness | S07 hardest | S11 daily-commit | S13 learner-style |
|---|---|---|---|---|---|---|---|---|
| **Cold tap** — haptic, flip, particles, hold, flip-back to selected | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| **Re-tap same card** — re-flips, particles replay fresh | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| **Tap different card** — previous reverts default, new flips | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| **Continue during yellow** — cancels timer, navigates immediately | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| **Continue after selected** — navigates normally | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| **Reduce Motion ON** — instant yellow, 2.5s wait, instant flip-back to selected | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

**Rationale for PASS calls:**

- **Cold tap:** `handlePress → onPress → setSelected → isSelected useEffect → triggerForwardFlip → withTiming(1, 300ms, callback) → [callback: setParticlesActive(true), startFlipBackTimer, notifyFlipComplete]`. Timer is 2500ms, fires `withTiming(0)` → `setParticlesActive(false)`. Code path complete.
- **Re-tap:** `handlePress` when `isSelected=true` → `setRetapKey(k+1)` + `onPress()`. `retapKey` effect → `cancelFlipBack + setParticlesActive(false) + triggerForwardFlip`. `isSelected` stays true (same value, no re-fire on isSelected effect). Code path complete.
- **Tap different card:** New selection → old card's `isSelected` effect fires `cancelFlipBack + withTiming(0)` + `setParticlesActive(false)`. New card's `isSelected` effect fires `triggerForwardFlip`. React batches the state update so both effects fire in the same render pass. Code path complete.
- **Continue during yellow:** `handleContinue → cancelFlipBackRef.current?.()` → calls `cancelFlipBack` inside the card → `clearTimeout(flipBackTimerRef.current)` → timer cleared before it fires → `router.push(...)`. Code path complete.
- **Continue after selected (timer already fired):** `cancelFlipBackRef.current?.()` calls `cancelFlipBack` which checks `flipBackTimerRef.current !== null` — false since timer cleared itself on fire — no-op. Safe. `router.push(...)` executes.
- **Reduce Motion ON:** `reduceMotionRef.current = true` → `triggerForwardFlip` takes the instant branch: `flipProgress.value = 1` synchronously, `setParticlesActive(true)`, `startFlipBackTimer()`. Timer fires, takes `flipProgress.value = 0` branch (instant). `HOLD_DURATION` still 2500ms on all paths.

**Per-screen exceptions noted:**

- **S11 daily-commitment:** `selected` starts as `null` (changed from pre-selected `15` in OB-08 per brief §5.4). Conviction card pattern fires correctly.
- **S04 empathy:** `handleContinue` writes `onboardingStore.readiness = null` (known deferred bug, commented). Does NOT prevent navigation or conviction card behaviour. PASS for conviction pattern; store persistence is a known P1 tracked separately.
- **S03 level:** 2 locked cards (B2, C1/C2) are plain `<View>` elements, not `ConvictionAnswerCard`. They have no tap handler. Correct.

---

## Part 3 — Edge case sweep

### EC-01: Background + foreground during yellow hold
**Method:** Static analysis of `setTimeout` behaviour in React Native.  
**Finding:** React Native's JS runtime is suspended on iOS when the app is backgrounded. `setTimeout` callbacks do not fire while backgrounded; they catch up on foreground resume. Expected behaviour: user backgrounds app during yellow hold, returns after 5 seconds → card flips back immediately on resume (timer debt accumulated). The `clearTimeout` in `cancelFlipBack` and unmount cleanup both remain safe across background/foreground. No state persistence API (`AsyncStorage` etc.) is used for flip state — it's in-memory React state, so if the app is process-killed and restarted, the user would return to the splash screen, not the mid-flip state.  
**Result:** ⚠️ **Needs device test on both iOS and Android** to confirm timer catch-up timing. Code path is safe (no leaks).

### EC-02: Navigate backward mid-hold
**Method:** Static analysis of unmount cleanup.  
**Finding:** `ConvictionAnswerCard` has:
```tsx
useEffect(() => {
  return () => { cancelFlipBack(); };
}, []);
```
When the user presses back during the 2500ms hold, the screen unmounts, this cleanup fires, `clearTimeout(flipBackTimerRef.current)` runs before the timer can fire. No `setState` on unmounted component. Metro warnings should not appear.  
**Result:** **PASS (static)** — no leaked timers. ⚠️ Confirm visually with Metro console on device.

### EC-03: Rapid tapping
**Method:** Static analysis of React state batching + `retapKey` pattern.  
**Finding:** All `setSelected(id)` calls are in the JS thread. React batches synchronous state updates within a single event handler. A rapid A→B→A→B→C sequence resolves to `selected=C`. The last-tapped card's `isSelected` effect fires with `true`, all others fire with `false`. The `retapKey` pattern only increments when `isSelected` is already `true` at press time, which in rapid multi-card tapping is unlikely (only the last-selected card holds `isSelected=true`). Result: only one card ever in yellow/selected state at any moment. Animation may look choppy for rapid switches (each animation starts then gets overwritten) but state remains consistent.  
**Result:** **PASS (static)** ⚠️ Confirm animation quality on device.

### EC-04: Double-tap Continue
**Method:** Code inspection.  
**Finding:** The Continue button has `disabled={!continueActive}`. Once `continueActive=true` it stays true (never set back to false, per brief §5.4 point 4). The button has no "navigating" lock. If the user double-taps Continue fast enough before expo-router processes the first push, `handleContinue` could fire twice, pushing the same route twice onto the navigation stack. Expo-router does not natively deduplicate identical `push` calls.  
**Result:** ⚠️ **P2 — potential double-navigate on rapid Continue tap.** Not blocking (requires deliberate double-tap), but creates a navigation stack with a duplicate entry. Documented for follow-up. Needs device test to confirm reproducibility.

### EC-05: TypeScript full project check
**Method:** `npx tsc --noEmit` from `expo/` directory.  
**Finding:** Zero TypeScript errors in any OB-01 through OB-08 modified file:
- `expo/components/onboarding/ConvictionAnswerCard.tsx` — **0 errors**
- `expo/components/onboarding/ConfettiParticles.tsx` — **0 errors**
- `expo/components/onboarding/convictionLookup.ts` — **0 errors**
- `expo/app/onboarding_launch/cert.tsx` — **0 errors**
- `expo/app/onboarding_launch/level.tsx` — **0 errors**
- `expo/app/onboarding_launch/empathy.tsx` — **0 errors**
- `expo/app/onboarding_launch/timeline.tsx` — **0 errors**
- `expo/app/onboarding_launch/readiness.tsx` — **0 errors**
- `expo/app/onboarding_launch/hardest.tsx` — **0 errors**
- `expo/app/onboarding_launch/daily-commitment.tsx` — **0 errors**
- `expo/app/onboarding_launch/learner-style.tsx` — **0 errors**

Pre-existing errors (not OB-introduced) exist in:
- `app/_archive/sectional-results.v1.tsx` (2 errors) — archive file
- `app/_layout.tsx` (2 errors) — pre-existing `Text` JSX type issue
- `app/onboarding_launch/trial-transparency.tsx` (1 error) — duplicate property
- `app/onboarding_launch_v1_2026-04-05/readiness.tsx` (1 error) — versioned backup
- `backups/index.v1.2026-04-03.tsx` (5 errors) — backup file
- `components/SchreibenResult.tsx` (1 error) — missing Platform import
- `hooks/useWalkthroughTarget.ts` (2 errors) — RefObject null typing
- `lib/realtimeSession.ts` (8 errors) — realtime speech module
- `lib/schreibenHelpers.ts` (2 errors) — Supabase query type

**Result:** **PASS** — zero OB-introduced TypeScript errors.

### EC-06: Metro console during full flow
**Method:** Cannot execute without a connected device. Static analysis only.  
**Finding:** No `console.warn` or `console.error` calls exist in the OB-added files. No known Reanimated v4 misuse (no `useAnimatedProps` on non-animated components, no worklet functions accessing JS-thread state directly except via `runOnJS`). The `withDelay` + `withTiming` on `ConfettiParticles` is a valid Reanimated v4 pattern.  
**Result:** ⚠️ **Needs device test.** Expected: no Reanimated warnings. The `runOnJS` wrappers in `triggerForwardFlip` are correct — `setParticlesActive`, `startFlipBackTimer`, `notifyFlipComplete` are JS-thread functions passed through `runOnJS`.

### EC-07: Card dimensions across all 8 screens
**Method:** Cannot measure rendered dimensions without a running app. Style dimensions from code.

| Screen | Card base style | Default border | Selected border | Back face |
|---|---|---|---|---|
| S02 cert | `padding: 16`, `borderRadius: 12` | `borderWidth: 1` | same (`borderWidth` unchanged) | `borderRadius: 12` |
| S03 level | `padding: 20`, `borderRadius: 16` | `borderWidth: 1.5` | same | `borderRadius: 16` |
| S04 empathy | `padding: 20`, `borderRadius: 16` | `borderWidth: 1.5` | same | `borderRadius: 16` |
| S05 timeline | `padding: 20`, `borderRadius: 16` | `borderWidth: 1.5` | same | `borderRadius: 16` |
| S06 readiness | `padding: 20`, `borderRadius: 16` | `borderWidth: 1.5` | same | `borderRadius: 16` |
| S07 hardest | `padding: 20`, `borderRadius: 16` | `borderWidth: 1.5` | same | `borderRadius: 16` |
| S11 daily-commit | `padding: 20`, `borderRadius: 16` | `borderWidth: 1` | same | `borderRadius: 16` |
| S13 learner-style | `padding: 16`, `borderRadius: 16` | `borderWidth: 1` | same | `borderRadius: 16` |

**Brief §5.1 says card dimensions must be identical across default / yellow / selected states on the same screen.** Static analysis confirms this is satisfied: the selected state only changes `borderColor` and `backgroundColor`. The back face is `position: absolute, top: 0, left: 0, right: 0, bottom: 0` — it exactly overlays the front face with no resize. `borderWidth` is the same across all states. No layout-affecting style changes between states. **PASS (static)**.

**Cross-screen variance noted:** S02 uses `padding: 16 / borderRadius: 12 / borderWidth: 1`, while S03–S07 use `padding: 20 / borderRadius: 16 / borderWidth: 1.5`. S11 and S13 differ slightly (`borderWidth: 1`). These are expected screen-specific design differences, not regressions.

⚠️ Measure actual rendered dimensions on device to confirm no surprises from content wrapping.

### EC-08: Store state after complete walk
**Method:** Static routing and store write trace.

| Store field | Written by | Value | Notes |
|---|---|---|---|
| `onboardingStore.cert` | `cert.tsx` handleContinue | Selected `CertId` | ✓ |
| `onboardingStore.level` | `level.tsx` handleContinue | Selected `LevelId` | ✓ |
| Empathy reason | — | **NOT STORED** | Known deferred bug: `empathy.tsx` writes `onboardingStore.readiness = null` instead of persisting the reason. The `null` is then overwritten correctly by `readiness.tsx`. See finding F-03. |
| `onboardingStore.timeline` | `timeline.tsx` handleContinue | Selected `TimelineId` | ✓ |
| `onboardingStore.readiness` | `readiness.tsx` handleContinue | Selected `ReadinessId` | ✓ — correctly overwrites the `null` from empathy.tsx |
| `onboardingStore.hardest` | `hardest.tsx` handleContinue | Selected `HardestId` | ✓ |
| `onboardingStore.dailyMinutes` | `daily-commitment.tsx` handleContinue | Selected `DailyMinutes` | ✓ |
| `onboardingStore.learnerStyle` | `learner-style.tsx` handleContinue | Selected `LearnerStyleId` | ✓ |

**Result:** 6 of 7 fields persist correctly after a complete walk. The empathy answer (exam motivation reason) is never stored anywhere — pre-existing deferred bug, not OB-introduced.

---

## Part 4 — Accessibility verification

**Method:** Static code analysis only. VoiceOver / TalkBack execution not possible without a physical device.

### S02 cert (4 cards, 12px radius)
| Check | Finding | Result |
|---|---|---|
| Front face reads answer label | `accessibilityLabel={accessibilityLabel}` when `isSelected=false`, where `accessibilityLabel` = `cert.title`. Front face `accessibilityElementsHidden={isSelected}` = false. | PASS (static) |
| Yellow face conviction copy announced | When `isSelected=true`: `accessibilityLabel` on Pressable = `${conviction.emoji} ${conviction.copy}`. Back face `accessibilityElementsHidden={false}`. | PASS (static) |
| Particles not announced | `ConfettiParticles` root View has `accessibilityElementsHidden={true}` and `importantForAccessibility="no-hide-descendants"`. | PASS (static) |
| Continue announced | `accessibilityRole="button"`, `accessibilityLabel="Continue"` on Pressable. | PASS (static) |
| **Note — label after flip-back** | When card returns to selected state (front face visible), `accessibilityLabel` still reads conviction copy, not card title. See Finding F-04. | ⚠️ P2 |

### S06 readiness (5 cards)
Same component, same findings. PASS (static) with same F-04 note.

### S11 daily-commitment (4 cards, recommended badge)
Same component. Badge (`position: absolute`) is part of `children` (front face). Badge has no `accessibilityElementsHidden` — it's accessible as a descendant of the front face. When front face is hidden (`isSelected=true`), badge is also hidden. When front face is visible, badge is readable. **No issue.**

---

## Findings summary

| ID | Severity | Category | Description |
|---|---|---|---|
| **F-01** | **P2 polish** | Visual consistency | `cert.tsx` CTA button has `borderRadius: 16` while all other 7 screens use `borderRadius: 100` (pill). Brief design system specifies pill shape for primary CTAs. Screen 02 CTA looks like a rounded rect, all others are pill. |
| **F-02** | **P2 polish** | Visual consistency | `cert.tsx` passes `cardBorderRadius={12}` to `ConvictionAnswerCard` while all other 7 screens pass `cardBorderRadius={16}`. This means the yellow back face on Screen 02 has 12px corners; all others have 16px. May be intentional (cert card design pre-dates OB), but inconsistent. |
| **F-03** | **P1 deferred (pre-existing)** | Store persistence | `empathy.tsx` does not persist the selected exam motivation reason. `onboardingStore.readiness = null` is written instead. Exam motivation reason is lost. `readiness.tsx` then correctly overwrites the `null` with the real readiness answer, so the readiness field is unaffected. This bug predates OB work; comment in code says "deferred post-launch". |
| **F-04** | **P2 polish** | Accessibility | After a card flip-back to selected state, the card's `accessibilityLabel` continues to read the conviction copy (`${conviction.emoji} ${conviction.copy}`) rather than the card title. A VoiceOver user focusing the card after flip-back hears the conviction text, not the answer title shown visually. Debatable whether this is intentional (conviction reinforcement) or confusing. |
| **F-05** | **P2 polish** | UX risk | Continue button has no "navigating" lock. After `continueActive=true`, a rapid double-tap on Continue could call `router.push()` twice before expo-router processes the first navigation. This would push a duplicate route onto the stack. Requires a deliberately fast double-tap; not a crash but creates unexpected back-stack depth. |
| **F-06** | N/A — confirmed | Missing docs | `AGENT_CONTEXT.md` referenced by all OB task docs does not exist in the repository. No functional impact but any future agent reading task docs will hit a dead reference. |
| **F-07** | N/A — confirmed | Stale test case | `Wordifi_UX_Test_Cases.docx` does not exist in the repo. TC-013 wording (mentions "date picker") is stale vs actual categorical timeline screen. |

---

## Recommendation

### Warrant follow-up tasks

| Finding | Action | Suggested task |
|---|---|---|
| F-01 | Fix cert.tsx CTA `borderRadius: 16` → `100`. 1-line change. | OB-10 visual QA, or trivial fix inline if PO agrees. |
| F-02 | Confirm with PO whether cert screen is intentionally 12px cards. If yes: document. If no: update cert.tsx `cardBorderRadius` to 16 and card style `borderRadius` to 16. | PO decision needed first. |
| F-04 | Decide: should the card title or conviction copy be announced after flip-back? If card title: change `accessibilityLabel` to always use the title when `isSelected` but `flipProgress` is back at 0. This requires lifting flip state to parent, which is out of scope. Alternative: add `accessibilityHint` for conviction copy instead of using it as label. | Deferred to accessibility pass. |
| F-05 | Add a `navigatingRef` (or disable the button on first press) to prevent double-navigate. ~5 lines per screen or ~3 lines in the component if handled internally. | OB-11 or inline fix at PO discretion. |

### No follow-up needed
- F-03: already tracked and commented.
- F-06 / F-07: documentation gaps, no code fix needed.
- EC-01, EC-04, EC-06: need device verification; behaviour expected to be correct.
- TypeScript: clean.

### Auto-fixed bugs
None. No silent fixes applied this pass.

---

## Routing chain verified

```
app-intro → cert (02) → level (03) → empathy (04) → timeline (05)
  → readiness (06) → hardest (07) → daily-commitment (11)
  → learner-style (13) → leaderboard → plan-builder → gap-analysis
  → notifications → plan-summary → trial-transparency → paywall → auth
```

All `router.push` targets exist as files. No broken links. No loops back into the question screens from any downstream screen.
