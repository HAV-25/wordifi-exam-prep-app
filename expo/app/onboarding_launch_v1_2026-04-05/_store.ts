/**
 * Onboarding Launch — lightweight module-level store.
 * Accumulates answers as the user moves through the flow.
 * Read by Plan Builder (screen 8) and Gap Analysis (screen 9).
 */

export type CertId        = 'goethe' | 'telc' | 'osd' | 'not_sure';
export type LevelId       = 'A1' | 'A2' | 'B1';
export type TimelineId    = 'lt4w' | '1to3m' | '3to6m' | 'gt6m' | 'none';
export type ReadinessId   = 'not_at_all' | 'not_very' | 'somewhat' | 'mostly' | 'very';
export type HardestId     = 'reading' | 'listening' | 'writing' | 'speaking' | 'grammar' | 'everything';
export type DailyMinutes  = 5 | 15 | 25 | 30;
export type LearnerStyleId = 'sprinter' | 'builder' | 'sniper' | 'explorer';

export type OnboardingAnswers = {
  cert:         CertId | null;
  level:        LevelId | null;
  timeline:     TimelineId | null;
  readiness:    ReadinessId | null;
  hardest:      HardestId | null;
  dailyMinutes: DailyMinutes | null;
  learnerStyle: LearnerStyleId | null;
};

export const onboardingStore: OnboardingAnswers = {
  cert:         null,
  level:        null,
  timeline:     null,
  readiness:    null,
  hardest:      null,
  dailyMinutes: null,
  learnerStyle: null,
};

// ─── Display helpers ──────────────────────────────────────────────────────────

export const CERT_LABELS: Record<CertId, string> = {
  goethe:   'Goethe-Institut',
  telc:     'TELC',
  osd:      'ÖSD',
  not_sure: 'TBD',
};

export const CERT_SHORT: Record<CertId, string> = {
  goethe:   'Goethe',
  telc:     'TELC',
  osd:      'ÖSD',
  not_sure: 'TBD',
};

export const TIMELINE_LABELS: Record<TimelineId, string> = {
  lt4w:   'Less than 4 weeks',
  '1to3m': '1 to 3 months',
  '3to6m': '3 to 6 months',
  gt6m:   'More than 6 months',
  none:   'No date set yet',
};

export const READINESS_DISPLAY: Record<ReadinessId, { emoji: string; label: string }> = {
  not_at_all: { emoji: '😰', label: 'Just starting out' },
  not_very:   { emoji: '😟', label: 'Not very ready' },
  somewhat:   { emoji: '😐', label: 'Getting there' },
  mostly:     { emoji: '😊', label: 'Mostly ready' },
  very:       { emoji: '💪', label: 'Very ready' },
};

export const HARDEST_DISPLAY: Record<HardestId, { emoji: string; label: string }> = {
  reading:    { emoji: '👁️',  label: 'Reading' },
  listening:  { emoji: '👂',  label: 'Listening' },
  writing:    { emoji: '✍️',  label: 'Writing' },
  speaking:   { emoji: '🗣️', label: 'Speaking' },
  grammar:    { emoji: '🔤', label: 'Grammar & Vocabulary' },
  everything: { emoji: '📊', label: 'All sections' },
};

export const DAILY_MINUTES_DISPLAY: Record<DailyMinutes, { label: string; description: string; emoji: string; recommended?: boolean }> = {
  5:  { label: '5 minutes',           description: 'Just the essentials every day',    emoji: '⚡' },
  15: { label: '10 to 15 minutes',    description: 'My daily sweet spot',              emoji: '✅', recommended: true },
  25: { label: '20 to 30 minutes',    description: 'I am serious about this',          emoji: '💪' },
  30: { label: 'More than 30 minutes',description: 'I am in full preparation mode',    emoji: '🔥' },
};

export const LEARNER_STYLE_DISPLAY: Record<LearnerStyleId, { emoji: string; title: string; description: string }> = {
  sprinter: { emoji: '🏃', title: 'The Sprinter',  description: 'I work best under pressure — intense, focused, fast' },
  builder:  { emoji: '🧱', title: 'The Builder',   description: 'I prefer steady daily habits over intense sessions' },
  sniper:   { emoji: '🎯', title: 'The Sniper',    description: 'I like to find my weak spots and fix them precisely' },
  explorer: { emoji: '🌊', title: 'The Explorer',  description: 'I like to learn broadly and go deep when something interests me' },
};
