# Wordifi Design System — Implementation Guide

## What's in this folder

```
src/
  theme/
    colors.ts       — All colour tokens (primary, semantic, German flag)
    typography.ts   — Fonts, type scale, predefined text styles
    spacing.ts      — Spacing, radius, shadows, screen zones, z-index
    motion.ts       — All animation durations, easings, spring configs
    constants.ts    — XP rates, exam timings, badge thresholds, queue config
    index.ts        — Barrel export — always import from here
  components/
    design-system/
      CTAButton.tsx           — Primary CTA button with blue glow
      GermanFlagBadge.tsx     — Small flag badge (Splash + Question screens only)
      GermanConfetti.tsx      — Decorative header shapes (Splash + Question only)
      CoreComponents.tsx      — ProgressBar, OptionCard, CelebrationCard, PreparednessGauge
      index.ts                — Barrel export
```

---

## Step-by-step implementation into Rork codebase

### Step 1 — Copy files
Copy the entire `src/theme/` folder and `src/components/design-system/` folder into your Rork project, maintaining the same paths.

### Step 2 — Set up path alias
In your `tsconfig.json` (or `babel.config.js` for Expo), add:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/theme":                    ["src/theme/index.ts"],
      "@/components/design-system": ["src/components/design-system/index.ts"]
    }
  }
}
```
For Expo / Babel, also add to `babel.config.js`:
```js
module.exports = {
  plugins: [
    ['module-resolver', {
      alias: {
        '@/theme':                    './src/theme',
        '@/components/design-system': './src/components/design-system',
      }
    }]
  ]
};
```
Install: `npx expo install babel-plugin-module-resolver`

### Step 3 — Install fonts
```bash
npx expo install @expo-google-fonts/bricolage-grotesque @expo-google-fonts/dm-sans expo-font
```
In your root `_layout.tsx` or `App.tsx`:
```tsx
import { useFonts, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_800ExtraBold,
    DMSans_400Regular,
    DMSans_500Medium,
  });

  if (!fontsLoaded) return null;
  // ... rest of your layout
}
```

### Step 4 — Install animation library
```bash
npx expo install react-native-reanimated
```
Add to `babel.config.js` plugins: `'react-native-reanimated/plugin'`

### Step 5 — Remove all hardcoded values
Do a project-wide search for any hardcoded hex colours (e.g. `#2B70EF`, `#0A1628`) and replace with `colors.blue`, `colors.navy` etc. from `@/theme`.

### Step 6 — Verify
Import and render `<CTAButton label="Test button" onPress={() => {}} />` on any screen. You should see the blue button with the glow shadow. If the glow appears, the design system is wired up correctly.

---

## Rules enforced by this design system

| Rule | Where enforced |
|---|---|
| Sentence case everywhere | `textStyles` — never pass uppercase strings |
| `wordifi` always lowercase | Use the string `'wordifi'` not `'Wordifi'` |
| German flag colours decorative only | `GermanFlagBadge` + `GermanConfetti` components isolated |
| Blue glow on CTA non-negotiable | `CTAButton` component — always applied |
| All animations via Reanimated v3 | `motion.ts` — never use legacy `Animated` API |
| No hardcoded values | Import everything from `@/theme` |

---

## Pushing to GitHub

```bash
# From your Rork project root
git add src/theme/ src/components/design-system/
git commit -m "feat: add Wordifi design system (colours, typography, spacing, motion, components)"
git push origin main
```

If you want a dedicated branch:
```bash
git checkout -b feat/design-system
git add src/theme/ src/components/design-system/
git commit -m "feat: add Wordifi design system"
git push origin feat/design-system
# Then open a PR on GitHub
```
