import createContextHook from '@nkzw/create-context-hook';
import type { Session, User } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Sentry from '@sentry/react-native';

import { signOutUser } from '@/lib/authHelpers';
import { ensureUserProfile, reconcilePendingOnboarding } from '@/lib/profileHelpers';
import { supabase } from '@/lib/supabaseClient';
import type { UserProfile } from '@/types/database';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      console.log('AuthProvider getSession', Boolean(data.session));
      if (!isMounted) {
        return;
      }
      setSession(data.session);
      setIsSessionLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      console.log('AuthProvider auth state changed', event, Boolean(nextSession));
      setSession(nextSession);
      setIsSessionLoading(false);

      if (nextSession?.user) {
        Sentry.setUser({
          id: nextSession.user.id,
          email: nextSession.user.email,
        });
      } else {
        Sentry.setUser(null);
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const user = useMemo<User | null>(() => session?.user ?? null, [session]);

  const profileQuery = useQuery({
    queryKey: ['user-profile', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<UserProfile | null> => {
      if (!user) {
        return null;
      }
      return ensureUserProfile(user);
    },
  });

  // Reconcile pending onboarding answers once an authenticated session exists.
  // Handles email confirmation handoff, app restarts, and retries after failed writes.
  const reconcilingRef = useRef(false);
  useEffect(() => {
    const uid = session?.user?.id;
    const profile = profileQuery.data;
    if (!uid || !profile || reconcilingRef.current) return;

    reconcilingRef.current = true;
    void reconcilePendingOnboarding(uid, profile)
      .then((applied) => {
        if (applied) void profileQuery.refetch();
      })
      .catch((err) => {
        Sentry.captureException(err, { tags: { context: 'onboarding_reconcile' } });
      })
      .finally(() => {
        reconcilingRef.current = false;
      });
  }, [session?.user?.id, profileQuery.data]);

  const signOutMutation = useMutation({
    mutationFn: async () => signOutUser(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    },
  });

  const refreshProfile = useCallback(async () => {
    await profileQuery.refetch();
  }, [profileQuery]);

  return useMemo(
    () => ({
      session,
      user,
      profile: profileQuery.data ?? null,
      isLoading: isSessionLoading || profileQuery.isLoading,
      hasCompletedOnboarding: Boolean(profileQuery.data?.onboarding_completed_at ?? profileQuery.data?.target_level),
      refreshProfile,
      signOut: signOutMutation.mutateAsync,
      isSigningOut: signOutMutation.isPending,
    }),
    [
      session,
      user,
      profileQuery.data,
      profileQuery.isLoading,
      isSessionLoading,
      refreshProfile,
      signOutMutation.mutateAsync,
      signOutMutation.isPending,
    ]
  );
});
