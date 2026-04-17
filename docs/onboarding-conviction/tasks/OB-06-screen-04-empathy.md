# OB-06 — Wire Screen 04: empathy.tsx

**Status:** [ ]  
**Brief sections:** §1, §5.4

---

## Objective
Wire `ConvictionCard` into `expo/app/onboarding_launch/empathy.tsx`.

---

## Note: answer not stored in onboardingStore
`empathy.tsx` does not write `selected` to `onboardingStore` (no field exists for it — pre-existing, not our problem per AGENT_CONTEXT). Do NOT add a store field. The conviction card flip still works because `selected` is local state.

---

## Conviction copy keys (Screen 04)
```
screen key: 'empathy'
visa        → 🛂  Real stakes. Wordifi gives you a real readiness score.
work        → 💼  Your career. Wordifi's daily practice gets you there.
university  → 🎓  Your place is waiting. Wordifi's mock tests secure it.
settlement  → 🏠  This is serious. Wordifi's full mock tests prepare you completely.
family      → ❤️  Nothing stands between you. Wordifi makes sure of it.
personal    → 💪  Best reason. Wordifi gives you a score you can trust.
```

---

## Changes
Same pattern as OB-04/05:
1. Import + add `continueActive` state
2. Replace 6 `Pressable` cards with `ConvictionCard`
3. conviction lookup key: `CONVICTION_CARDS.empathy[reason.id]`

---

## Acceptance criteria
- [ ] All 6 cards flip correctly
- [ ] Continue gates on `continueActive`, not `selected`
- [ ] Existing navigation (`router.push('/onboarding_launch/timeline')`) unchanged
