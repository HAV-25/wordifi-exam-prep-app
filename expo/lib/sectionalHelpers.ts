import { supabase } from '@/lib/supabaseClient';
import { MOCK_TEST_QUESTION_COUNTS, shuffleArray } from '@/theme/constants';
import type { AppQuestion, UserProfile } from '@/types/database';

export type TeilInfo = {
  section: string;
  teil: number;
  question_type: string;
  structure_type: string;
  q_count: number;
  estimated_minutes: number;
};

export type RetestInfo = {
  retest_available_at: string | null;
  is_locked: boolean;
};

type TeilRow = {
  section: string;
  teil: number;
  question_type: string;
  source_structure_type: string;
};

type SessionRetestRow = {
  completed_at: string | null;
  retest_available_at: string | null;
};

export async function fetchAvailableTeile(level: string): Promise<TeilInfo[]> {
  console.log('sectionalHelpers fetchAvailableTeile', level);

  const { data, error } = await supabase
    .from('app_questions')
    .select('section, teil, question_type, source_structure_type')
    .eq('level', level)
    .eq('is_active', true);

  if (error) {
    console.log('fetchAvailableTeile error', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return [];
  }

  const rows = data as unknown as TeilRow[];
  const grouped = new Map<string, { section: string; teil: number; question_type: string; structure_type: string; count: number }>();

  for (const row of rows) {
    const key = `${row.section}__${row.teil}__${row.source_structure_type}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(key, {
        section: row.section,
        teil: row.teil,
        question_type: row.question_type,
        structure_type: row.source_structure_type,
        count: 1,
      });
    }
  }

  const result: TeilInfo[] = [];
  for (const entry of grouped.values()) {
    const examCount = MOCK_TEST_QUESTION_COUNTS[level]?.[entry.section]?.[entry.teil];
    const displayCount = examCount ?? entry.count;
    result.push({
      section: entry.section,
      teil: entry.teil,
      question_type: entry.question_type,
      structure_type: entry.structure_type,
      q_count: displayCount,
      estimated_minutes: Math.max(1, Math.round((displayCount * 45) / 60)),
    });
  }

  result.sort((a, b) => {
    if (a.section < b.section) return -1;
    if (a.section > b.section) return 1;
    return a.teil - b.teil;
  });

  return result;
}

export async function checkRetestAvailability(
  userId: string,
  level: string,
  section: string,
  teil: number
): Promise<RetestInfo> {
  console.log('sectionalHelpers checkRetestAvailability', { userId, level, section, teil });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('test_sessions') as any)
    .select('completed_at, retest_available_at')
    .eq('user_id', userId)
    .eq('level', level)
    .eq('section', section)
    .eq('teil', teil)
    .eq('session_type', 'sectional')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return { retest_available_at: null, is_locked: false };
  }

  const row = (data as unknown as SessionRetestRow[])[0];
  if (!row?.retest_available_at) {
    return { retest_available_at: null, is_locked: false };
  }

  const retestDate = new Date(row.retest_available_at);
  const now = new Date();
  const isLocked = retestDate > now;

  return {
    retest_available_at: row.retest_available_at,
    is_locked: isLocked,
  };
}

export async function fetchSectionalQuestions(
  level: string,
  section: string,
  teil: number
): Promise<AppQuestion[]> {
  console.log('sectionalHelpers fetchSectionalQuestions', { level, section, teil });

  const { data, error } = await supabase
    .from('app_questions')
    .select('*')
    .eq('level', level)
    .eq('section', section)
    .eq('teil', teil)
    .eq('is_active', true);

  if (error) {
    console.log('fetchSectionalQuestions error', error);
    throw error;
  }

  const allQuestions = (data ?? []) as AppQuestion[];
  const targetCount = MOCK_TEST_QUESTION_COUNTS[level]?.[section]?.[teil];

  if (targetCount && allQuestions.length > targetCount) {
    const shuffled = shuffleArray(allQuestions).slice(0, targetCount);
    shuffled.sort((a, b) => (a.question_number ?? 0) - (b.question_number ?? 0));
    console.log('fetchSectionalQuestions selected', { total: allQuestions.length, target: targetCount, selected: shuffled.length });
    return shuffled;
  }

  console.log('fetchSectionalQuestions returning all', { total: allQuestions.length, targetCount });
  return allQuestions;
}

export async function createSectionalSession(params: {
  userId: string;
  level: string;
  section: string;
  teil: number;
  examType: string;
  questionsTotal: number;
  isTimed: boolean;
}): Promise<string> {
  console.log('sectionalHelpers createSectionalSession', params);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('test_sessions') as any)
    .insert({
      user_id: params.userId,
      session_type: 'sectional',
      level: params.level,
      section: params.section,
      teil: params.teil,
      exam_type: params.examType,
      score_pct: 0,
      questions_total: params.questionsTotal,
      questions_correct: 0,
      time_taken_seconds: 0,
      is_timed: params.isTimed,
      completed_at: null,
    })
    .select('id')
    .single();

  if (error) {
    console.log('createSectionalSession error', error);
    throw error;
  }

  return (data as { id: string }).id;
}

export async function completeSectionalSession(params: {
  sessionId: string;
  userId: string;
  questions: AppQuestion[];
  answers: Record<string, string>;
  timeTakenSeconds: number;
  profile: UserProfile | null;
}): Promise<{
  correctCount: number;
  total: number;
  scorePct: number;
}> {
  const { sessionId, userId, questions, answers, timeTakenSeconds, profile } = params;
  const total = questions.length;
  const correctCount = questions.reduce((count, q) => {
    const selected = (answers[q.id] ?? '').toLowerCase();
    return selected === q.correct_answer.toLowerCase() ? count + 1 : count;
  }, 0);
  const scorePct = total > 0 ? Number(((correctCount / total) * 100).toFixed(2)) : 0;

  console.log('sectionalHelpers completeSectionalSession', { sessionId, correctCount, total, scorePct });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: sessionError } = await (supabase.from('test_sessions') as any)
      .update({
        score_pct: scorePct,
        questions_correct: correctCount,
        time_taken_seconds: timeTakenSeconds,
        completed_at: new Date().toISOString(),
        retest_available_at: getRetestDate(),
      })
      .eq('id', sessionId);

    if (sessionError) {
      console.log('completeSectionalSession session update error', sessionError);
    }

    const answerRows = questions.map((q) => ({
      session_id: sessionId,
      user_id: userId,
      question_id: q.id,
      selected_answer: (answers[q.id] ?? '').toLowerCase(),
      is_correct: (answers[q.id] ?? '').toLowerCase() === q.correct_answer.toLowerCase(),
      time_taken_seconds: null,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: answersError } = await (supabase.from('user_answers') as any).insert(answerRows);
    if (answersError) {
      console.log('completeSectionalSession answers insert error', answersError);
    }

    const today = new Date().toISOString().split('T')[0] ?? '';
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0] ?? '';
    let newStreak = profile?.streak_count ?? 0;
    if (profile?.last_active_date === yesterday) {
      newStreak = (profile?.streak_count ?? 0) + 1;
    } else if (profile?.last_active_date !== today) {
      newStreak = 1;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: profileError } = await (supabase.from('user_profiles') as any)
      .update({
        xp_total: (profile?.xp_total ?? 0) + correctCount,
        last_active_date: today,
        streak_count: newStreak,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (profileError) {
      console.log('completeSectionalSession profile update error', profileError);
    }
  } catch (err) {
    console.log('completeSectionalSession unexpected error', err);
  }

  return { correctCount, total, scorePct };
}

export async function createSessionLink(params: {
  userId: string;
  level: string;
  section: string;
  teil: number;
  examType: string;
  isTimed: boolean;
  questionIds: string[];
}): Promise<string> {
  console.log('sectionalHelpers createSessionLink');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('session_links') as any)
    .update({ expires_at: new Date().toISOString() })
    .eq('user_id', params.userId)
    .eq('is_used', false)
    .gt('expires_at', new Date().toISOString());

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('session_links') as any)
    .insert({
      user_id: params.userId,
      level: params.level,
      section: params.section,
      teil: params.teil,
      exam_type: params.examType,
      is_timed: params.isTimed,
      question_ids: params.questionIds,
      is_used: false,
      expires_at: expiresAt,
    })
    .select('token')
    .single();

  if (error) {
    console.log('createSessionLink error', error);
    throw error;
  }

  return (data as { token: string }).token;
}

function getRetestDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0] ?? '';
}

export type PreviousSessionResult = {
  sessionId: string;
  scorePct: number;
  correctCount: number;
  total: number;
  isTimed: boolean;
  timeTaken: number;
  questions: AppQuestion[];
  answers: Record<string, string>;
};

export async function fetchPreviousSessionResult(
  userId: string,
  level: string,
  section: string,
  teil: number
): Promise<PreviousSessionResult | null> {
  console.log('sectionalHelpers fetchPreviousSessionResult', { userId, level, section, teil });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sessionData, error: sessionError } = await (supabase.from('test_sessions') as any)
    .select('id, score_pct, questions_total, questions_correct, is_timed, time_taken_seconds')
    .eq('user_id', userId)
    .eq('level', level)
    .eq('section', section)
    .eq('teil', teil)
    .eq('session_type', 'sectional')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1);

  if (sessionError || !sessionData || sessionData.length === 0) {
    console.log('fetchPreviousSessionResult no session found', sessionError);
    return null;
  }

  const session = sessionData[0] as {
    id: string;
    score_pct: number;
    questions_total: number;
    questions_correct: number;
    is_timed: boolean;
    time_taken_seconds: number;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: answerData, error: answerError } = await (supabase.from('user_answers') as any)
    .select('question_id, selected_answer')
    .eq('session_id', session.id)
    .eq('user_id', userId);

  if (answerError) {
    console.log('fetchPreviousSessionResult answers error', answerError);
    return null;
  }

  const answerRows = (answerData ?? []) as { question_id: string; selected_answer: string }[];
  const questionIds = answerRows.map((a) => a.question_id);

  if (questionIds.length === 0) {
    console.log('fetchPreviousSessionResult no answers found');
    return null;
  }

  const { data: questionData, error: questionError } = await supabase
    .from('app_questions')
    .select('*')
    .in('id', questionIds)
    .order('question_number', { ascending: true });

  if (questionError || !questionData) {
    console.log('fetchPreviousSessionResult questions error', questionError);
    return null;
  }

  const answersMap: Record<string, string> = {};
  for (const row of answerRows) {
    answersMap[row.question_id] = row.selected_answer;
  }

  return {
    sessionId: session.id,
    scorePct: session.score_pct,
    correctCount: session.questions_correct,
    total: session.questions_total,
    isTimed: session.is_timed,
    timeTaken: session.time_taken_seconds,
    questions: questionData as AppQuestion[],
    answers: answersMap,
  };
}
