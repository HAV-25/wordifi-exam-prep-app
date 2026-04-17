# OB-07 — Wire Screen 05: timeline.tsx

**Status:** [ ]  
**Brief sections:** §1, §5.4

---

## Objective
Wire `ConvictionCard` into `expo/app/onboarding_launch/timeline.tsx`.

---

## Conviction copy keys (Screen 05)
```
screen key: 'timeline'
lt4w   → ⚡  Let's go. Wordifi's targeted practice wastes zero time.
1to3m  → 🎯  Perfect window. Wordifi's daily score moves fast here.
3to6m  → 📅  Ideal. Wordifi's streak system keeps you sharp all the way.
gt6m   → 🌟  Smart start. Wordifi's habit-building does the heavy lifting.
none   → 🧠  Prepare first. Wordifi's score tells you exactly when to book.
```

---

## Changes
Same pattern as OB-04. 5 cards.  
conviction lookup key: `CONVICTION_CARDS.timeline[item.id]`

---

## Acceptance criteria
- [ ] 5 cards flip correctly
- [ ] `onboardingStore.timeline` set on Continue
- [ ] Continue gates on `continueActive`
