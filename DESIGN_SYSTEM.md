# Wordifi Design System

> Master source: Wordifi Brand Brief — `Wordifi_Stitch_Doc1_Base_Brief.docx` (2026-01)
> This file is the in-repo representation of that brief. Do not deviate from these values.

---

## 1. What Wordifi Is

Wordifi is a German language certification exam preparation app — not a language game.
It exists to get people through their Goethe-Institut, TELC or ÖSD exam on the specific date
their visa, job, citizenship, or right to stay depends on.

Every screen must honour that weight.

---

## 2. The Feeling We Are Designing For

When a user opens Wordifi they should feel, in sequence:

1. **Relief** — "Finally. An app that takes this as seriously as I do."
2. **Trust** — "This feels premium. Intentional. Like it was built by people who know what they are doing."
3. **Excitement** — "Such a fresh experience it feels like 2030."

Achieved through restraint, hierarchy, and quiet confidence — not animation or decoration.

**Ratio: 70% premium minimal · 30% warm and playful.**

---

## 3. Colour System

| Name | Hex | Usage |
|---|---|---|
| Primary Blue | `#2B70EF` | CTA buttons. Progress elements. Header zone on question screens. Dominant brand colour. |
| Accent Teal | `#00E5B6` | One highlight word in key headlines. Success states. Celebration moments. Used sparingly so it always pops. |
| Body Background | `#F8FAFF` | Base of every light screen. Warm off-white. Never pure white. |
| Dark Navy | `#0A0E1A` | Full-bleed hero screens (Splash, Score Reveal, Plan Summary). Headline text on light screens. |
| Mid Gray | `#374151` | Body copy on all light screens. |
| Muted Gray | `#9CA3AF` | Hints, micro-copy, placeholder text. |
| Flag Gold | `#F5C400` | Confetti accents in header zone only. Never a UI colour. |
| Flag Red | `#DD0000` | Confetti accents in header zone only. Never a UI colour. |

### Rules
- Body copy always uses **Mid Gray (`#374151`)** — never dark navy for reading text
- Accent Teal is used sparingly — success states, one highlight word. Never structural UI.
- Flag colours are decorative confetti only — never for backgrounds, buttons, or text

### The No-Line Rule
1px solid borders are prohibited. Separate sections using background colour shifts.
If a visible boundary is required, use a Ghost Border: `#E5E7EB` at 40–60% opacity, never full opacity.

---

## 4. Typography

| Role | Font | Weight | Usage |
|---|---|---|---|
| Headline / CTA | Outfit | 800 ExtraBold | All headlines, CTA button labels, scores, wordmark |
| Sub-headline / Emphasis | Nunito Sans | 600 SemiBold | Card titles, sub-headers, emphasis within body |
| Body / Labels | Nunito Sans | 400 Regular | Body copy, option labels, explanatory text, hints |

### Font Loading
Loaded in `expo/app/_layout.tsx` via `useFonts()`:
- `@expo-google-fonts/outfit` → `Outfit_800ExtraBold`
- `@expo-google-fonts/nunito-sans` → `NunitoSans_400Regular`, `NunitoSans_600SemiBold`, `NunitoSans_700Bold`

### Type Scale Principle
Fewer sizes, more contrast. The jump between headline and body should feel dramatic.
**Never use more than three text sizes on a single screen.**
Let size, weight, and colour create the hierarchy — not decoration.

---

## 5. Spacing & Layout

- **8pt grid** — all spacing in multiples of 8
- **Minimum horizontal margin:** 24px
- **Section spacing:** 32px between major sections
- **Device target:** Mobile, 390px wide

### Corner Radii
| Size | Value | Usage |
|---|---|---|
| Small | 12px | Small elements, chips, badges |
| Cards / Buttons | 16px | Answer cards, CTA buttons, input fields |
| Large containers | 24px | Modals, bottom sheets, large cards |

---

## 6. Screen Types

### Value Screens
Full-bleed colour backgrounds (Dark Navy or Primary Blue). Large symbolic illustration.
Dominant headline. Single CTA. Used for wow moments: Splash, Score Reveal, Plan Summary.

### Question Screens
Off-white (`#F8FAFF`) surface. Large question in Outfit 800. Clean full-width answer cards
with soft border. Progress bar at top. Pure function — no decoration.

---

## 7. Component Specs

### Primary CTA Button
- Full-width · 56px height · 16px corner radius
- Background: flat **Primary Blue `#2B70EF`** — no gradients, ever
- Label: Outfit 800 · white · sentence case
- Press: scale 0.96 + slight darkening · spring release
- Shadow: subtle blue glow (`rgba(43,112,239,0.30)`)

### Answer Cards
- Full-width · min 64px, max 72px height · 16px corner radius
- Default: white fill · border `#E5E7EB`
- Selected: Primary Blue border · soft blue background tint (`#EEF3FD`)
- Correct: Accent Teal border · teal tint
- Incorrect: red border · red tint
- Label: Nunito Sans 600 · Dark Navy · sentence case
- Sub-label: Nunito Sans 400 · Mid Gray

### Progress Bar
- Height: 4px
- Fill: Primary Blue `#2B70EF`
- Track: light gray `#E5E7EB`
- No numeric labels — visual progress only

### Score Dial
- Large circular arc · gradient Primary Blue → Accent Teal
- Score number: Outfit 800 · 64px · centred
- Animation: arc sweeps 0→score over 1.5s, ease-out · number counts up simultaneously

### Celebration Card (Explanation panel)
- Bottom sheet · slides up with spring
- Left border in Accent Teal
- Off-white fill · headline Dark Navy · body Mid Gray
- Confetti burst at top (German flag colours) · auto-advances after 2.5s

### Glassmorphic / Floating Navigation
- Background: `#F8FAFF` at 80% opacity · `backdrop-filter: blur(20px)`

---

## 8. Illustration Style

- Flat vector · clean edges · no gradients within shapes
- Adult warmth — not childish, not corporate
- Palette: Primary Blue, Accent Teal, warm neutrals — one or two colours maximum
- Scale: 40–50% of screen on value screens — generous, not tucked away
- Metaphor: symbolic object or scene, never literal (studying, books, exams)
  - Think: archway, mountain, departure board, hourglass, mirror
- Human figures: simple silhouettes only, no face, no specific features — universal

---

## 9. Motion

| Element | Behaviour |
|---|---|
| Screen transitions | Slide left on advance · spring physics · 280ms |
| Answer card tap | Scale 0.97 on press · spring back · border+bg colour at 150ms |
| Celebration card | Spring up from bottom · confetti burst · fade at 2.5s · auto-advance |
| Score dial | Sweep 0→score in 1.5s ease-out · number counts up simultaneously |
| CTA button | Scale 0.96 + slight darken on tap · spring release — never laggy |
| Loading | Skeleton screens only — no spinners |

---

## 10. Do's and Don'ts

### Do
- One idea per screen — single visual anchor, single primary action
- Embrace generous white space: 24px+ horizontal margins, 32px between sections
- Use Mid Gray (`#374151`) for all body copy
- Use background colour shifts to separate sections (not borders)
- Let size, weight, and colour create hierarchy — not decoration

### Don't
- No gradients on CTA buttons — ever
- No 1px solid borders for layout separation
- No dark navy for body copy reading text
- No pure white backgrounds — use `#F8FAFF`
- No more than three text sizes on one screen
- No spinners — skeleton screens only
- No Flag Gold or Flag Red for structural UI
- Don't clutter — restrained, premium, spacious
