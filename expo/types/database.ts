export type Level = 'A1' | 'A2' | 'B1';
export type Section = 'Hören' | 'Lesen';
export type ExamType = 'TELC' | 'GOETHE';
export type QuestionType = 'mcq' | 'true_false' | 'matching' | 'opinion';

export type QuestionOption = {
  key: string;
  text: string;
};

export type AppQuestion = {
  id: string;
  source_clip_id: string | null;
  source_test_id: string | null;
  source_structure_type: string;
  level: string;
  section: string;
  teil: number;
  exam_type: string;
  question_type: string;
  question_number: number | null;
  question_text: string;
  stimulus_text: string | null;
  stimulus_type: string | null;
  options: QuestionOption[];
  correct_answer: string;
  audio_url: string | null;
  audio_script: string | null;
  is_active: boolean;
  version: number | null;
  test_number: string | null;
  created_at: string | null;
  explanation_en: string | null;
  explanation_de: string | null;
  grammar_rule: string | null;
  grammar_rule_de: string | null;
};

export type UserNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  action_url: string | null;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export type StudyPlanItem = {
  priority: number;
  section: string;
  action: string;
  resource: string;
};

export type StudyPlanJson = {
  weekly_goal_sessions: number;
  focus_section: 'Hören' | 'Lesen' | 'Both';
  mock_test_dates: string[];
};

export type MockTest = {
  id: string;
  user_id: string;
  level: string;
  exam_type: string;
  is_timed: boolean;
  status: string;
  current_section: string | null;
  current_teil: number | null;
  hoeren_score_pct: number | null;
  lesen_score_pct: number | null;
  overall_score_pct: number | null;
  started_at: string | null;
  completed_at: string | null;
  time_taken_seconds: number | null;
  section_session_ids: string[] | null;
  study_plan: StudyPlanItem[] | null;
  retest_available_at: string | null;
  created_at: string | null;
};

export type QuestionReport = {
  id: string;
  question_id: string;
  user_id: string;
  reason: string;
  detail: string | null;
  status: string;
  created_at: string | null;
};

export type UserProfile = {
  id: string;
  target_level: string | null;
  exam_type: string | null;
  exam_date: string | null;
  subscription_tier: string;
  subscription_valid_until: string | null;
  trial_active: boolean;
  readiness_score: number;
  streak_count: number;
  last_active_date: string | null;
  xp_total: number;
  credit_balance: number;
  referral_code: string | null;
  study_plan_json: StudyPlanJson | null;
  player_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Onboarding preferences
  onboarding_cert: string | null;
  onboarding_readiness: string | null;
  onboarding_hardest: string | null;
  onboarding_daily_minutes: number | null;
  onboarding_learner_style: string | null;
  onboarding_completed_at: string | null;
  walkthrough_completed: boolean;
  walkthrough_completed_at: string | null;
  avatar_url: string | null;
};

export type LeaderboardEntry = {
  player_name: string;
  readiness_score: number;
  streak_count: number;
  target_level: string;
  user_id: string;
  rank: number;
};

export type TestSession = {
  id: string;
  user_id: string;
  session_type: string;
  level: string;
  section: string;
  teil: number;
  exam_type: string;
  score_pct: number;
  questions_total: number;
  questions_correct: number;
  time_taken_seconds: number;
  is_timed: boolean;
  completed_at: string;
  created_at: string | null;
  mock_test_id: string | null;
  retest_available_at: string | null;
};

export type UserAnswer = {
  id: string;
  session_id: string;
  user_id: string;
  question_id: string;
  selected_answer: string;
  is_correct: boolean;
  time_taken_seconds: number | null;
  created_at: string | null;
};

export type UserBadge = {
  id: string;
  user_id: string;
  badge_type: string;
  level: string;
  awarded_at: string;
  created_at: string | null;
};

export type SessionLink = {
  id: string;
  user_id: string;
  test_session_id: string | null;
  token: string;
  expires_at: string;
  completed_at: string | null;
  level: string;
  section: string;
  teil: number;
  exam_type: string;
  is_timed: boolean;
  question_ids: string[];
  answers: Record<string, string> | null;
  is_used: boolean;
  created_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      app_questions: {
        Row: AppQuestion;
        Insert: AppQuestion;
        Update: Partial<AppQuestion>;
        Relationships: [];
      };
      user_profiles: {
        Row: UserProfile;
        Insert: {
          id: string;
          target_level?: string | null;
          exam_type?: string | null;
          exam_date?: string | null;
          subscription_tier?: string;
          subscription_valid_until?: string | null;
          trial_active?: boolean;
          readiness_score?: number;
          streak_count?: number;
          last_active_date?: string | null;
          xp_total?: number;
          credit_balance?: number;
          referral_code?: string | null;
          study_plan_json?: StudyPlanJson | null;
          player_name?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<UserProfile>;
        Relationships: [];
      };
      test_sessions: {
        Row: TestSession;
        Insert: {
          id?: string;
          user_id: string;
          session_type: string;
          level: string;
          section: string;
          teil: number;
          exam_type: string;
          score_pct: number;
          questions_total: number;
          questions_correct: number;
          time_taken_seconds: number;
          is_timed: boolean;
          completed_at: string;
          created_at?: string | null;
        };
        Update: Partial<TestSession>;
        Relationships: [];
      };
      user_answers: {
        Row: UserAnswer;
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          question_id: string;
          selected_answer: string;
          is_correct: boolean;
          time_taken_seconds?: number | null;
          created_at?: string | null;
        };
        Update: Partial<UserAnswer>;
        Relationships: [];
      };
      user_badges: {
        Row: UserBadge;
        Insert: {
          id?: string;
          user_id: string;
          badge_type: string;
          level: string;
          awarded_at: string;
          created_at?: string | null;
        };
        Update: Partial<UserBadge>;
        Relationships: [];
      };
      session_links: {
        Row: SessionLink;
        Insert: {
          id?: string;
          user_id: string;
          test_session_id?: string | null;
          token?: string;
          expires_at?: string;
          completed_at?: string | null;
          level: string;
          section: string;
          teil: number;
          exam_type: string;
          is_timed: boolean;
          question_ids: string[];
          answers?: Record<string, string> | null;
          is_used?: boolean;
          created_at?: string | null;
        };
        Update: Partial<SessionLink>;
        Relationships: [];
      };
      user_notifications: {
        Row: UserNotification;
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          body: string;
          action_url?: string | null;
          metadata?: Record<string, unknown> | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<UserNotification>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
