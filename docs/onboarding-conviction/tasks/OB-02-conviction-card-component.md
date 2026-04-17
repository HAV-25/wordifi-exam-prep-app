# OB-02 — ConvictionCard Flip Component

**Status:** [ ]  
**Brief sections:** §2 (interaction flow), §4.1, §4.2, §4.3, §5.1, §5.2, §5.3, §5.4, §5.5

---

## Objective
Build `expo/components/onboarding/ConvictionCard.tsx` — the self-contained flip card component. No confetti yet (OB-03).

---

## Component API

```ts
type ConvictionCardProps = {
  // Answer card content (front face)
  children: React.ReactNode;

  // Conviction data (back face) — null means no conviction for this card
  conviction: { emoji: string; copy: string } | null;

  // Whether this card is currently selected (drives selected-state style on flip-back)
  isSelected: boolean;

  // Fires when user taps — parent sets selected state and passes it back via isSelected
  onSelect: () => void;

  // Fires when Continue should activate (flip animation complete)
  onFlipComplete: () => void;
};
```

---

## Implementation notes

### Dimensions (§5.1)
Cards have no fixed height in existing screens — height is driven by content + padding. Use `onLayout` on the outer container to capture height at render time. Both faces share the same container, so they're inherently the same size.

### Flip animation (§4.1)
- `flipProgress` shared value: 0 = front, 1 = back
- Front face: rotateY 0 → 180 deg, backfaceVisibility hidden
- Back face: rotateY 180 → 360 deg, backfaceVisibility hidden, position absolute inset 0
- Duration 300ms, `Easing.out(Easing.back(1.5))`
- Content swap happens at 50% (invisible midpoint) via conditional render gated on `flipProgress.value >= 0.5` — use a derived value or `runOnJS` callback at midpoint

### Hold + auto flip-back (§4.3)
- `HOLD_DURATION = 2500` ms
- `onFlipComplete()` is called when flip lands (after 300ms)
- `setTimeout` of 2500ms triggers flip-back
- Store the timer ref in `useRef` so it can be cancelled
- If component unmounts, clear the timer

### Continue button integration (§5.4)
- `onFlipComplete` fires → parent activates Continue
- If user taps Continue while yellow face is showing, parent calls a cancel ref or the timer clears automatically on navigation (unmount clears it)

### Reduce Motion (§5.5)
```ts
import { AccessibilityInfo } from 'react-native';
const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
```
If true: skip rotation, show yellow face as instant background color change for 2.5s, then flip back.

### Haptics (§5.3)
```ts
import * as Haptics from 'expo-haptics';
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); // on pressIn
```

### Press scale (§4.2)
Scale 1 → 0.97 on pressIn (100ms), back to 1 on pressOut (100ms). Applied to the outer container.

### Yellow face anatomy (§5.2)
```
Row: [Emoji 30px, marginRight 12] + [Copy Outfit_800ExtraBold 16px #374151 flex:1 lineHeight 22]
Background: #F0C808, borderRadius matches front card, paddingH 16 paddingV 12, overflow hidden
```
Confetti placeholder View added here (absoluteFill, zIndex 0) — wired up in OB-03.

---

## Acceptance criteria
- [ ] Flip animation completes in 300ms, spring feel
- [ ] Only tapped card flips — siblings are completely static
- [ ] Yellow face shows for 2.5s then auto flip-back
- [ ] Continue activates immediately when yellow face appears (onFlipComplete called)
- [ ] Press scale 0.97 on tap down
- [ ] Light haptic on tap down
- [ ] Reduce Motion: instant color swap, no rotation
- [ ] Timer cleared on unmount (no memory leak)
- [ ] TypeScript strict — no `any`
