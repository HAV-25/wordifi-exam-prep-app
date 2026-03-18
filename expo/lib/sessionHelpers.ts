import type { AppQuestion, UserProfile } from '@/types/database';
import { supabase } from '@/lib/supabaseClient';
import type { TestSession } from '@/types/database';

export type SubmitSessionPayload = {
  userId: string;
  questions: AppQuestion[];
  answers: Record<string, string>;
  level: string;
  section: string;
  teil: number;
  examType: string;
  sessionStartTime: number;
  profile: UserProfile | null;
};

function getTodayValue(): string {
  return new Date().toISOString().split('T')[0] ?? '';
}

function getYesterdayValue(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0] ?? '';
}

function calculateStreak(lastActiveDate: string | null, currentStreak: number): number {
  const today = getTodayValue();
  if (lastActiveDate === today) {
    return currentStreak;
  }
  if (lastActiveDate === getYesterdayValue()) {
    return currentStreak + 1;
  }
  return 1;
}

export async function submitCompletedSession(payload: SubmitSessionPayload) {
  const { questions, answers, sessionStartTime, userId, level, section, teil, examType, profile } = payload;
  const total = questions.length;
  const correctCount = questions.reduce((count: number, question) => {
    const selected = (answers[question.id] ?? '').toLowerCase();
    return selected === question.correct_answer.toLowerCase() ? count + 1 : count;
  }, 0);
  const scorePct = total > 0 ? Number(((correctCount / total) * 100).toFixed(2)) : 0;
  const timeTakenSeconds = Math.max(1, Math.round((Date.now() - sessionStartTime) / 1000));

  let sessionId = '';

  try {
    const { data: sessionData, error: sessionError } = await supabase
      .from('test_sessions')
      .insert({
        user_id: userId,
        session_type: 'stream',
        level,
        section,
        teil,
        exam_type: examType,
        score_pct: scorePct,
        questions_total: total,
        questions_correct: correctCount,
        time_taken_seconds: timeTakenSeconds,
        is_timed: false,
        completed_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (sessionError || !sessionData) {
      console.log('submitCompletedSession session error', sessionError);
    } else {
      const session = sessionData as TestSession;
      sessionId = session.id;

      const answerRows = questions.map((question) => {
        const selectedAnswer = (answers[question.id] ?? '').toLowerCase();
        return {
          session_id: session.id,
          user_id: userId,
          question_id: question.id,
          selected_answer: selectedAnswer,
          is_correct: selectedAnswer === question.correct_answer.toLowerCase(),
          time_taken_seconds: null,
        };
      });

      const { error: answersError } = await supabase.from('user_answers').insert(answerRows);
      if (answersError) {
        console.log('submitCompletedSession answers error', answersError);
      }
    }

    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        xp_total: (profile?.xp_total ?? 0) + correctCount,
        last_active_date: getTodayValue(),
        streak_count: calculateStreak(profile?.last_active_date ?? null, profile?.streak_count ?? 0),
        preparedness_score: scorePct,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (profileError) {
      console.log('submitCompletedSession profile error', profileError);
    }
  } catch (error) {
    console.log('submitCompletedSession unexpected error', error);
  }

  return {
    sessionId,
    correctCount,
    total,
    scorePct,
    timeTakenSeconds,
  };
}
