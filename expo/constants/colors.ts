import { colors } from '@/theme';

const Colors = {
  background:   colors.background,            // #FAF8FF — warm off-white canvas
  surface:      colors.surfaceContainerLowest, // #FFFFFF — cards, white zones
  surfaceLow:   colors.surfaceContainerLow,    // #F2F3FF — secondary grouping
  surfaceMuted: colors.surfaceContainerHigh,   // #E5E7F9 — elevated containers
  primary:      colors.primary,               // #0057CD
  primarySoft:  colors.surfaceContainer,      // #EAEDFF — soft primary tint
  primaryDeep:  colors.navy,                  // #0A0E1A — dark nav/status bars
  accent:       colors.green,
  accentSoft:   '#DDF8EA',
  danger:       colors.red,
  dangerSoft:   '#FCE3E3',
  text:         colors.onSurface,             // #171B28
  textMuted:    colors.onSurfaceVariant,      // #424654 — body copy
  border:       colors.outlineVariant,        // #C2C6D7 — ghost borders at 10–20% opacity only
  warning:      colors.amber,
  ringTrack:    colors.ringTrack,
  shadow:       'rgba(23, 27, 40, 0.12)',     // onSurface-based shadow
};

export default Colors;
