export type ReadinessRow = {
  user_id: string;
  cefr_level: 'A1' | 'A2' | 'B1';
  raw_score_current: number;
  raw_score_preceding: number;
  ema_score: number;
  normalized_score: number;
  ramp_factor: number;
  ramp_complete: boolean;
};

export type StreakRow = {
  current_streak_days: number;
  longest_streak_days: number;
  last_qualifying_day: string | null;
  streak_started_at: string | null;
  last_shield_used_at: string | null;
  timezone: string;
  tier_adjusted_lifetime: boolean;
  daily_requirement_tier_adjustment: number;
};

export type DailyRollupRow = {
  activity_date: string;
  cefr_level: 'A1' | 'A2' | 'B1';
  stream_questions_answered: number;
  stream_questions_correct: number;
  sectional_questions_attempted: number;
  sectional_questions_correct: number;
  mock_questions_attempted: number;
  mock_questions_correct: number;
  sprechen_readiness_contrib: number;
  schreiben_readiness_contrib: number;
  total_questions_counted_for_streak: number;
  streak_requirement_met: boolean;
};

export type TierConfigRow = {
  tier_name: string;
  display_name: string;
  tier_description: string;
  stream_questions_per_day: number | null;
  sectional_tests_enabled: boolean;
  schreiben_enabled: boolean;
  sprechen_enabled: boolean;
  mock_tests_enabled: boolean;
  trial_duration_hours: number | null;
};
