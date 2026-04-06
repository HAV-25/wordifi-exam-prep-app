import type { User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabaseClient';
import type { ExamType, Level, StudyPlanJson, UserProfile } from '@/types/database';
import type { OnboardingAnswers } from '@/app/onboarding_launch/_store';

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

  const trialExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const playerName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'User';

  const { data: inserted, error: insertError } = await supabase
    .from('user_profiles')
    .insert({
      id: user.id,
      player_name: playerName,
      subscription_tier: 'free_trial',
      trial_active: true,
      trial_expires_at: trialExpiresAt,
      preparedness_score: 0,
      streak_count: 0,
      xp_total: 0,
      credit_balance: 0,
      notifications_permission: 'not_asked',
      notifications_enabled: false,
      tc_accepted: false,
    } as never)
    .select('*')
    .single();

  if (insertError || !inserted) {
    console.log('ensureUserProfile insert error', insertError);
    throw insertError ?? new Error('Profile creation failed');
  }

  console.log('ensureUserProfile new user created with free_trial tier, trial expires at', trialExpiresAt);

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
  explanation_de: string | null;
  section: string;
  level: string;
  created_at: string | null;
  options: Array<{ key: string; text: string }>;
  stimulus_text: string | null;
  stimulus_type: string | null;
  audio_url: string | null;
  question_type: string;
  teil: number;
  audio_script: string | null;
  grammar_rule: string | null;
  grammar_rule_de: string | null;
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
      .select('id, question_text, correct_answer, explanation_en, explanation_de, section, level, options, stimulus_text, stimulus_type, audio_url, question_type, teil, audio_script, grammar_rule, grammar_rule_de')
      .in('id', questionIds);

    if (qError || !questions) {
      console.log('fetchRecentIncorrect questions error', qError);
      return [];
    }

    type QRow = {
      id: string;
      question_text: string;
      correct_answer: string;
      explanation_en: string | null;
      explanation_de: string | null;
      section: string;
      level: string;
      options: Array<{ key: string; text: string }>;
      stimulus_text: string | null;
      stimulus_type: string | null;
      audio_url: string | null;
      question_type: string;
      teil: number;
      audio_script: string | null;
      grammar_rule: string | null;
      grammar_rule_de: string | null;
    };
    const qMap = new Map<string, QRow>();
    for (const q of questions as QRow[]) {
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
        explanation_de: q.explanation_de,
        section: q.section,
        level: q.level,
        created_at: row.created_at,
        options: q.options,
        stimulus_text: q.stimulus_text,
        stimulus_type: q.stimulus_type,
        audio_url: q.audio_url,
        question_type: q.question_type,
        teil: q.teil,
        audio_script: q.audio_script,
        grammar_rule: q.grammar_rule,
        grammar_rule_de: q.grammar_rule_de,
      });
    }

    return result;
  } catch (err) {
    console.log('fetchRecentIncorrect unexpected error', err);
    return [];
  }
}

export async function saveOnboardingAnswers(
  userId: string,
  answers: OnboardingAnswers
): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .upsert({
      id: userId,
      target_level: answers.level ?? null,
      exam_type: answers.cert !== 'not_sure' ? answers.cert : null,
      onboarding_cert: answers.cert,
      onboarding_readiness: answers.readiness,
      onboarding_hardest: answers.hardest,
      onboarding_daily_minutes: answers.dailyMinutes,
      onboarding_learner_style: answers.learnerStyle,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never);

  if (error) {
    console.error('saveOnboardingAnswers error', error);
    throw error;
  }
}

const PENDING_ONBOARDING_KEY = 'wordifi_pending_onboarding';

export async function savePendingOnboarding(answers: OnboardingAnswers): Promise<void> {
  await AsyncStorage.setItem(PENDING_ONBOARDING_KEY, JSON.stringify(answers));
}

export async function loadAndClearPendingOnboarding(): Promise<OnboardingAnswers | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_ONBOARDING_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(PENDING_ONBOARDING_KEY);
    return JSON.parse(raw) as OnboardingAnswers;
  } catch {
    return null;
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
