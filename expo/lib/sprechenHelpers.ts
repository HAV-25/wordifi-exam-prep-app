import { supabase } from '@/lib/supabaseClient';
import type { AppQuestion } from '@/types/database';

export type SprechenResponse = {
  id: string;
  recording_url: string;
  recording_duration_sec: number;
  self_rating: number | null;
  submitted_at: string | null;
};

export type SprechenTeilInfo = {
  teil: number;
  source_structure_type: string;
  q_count: number;
};

export const SPRECHEN_STRUCTURE_LABELS: Record<string, string> = {
  sprechen_a1_t1_monologue: 'Sich vorstellen',
  sprechen_a2_t1_qa: 'Fragen zur Person',
  sprechen_a2_t2_monologue: 'Von sich erzählen',
  sprechen_a2_t3_planning: 'Gemeinsam planen',
  sprechen_b1_t1_planning: 'Gemeinsam planen',
  sprechen_b1_t2_presentation: 'Thema präsentieren',
  sprechen_b1_t3_discussion: 'Reagieren und diskutieren',
};

export function isDialogueTask(structureType: string): boolean {
  return (
    structureType.includes('_qa') ||
    structureType.includes('_planning') ||
    structureType.includes('_discussion')
  );
}

export function isPresentationTask(structureType: string): boolean {
  return structureType.includes('_presentation');
}

export async function fetchSprechenTeile(level: string): Promise<SprechenTeilInfo[]> {
  console.log('sprechenHelpers fetchSprechenTeile', level);

  const { data, error } = await supabase
    .from('app_questions')
    .select('teil, source_structure_type')
    .eq('level', level)
    .eq('section', 'Sprechen')
    .eq('is_active', true);

  if (error) {
    console.log('fetchSprechenTeile error', error);
    throw error;
  }

  if (!data || data.length === 0) return [];

  const grouped = new Map<number, { teil: number; source_structure_type: string; count: number }>();
  for (const row of data as Array<{ teil: number; source_structure_type: string }>) {
    const existing = grouped.get(row.teil);
    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(row.teil, {
        teil: row.teil,
        source_structure_type: row.source_structure_type,
        count: 1,
      });
    }
  }

  const result: SprechenTeilInfo[] = [];
  for (const entry of grouped.values()) {
    result.push({
      teil: entry.teil,
      source_structure_type: entry.source_structure_type,
      q_count: entry.count,
    });
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

export async function fetchSprechenQuestions(
  level: string,
  teil: number,
  limit: number = 10
): Promise<AppQuestion[]> {
  console.log('sprechenHelpers fetchSprechenQuestions', { level, teil, limit });

  const { data, error } = await supabase
    .from('app_questions')
    .select('*')
    .eq('section', 'Sprechen')
    .eq('level', level)
    .eq('teil', teil)
    .eq('is_active', true);

  if (error) {
    console.log('fetchSprechenQuestions error', error);
    throw error;
  }

  const all = (data ?? []) as AppQuestion[];
  const shuffled = shuffleArray(all);
  return shuffled.slice(0, limit);
}

export async function fetchSprechenResponse(
  userId: string,
  questionId: string
): Promise<SprechenResponse | null> {
  console.log('sprechenHelpers fetchSprechenResponse', { userId, questionId });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('sprechen_responses') as any)
    .select('id, recording_url, recording_duration_sec, self_rating, submitted_at')
    .eq('user_id', userId)
    .eq('question_id', questionId)
    .maybeSingle();

  if (error) {
    console.log('fetchSprechenResponse error', error);
    return null;
  }

  if (!data) return null;
  return data as SprechenResponse;
}

export async function saveSprechenResponse(params: {
  userId: string;
  questionId: string;
  sessionId: string | null;
  recordingUrl: string;
  recordingDurationSec: number;
}): Promise<boolean> {
  console.log('sprechenHelpers saveSprechenResponse', { questionId: params.questionId });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('sprechen_responses') as any)
    .upsert(
      {
        user_id: params.userId,
        question_id: params.questionId,
        session_id: params.sessionId,
        recording_url: params.recordingUrl,
        recording_duration_sec: params.recordingDurationSec,
      },
      { onConflict: 'user_id,question_id' }
    );

  if (error) {
    console.log('saveSprechenResponse error', error);
    return false;
  }
  return true;
}

export async function saveSelfRating(
  userId: string,
  questionId: string,
  rating: number
): Promise<boolean> {
  console.log('sprechenHelpers saveSelfRating', { questionId, rating });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('sprechen_responses') as any)
    .update({ self_rating: rating })
    .eq('user_id', userId)
    .eq('question_id', questionId);

  if (error) {
    console.log('saveSelfRating error', error);
    return false;
  }
  return true;
}

export async function uploadRecording(
  uri: string,
  userId: string,
  questionId: string
): Promise<string> {
  console.log('sprechenHelpers uploadRecording', { userId, questionId });

  const filename = `sprechen/${userId}/${questionId}_${Date.now()}.m4a`;

  const response = await fetch(uri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from('user-recordings')
    .upload(filename, blob, { contentType: 'audio/m4a', upsert: true });

  if (error) {
    console.log('uploadRecording error', error);
    throw new Error('Speicher nicht verfügbar. Bitte kontaktiere den Support.');
  }

  const { data: urlData } = supabase.storage
    .from('user-recordings')
    .getPublicUrl(filename);

  return urlData.publicUrl;
}
