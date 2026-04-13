/**
 * streamSessionHelpers.ts — DB-backed daily stream session logic
 *
 * Uses the stream_sessions table with:
 *   question_ids uuid[]   — ordered list of 20 question IDs for the day
 *   current_index int     — resume pointer (0-based)
 *   completed_count int   — how many the user has answered
 *   is_complete boolean   — true when all questions answered
 *   UNIQUE(user_id, level, session_date)
 */
import { supabase } from '@/lib/supabaseClient';
import * as Sentry from '@sentry/react-native';
import type { AppQuestion } from '@/types/database';

// ─── Types ───────────────────────────────────────────────────────────────────

export type StreamSession = {
  id: string;
  user_id: string;
  level: string;
  session_date: string;
  question_ids: string[];
  current_index: number;
  completed_count: number;
  is_complete: boolean;
};

export type SessionResult =
  | { status: 'active'; session: StreamSession }
  | { status: 'complete'; session: StreamSession }
  | { status: 'created'; session: StreamSession; isRecycled: boolean };

// ─── 1. getOrCreateStreamSession ─────────────────────────────────────────────

export async function getOrCreateStreamSession(
  userId: string,
  level: string,
  sessionDate: string,
  sections: string[] = ['Hören', 'Lesen'],
): Promise<SessionResult> {
  console.log('[StreamSession] getOrCreate', { userId, level, sessionDate });

  // Check for existing session today (pick latest if duplicates exist)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingRows, error: selectErr } = await (supabase.from('stream_sessions') as any)
    .select('*')
    .eq('user_id', userId)
    .eq('level', level)
    .eq('session_date', sessionDate)
    .order('created_at', { ascending: false })
    .limit(1);

  if (selectErr) {
    console.error('[StreamSession] select error', selectErr);
    Sentry.captureException(selectErr, { tags: { context: 'stream_session' } });
    throw selectErr;
  }

  const existing = (existingRows as unknown[] | null)?.[0] ?? null;

  if (existing) {
    const session = existing as StreamSession;
    if (session.is_complete) {
      return { status: 'complete', session };
    }
    console.log('[StreamSession] resuming at index', session.current_index);
    return { status: 'active', session };
  }

  // No session today — create one
  const { questionIds, isRecycled } = await selectQuestionsForSession(userId, level, 20, sections);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error: insertErr } = await (supabase.from('stream_sessions') as any)
    .insert({
      user_id: userId,
      level,
      session_date: sessionDate,
      question_ids: questionIds,
      current_index: 0,
      completed_count: 0,
      is_complete: false,
    })
    .select('*')
    .single();

  if (insertErr) {
    console.error('[StreamSession] insert error', insertErr);
    Sentry.captureException(insertErr, { tags: { context: 'stream_session' } });
    throw insertErr;
  }

  console.log('[StreamSession] created with', questionIds.length, 'questions', isRecycled ? '(recycled)' : '');
  return { status: 'created', session: inserted as StreamSession, isRecycled };
}

// ─── 2. selectQuestionsForSession ────────────────────────────────────────────

