export type UserAccess = {
  tier: string;
  stream_questions_per_day: number | null;
  stream_questions_remaining: number | null;
  schreiben_visible: boolean;
  schreiben_enabled: boolean;
  sprechen_visible: boolean;
  sprechen_enabled: boolean;
  sectional_tests_enabled: boolean;
  mock_tests_enabled: boolean;
  trial_expires_at: string | null;
  trial_hours_remaining: number | null;
};
