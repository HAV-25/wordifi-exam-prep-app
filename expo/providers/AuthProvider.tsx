import createContextHook from '@nkzw/create-context-hook';
import type { Session, User } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Sentry from '@sentry/react-native';

import { signOutUser } from '@/lib/authHelpers';
import { ensureUserProfile, loadAndClearPendingOnboarding, saveOnboardingAnswers } from '@/lib/profileHelpers';
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

  // Safety net: apply any AsyncStorage-persisted onboarding data that wasn't saved to DB yet
  // (handles the case where email confirmation link opens a fresh app instance)
  useEffect(() => {
    const uid = session?.user?.id;
    const profile = profileQuery.data;
    if (!uid || !profile || profile.onboarding_completed_at) return;

    void loadAndClearPendingOnboarding().then(async (pending) => {
      if (!pending) return;
      await saveOnboardingAnswers(uid, pending).catch(() => {});
      await profileQuery.refetch();
    });
  }, [session?.user?.id, profileQuery.data?.onboarding_completed_at]);

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
