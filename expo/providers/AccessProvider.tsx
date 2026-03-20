import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/providers/AuthProvider';
import type { UserAccess } from '@/types/access';

const DEFAULT_ACCESS: UserAccess = {
  tier: 'free',
  stream_questions_per_day: 3,
  stream_questions_remaining: 3,
  schreiben_visible: true,
  schreiben_enabled: false,
  sprechen_visible: true,
  sprechen_enabled: false,
  sectional_tests_enabled: false,
  mock_tests_enabled: false,
  trial_expires_at: null,
  trial_hours_remaining: null,
};

export const [AccessProvider, useAccess] = createContextHook(() => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  const [streamQuestionsRemaining, setStreamQuestionsRemaining] = useState<number | null>(null);

  const accessQuery = useQuery({
    queryKey: ['user-access', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<UserAccess> => {
      if (!userId) return DEFAULT_ACCESS;

      console.log('AccessProvider fetching access for', userId);
      const { data, error } = await supabase.rpc('get_user_access' as never, {
        p_user_id: userId,
      } as never);

      if (error) {
        console.log('AccessProvider RPC error', error);
        return DEFAULT_ACCESS;
      }

      if (!data) {
        console.log('AccessProvider no data returned');
        return DEFAULT_ACCESS;
      }

      const raw = data as Record<string, unknown>;
      const row = Array.isArray(raw) ? (raw[0] as Record<string, unknown> | undefined) : raw;
      if (!row) return DEFAULT_ACCESS;

      const access: UserAccess = {
        tier: (row.tier as string) ?? 'free',
        stream_questions_per_day: (row.stream_questions_per_day as number | null) ?? null,
        stream_questions_remaining: (row.stream_questions_remaining as number | null) ?? null,
        schreiben_visible: (row.schreiben_visible as boolean) ?? true,
        schreiben_enabled: (row.schreiben_enabled as boolean) ?? false,
        sprechen_visible: (row.sprechen_visible as boolean) ?? true,
        sprechen_enabled: (row.sprechen_enabled as boolean) ?? false,
        sectional_tests_enabled: (row.sectional_tests_enabled as boolean) ?? false,
        mock_tests_enabled: (row.mock_tests_enabled as boolean) ?? false,
        trial_expires_at: (row.trial_expires_at as string | null) ?? null,
        trial_hours_remaining: (row.trial_hours_remaining as number | null) ?? null,
      };

      console.log('AccessProvider access loaded', access.tier, 'remaining:', access.stream_questions_remaining);
      return access;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (accessQuery.data?.stream_questions_remaining != null) {
      setStreamQuestionsRemaining(accessQuery.data.stream_questions_remaining);
    }
  }, [accessQuery.data?.stream_questions_remaining]);

  useEffect(() => {
    if (!userId) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        console.log('AccessProvider app foregrounded, refreshing access');
        void queryClient.invalidateQueries({ queryKey: ['user-access', userId] });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [userId, queryClient]);

  const refreshAccess = useCallback(async () => {
    if (!userId) return;
    console.log('AccessProvider manual refresh');
    await queryClient.invalidateQueries({ queryKey: ['user-access', userId] });
  }, [userId, queryClient]);

  const decrementStreamRemaining = useCallback(() => {
    setStreamQuestionsRemaining((prev) => {
      if (prev === null) return null;
      return Math.max(0, prev - 1);
    });
  }, []);

  const incrementDailyStreamCount = useCallback(async () => {
    if (!userId) return;
    try {
      await supabase
        .from('user_profiles')
        .update({
          daily_stream_count: (streamQuestionsRemaining !== null
            ? (accessQuery.data?.stream_questions_per_day ?? 3) - streamQuestionsRemaining + 1
            : 1),
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', userId);
    } catch (err) {
      console.log('AccessProvider incrementDailyStreamCount error', err);
    }
  }, [userId, streamQuestionsRemaining, accessQuery.data?.stream_questions_per_day]);

  const access = useMemo<UserAccess>(() => {
    const base = accessQuery.data ?? DEFAULT_ACCESS;
    return {
      ...base,
      stream_questions_remaining: streamQuestionsRemaining ?? base.stream_questions_remaining,
    };
  }, [accessQuery.data, streamQuestionsRemaining]);

  const isStreamLimited = useMemo(() => {
    return (
      access.stream_questions_per_day !== null &&
      (access.stream_questions_remaining ?? 0) <= 0
    );
  }, [access.stream_questions_per_day, access.stream_questions_remaining]);

  return useMemo(
    () => ({
      access,
      isLoading: accessQuery.isLoading,
      isStreamLimited,
      refreshAccess,
      decrementStreamRemaining,
      incrementDailyStreamCount,
    }),
    [access, accessQuery.isLoading, isStreamLimited, refreshAccess, decrementStreamRemaining, incrementDailyStreamCount]
  );
});
