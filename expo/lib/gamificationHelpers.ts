import type { DailyRollupRow } from '@/types/gamification';

// ─── Readiness band definitions ───────────────────────────────────────────────
// Matches the 6 arc segments of ReadinessRingV2. Order: lowest → highest.
export const READINESS_BANDS = [
  { min: 0,  max: 19,  label: 'Getting started', color: '#E24B4A' },
  { min: 20, max: 39,  label: 'Needs attention',  color: '#EF9F27' },
  { min: 40, max: 59,  label: 'Building',         color: '#F4C430' },
  { min: 60, max: 74,  label: 'On track',         color: '#97C459' },
  { min: 75, max: 89,  label: 'Ready',            color: '#639922' },
  { min: 90, max: 100, label: 'Exceptional',      color: '#1D9E75' },
] as const;

export type ReadinessBandLabel =
  | 'Getting started'
  | 'Needs attention'
  | 'Building'
  | 'On track'
  | 'Ready'
  | 'Exceptional';

export function getBandLabel(score: number): ReadinessBandLabel {
  const s = Math.min(Math.max(score, 0), 100);
  for (const band of READINESS_BANDS) {
    if (s >= band.min && s <= band.max) return band.label;
  }
  return 'Exceptional';
}

export function getBandColor(score: number): string {
  const s = Math.min(Math.max(score, 0), 100);
  for (const band of READINESS_BANDS) {
    if (s >= band.min && s <= band.max) return band.color;
  }
  return '#1D9E75';
}

// ─── Badge ladder streak → q_per_day lookup ──────────────────────────────────
// Static mirror of the badge_ladder table (cumulative_day → q_per_day).
// Covers the Wordifi v2.8 ladder: 5 questions for days 1–6, then steps up
// with each badge unlock.
// Sourced from gamification_config.badge_ladder in Supabase —
// duplicated client-side until RPC fetched in next sprint.
// §5.2 — 12 ranks, exact thresholds, do NOT interpolate.
//   day  1 →  5q  Der Einsteiger
//   day  3 →  5q  Der Stürmer
//   day  6 →  5q  Der Jäger
//   day 10 →  6q  Der Kämpfer
//   day 15 →  7q  Der Bezwinger
//   day 21 →  8q  Der Meister
//   day 28 →  9q  Der Legendär
//   day 36 → 10q  Bronze
//   day 45 → 11q  Silber
//   day 55 → 12q  Gold
//   day 66 → 13q  Diamant
//   day 78 → 14q  Platin (capped — 14 forever past day 78)

/**
 * Returns the base (unadjusted) daily question requirement for the given
 * streak day count. Add streak.daily_requirement_tier_adjustment to get
 * the user's real daily target.
 */
export function getBaseStreakRequirement(streakDays: number): number {
  const d = Math.max(streakDays, 0);
  if (d >= 78) return 14;
  if (d >= 66) return 13;
  if (d >= 55) return 12;
  if (d >= 45) return 11;
  if (d >= 36) return 10;
  if (d >= 28) return 9;
  if (d >= 21) return 8;
  if (d >= 15) return 7;
  if (d >= 10) return 6;
  return 5; // days 1–9
}

// ─── Flame strip aggregation ─────────────────────────────────────────────────
/**
 * For each calendar date in the last 7 days (oldest → newest),
 * returns true if ANY CEFR-level row for that date had
 * streak_requirement_met === true. Matches v2.8 §1.2 global streak logic.
 */
export function aggregateFlameStrip(rows: DailyRollupRow[]): boolean[] {
  // Collect distinct dates, sorted oldest first
  const dateSet = new Set(rows.map((r) => r.activity_date));
  const sortedDates = [...dateSet].sort().slice(-7);

  return sortedDates.map((date) =>
    rows.some((r) => r.activity_date === date && r.streak_requirement_met),
  );
}
