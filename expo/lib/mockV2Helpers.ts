/**
 * Mock V2 helpers — save/resume + Set 1/Set 2 scoring.
 */
import { supabase } from '@/lib/supabaseClient';
import type { ExamSectionKey } from '@/lib/examBlueprint';

export type SavedSectionResult = {
  section: ExamSectionKey;
  scorePct: number;
  questionsCorrect?: number;
  questionsTotal?: number;
  timeTakenSeconds: number;
};

export type MockV2SavedState = {
  level: string;
  phaseSectionIndex: number;
  results: SavedSectionResult[];
  startedAt: string;
};

/** Create a new mock_tests row for V2 flow and return its id. */
export async function createMockV2Session(userId: string, level: string, examType: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('mock_tests') as any)
    .insert({
      user_id: userId,
      level,
      exam_type: examType,
      v2_flow: true,
      current_phase: 'horen',
      saved_state: {},
      saved_at: new Date().toISOString(),
      is_abandoned: false,
    })
    .select('id')
    .single();
  if (error) {
    console.log('[MockV2] createSession error', error);
    throw error;
  }
  return (data as { id: string }).id;
}

/** Save current progress. */
export async function saveMockV2State(mockTestId: string, state: MockV2SavedState, currentPhase: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('mock_tests') as any)
    .update({
      current_phase: currentPhase,
      saved_state: state,
      saved_at: new Date().toISOString(),
    })
    .eq('id', mockTestId);
  if (error) console.log('[MockV2] saveState error', error);
}

/** Fetch latest resumable mock session (within 24 hours). */
export async function fetchResumableMockV2(userId: string): Promise<{
  id: string;
  level: string;
  savedState: MockV2SavedState;
  currentPhase: string;
  savedAt: string;
} | null> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('mock_tests') as any)
    .select('id, level, saved_state, current_phase, saved_at')
    .eq('user_id', userId)
    .eq('v2_flow', true)
    .eq('is_abandoned', false)
    .is('completed_at', null)
    .gte('saved_at', cutoff)
    .order('saved_at', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  const row = data[0] as { id: string; level: string; saved_state: MockV2SavedState; current_phase: string; saved_at: string };
  return {
    id: row.id,
    level: row.level,
    savedState: row.saved_state,
    currentPhase: row.current_phase,
    savedAt: row.saved_at,
  };
}

/** Mark session abandoned (user tapped "Start fresh"). */
export async function abandonMockV2(mockTestId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('mock_tests') as any)
    .update({ is_abandoned: true })
    .eq('id', mockTestId);
}

/** Compute Set 1 and Set 2 scores from section results. */
export function computeSetScores(results: SavedSectionResult[]): {
  set1Pct: number;
  set2Pct: number;
  overallPct: number;
  set1Pass: boolean;
  set2Pass: boolean;
  overallPass: boolean;
} {
  const ORAL_SECTIONS: ExamSectionKey[] = ['Sprechen'];
  const set1Results = results.filter((r) => !ORAL_SECTIONS.includes(r.section));
  const set2Results = results.filter((r) => ORAL_SECTIONS.includes(r.section));

  const avg = (arr: SavedSectionResult[]) =>
    arr.length === 0 ? 0 : Math.round(arr.reduce((s, r) => s + r.scorePct, 0) / arr.length);

  const set1Pct = avg(set1Results);
  const set2Pct = avg(set2Results);
  const overallPct = results.length === 0 ? 0 : Math.round(((set1Pct + set2Pct) / 2));

  const set1Pass = set1Pct >= 60;
  const set2Pass = set2Pct >= 60;
  const overallPass = set1Pass && set2Pass;

  return { set1Pct, set2Pct, overallPct, set1Pass, set2Pass, overallPass };
}

/** Finalize mock session with overall scores. */
export async function completeMockV2(
  mockTestId: string,
  results: SavedSectionResult[]
): Promise<{
  overallPct: number;
  set1Pct: number;
  set2Pct: number;
  overallPass: boolean;
}> {
  const scores = computeSetScores(results);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('mock_tests') as any)
    .update({
      completed_at: new Date().toISOString(),
      overall_score_pct: scores.overallPct,
      set1_score_pct: scores.set1Pct,
      set2_score_pct: scores.set2Pct,
      saved_state: { results },
    })
    .eq('id', mockTestId);

  if (error) console.log('[MockV2] completeMockV2 error', error);
  return scores;
}
