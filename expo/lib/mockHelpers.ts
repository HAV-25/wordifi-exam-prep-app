import { supabase } from '@/lib/supabaseClient';
import { MOCK_TEST_QUESTION_COUNTS, shuffleArray } from '@/theme/constants';
import type { AppQuestion, StudyPlanItem, UserProfile } from '@/types/database';

export type MockTestInfo = {
  level: string;
  horenCount: number;
  lesenCount: number;
  totalCount: number;
  estimatedMinutes: number;
};

type MockRetestRow = {
  completed_at: string | null;
  retest_available_at: string | null;
};

const TIMING_MAP: Record<string, { horen: number; lesen: number }> = {
  A1: { horen: 20, lesen: 25 },
  A2: { horen: 30, lesen: 30 },
  B1: { horen: 40, lesen: 60 },
};

export function getMockTiming(level: string): { horenMinutes: number; lesenMinutes: number } {
  const t = TIMING_MAP[level] ?? { horen: 30, lesen: 30 };
  return { horenMinutes: t.horen, lesenMinutes: t.lesen };
}

export async function fetchMockTestInfo(level: string): Promise<MockTestInfo> {
  console.log('mockHelpers fetchMockTestInfo', level);

  const { data, error } = await supabase
    .from('app_questions')
    .select('section')
    .eq('level', level)
    .eq('is_active', true);

  if (error) {
    console.log('fetchMockTestInfo error', error);
    throw error;
  }

  const rows = (data ?? []) as Array<{ section: string }>;
  const horenCount = rows.filter((r) => r.section === 'Hören').length;
  const lesenCount = rows.filter((r) => r.section === 'Lesen').length;
  const totalCount = horenCount + lesenCount;
  const timing = getMockTiming(level);
  const estimatedMinutes = timing.horenMinutes + timing.lesenMinutes;

  return { level, horenCount, lesenCount, totalCount, estimatedMinutes };
}

export async function checkMockRetestAvailability(
  userId: string,
  level: string
): Promise<{ isLocked: boolean; retestDate: string | null }> {
  console.log('mockHelpers checkMockRetestAvailability', { userId, level });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('mock_tests') as any)
    .select('completed_at, retest_available_at')
    .eq('user_id', userId)
    .eq('level', level)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return { isLocked: false, retestDate: null };
  }

  const row = (data as unknown as MockRetestRow[])[0];
  if (!row?.retest_available_at) {
    return { isLocked: false, retestDate: null };
  }

  const retestDate = new Date(row.retest_available_at);
  const now = new Date();
  return {
    isLocked: retestDate > now,
    retestDate: row.retest_available_at,
  };
}

export async function fetchMockQuestions(
  level: string
): Promise<{ horen: AppQuestion[]; lesen: AppQuestion[] }> {
  console.log('mockHelpers fetchMockQuestions', level);

  const { data, error } = await supabase
    .from('app_questions')
    .select('*')
    .eq('level', level)
    .eq('is_active', true)
    .order('teil', { ascending: true })
    .order('question_number', { ascending: true });

  if (error) {
    console.log('fetchMockQuestions error', error);
    throw error;
  }

  const all = (data ?? []) as AppQuestion[];

  const sectionCounts = MOCK_TEST_QUESTION_COUNTS[level];

  const selectForSection = (section: string): AppQuestion[] => {
    const sectionQuestions = all.filter((q) => q.section === section);
    const teilMap = new Map<number, AppQuestion[]>();
    for (const q of sectionQuestions) {
      const teil = q.teil ?? 1;
      if (!teilMap.has(teil)) teilMap.set(teil, []);
      teilMap.get(teil)!.push(q);
    }

    const teilCounts = sectionCounts?.[section];
    if (!teilCounts) return sectionQuestions;

    const selected: AppQuestion[] = [];
    for (const [teil, questions] of teilMap) {
      const targetCount = teilCounts[teil] ?? questions.length;
      const shuffled = shuffleArray(questions);
      selected.push(...shuffled.slice(0, targetCount));
    }

    selected.sort((a, b) => {
      if ((a.teil ?? 1) !== (b.teil ?? 1)) return (a.teil ?? 1) - (b.teil ?? 1);
      return (a.question_number ?? 0) - (b.question_number ?? 0);
    });

    return selected;
  };

  const horen = selectForSection('Hören');
  const lesen = selectForSection('Lesen');

  console.log('fetchMockQuestions selected', { horenCount: horen.length, lesenCount: lesen.length, level });

  return { horen, lesen };
}

