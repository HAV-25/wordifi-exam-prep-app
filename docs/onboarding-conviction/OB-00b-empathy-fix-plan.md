# OB-00b — Empathy Answer Persistence — Fix Plan

**Type:** Plan only. No code changes.  
**Author:** Claude Code, 2026-04-17

---

## Section 1 — The Bug, Precisely

### Exact location
`expo/app/onboarding_launch/empathy.tsx`, line 35:
```ts
function handleContinue() {
  if (!selected) return;
  onboardingStore.readiness = null;   // ← the bug
  router.push('/onboarding_launch/timeline');
}
```

### What it writes today
`onboardingStore.readiness = null` — overwrites the `readiness` field of the global onboarding store with `null`, and does NOT persist the user's selected motivation reason anywhere.

### What it should write
Either:
- `onboardingStore.empathy = selected;` (if an `empathy` field existed in the store), or
- Nothing — if the product decision is that exam motivation should not be stored.

### Why it was probably written this way
Almost certainly a copy-paste accident from the v1 flow, which has the identical line at `expo/app/onboarding_launch_v1_2026-04-05/empathy.tsx:95`. The v1 and v2 empathy screens share the same author comment (both say `onboardingStore.readiness = null`), which means neither version ever had this implemented. Best guess: the developer copy-pasted the screen template from `readiness.tsx` (which does write `onboardingStore.readiness = selected`), stripped the content, and left the store write as a placeholder that was never filled in — because no `empathy` field was ever added to `OnboardingAnswers`.

### Downstream consequences today
**Zero functional impact.** This is why the bug has gone unnoticed:

1. **The write is a no-op.** `empathy.tsx` is Step 3 of 10. `readiness.tsx` is Step 5. At Step 3, `onboardingStore.readiness` is already `null` (its initial value). Writing `null` to `null` changes nothing.

2. **No downstream code reads an empathy/reason field.** Checked:
   - `plan-builder.tsx:96` destructures `{ cert, level, timeline, hardest, dailyMinutes }` — no empathy
   - `gap-analysis.tsx:50` destructures `{ cert, level, timeline, readiness, hardest }` — no empathy
   - `plan-summary.tsx:124` destructures `{ cert, level, timeline, dailyMinutes, learnerStyle, hardest }` — no empathy
   - `profileHelpers.ts:315-320` saves `onboarding_cert`, `onboarding_readiness`, `onboarding_hardest`, `onboarding_daily_minutes`, `onboarding_learner_style` — no empathy column

3. **No Supabase column exists.** `expo/types/database.ts` lines 101–107 list all `onboarding_*` columns on `user_profiles`. There is no `onboarding_empathy` or `onboarding_reason` column. No migration was ever written.

Note for completeness: `onboarding_level` and `onboarding_timeline` are also absent from `user_profiles` — those store fields exist but are never persisted to Supabase either. This is a separate pre-existing gap outside this workstream.

---

## Section 2 — Options

### Option A — Minimal store fix (memory-only)
**What changes:**
- `_store.ts`: add `empathy: ReasonId | null` to `OnboardingAnswers` type and initialise to `null`
- `_store.ts`: export `type ReasonId` (currently defined locally inside `empathy.tsx`)
- `empathy.tsx`: change line 35 from `onboardingStore.readiness = null` to `onboardingStore.empathy = selected`

**Scope:** ~8 lines across 2 files.

**Risk:** Minimal. No navigation logic changes, no Supabase writes, no schema changes. The `empathy` value is in memory for the session but nothing consumes it yet — it's dead storage.

**Timing:** Can be done as a standalone PR before OB-06 without blocking the conviction work. OB-06 integration is unchanged — the conviction card flip operates on local `selected` state, not the store.

---

### Option B — Full persistence (store + Supabase column)
**What changes:**
- Everything in Option A, plus:
- `profileHelpers.ts`: add `onboarding_empathy: answers.empathy` to the `UPDATE` payload
- `profileHelpers.ts`: add `profile.onboarding_empathy != null` to the "already completed" check
- `types/database.ts`: add `onboarding_empathy: string | null` to `UserProfile`
- **Supabase migration required** to add the `onboarding_empathy` column to `user_profiles`. Cannot be written in this workstream per AGENT_CONTEXT.

**Scope:** ~15 lines of app code + 1 migration SQL statement (blocked until cleared).

**Risk:** Low-risk app code change; the migration is additive (new nullable column, no existing rows affected). However, migration is out of scope here and must be cleared separately.

**Timing:** Can be done before OB-06 (app code only), with the migration following independently. Or done post-OB-10 as cleanup once the workstream is complete.

---

### Option C — Explicit defer with comment cleanup
**What changes:**
- `empathy.tsx`: replace `onboardingStore.readiness = null` with a comment:
  ```ts
  // TODO(empathy-persist): store exam motivation reason once product confirms downstream use
  ```

**Scope:** 1 line.

**Risk:** Zero. The behaviour is identical (neither version persists the answer). Cleaner than the misleading `readiness = null` write.

**Timing:** Can be done in 60 seconds at any point in the workstream. Or left as-is until post-launch.

---

## Section 3 — Recommendation

**Recommended: Option C (explicit defer) now, with Option A queued for a post-OB-10 cleanup PR.**

The exam motivation answer is not consumed anywhere in the current product — not by the plan builder, not by gap analysis, not by Supabase, not by any personalisation logic. Storing it without a consumer is dead code, and adding a Supabase column for data that drives nothing would be premature schema growth. The conviction card interaction (OB-06) operates entirely on local `selected` state and is unaffected by whether the store field exists. The right move is to replace the misleading `readiness = null` write with an honest comment now (Option C) so future readers understand the gap, then revisit as a small Option A fix once a product decision is made about whether exam motivation should personalise anything — push notifications, plan messaging, or Gap Analysis framing are natural candidates.
