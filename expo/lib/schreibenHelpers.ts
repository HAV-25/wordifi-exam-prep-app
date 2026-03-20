import { supabase } from '@/lib/supabaseClient';
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

  const requiredPoints = taskType === 'form_fill'
    ? []
    : (question.options as Array<{ key?: string; text?: string }>).map((o) => o.text ?? '');

  console.log('schreibenHelpers assessSchreiben invoking edge function...');

  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://wwfiauhsbssjowaxmqyn.supabase.co';
  const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

  let { data: sessionData } = await supabase.auth.getSession();
  let accessToken = sessionData?.session?.access_token ?? '';

  if (!accessToken) {
    console.log('schreibenHelpers assessSchreiben: no access token, attempting refresh...');
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session) {
      console.log('schreibenHelpers assessSchreiben: session refresh failed', refreshError);
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
    throw new Error('Network error calling assess-schreiben');
  }

  console.log('schreibenHelpers assessSchreiben response status', response.status);

  const responseText = await response.text();
  console.log('schreibenHelpers assessSchreiben response body', responseText.slice(0, 500));

  if (!response.ok) {
    throw new Error(`Edge function returned ${response.status}: ${responseText.slice(0, 200)}`);
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(responseText);
  } catch {
    console.log('schreibenHelpers assessSchreiben: failed to parse JSON');
    throw new Error('Invalid JSON from edge function');
  }

  console.log('schreibenHelpers assessSchreiben parsed keys:', Object.keys(data));

  const assessment: AssessmentResult | undefined = (data.assessment as AssessmentResult | undefined) ?? (data.overall_score !== undefined ? (data as unknown as AssessmentResult) : undefined);

  if (!assessment) {
    console.log('schreibenHelpers assessSchreiben: could not find assessment. Full data:', JSON.stringify(data).slice(0, 500));
    throw new Error('Assessment not found in response');
  }

  console.log('schreibenHelpers assessSchreiben result score:', assessment.overall_score);
  return assessment;
};

export async function fetchSchreibenTeile(level: string): Promise<Array<{ teil: number; q_count: number }>> {
  console.log('schreibenHelpers fetchSchreibenTeile', level);

  const { data, error } = await supabase
    .from('app_questions')
    .select('teil')
    .eq('level', level)
    .eq('section', 'Schreiben')
    .eq('is_active', true);

  if (error) {
    console.log('fetchSchreibenTeile error', error);
    throw error;
  }

  if (!data || data.length === 0) return [];

  const grouped = new Map<number, number>();
  for (const row of data as Array<{ teil: number }>) {
    grouped.set(row.teil, (grouped.get(row.teil) ?? 0) + 1);
  }

  const result: Array<{ teil: number; q_count: number }> = [];
  for (const [teil, count] of grouped.entries()) {
    result.push({ teil, q_count: count });
  }

  result.sort((a, b) => a.teil - b.teil);
  return result;
}

export async function fetchSchreibenQuestions(
  level: string,
  teil: number
): Promise<AppQuestion[]> {
  console.log('schreibenHelpers fetchSchreibenQuestions', { level, teil });

  const { data, error } = await supabase
    .from('app_questions')
    .select('*')
    .eq('level', level)
    .eq('section', 'Schreiben')
    .eq('teil', teil)
    .eq('is_active', true)
    .order('question_number', { ascending: true });

  if (error) {
    console.log('fetchSchreibenQuestions error', error);
    throw error;
  }

  return (data ?? []) as AppQuestion[];
}