export async function createMockTest(params: {
  userId: string;
  level: string;
  examType: string;
  isTimed: boolean;
}): Promise<string> {
  console.log('mockHelpers createMockTest', params);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('mock_tests') as any)
    .insert({
      user_id: params.userId,
      level: params.level,
      exam_type: params.examType,
      is_timed: params.isTimed,
      status: 'in_progress',
      current_section: 'Hören',
      current_teil: 1,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.log('createMockTest error', error);
    throw error;
  }

  return (data as { id: string }).id;
}

export async function abandonMockTest(mockTestId: string): Promise<void> {
  console.log('mockHelpers abandonMockTest', mockTestId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('mock_tests') as any)
    .update({ status: 'abandoned' })
    .eq('id', mockTestId);

  if (error) {
    console.log('abandonMockTest error', error);
  }
}

export function generateStudyPlan(
  hoerenPct: number,
  lesenPct: number,
  overallPct: number
): StudyPlanItem[] {
  const plan: StudyPlanItem[] = [];

  if (hoerenPct < 60) {
    plan.push({
      priority: 1,
      section: 'Hören',
      action: 'Focus on Hören daily — aim for 10 questions per day',
      resource: 'Test Stream → Hören filter',
    });
  }
  if (lesenPct < 60) {
    plan.push({
      priority: plan.length + 1,
      section: 'Lesen',
      action: 'Practise Lesen reading speed — 2 Lesen sections per week',
      resource: 'Sectional Tests → Lesen',
    });
  }
  if (overallPct >= 60) {
    plan.push({
      priority: plan.length + 1,
      section: 'All',
      action: 'Great score! Keep your streak going to maintain readiness.',
      resource: 'Test Stream — daily practice',
    });
  }
  if (plan.length === 0) {
    plan.push({
      priority: 1,
      section: 'All',
      action: 'Keep practising both sections to improve your overall score.',
      resource: 'Test Stream — daily practice',
    });
  }

  return plan;
}

