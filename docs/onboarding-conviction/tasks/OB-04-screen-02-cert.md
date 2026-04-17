# OB-04 — Wire Screen 02: cert.tsx

**Status:** [ ]  
**Brief sections:** §1, §5.1, §5.4, §5.6

---

## Objective
Replace the plain `Pressable` answer cards in `expo/app/onboarding_launch/cert.tsx` with `ConvictionCard`, using Screen 02's conviction copy.

---

## File to edit
`expo/app/onboarding_launch/cert.tsx`

---

## Changes

### 1. Import ConvictionCard and copy data
```ts
import { ConvictionCard } from '@/components/onboarding/ConvictionCard';
import { CONVICTION_CARDS } from '@/components/onboarding/convictionCards';
```

### 2. Track flip state for Continue button
The existing `selected` state controls whether the CTA is enabled.  
Add a second piece of state:
```ts
const [continueActive, setContinueActive] = useState(false);
```
- `continueActive` starts false
- Set to true when `onFlipComplete` fires
- On re-select (different card tapped): keep `continueActive` true per §5.4 ("Once active, remains active")

Update CTA `disabled` to use `!continueActive` instead of `!selected`.

### 3. Replace card list
Current:
```tsx
{CERTS.map((cert) => (
  <Pressable key={cert.id} onPress={() => setSelected(cert.id)} ...>
    <Text>{cert.emoji}</Text>
    <View>
      <Text>{cert.title}</Text>
      <Text>{cert.subtitle}</Text>
    </View>
  </Pressable>
))}
```

Replace each `Pressable` with `ConvictionCard`:
```tsx
{CERTS.map((cert) => (
  <ConvictionCard
    key={cert.id}
    conviction={CONVICTION_CARDS.cert[cert.id] ?? null}
    isSelected={selected === cert.id}
    onSelect={() => setSelected(cert.id)}
    onFlipComplete={() => setContinueActive(true)}
  >
    {/* existing card interior — emoji, title, subtitle */}
    <Text style={styles.emoji}>{cert.emoji}</Text>
    <View style={styles.cardText}>
      <Text style={[styles.cardTitle, selected === cert.id && styles.cardTitleSelected]}>
        {cert.title}
      </Text>
      <Text style={styles.cardSubtitle}>{cert.subtitle}</Text>
    </View>
  </ConvictionCard>
))}
```

### 4. Remove cardPressed style from selected/pressed logic
`ConvictionCard` handles scale press internally. Remove `pressed && styles.cardPressed` from the existing `Pressable` style function (the style itself can stay for other uses, but the `Pressable` is gone).

---

## Conviction copy keys (Screen 02)
```
screen key: 'cert'
goethe    → 🎓  Perfect. Wordifi has every Goethe section covered.
telc      → ✅  Smart. Wordifi's mock tests are built for TELC.
osd       → 🏅  Exactly right. Wordifi knows every ÖSD section.
not_sure  → 💡  No problem. Wordifi will find the right exam for you.
```

---

## Acceptance criteria
- [ ] Tapping a card triggers flip on that card only; other 3 cards are static
- [ ] Yellow face shows correct emoji + copy for each cert option
- [ ] Continue button inactive until flip completes; active after
- [ ] Auto flip-back after 2.5s, card lands in selected state
- [ ] Tapping a second card re-triggers flip; Continue stays active
- [ ] `onboardingStore.cert` is set correctly on Continue
