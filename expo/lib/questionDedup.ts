/**
 * Question dedup — fetch question IDs the user has answered within the last 30 days.
 *
 * Used across Sectional and Mock V2 to prefer fresh questions and only recycle
 * oldest-seen when the unseen pool is exhausted.
 *
 * Stream already has its own dedup logic (streamHelpers.ts). This helper mirrors
 * the same 30-day window for parity.
 */
import { supabase } from '@/lib/supabaseClient';

export type RecentlyAnswered = {
  /** Set of question IDs answered within 30 days — fast `has()` lookup. */
  seen: Set<string>;
  /** Map of questionId → answered_at ISO — used for oldest-first fallback sort. */
  seenAt: Map<string, string>;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Fetch all `user_answers` rows for the user within the 30-day window and
 * return dedup structures. Returns empty structures on error or empty user.
 */
export async function fetchRecentlyAnsweredIds(userId: string): Promise<RecentlyAnswered> {
  const empty: RecentlyAnswered = { seen: new Set(), seenAt: new Map() };
  if (!userId) return empty;

  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('user_answers') as any)
      .select('question_id, created_at')
      .eq('user_id', userId)
      .gte('created_at', cutoff);

    if (error) {
      console.log('[questionDedup] fetch error', error);
      return empty;
    }

    const rows = (data ?? []) as Array<{ question_id: string; created_at: string }>;
    const seen = new Set<string>();
    const seenAt = new Map<string, string>();
    for (const r of rows) {
      if (!r.question_id) continue;
      seen.add(r.question_id);
      // Keep the LATEST answered_at per question (if answered multiple times)
      const prev = seenAt.get(r.question_id);
      if (!prev || r.created_at > prev) {
        seenAt.set(r.question_id, r.created_at);
      }
    }
    return { seen, seenAt };
  } catch (err) {
    console.log('[questionDedup] exception', err);
    return empty;
  }
}

/**
 * Partition a list of questions into [unseen, seen-sorted-oldest-first].
 * Concatenating them gives a prioritized pool: prefer unseen, fall back to
 * oldest-seen.
 */
export function partitionByDedup<T extends { id: string }>(
  questions: T[],
  dedup: RecentlyAnswered
): { unseen: T[]; seenOldestFirst: T[] } {
  const unseen: T[] = [];
  const seenList: T[] = [];
  for (const q of questions) {
    if (dedup.seen.has(q.id)) seenList.push(q);
    else unseen.push(q);
  }
  // Oldest answered first — earlier created_at comes first
  seenList.sort((a, b) => {
    const aAt = dedup.seenAt.get(a.id) ?? '';
    const bAt = dedup.seenAt.get(b.id) ?? '';
    return aAt.localeCompare(bAt);
  });
  return { unseen, seenOldestFirst: seenList };
}
