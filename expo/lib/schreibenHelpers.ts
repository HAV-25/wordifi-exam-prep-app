import { supabase } from '@/lib/supabaseClient';
import * as Sentry from '@sentry/react-native';
import type { AppQuestion } from '@/types/database';
import type { AssessmentResult } from '@/types/schreiben';

export const countWords = (text: string): number => {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
};

export const assessSchreiben = async (
  question: AppQuestion,
  userText: string,
  wordCount: number,
  taskType: string,
  sessionId: string | null
): Promise<AssessmentResult> => {
  console.log('schreibenHelpers assessSchreiben', { questionId: question.id, taskType, wordCount });

  // Client-side cache check — skip Edge Function if already assessed
  try {
    const { data: cached } = await supabase
      .from('schreiben_submissions')
      .select('assessment_json, score, passed')
      .eq('question_id', question.id)
      .maybeSingle();

    if (cached?.assessment_json) {
      console.log('schreibenHelpers assessSchreiben: returning cached result, score:', cached.score);
      return cached.assessment_json as AssessmentResult;
    }
  } catch (cacheErr) {
    console.log('schreibenHelpers assessSchreiben: cache check failed, proceeding to edge function', cacheErr);
    Sentry.captureException(cacheErr, { tags: { context: 'schreiben' } });
  }

  const requiredPoints = taskType === 'form_fill'
    ? []
    : (question.options as Array<{ key?: string; text?: string }>).map((o) => o.text ?? '');

  console.log('schreibenHelpers assessSchreiben invoking edge function...');

  const SUPABASE_URL = 'https://wwfiauhsbssjowaxmqyn.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3ZmlhdWhzYnNzam93YXhtcXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MTQxMzUsImV4cCI6MjA4Njk5MDEzNX0.lSPPEQCtdigdXpwB2X5hUTrC2dThil6qleQtqcUEKAE';

  let { data: sessionData } = await supabase.auth.getSession();
  let accessToken = sessionData?.session?.access_token ?? '';

  if (!accessToken) {
    console.log('schreibenHelpers assessSchreiben: no access token, attempting refresh...');
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session) {
      console.log('schreibenHelpers assessSchreiben: session refresh failed', refreshError);
      Sentry.captureException(refreshError ?? new Error('Session expired — please sign in again'), { tags: { context: 'schreiben' } });
      throw new Error('Session expired — please sign in again');
    }
    accessToken = refreshed.session.access_token;
    console.log('schreibenHelpers assessSchreiben: session refreshed successfully');
  } else {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshed.session) {
      accessToken = refreshed.session.access_token;
      console.log('schreibenHelpers assessSchreiben: proactively refreshed session token');
    } else {
      console.log('schreibenHelpers assessSchreiben: proactive refresh failed, using existing token');
    }
  }

  console.log('schreibenHelpers assessSchreiben hasAccessToken:', !!accessToken);

  const requestBody = {
    question_id: question.id,
    session_id: sessionId,
    user_text: userText,
    word_count: wordCount,
    level: question.level,
    task_type: taskType,
    required_points: requiredPoints,
    options: taskType === 'form_fill' ? question.options : undefined,
  };

  console.log('schreibenHelpers assessSchreiben request body', JSON.stringify(requestBody).slice(0, 300));

  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/assess-schreiben`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(requestBody),
    });
  } catch (fetchErr) {
    console.log('schreibenHelpers assessSchreiben fetch network error', String(fetchErr));
    Sentry.captureException(fetchErr, { tags: { context: 'schreiben' } });
    throw new Error('Network error calling assess-schreiben');
  }

  console.log('schreibenHelpers assessSchreiben response status', response.status);

  const responseText = await response.text();
  console.log('schreibenHelpers assessSchreiben response body', responseText.slice(0, 500));

  if (!response.ok) {
    const err = new Error(`Edge function returned ${response.status}: ${responseText.slice(0, 200)}`);
    Sentry.captureException(err, { tags: { context: 'schreiben' } });
    throw err;
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(responseText);
  } catch {
    console.log('schreibenHelpers assessSchreiben: failed to parse JSON');
    const parseErr = new Error('Invalid JSON from edge function');
    Sentry.captureException(parseErr, { tags: { context: 'schreiben' } });
    throw parseErr;
  }

  console.log('schreibenHelpers assessSchreiben parsed keys:', Object.keys(data));

  const assessment: AssessmentResult | undefined = (data.assessment as AssessmentResult | undefined) ?? (data.overall_score !== undefined ? (data as unknown as AssessmentResult) : undefined);

  if (!assessment) {
    console.log('schreibenHelpers assessSchreiben: could not find assessment. Full data:', JSON.stringify(data).slice(0, 500));
    const noAssessmentErr = new Error('Assessment not found in response');
    Sentry.captureException(noAssessmentErr, { tags: { context: 'schreiben' } });
    throw noAssessmentErr;
  }

  console.log('schreibenHelpers assessSchreiben result score:', assessment.overall_score);
  return assessment;
};

export async function fetchSchreibenTeile(level: string): Promise<Array<{ teil: number; q_count: number; source_structure_type: string }>> {
  console.log('schreibenHelpers fetchSchreibenTeile', level);

  const { data, error } = await supabase
    .from('app_questions')
    .select('teil, source_structure_type')
    .eq('level', level)
    .eq('section', 'Schreiben')
    .eq('is_active', true);

  if (error) {
    console.log('fetchSchreibenTeile error', error);
    Sentry.captureException(error, { tags: { context: 'schreiben' } });
    throw error;
  }

  if (!data || data.length === 0) return [];

  const grouped = new Map<number, { count: number; source_structure_type: string }>();
  for (const row of data as Array<{ teil: number; source_structure_type: string }>) {
    const existing = grouped.get(row.teil);
    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(row.teil, { count: 1, source_structure_type: row.source_structure_type });
    }
  }

  const result: Array<{ teil: number; q_count: number; source_structure_type: string }> = [];
  for (const [teil, entry] of grouped.entries()) {
    result.push({ teil, q_count: entry.count, source_structure_type: entry.source_structure_type });
  }

  result.sort((a, b) => a.teil - b.teil);
  return result;
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

export async function fetchSchreibenQuestions(
  level: string,
  teil: number,
  limit: number = 1
): Promise<AppQuestion[]> {
  console.log('schreibenHelpers fetchSchreibenQuestions', { level, teil, limit });

  const { data, error } = await supabase
    .from('app_questions')
    .select('id, question_text, task_subtype, source_structure_type, options, correct_answer, level, section, teil, rubric_card, model_answer_script, explanation_en, explanation_de, stimulus_text, is_active')
    .eq('level', level)
    .eq('section', 'Schreiben')
    .eq('teil', teil)
    .eq('is_active', true);

  if (error) {
    console.log('fetchSchreibenQuestions error', error);
    Sentry.captureException(error, { tags: { context: 'schreiben' } });
    throw error;
  }

  const all = (data ?? []) as AppQuestion[];
  const shuffled = shuffleArray(all);
  return shuffled.slice(0, limit);
}

export async function fetchExistingSubmission(
  userId: string,
  questionId: string
): Promise<AssessmentResult | null> {
  console.log('schreibenHelpers fetchExistingSubmission', { userId, questionId });

  const { data, error } = await supabase
    .from('schreiben_submissions')
    .select('assessment_json, score, passed')
    .eq('user_id', userId)
    .eq('question_id', questionId)
    .maybeSingle();

  if (error) {
    console.log('fetchExistingSubmission error', error);
    Sentry.captureException(error, { tags: { context: 'schreiben' } });
    return null;
  }

  if (!data) return null;

  const row = data as Record<string, unknown>;
  if (row.assessment_json) {
    try {
      const parsed = typeof row.assessment_json === 'string'
        ? JSON.parse(row.assessment_json)
        : row.assessment_json;
      return parsed as AssessmentResult;
    } catch {
      console.log('fetchExistingSubmission: failed to parse assessment_json');
      Sentry.captureException(new Error('Failed to parse assessment_json in fetchExistingSubmission'), { tags: { context: 'schreiben' } });
    }
  }

  return null;
}
