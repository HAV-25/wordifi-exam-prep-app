import { colors } from '@/theme';

const Colors = {
  background:   colors.bodyBackground,          // #F8FAFF — warm off-white canvas
  surface:      colors.surfaceContainerLowest,  // #FFFFFF — cards, white zones
  surfaceLow:   colors.surfaceContainerLow,     // #F2F4FF — secondary grouping
  surfaceMuted: colors.surfaceContainerHigh,    // #E5E7EB — elevated containers
  primary:      colors.primaryBlue,             // #2B70EF
  primarySoft:  colors.surfaceContainer,        // #EEF3FD — soft primary tint
  primaryDeep:  colors.darkNavy,                // #0A0E1A — dark nav/status bars
  accent:       colors.accentTeal,              // #00E5B6
  accentSoft:   '#DDF8EA',
  danger:       colors.red,                     // #EF4444
  dangerSoft:   '#FCE3E3',
  text:         colors.darkNavy,                // #0A0E1A — headlines on light screens
  textBody:     colors.midGray,                 // #374151 — body copy
  textMuted:    colors.mutedGray,               // #9CA3AF — hints, micro-copy
  border:       colors.cardBorder,              // #E5E7EB
  warning:      colors.amber,
  ringTrack:    colors.ringTrack,
  shadow:       'rgba(43, 112, 239, 0.12)',     // primaryBlue-based shadow
  scrim:        colors.scrim,                   // rgba(0,0,0,0.3) — modal/tooltip overlay
  white:        colors.white,                   // #FFFFFF — pure white surfaces
};

export default Colors;
