# OB-05 — Wire Screen 03: level.tsx

**Status:** [ ]  
**Brief sections:** §1, §5.4

---

## Objective
Wire `ConvictionCard` into `expo/app/onboarding_launch/level.tsx`.  
Same pattern as OB-04.

---

## Conviction copy keys (Screen 03)
```
screen key: 'level'
A1 → 🌱  Perfect start. Wordifi moves A1 learners fast.
A2 → 📗  Great. Wordifi's daily score shows every gain.
B1 → 🔥  The big one. Wordifi was built for B1 passers.
```

---

## Changes
Follow the exact same pattern as OB-04:
1. Import `ConvictionCard` and `CONVICTION_CARDS`
2. Add `continueActive` state, gate CTA on `!continueActive`
3. Replace each `Pressable` card with `ConvictionCard`, passing `conviction={CONVICTION_CARDS.level[item.id]}`
4. `isSelected`, `onSelect`, `onFlipComplete` wired as in OB-04

---

## Acceptance criteria
- [ ] 3 cards, each flips correctly with matching conviction copy
- [ ] `onboardingStore.level` set correctly on Continue
- [ ] Continue inactive until flip completes
