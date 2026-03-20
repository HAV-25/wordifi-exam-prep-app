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

  const { data, error } = await supabase.functions.invoke('assess-schreiben', {
    body: {
      question_id: question.id,
      session_id: sessionId,
      user_text: userText,
      word_count: wordCount,
      level: question.level,
      task_type: taskType,
      required_points: requiredPoints,
      options: taskType === 'form_fill' ? question.options : undefined,
    },
  });

  if (error) {
    console.log('schreibenHelpers assessSchreiben error', error);
    throw error;
  }

  console.log('schreibenHelpers assessSchreiben result', data?.assessment?.overall_score);
  return data.assessment as AssessmentResult;
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