export async function completeMockTest(params: {
  mockTestId: string;
  userId: string;
  level: string;
  examType: string;
  isTimed: boolean;
  horenQuestions: AppQuestion[];
  lesenQuestions: AppQuestion[];
  answers: Record<string, string>;
  timeTakenSeconds: number;
  profile: UserProfile | null;
}): Promise<{
  horenCorrect: number;
  horenTotal: number;
  horenPct: number;
  lesenCorrect: number;
  lesenTotal: number;
  lesenPct: number;
  overallPct: number;
  totalCorrect: number;
  totalQuestions: number;
  studyPlan: StudyPlanItem[];
}> {
  const {
    mockTestId,
    userId,
    level,
    examType,
    isTimed,
    horenQuestions,
    lesenQuestions,
    answers,
    timeTakenSeconds,
    profile,
  } = params;

  const calcSection = (questions: AppQuestion[]) => {
    const total = questions.length;
    const correct = questions.reduce((count, q) => {
      const sel = (answers[q.id] ?? '').toLowerCase();
      return sel === q.correct_answer.toLowerCase() ? count + 1 : count;
    }, 0);
    const pct = total > 0 ? Number(((correct / total) * 100).toFixed(2)) : 0;
    return { correct, total, pct };
  };

  const horen = calcSection(horenQuestions);
  const lesen = calcSection(lesenQuestions);
  const totalCorrect = horen.correct + lesen.correct;
  const totalQuestions = horen.total + lesen.total;
  const overallPct = totalQuestions > 0
    ? Number(((totalCorrect / totalQuestions) * 100).toFixed(2))
    : 0;

  const studyPlan = generateStudyPlan(horen.pct, lesen.pct, overallPct);

  const retestDate = new Date();
  retestDate.setDate(retestDate.getDate() + 7);
  const retestStr = retestDate.toISOString().split('T')[0] ?? '';

  const sessionIds: string[] = [];

  try {
    if (horen.total > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: hSession, error: hErr } = await (supabase.from('test_sessions') as any)
        .insert({
          user_id: userId,
          session_type: 'mock',
          level,
          section: 'Hören',
          teil: 0,
          exam_type: examType,
          score_pct: horen.pct,
          questions_total: horen.total,
          questions_correct: horen.correct,
          time_taken_seconds: Math.round(timeTakenSeconds * (horen.total / totalQuestions)),
          is_timed: isTimed,
          completed_at: new Date().toISOString(),
          mock_test_id: mockTestId,
          retest_available_at: retestStr,
        })
        .select('id')
        .single();

      if (hErr) {
        console.log('completeMockTest horen session error', hErr);
      } else {
        sessionIds.push((hSession as { id: string }).id);
      }
    }

    if (lesen.total > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: lSession, error: lErr } = await (supabase.from('test_sessions') as any)
        .insert({
          user_id: userId,
          session_type: 'mock',
          level,
          section: 'Lesen',
          teil: 0,
          exam_type: examType,
          score_pct: lesen.pct,
          questions_total: lesen.total,
          questions_correct: lesen.correct,
          time_taken_seconds: Math.round(timeTakenSeconds * (lesen.total / totalQuestions)),
          is_timed: isTimed,
          completed_at: new Date().toISOString(),
          mock_test_id: mockTestId,
          retest_available_at: retestStr,
        })
        .select('id')
        .single();

      if (lErr) {
        console.log('completeMockTest lesen session error', lErr);
      } else {
        sessionIds.push((lSession as { id: string }).id);
      }
    }

    const allQuestions = [...horenQuestions, ...lesenQuestions];
    const answerRows = allQuestions.map((q) => ({
      session_id: sessionIds[0] ?? mockTestId,
      user_id: userId,
      question_id: q.id,
      selected_answer: (answers[q.id] ?? '').toLowerCase(),
      is_correct: (answers[q.id] ?? '').toLowerCase() === q.correct_answer.toLowerCase(),
      time_taken_seconds: null,
    }));

    if (answerRows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: aErr } = await (supabase.from('user_answers') as any).insert(answerRows);
      if (aErr) {
        console.log('completeMockTest answers insert error', aErr);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: mockErr } = await (supabase.from('mock_tests') as any)
      .update({
        status: 'completed',
        hoeren_score_pct: horen.pct,
        lesen_score_pct: lesen.pct,
        overall_score_pct: overallPct,
        completed_at: new Date().toISOString(),
        time_taken_seconds: timeTakenSeconds,
        section_session_ids: sessionIds,
        study_plan: studyPlan,
        retest_available_at: retestStr,
      })
      .eq('id', mockTestId);

    if (mockErr) {
      console.log('completeMockTest mock update error', mockErr);
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
    const { error: profErr } = await (supabase.from('user_profiles') as any)
      .update({
        xp_total: (profile?.xp_total ?? 0) + totalCorrect,
        last_active_date: today,
        streak_count: newStreak,
        preparedness_score: Math.min(100, Math.max(0, overallPct * 0.8 + (profile?.preparedness_score ?? 0) * 0.2)),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (profErr) {
      console.log('completeMockTest profile update error', profErr);
    }
  } catch (err) {
    console.log('completeMockTest unexpected error', err);
  }

  return {
    horenCorrect: horen.correct,
    horenTotal: horen.total,
    horenPct: horen.pct,
    lesenCorrect: lesen.correct,
    lesenTotal: lesen.total,
    lesenPct: lesen.pct,
    overallPct,
    totalCorrect,
    totalQuestions,
    studyPlan,
  };
}

export async function submitQuestionReport(params: {
  questionId: string;
  userId: string;
  reason: string;
  detail: string;
}): Promise<void> {
  console.log('mockHelpers submitQuestionReport', params);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('question_reports') as any)
    .upsert(
      {
        question_id: params.questionId,
        user_id: params.userId,
        reason: params.reason,
        detail: params.detail || null,
        status: 'pending',
      },
      { onConflict: 'question_id,user_id' }
    );

  if (error) {
    console.log('submitQuestionReport error', error);
    throw error;
  }
}