export async function selectQuestionsForSession(
  userId: string,
  level: string,
  count: number,
  sections: string[] = ['Hören', 'Lesen'],
): Promise<{ questionIds: string[]; isRecycled: boolean }> {
  // Get question IDs answered in last 30 days (from stream sessions only)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recentSessions } = await (supabase.from('stream_sessions') as any)
    .select('question_ids')
    .eq('user_id', userId)
    .gte('session_date', cutoffStr);

  const seenIds = new Set<string>();
  for (const row of (recentSessions ?? []) as { question_ids: string[] }[]) {
    for (const qid of row.question_ids ?? []) {
      seenIds.add(qid);
    }
  }

  // Also check user_answers from the last 30 days as a broader fallback
  const { data: recentAnswers } = await supabase
    .from('user_answers')
    .select('question_id')
    .eq('user_id', userId)
    .gte('created_at', cutoff.toISOString());

  for (const row of (recentAnswers ?? []) as { question_id: string }[]) {
    seenIds.add(row.question_id);
  }

  // Fetch eligible (unseen) questions — per section for balanced mix
  const fetchLimit = seenIds.size > 0 ? count * 5 : count * 2;
  const { data: eligible, error: eligibleErr } = await supabase
    .from('app_questions')
    .select('id, section')
    .eq('level', level)
    .eq('is_active', true)
    .in('section', sections)
    .limit(fetchLimit);

  if (eligibleErr) {
    console.error('[StreamSession] eligible query error', eligibleErr);
    Sentry.captureException(eligibleErr, { tags: { context: 'stream_session' } });
    throw eligibleErr;
  }

  const unseen = ((eligible ?? []) as { id: string; section: string }[])
    .filter((q) => !seenIds.has(q.id));

  // Split by section and shuffle each pool
  const horenPool = shuffleIds(unseen.filter((q) => q.section === 'Hören').map((q) => q.id));
  const lesenPool = shuffleIds(unseen.filter((q) => q.section === 'Lesen').map((q) => q.id));

  // Target: half from each section, fill remainder from the other if short
  const half = Math.floor(count / 2);
  const horenTake = Math.min(horenPool.length, half);
  const lesenTake = Math.min(lesenPool.length, half);
  let selected = [
    ...horenPool.slice(0, horenTake),
    ...lesenPool.slice(0, lesenTake),
  ];
  // Fill shortfall from the other section
  const remaining = count - selected.length;
  if (remaining > 0) {
    const horenExtra = horenPool.slice(horenTake, horenTake + remaining);
    const lesenExtra = lesenPool.slice(lesenTake, lesenTake + remaining);
    selected = [...selected, ...horenExtra, ...lesenExtra];
    selected = selected.slice(0, count);
  }

  // Final shuffle so Hören and Lesen appear in random order
  selected = shuffleIds(selected);

  if (selected.length >= count) {
    console.log('[StreamSession] balanced pool:', horenTake, 'Hören +', lesenTake, 'Lesen');
    return { questionIds: selected.slice(0, count), isRecycled: false };
  }

  // Not enough unseen — recycle from full pool with same balanced approach
  console.log('[StreamSession] pool exhausted, recycling. Found', selected.length, 'unseen');
  const { data: allQuestions, error: allErr } = await supabase
    .from('app_questions')
    .select('id, section')
    .eq('level', level)
    .eq('is_active', true)
    .in('section', sections)
    .limit(count * 3);

  if (allErr) {
    console.error('[StreamSession] recycle query error', allErr);
    Sentry.captureException(allErr, { tags: { context: 'stream_session' } });
    throw allErr;
  }

  const allRows = (allQuestions ?? []) as { id: string; section: string }[];
  const horenAll = shuffleIds(allRows.filter((q) => q.section === 'Hören').map((q) => q.id));
  const lesenAll = shuffleIds(allRows.filter((q) => q.section === 'Lesen').map((q) => q.id));
  const hTake = Math.min(horenAll.length, half);
  const lTake = Math.min(lesenAll.length, half);
  let recycled = [...horenAll.slice(0, hTake), ...lesenAll.slice(0, lTake)];
  const rRemaining = count - recycled.length;
  if (rRemaining > 0) {
    recycled = [...recycled, ...horenAll.slice(hTake, hTake + rRemaining), ...lesenAll.slice(lTake, lTake + rRemaining)];
    recycled = recycled.slice(0, count);
  }
  recycled = shuffleIds(recycled);

  return { questionIds: recycled.slice(0, count), isRecycled: true };
}

// ─── 3. advanceSession ───────────────────────────────────────────────────────

export async function advanceSession(
  sessionId: string,
  newIndex: number,
  totalCount: number,
): Promise<void> {
  const isComplete = newIndex >= totalCount;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('stream_sessions') as any)
    .update({
      current_index: newIndex,
      completed_count: newIndex,
      is_complete: isComplete,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) {
    console.error('[StreamSession] advance error', error);
    Sentry.captureException(error, { tags: { context: 'stream_session' } });
  }
}

// ─── 4. saveStreamAnswer ─────────────────────────────────────────────────────

export async function saveStreamAnswer(params: {
  sessionId: string;
  userId: string;
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
  timeTakenSeconds?: number;
}): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('user_answers') as any).insert({
    session_id: params.sessionId,
    user_id: params.userId,
    question_id: params.questionId,
    selected_answer: params.selectedAnswer,
    is_correct: params.isCorrect,
    time_taken_seconds: params.timeTakenSeconds ?? null,
  });

  if (error) {
    console.error('[StreamSession] saveAnswer error', error);
    Sentry.captureException(error, { tags: { context: 'stream_session' } });
  }
}

// ─── 5. fetchQuestionById ────────────────────────────────────────────────────

export async function fetchQuestionById(
  questionId: string,
): Promise<AppQuestion | null> {
  const { data, error } = await supabase
    .from('app_questions')
    .select('*')
    .eq('id', questionId)
    .maybeSingle();

  if (error) {
    console.error('[StreamSession] fetchQuestion error', error);
    Sentry.captureException(error, { tags: { context: 'stream_session' } });
    return null;
  }

  return (data as AppQuestion) ?? null;
}

// ─── 6. fetchQuestionsByIds (batch) ──────────────────────────────────────────

export async function fetchQuestionsByIds(
  questionIds: string[],
): Promise<AppQuestion[]> {
  if (questionIds.length === 0) return [];

  const { data, error } = await supabase
    .from('app_questions')
    .select('*')
    .in('id', questionIds);

  if (error) {
    console.error('[StreamSession] fetchQuestionsByIds error', error);
    Sentry.captureException(error, { tags: { context: 'stream_session' } });
    return [];
  }

  // Reorder to match the input order
  const map = new Map<string, AppQuestion>();
  for (const q of (data ?? []) as AppQuestion[]) {
    map.set(q.id, q);
  }
  return questionIds.map((id) => map.get(id)).filter(Boolean) as AppQuestion[];
}

// ─── Helper: Fisher-Yates shuffle ───────────────────────────────────────────

function shuffleIds(ids: string[]): string[] {
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
