import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export type BadgeLadderEntry = {
  rank: number;
  name: string;
  translation: string;
  cumulative_day: number;
  interval_days: number;
  q_per_day: number;
};

export function useBadgeLadder() {
  return useQuery({
    queryKey: ['badge_ladder'],
    queryFn: async (): Promise<BadgeLadderEntry[]> => {
      const { data, error } = await supabase.rpc('get_badge_ladder' as never);
      if (error) throw error;
      return (data ?? []) as BadgeLadderEntry[];
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 h — ladder rarely changes
  });
}

/**
 * Returns the highest badge the user has earned for their current streak.
 * Returns null if streakDays < 1 (no badge yet).
 */
export function getBadgeByStreak(
  streakDays: number,
  ladder: BadgeLadderEntry[],
): BadgeLadderEntry | null {
  if (streakDays < 1 || ladder.length === 0) return null;
  return (
    [...ladder].reverse().find((b) => streakDays >= b.cumulative_day) ?? null
  );
}
