# OB-08 — Wire Screen 06: readiness.tsx

**Status:** [ ]  
**Brief sections:** §1, §5.4

---

## Objective
Wire `ConvictionCard` into `expo/app/onboarding_launch/readiness.tsx`.

---

## Conviction copy keys (Screen 06)
```
screen key: 'readiness'
not_at_all → 💥  Honest start. Wordifi's score shows you every step forward.
not_very   → 🧩  Good call. Wordifi finds your gaps before the examiner does.
somewhat   → 🔍  Almost there. Wordifi's targeting fixes gaps before exam day.
mostly     → 🎯  Nearly. Wordifi's mock tests confirm you are actually ready.
very       → 🏆  Prove it. Wordifi's mock tests turn confidence into certainty.
```

---

## Changes
Same pattern as OB-04. 5 cards.  
conviction lookup key: `CONVICTION_CARDS.readiness[item.id]`

---

## Acceptance criteria
- [ ] 5 cards flip correctly
- [ ] `onboardingStore.readiness` set on Continue
- [ ] Continue gates on `continueActive`
