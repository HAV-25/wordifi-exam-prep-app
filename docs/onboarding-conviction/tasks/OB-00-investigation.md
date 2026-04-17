# OB-00 — Codebase Investigation & Setup

**Status:** [x] Complete  
**Brief sections:** All (orientation)

---

## Objective
Map the onboarding flow files, verify answer key alignment, identify critical gaps before any code is written.

## Findings

### Onboarding directory
Active flow: `expo/app/onboarding_launch/`  
Legacy copy (do not touch): `expo/app/onboarding_launch_v1_2026-04-05/`

### Screen → file mapping

| Brief Screen | File | Answer type | Answer keys |
|---|---|---|---|
| 02 Certification | `cert.tsx` | `CertId` | `goethe \| telc \| osd \| not_sure` |
| 03 Level | `level.tsx` | `LevelId` | `A1 \| A2 \| B1` |
| 04 Why | `empathy.tsx` | `ReasonId` (local) | `visa \| work \| university \| settlement \| family \| personal` |
| 05 Date | `timeline.tsx` | `TimelineId` | `lt4w \| 1to3m \| 3to6m \| gt6m \| none` |
| 06 Readiness | `readiness.tsx` | `ReadinessId` | `not_at_all \| not_very \| somewhat \| mostly \| very` |
| 07 Hardest | `hardest.tsx` | `HardestId` | `reading \| listening \| writing \| speaking \| grammar \| everything` |
| 11 Minutes | `daily-commitment.tsx` | `DailyMinutes` (numeric) | `5 \| 15 \| 25 \| 30` |
| 13 Style | `learner-style.tsx` | `LearnerStyleId` | `sprinter \| builder \| sniper \| explorer` |

### Answer key alignment with conviction cards doc
All answer keys map cleanly to the copy doc entries with one note:
- Screen 04: the `personal` key maps to the doc's "Personal goal" (💪) entry — confirmed.
- Screen 11: `25` maps to the doc's "20 to 30 minutes" entry; `30` maps to "More than 30 minutes" — confirmed.

### Card anatomy
Every question screen uses the same pattern:
- `Pressable` wrapper per answer card
- `cardSelected` style applied when `selected === item.id`
- No fixed explicit height on cards — height is set by padding + content
- Cards have `borderRadius: 12` (cert) or `16` (empathy, hardest, etc.)

The brief (§5.1) requires the conviction card be pixel-identical in size. Since current cards have no fixed height, the ConvictionCard component will need to use `onLayout` to capture the rendered height of the front face and mirror it on the back.

### Store
`expo/app/onboarding_launch/_store.ts` — module-level mutable object (not Context/reducer).  
All 7 answer fields present. Screen 04 (empathy) does **not** write to the store (no `empathy` field exists — not our problem per AGENT_CONTEXT).

### Dependencies
- `expo-haptics ~15.0.8` — ✅ installed
- `react-native-reanimated` — ❌ **NOT installed, NOT in node_modules**  
  → OB-01 must install it before any animation code is written.
- `react-native-gesture-handler ~2.28.0` — ✅ installed (needed by Reanimated)

### No blockers
No answer key mismatches. No "do not touch" boundary violations in scope. Reanimated absence is the only prerequisite gap.

---

## Acceptance criteria
- [x] All 8 screen files located and read
- [x] All answer keys verified against conviction cards doc
- [x] Store structure understood
- [x] Reanimated gap documented
- [x] BACKLOG.md and all task files created
