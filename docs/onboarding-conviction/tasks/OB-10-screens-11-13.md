# OB-10 — Wire Screens 11 + 13: daily-commitment.tsx + learner-style.tsx

**Status:** [ ]  
**Brief sections:** §1, §5.4

---

## Objective
Wire `ConvictionCard` into both remaining question screens in one task (they're identical in pattern).

---

## Screen 11 — daily-commitment.tsx

### Conviction copy keys
```
screen key: 'dailyMinutes'
5  → ⚡  Enough. Wordifi makes every minute move your score forward.
15 → ✅  The sweet spot. Wordifi's top passers use exactly this.
25 → 💪  Serious. Wordifi's mock tests fit perfectly in this window.
30 → 🔥  All in. Wordifi's full system is built for exactly this.
```

Note: store keys are numeric (`DailyMinutes = 5 | 15 | 25 | 30`). The CONVICTION_CARDS lookup key must match: use `String(item.minutes)` or define the screen key as `'dailyMinutes'` with numeric string keys.

conviction lookup: `CONVICTION_CARDS.dailyMinutes[String(item.id)]`

---

## Screen 13 — learner-style.tsx

### Conviction copy keys
```
screen key: 'learnerStyle'
sprinter → 🏃  Fast mover. Wordifi's real-time score keeps you on pace.
builder  → 🧱  Consistent wins. Wordifi's streak system was made for you.
sniper   → 🎯  Precision thinker. Wordifi's targeting finds every weak spot.
explorer → 🌊  Curious mind. Wordifi's varied stream keeps practice exciting.
```

conviction lookup: `CONVICTION_CARDS.learnerStyle[item.id]`

---

## Changes (both screens)
Same pattern as OB-04.

---

## Acceptance criteria
- [ ] daily-commitment: 4 cards flip correctly; `onboardingStore.dailyMinutes` set on Continue
- [ ] learner-style: 4 cards flip correctly; `onboardingStore.learnerStyle` set on Continue
- [ ] Continue gates on `continueActive` in both screens
- [ ] Numeric key lookup works correctly for dailyMinutes
