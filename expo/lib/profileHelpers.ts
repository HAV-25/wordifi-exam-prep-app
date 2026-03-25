import type { User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabaseClient';
import type { ExamType, Level, StudyPlanJson, UserProfile } from '@/types/database';

export type OnboardingPayload = {
  targetLevel: Level;
  examType: ExamType;
  examDate: string | null;
};

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.log('ensureUserProfile select error', error);
    throw error;
  }

  if (data) {
    return data as UserProfile;
  }

  const trialExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from('user_profiles')
    .insert({
      id: user.id,
      subscription_tier: 'free_trial',
      trial_active: true,
      preparedness_score: 0,
      streak_count: 0,
      xp_total: 0,
      credit_balance: 0,
    } as never)
    .select('*')
    .single();

  if (insertError || !inserted) {
    console.log('ensureUserProfile insert error', insertError);
    throw insertError ?? new Error('Profile creation failed');
  }

  console.log('ensureUserProfile new user created with free_trial tier, trial expires at', trialExpiresAt);

  await supabase
    .from('user_profiles')
    .update({
      trial_expires_at: trialExpiresAt,
    } as never)
    .eq('id', user.id);

  return inserted as UserProfile;
}

export async function upsertOnboardingProfile(
  userId: string,
  payload: OnboardingPayload
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(
      {
        id: userId,
        target_level: payload.targetLevel,
        exam_type: payload.examType,
        exam_date: payload.examDate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select('*')
    .single();

  if (error || !data) {
    console.log('upsertOnboardingProfile error', error);
    throw error ?? new Error('Profile update failed');
  }

  return data as UserProfile;
}

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.log('fetchUserProfile error', error);
    throw error;
  }

  return (data as UserProfile | null) ?? null;
}

export async function updateTargetLevel(userId: string, targetLevel: Level): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ target_level: targetLevel, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('*')
    .single();

  if (error || !data) {
    console.log('updateTargetLevel error', error);
    throw error ?? new Error('Could not update level');
  }

  return data as UserProfile;
}

export async function updateExamDate(userId: string, examDate: string | null): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ exam_date: examDate, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('*')
    .single();

  if (error || !data) {
    console.log('updateExamDate error', error);
    throw error ?? new Error('Could not update exam date');
  }

  return data as UserProfile;
}

export async function updateStudyPlan(userId: string, plan: StudyPlanJson): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ study_plan_json: plan, updated_at: new Date().toISOString() } as never)
    .eq('id', userId)
    .select('*')
    .single();

  if (error || !data) {
    console.log('updateStudyPlan error', error);
    throw error ?? new Error('Could not update study plan');
  }

  return data as UserProfile;
}

export async function updatePlayerName(userId: string, playerName: string): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ player_name: playerName, updated_at: new Date().toISOString() } as never)
    .eq('id', userId);

  if (error) {
    console.log('updatePlayerName error', error);
    throw error;
  }
}

export type LeaderboardEntry = {
  rank: number;
  display_name: string;
  preparedness_score: number;
  streak_count: number;
  target_level: string;
  is_current_user: boolean;
};

export async function fetchLeaderboard(targetLevel: string): Promise<LeaderboardEntry[]> {
  console.log('fetchLeaderboard calling RPC get_leaderboard with level:', targetLevel);
  const { data, error } = await (supabase.rpc as any)('get_leaderboard', { p_level: targetLevel });

  if (error) {
    console.log('fetchLeaderboard RPC error', error);
    throw error;
  }

  console.log('fetchLeaderboard RPC returned', (data ?? []).length, 'entries');
  return (data ?? []) as LeaderboardEntry[];
}

export type RecentIncorrectAnswer = {
  question_id: string;
  question_text: string;
  correct_answer: string;
  explanation_en: string | null;
  section: string;
  level: string;
  created_at: string | null;
};

export async function fetchRecentIncorrect(userId: string): Promise<RecentIncorrectAnswer[]> {
  try {
    const { data: answers, error: ansError } = await supabase
      .from('user_answers')
      .select('question_id, created_at')
      .eq('user_id', userId)
      .eq('is_correct', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (ansError || !answers || answers.length === 0) {
      console.log('fetchRecentIncorrect answers error or empty', ansError);
      return [];
    }

    const rows = answers as Array<{ question_id: string; created_at: string | null }>;
    const questionIds = [...new Set(rows.map((r) => r.question_id))];

    const { data: questions, error: qError } = await supabase
      .from('app_questions')
      .select('id, question_text, correct_answer, explanation_en, section, level')
      .in('id', questionIds);

    if (qError || !questions) {
      console.log('fetchRecentIncorrect questions error', qError);
      return [];
    }

    const qMap = new Map<string, { question_text: string; correct_answer: string; explanation_en: string | null; section: string; level: string }>();
    for (const q of questions as Array<{ id: string; question_text: string; correct_answer: string; explanation_en: string | null; section: string; level: string }>) {
      qMap.set(q.id, q);
    }

    const result: RecentIncorrectAnswer[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.question_id)) continue;
      seen.add(row.question_id);
      const q = qMap.get(row.question_id);
      if (!q) continue;
      result.push({
        question_id: row.question_id,
        question_text: q.question_text,
        correct_answer: q.correct_answer,
        explanation_en: q.explanation_en,
        section: q.section,
        level: q.level,
        created_at: row.created_at,
      });
    }

    return result;
  } catch (err) {
    console.log('fetchRecentIncorrect unexpected error', err);
    return [];
  }
}

export async function fetchUncompletedTeileCount(userId: string, level: string): Promise<number> {
  const { data, error } = await supabase
    .from('app_questions')
    .select('section, teil')
    .eq('level', level)
    .eq('is_active', true);

  if (error || !data) {
    console.log('fetchUncompletedTeileCount questions error', error);
    return 0;
  }

  const allTeile = new Set(data.map((q: { section: string; teil: number }) => `${q.section}-${q.teil}`));

  const { data: sessions, error: sessError } = await supabase
    .from('test_sessions')
    .select('section, teil')
    .eq('user_id', userId)
    .eq('level', level)
    .eq('session_type', 'sectional');

  if (sessError) {
    console.log('fetchUncompletedTeileCount sessions error', sessError);
    return allTeile.size;
  }

  const completedTeile = new Set((sessions ?? []).map((s: { section: string; teil: number }) => `${s.section}-${s.teil}`));
  let uncompleted = 0;
  allTeile.forEach((t) => {
    if (!completedTeile.has(t)) uncompleted++;
  });

  return uncompleted;
}
