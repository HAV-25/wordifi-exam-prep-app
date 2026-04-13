import createContextHook from '@nkzw/create-context-hook';
import type { Session, User } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import * as Sentry from '@sentry/react-native';

import { adapty } from 'react-native-adapty';

import { signOutUser, updateTcAccepted } from '@/lib/authHelpers';
import { syncSubscriptionOnLaunch } from '@/lib/adaptyPaywall';
import { ensureUserProfile, reconcilePendingOnboarding } from '@/lib/profileHelpers';
import { supabase } from '@/lib/supabaseClient';
import type { UserProfile } from '@/types/database';
import { useAppConfig } from '@/providers/AppConfigProvider';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const queryClient = useQueryClient();
  const config = useAppConfig();
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
        // Link Adapty profile with Supabase user
        adapty.identify(nextSession.user.id).catch((err) =>
          console.warn('[Adapty] identify failed:', err)
        );
      } else {
        Sentry.setUser(null);
        adapty.logout().catch(() => {});
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

  // Sync Adapty subscription status on launch (handles renewals/expirations between sessions)
  const adaptysSyncRef = useRef(false);
  useEffect(() => {
    const uid = session?.user?.id;
    const profile = profileQuery.data;
    if (!uid || !profile || adaptysSyncRef.current) return;
    adaptysSyncRef.current = true;

    syncSubscriptionOnLaunch(uid, profile.subscription_tier ?? 'free_trial')
      .then((changed) => {
        if (changed) void profileQuery.refetch();
      })
      .catch(() => {});
  }, [session?.user?.id, profileQuery.data]);

  // Fallback: if profile exists with no onboarding_completed_at after reconcile has had
  // a chance to run, backfill the timestamp so the user isn't stuck in the onboarding loop.
  // This handles: AsyncStorage wiped, reconcile RLS failure, cross-device confirmation, etc.
  const backfillAttemptedRef = useRef(false);
  useEffect(() => {
    const uid = session?.user?.id;
    const profile = profileQuery.data;
    if (!uid || !profile || backfillAttemptedRef.current) return;
    if (profile.onboarding_completed_at || profile.target_level) return;

    // Give reconcile 3 seconds to complete before backfilling
    const timer = setTimeout(async () => {
      // Re-check in case reconcile succeeded in the meantime
      const freshProfile = profileQuery.data;
      if (freshProfile?.onboarding_completed_at || freshProfile?.target_level) return;

      backfillAttemptedRef.current = true;
      console.log('[Onboarding] Reconcile did not complete — backfilling onboarding_completed_at');
      const { error } = await supabase
        .from('user_profiles')
        .update({
          onboarding_completed_at: profile.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', uid);
      if (error) {
        console.error('[Onboarding] Backfill failed:', error.message);
        Sentry.captureException(error, { tags: { context: 'onboarding_backfill' } });
      } else {
        console.log('[Onboarding] Backfilled onboarding_completed_at for', uid);
        void profileQuery.refetch();
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [session?.user?.id, profileQuery.data?.onboarding_completed_at]);

  // Ensure tc_accepted is set after session is established.
  // Handles the confirmation_pending path where no session exists at signup time.
  useEffect(() => {
    const uid = session?.user?.id;
    const profile = profileQuery.data as (UserProfile & { tc_accepted?: boolean }) | null | undefined;
    if (!uid || !profile || profile.tc_accepted) return;

    void updateTcAccepted(uid, config.tc_version)
      .then(() => void profileQuery.refetch())
      .catch((err) => {
        console.error('[Auth] tc_accepted update failed:', err);
      });
  }, [session?.user?.id, (profileQuery.data as any)?.tc_accepted]);

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
