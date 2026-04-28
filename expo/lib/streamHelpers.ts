import { supabase } from '@/lib/supabaseClient';
import type { AppQuestion, UserProfile } from '@/types/database';
import { track } from '@/lib/track';

export type StreamFetchParams = {
  userId: string;
  targetLevel: string;
  limit?: number;
  sections?: string[]; // restrict to specific sections (e.g. ['Hören','Lesen'] for free_trial)
};

export type SectionAccuracy = {
  // Hören + Lesen: raw counts for last 30 days
  horenCorrect: number;
  horenTotal: number;
  lesenCorrect: number;
  lesenTotal: number;
  // Schreiben + Sprechen: average score_pct across all sessions (last 30 days)
  schreibenAvgPct: number | null;
  sprechenAvgPct: number | null;
  hasHistory: boolean;
};

type AnswerRow = { is_correct: boolean; question_id: string };
type QuestionSectionRow = { id: string; section: string };
type QuestionIdRow = { question_id: string };
type BadgeRow = { badge_type: string };
type SessionIdRow = { id: string };

const XP_PER_LEVEL: Record<string, number> = {
  A1: 5,
  A2: 10,
  B1: 15,
};

const EMPTY_ACCURACY: SectionAccuracy = {
  horenCorrect: 0, horenTotal: 0,
  lesenCorrect: 0, lesenTotal: 0,
  schreibenAvgPct: null, sprechenAvgPct: null,
  hasHistory: false,
};

export async function fetchSectionAccuracy(userId: string): Promise<SectionAccuracy> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString();

  try {
    // Run all three queries in parallel
    const [answersResult, schreibenResult, sprechenResult] = await Promise.all([
      supabase
        .from('user_answers')
        .select('is_correct, question_id')
        .eq('user_id', userId)
        .gte('created_at', cutoff),
      supabase
        .from('test_sessions')
        .select('score_pct')
        .eq('user_id', userId)
        .eq('section', 'Schreiben')
        .not('completed_at', 'is', null)
        .gte('completed_at', cutoff),
      supabase
        .from('test_sessions')
        .select('score_pct')
        .eq('user_id', userId)
        .eq('section', 'Sprechen')
        .not('completed_at', 'is', null)
        .gte('completed_at', cutoff),
    ]);

    // ── Hören / Lesen counts ─────────────────────────────────────────────────
    let horenCorrect = 0, horenTotal = 0, lesenCorrect = 0, lesenTotal = 0;

    if (answersResult.data && answersResult.data.length > 0) {
      const rows = answersResult.data as unknown as AnswerRow[];
      const questionIds = [...new Set(rows.map((r) => r.question_id))];

      const { data: questions } = await supabase
        .from('app_questions')
        .select('id, section')
        .in('id', questionIds);

      if (questions) {
        const sectionMap = new Map<string, string>();
        for (const q of questions as unknown as QuestionSectionRow[]) {
          sectionMap.set(q.id, q.section);
        }
        for (const answer of rows) {
          const section = sectionMap.get(answer.question_id);
          if (section === 'Hören') {
            horenTotal++;
            if (answer.is_correct) horenCorrect++;
          } else if (section === 'Lesen') {
            lesenTotal++;
            if (answer.is_correct) lesenCorrect++;
          }
        }
      }
    }

    // ── Schreiben average ───────────────────────────────────────────────────
    let schreibenAvgPct: number | null = null;
    if (schreibenResult.data && schreibenResult.data.length > 0) {
      const scores = (schreibenResult.data as { score_pct: number }[]).map((r) => r.score_pct ?? 0);
      schreibenAvgPct = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }

    // ── Sprechen average ────────────────────────────────────────────────────
    let sprechenAvgPct: number | null = null;
    if (sprechenResult.data && sprechenResult.data.length > 0) {
      const scores = (sprechenResult.data as { score_pct: number }[]).map((r) => r.score_pct ?? 0);
      sprechenAvgPct = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }

    return {
      horenCorrect, horenTotal,
      lesenCorrect, lesenTotal,
      schreibenAvgPct, sprechenAvgPct,
      hasHistory: horenTotal > 0 || lesenTotal > 0 || schreibenAvgPct !== null || sprechenAvgPct !== null,
    };
  } catch (err) {
    console.log('fetchSectionAccuracy error', err);
    return EMPTY_ACCURACY;
  }
}

