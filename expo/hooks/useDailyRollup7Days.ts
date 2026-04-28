import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import type { DailyRollupRow } from '@/types/gamification';

/** Returns an ISO date string (YYYY-MM-DD) offset by `daysAgo` from today. */
function isoDateOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

/**
 * Fetches the last 7 calendar days of daily_activity_rollup rows for a user.
 * Returns all rows (may be multiple per date if multiple CEFR levels).
 * Returns an empty array while loading or on error.
 */
export function useDailyRollup7Days(userId: string) {
  return useQuery({
    queryKey: ['daily-rollup-7days', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<DailyRollupRow[]> => {
      const since = isoDateOffset(6); // today − 6 days = 7-day window
      const { data, error } = await supabase
        .from('daily_activity_rollup')
        .select(
          'activity_date, cefr_level, stream_questions_answered, stream_questions_correct, ' +
          'sectional_questions_attempted, sectional_questions_correct, ' +
          'mock_questions_attempted, mock_questions_correct, ' +
          'sprechen_readiness_contrib, schreiben_readiness_contrib, ' +
          'total_questions_counted_for_streak, streak_requirement_met'
        )
        .eq('user_id', userId)
        .gte('activity_date', since)
        .order('activity_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as DailyRollupRow[];
    },
    staleTime: 30_000,
  });
}
