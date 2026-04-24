export type PointResult = {
  point: string;
  addressed: boolean;
  comment: string;
};

export type CorrectionItem = {
  type: 'error' | 'suggestion' | 'excellent';
  original: string;
  corrected: string;
  explanation: string;
  context?: string;
};

export type ScoreBreakdownItem = {
  label: string;
  score: number;
  max_score: number;
  color?: string;
};

export type AssessmentResult = {
  // ── Backend-calculated ────────────────────────────────────────────────────
  overall_score: number;
  max_score: number;
  passed: boolean;
  moderation_flagged?: boolean;        // true = content policy blocked
  criterion_scores?: Record<string, number>; // raw per-criterion values (A1/A2/B1 keys differ)
  score_details?: ScoreBreakdownItem[];      // backend-derived 3-category aggregates

  // ── AI qualitative ────────────────────────────────────────────────────────
  points_coverage: PointResult[];
  language_feedback: {
    grammar: string;
    spelling: string;
    register: string;
    sentence_structure: string;
  };
  encouragement: string;
  assessment_type: 'local' | 'ai' | 'moderation_blocked';
  scoring_breakdown?: string;
  corrections?: CorrectionItem[];
};

export type FormFillOption = {
  label: string;
  answer?: string;
  value_prefilled?: string;
};

export type BulletPointOption = {
  key: string;
  text: string;
};

export const SCHREIBEN_TASK_TYPE: Record<string, Record<number, string>> = {
  A1: { 1: 'form_fill', 2: 'sms' },
  A2: { 1: 'sms', 2: 'formal_email' },
  B1: { 1: 'formal_email', 2: 'informal_letter', 3: 'opinion' },
};

export const SCHREIBEN_TASK_LABELS: Record<string, string> = {
  form_fill: 'Formular ausfüllen',
  sms: 'SMS schreiben',
  formal_email: 'Formelle E-Mail',
  informal_letter: 'Informeller Brief',
  opinion: 'Meinung äußern',
};

export const SCHREIBEN_WORD_LIMITS: Record<string, { min: number; max: number; warnBelow: number }> = {
  sms: { min: 30, max: 80, warnBelow: 20 },
  formal_email: { min: 60, max: 120, warnBelow: 40 },
  informal_letter: { min: 80, max: 150, warnBelow: 50 },
  opinion: { min: 60, max: 120, warnBelow: 50 },
};
