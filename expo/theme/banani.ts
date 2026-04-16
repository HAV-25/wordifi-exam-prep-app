/**
 * Banani v2 design tokens — shared across all question-rendering surfaces.
 *
 * StreamCard has its own inline copy of these values (components/StreamCard.tsx:22-34).
 * We intentionally leave StreamCard untouched; these are used by OptionButton,
 * sectional-test, mock-test, practice, and results screens.
 */
export const B = {
  background:   '#F8FAFF',
  foreground:   '#374151',
  border:       '#E2E8F0',
  primary:      '#2B70EF',
  primaryFg:    '#FFFFFF',
  card:         '#FFFFFF',
  muted:        '#94A3B8',
  success:      '#22C55E',
  destructive:  '#EF4444',
  questionColor:'#0F1F3D',
} as const;
