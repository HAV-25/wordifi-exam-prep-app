import { supabase } from '@/lib/supabaseClient';
import type { AppQuestion } from '@/types/database';

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

