import createContextHook from '@nkzw/create-context-hook';
import type { Session, User } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import * as Sentry from '@sentry/react-native';

import { signOutUser } from '@/lib/authHelpers';
import { ensureUserProfile, loadPendingOnboarding, reconcilePendingOnboarding } from '@/lib/profileHelpers';
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

  // ── Deep link handler for email confirmation / auth redirects ────────────
  useEffect(() => {
    async function handleDeepLink({ url }: { url: string }) {
      if (!url.includes('auth/confirm')) return;

      // Tokens may be in hash (#) or query (?) part
      const hashPart = url.includes('#') ? url.split('#')[1] : url.split('?')[1];
      if (!hashPart) return;

      const params = new URLSearchParams(hashPart);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (!accessToken || !refreshToken) return;

      console.log('[Auth] Deep link received, setting session...');
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        console.error('[Auth] Deep link session error:', error.message);
        Sentry.captureException(error, { tags: { context: 'deep_link_auth' } });
      }
    }

    const subscription = Linking.addEventListener('url', handleDeepLink);
    // Handle cold start — app opened via deep link
    void Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => subscription.remove();
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

  // Fallback: if profile exists with no onboarding_completed_at and no pending data
  // in AsyncStorage, backfill the timestamp so the user isn't stuck in the onboarding loop.
  // This handles edge cases where AsyncStorage was wiped (reinstall, cross-device, etc.).
  useEffect(() => {
    const uid = session?.user?.id;
    const profile = profileQuery.data;
    if (!uid || !profile) return;
    if (profile.onboarding_completed_at || profile.target_level) return;

    void loadPendingOnboarding().then(async (pending) => {
      if (pending) return; // Reconcile effect will handle it
      console.log('[Onboarding] No pending data and no onboarding fields — backfilling timestamp');
      const { error } = await supabase
        .from('user_profiles')
        .update({
          onboarding_completed_at: profile.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', uid);
      if (error) {
        console.error('[Onboarding] Backfill failed:', error.message);
      } else {
        console.log('[Onboarding] Backfilled onboarding_completed_at for', uid);
        void profileQuery.refetch();
      }
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
