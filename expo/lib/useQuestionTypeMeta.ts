import createContextHook from '@nkzw/create-context-hook';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { supabase } from './supabaseClient';

export type QuestionTypeMeta = {
  structure_type: string;
  section: string;
  question_category: string;
  name_en: string;
  name_de: string;
  tooltip_en: string;
  tooltip_de: string;
  is_hybrid: boolean;
  applicable_levels: string[];
  display_order: number;
};

export type QuestionTypeMetaMap = Record<string, QuestionTypeMeta>;

export async function fetchQuestionTypeMeta(): Promise<QuestionTypeMetaMap> {
  const { data, error } = await supabase
    .from('question_type_meta')
    .select('*');
  if (error) throw error;
  return Object.fromEntries(
    (data ?? []).map((row: QuestionTypeMeta) => [row.structure_type, row])
  );
}

function toTitleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function makeFallback(structure_type: string): QuestionTypeMeta {
  return {
    structure_type,
    section: '',
    question_category: 'mcq',
    name_en: toTitleCase(structure_type),
    name_de: '',
    tooltip_en: 'Read or listen carefully, then answer the question.',
    tooltip_de: 'Lesen oder hören Sie sorgfältig und beantworten Sie dann die Frage.',
    is_hybrid: false,
    applicable_levels: [],
    display_order: 999,
  };
}

export const [QuestionTypeMetaProvider, useQuestionTypeMetaContext] = createContextHook(() => {
  const query = useQuery<QuestionTypeMetaMap>({
    queryKey: ['question-type-meta'],
    staleTime: Infinity,
    queryFn: fetchQuestionTypeMeta,
  });

  return useMemo(
    () => ({
      metaMap: query.data ?? {},
      isMetaLoading: query.isLoading,
    }),
    [query.data, query.isLoading]
  );
});

export function useQuestionMeta(structure_type?: string): QuestionTypeMeta | undefined {
  const { metaMap } = useQuestionTypeMetaContext();
  if (!structure_type) return undefined;
  return metaMap[structure_type] ?? makeFallback(structure_type);
}
