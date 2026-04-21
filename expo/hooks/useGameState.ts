import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type GameState = {
  streak: {
    current_days: number;
    longest_days: number;
    started_at: string | null;
  };
  today: {
    questions_counted: number;
    requirement: number;
    requirement_met: boolean;
    questions_remaining: number;
  };
  badge: {
    current_rank: number;
    highest_rank: number;
  };
  readiness: {
    current_score: number;
  };
};

export function useGameState(activeLevel: string, userId?: string) {
  return useQuery({
    queryKey: ['game_state', activeLevel, userId],
    enabled: Boolean(userId && activeLevel),
    queryFn: async (): Promise<GameState> => {
      const { data, error } = await supabase.rpc(
        'get_my_gamification_state' as never,
        { p_active_level: activeLevel } as never,
      );
      if (error) throw error;
      return data as GameState;
    },
    staleTime: 30_000, // 30 s — refreshed after each answer submission
  });
}

/**
 * Returns a callback that invalidates the game_state query for a level.
 * Call this after every answer submission (stream / sectional / mock).
 */
export function useInvalidateGameState() {
  const queryClient = useQueryClient();
  return useCallback(
    (activeLevel: string, userId?: string) => {
      void queryClient.invalidateQueries({
        queryKey: ['game_state', activeLevel, userId],
      });
    },
    [queryClient],
  );
}
