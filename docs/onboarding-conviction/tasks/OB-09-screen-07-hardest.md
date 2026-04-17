# OB-09 — Wire Screen 07: hardest.tsx

**Status:** [ ]  
**Brief sections:** §1, §5.4

---

## Objective
Wire `ConvictionCard` into `expo/app/onboarding_launch/hardest.tsx`.

---

## Conviction copy keys (Screen 07)
```
screen key: 'hardest'
reading    → 👁️  Noted. Wordifi surfaces Lesen daily until it stops being hard.
listening  → 👂  Got it. Wordifi trains your ear to real exam speed.
writing    → ✍️  Locked in. Wordifi shows you exactly what passing looks like.
speaking   → 🗣️  Understood. Wordifi's model answers close this gap fast.
grammar    → 🔤  Perfect. Wordifi targets your weakest rules automatically every day.
everything → 📊  Honest. Wordifi's score tracks all five sections simultaneously.
```

---

## Changes
Same pattern as OB-04. 6 cards.  
conviction lookup key: `CONVICTION_CARDS.hardest[item.id]`

---

## Acceptance criteria
- [ ] All 6 cards flip correctly (including `everything`)
- [ ] `onboardingStore.hardest` set on Continue
- [ ] Continue gates on `continueActive`