export async function fetchStreamQuestions(
  params: StreamFetchParams
): Promise<{ questions: AppQuestion[]; isRecycled: boolean }> {
  const { userId, targetLevel, limit = 20, sections } = params;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString();

  try {
    const { data: recentAnswers } = await supabase
      .from('user_answers')
      .select('question_id')
      .eq('user_id', userId)
      .gte('created_at', cutoff);

    const seenIds = ((recentAnswers ?? []) as unknown as QuestionIdRow[]).map((r) => r.question_id);

    let query = supabase
      .from('app_questions')
      .select('*')
      .eq('level', targetLevel)
      .eq('is_active', true);

    if (sections && sections.length > 0) {
      query = query.in('section', sections);
    }

    if (seenIds.length > 0) {
      query = query.not('id', 'in', `(${seenIds.join(',')})`);
    }

    query = query.limit(limit * 2);

    const { data, error } = await query;

    if (error) {
      console.log('fetchStreamQuestions error', error);
      throw error;
    }

    let questions = (data ?? []) as AppQuestion[];

    if (questions.length === 0 && seenIds.length > 0) {
      console.log('fetchStreamQuestions all seen, recycling');
      let recycleQuery = supabase
        .from('app_questions')
        .select('*')
        .eq('level', targetLevel)
        .eq('is_active', true);

      if (sections && sections.length > 0) {
        recycleQuery = recycleQuery.in('section', sections);
      }

      const { data: recycled, error: recycleError } = await recycleQuery.limit(limit * 2);

      if (recycleError) {
        console.log('fetchStreamQuestions recycle error', recycleError);
        throw recycleError;
      }

      questions = (recycled ?? []) as AppQuestion[];
      const shuffled = shuffleArray(questions).slice(0, limit);
      return { questions: shuffled, isRecycled: true };
    }

    const shuffled = shuffleArray(questions).slice(0, limit);
    return { questions: shuffled, isRecycled: false };
  } catch (err) {
    console.log('fetchStreamQuestions unexpected error', err);
    throw err;
  }
}

export async function writeStreamAnswer(params: {
  userId: string;
  sessionId: string;
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
}): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('user_answers') as any).insert({
    session_id: params.sessionId,
    user_id: params.userId,
    question_id: params.questionId,
    selected_answer: params.selectedAnswer,
    is_correct: params.isCorrect,
  });
  if (error) {
    console.log('writeStreamAnswer error', error);
  }
}

export async function createStreamSession(params: {
  userId: string;
  level: string;
  questionsTotal: number;
  questionsCorrect: number;
  timeTakenSeconds: number;
}): Promise<string> {
  const scorePct =
    params.questionsTotal > 0
      ? Number(((params.questionsCorrect / params.questionsTotal) * 100).toFixed(2))
      : 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('test_sessions') as any)
    .insert({
      user_id: params.userId,
      session_type: 'stream',
      level: params.level,
      section: 'mixed',
      teil: 0,
      exam_type: 'mixed',
      score_pct: scorePct,
      questions_total: params.questionsTotal,
      questions_correct: params.questionsCorrect,
      time_taken_seconds: params.timeTakenSeconds,
      is_timed: false,
      completed_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.log('createStreamSession error', error);
    return 'placeholder-session';
  }

  track('session_started', { section: 'mixed', cefr_level: params.level });
  track('section_completed', { section: 'mixed', cefr_level: params.level, score_pct: scorePct, duration_sec: params.timeTakenSeconds });

  return (data as unknown as SessionIdRow).id;
}

export async function updateReadinessScore(
  userId: string,
  delta: number = 1
): Promise<number> {
  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('readiness_score')
    .eq('id', userId)
    .single();

  const currentScore = (profileData as { readiness_score?: number } | null)?.readiness_score ?? 0;
  const newScore = Math.max(0, Math.min(100, currentScore + delta));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('user_profiles') as any)
    .update({ readiness_score: newScore, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    console.log('updateReadinessScore error', error);
  }

  return newScore;
}

export async function updateXpAndStreak(
  userId: string,
  profile: UserProfile
): Promise<{ newXp: number; newStreak: number }> {
  const today = new Date().toISOString().split('T')[0] ?? '';
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0] ?? '';

  const prevStreak = profile.streak_count;
  let newStreak = prevStreak;
  if (profile.last_active_date === yesterday) {
    newStreak = profile.streak_count + 1;
  } else if (profile.last_active_date !== today) {
    newStreak = 1;
  }

  const xpGain = XP_PER_LEVEL[profile.target_level ?? 'A1'] ?? 5;
  const newXp = profile.xp_total + xpGain;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('user_profiles') as any)
    .update({
      xp_total: newXp,
      streak_count: newStreak,
      last_active_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.log('updateXpAndStreak error', error);
  }

  if (profile.last_active_date === yesterday) {
    track('streak_extended', { streak_count: newStreak });
  } else if (profile.last_active_date !== today && prevStreak > 1) {
    track('streak_broken', { prev_streak: prevStreak });
  }

  return { newXp, newStreak };
}

export async function submitQuestionReport(params: {
  questionId: string;
  userId: string;
  reason: string;
  detail: string | null;
}): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('question_reports') as any).insert({
      question_id: params.questionId,
      user_id: params.userId,
      reason: params.reason,
      detail: params.detail,
      status: 'open',
    });
    if (error) {
      console.log('submitQuestionReport error', error);
      return false;
    }
    return true;
  } catch (err) {
    console.log('submitQuestionReport unexpected error', err);
    return false;
  }
}


function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }
  return shuffled;
}
