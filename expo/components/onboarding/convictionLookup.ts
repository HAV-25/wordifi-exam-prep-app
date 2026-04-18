/**
 * Shared conviction card copy — all 8 question screens, 37 entries.
 *
 * Source: Wordifi_Conviction_Cards.docx  (Screens 02–07, 11, 13)
 * Format per brief: [Emoji] + [Punchy headline ≤10 words] + [Wordifi advantage]
 *
 * Keys match the option ID values defined in each screen's data array so
 * wiring in OB-06 and beyond is a straight lookup:
 *   CERT_CONVICTIONS[cert.id]
 *   LEVEL_CONVICTIONS[level.id]
 *   ...etc
 *
 * This file is data-only. No React, no Reanimated, no side-effects.
 */

import type { ConvictionEntry } from './ConvictionAnswerCard';
import type { DailyMinutes, LearnerStyleId } from '@/app/onboarding_launch/_store';

// ─── Screen 02 · Which German certification? · 4 cards ───────────────────────

type CertId = 'goethe' | 'telc' | 'osd' | 'not_sure';

export const CERT_CONVICTIONS: Record<CertId, ConvictionEntry> = {
  goethe:   { emoji: '🎓', copy: 'Perfect. Wordifi has every Goethe section covered.' },
  telc:     { emoji: '✅', copy: "Smart. Wordifi's mock tests are built for TELC." },
  osd:      { emoji: '🏅', copy: 'Exactly right. Wordifi knows every ÖSD section.' },
  not_sure: { emoji: '💡', copy: 'No problem. Wordifi will find the right exam for you.' },
};

// ─── Screen 03 · What level are you targeting? · 3 cards ─────────────────────

type LevelId = 'A1' | 'A2' | 'B1';

export const LEVEL_CONVICTIONS: Record<LevelId, ConvictionEntry> = {
  A1: { emoji: '🌱', copy: 'Perfect start. Wordifi moves A1 learners fast.' },
  A2: { emoji: '📗', copy: "Great. Wordifi's daily score shows every gain." },
  B1: { emoji: '🔥', copy: 'The big one. Wordifi was built for B1 passers.' },
};

// ─── Screen 04 · This exam matters. Tell us why. · 6 cards ───────────────────

type ReasonId = 'visa' | 'work' | 'university' | 'settlement' | 'family' | 'personal';

export const EMPATHY_CONVICTIONS: Record<ReasonId, ConvictionEntry> = {
  visa:       { emoji: '🛂', copy: 'Real stakes. Wordifi gives you a real readiness score.' },
  work:       { emoji: '💼', copy: "Your career. Wordifi's daily practice gets you there." },
  university: { emoji: '🎓', copy: "Your place is waiting. Wordifi's mock tests secure it." },
  settlement: { emoji: '🏠', copy: "This is serious. Wordifi's full mock tests prepare you completely." },
  family:     { emoji: '❤️', copy: 'Nothing stands between you. Wordifi makes sure of it.' },
  personal:   { emoji: '💪', copy: 'Best reason. Wordifi gives you a score you can trust.' },
};

// ─── Screen 05 · How long until your exam date? · 5 cards ────────────────────

type TimelineId = 'lt4w' | '1to3m' | '3to6m' | 'gt6m' | 'none';

export const TIMELINE_CONVICTIONS: Record<TimelineId, ConvictionEntry> = {
  lt4w:   { emoji: '⚡', copy: "Let's go. Wordifi's targeted practice wastes zero time." },
  '1to3m': { emoji: '🎯', copy: "Perfect window. Wordifi's daily score moves fast here." },
  '3to6m': { emoji: '📅', copy: "Ideal. Wordifi's streak system keeps you sharp all the way." },
  gt6m:   { emoji: '🌟', copy: "Smart start. Wordifi's habit-building does the heavy lifting." },
  none:   { emoji: '🧠', copy: "Prepare first. Wordifi's score tells you exactly when to book." },
};

// ─── Screen 06 · How ready are you for your exam today? · 5 cards ────────────

type ReadinessId = 'not_at_all' | 'not_very' | 'somewhat' | 'mostly' | 'very';

export const READINESS_CONVICTIONS: Record<ReadinessId, ConvictionEntry> = {
  not_at_all: { emoji: '💥', copy: "Honest start. Wordifi's score shows you every step forward." },
  not_very:   { emoji: '🧩', copy: 'Good call. Wordifi finds your gaps before the examiner does.' },
  somewhat:   { emoji: '🔍', copy: "Almost there. Wordifi's targeting fixes gaps before exam day." },
  mostly:     { emoji: '🎯', copy: "Nearly. Wordifi's mock tests confirm you are actually ready." },
  very:       { emoji: '🏆', copy: "Prove it. Wordifi's mock tests turn confidence into certainty." },
};

// ─── Screen 07 · Which part of the exam do you find hardest? · 6 cards ───────

type HardestId = 'reading' | 'listening' | 'writing' | 'speaking' | 'grammar' | 'everything';

export const HARDEST_CONVICTIONS: Record<HardestId, ConvictionEntry> = {
  reading:    { emoji: '👁️',  copy: 'Noted. Wordifi surfaces Lesen daily until it stops being hard.' },
  listening:  { emoji: '👂',  copy: 'Got it. Wordifi trains your ear to real exam speed.' },
  writing:    { emoji: '✍️',  copy: 'Locked in. Wordifi shows you exactly what passing looks like.' },
  speaking:   { emoji: '🗣️', copy: "Understood. Wordifi's model answers close this gap fast." },
  grammar:    { emoji: '🔤', copy: 'Perfect. Wordifi targets your weakest rules automatically every day.' },
  everything: { emoji: '📊', copy: "Honest. Wordifi's score tracks all five sections simultaneously." },
};

// ─── Screen 11 · How many minutes can you practice each day? · 4 cards ───────
//
// Keys are DailyMinutes (5 | 15 | 25 | 30) matching onboardingStore.dailyMinutes.
// The brief maps:  5 → 5 min  ·  15 → 10-15 min  ·  25 → 20-30 min  ·  30 → 30+ min

export const DAILY_MINUTES_CONVICTIONS: Record<DailyMinutes, ConvictionEntry> = {
  5:  { emoji: '⚡', copy: 'Enough. Wordifi makes every minute move your score forward.' },
  15: { emoji: '✅', copy: "The sweet spot. Wordifi's top passers use exactly this." },
  25: { emoji: '💪', copy: "Serious. Wordifi's mock tests fit perfectly in this window." },
  30: { emoji: '🔥', copy: "All in. Wordifi's full system is built for exactly this." },
};

// ─── Screen 13 · Which style describes you best? · 4 cards ───────────────────

export const LEARNER_STYLE_CONVICTIONS: Record<LearnerStyleId, ConvictionEntry> = {
  sprinter: { emoji: '🏃',  copy: "Fast mover. Wordifi's real-time score keeps you on pace." },
  builder:  { emoji: '🧱',  copy: "Consistent wins. Wordifi's streak system was made for you." },
  sniper:   { emoji: '🎯',  copy: "Precision thinker. Wordifi's targeting finds every weak spot." },
  explorer: { emoji: '🌊',  copy: "Curious mind. Wordifi's varied stream keeps practice exciting." },
};
