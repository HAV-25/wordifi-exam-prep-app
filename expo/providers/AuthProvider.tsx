import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import type { Session, User } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as Sentry from '@sentry/react-native';

import { adapty } from 'react-native-adapty';

const HAS_ACCOUNT_KEY = 'wordifi_has_account_v1';

import { signOutUser, updateTcAccepted } from '@/lib/authHelpers';
import { syncSubscriptionOnLaunch } from '@/lib/adaptyPaywall';
import { ensureUserProfile, reconcilePendingOnboarding } from '@/lib/profileHelpers';
import { supabase } from '@/lib/supabaseClient';
import type { UserProfile } from '@/types/database';
import { useAppConfig } from '@/providers/AppConfigProvider';
import { identifyUser, resetUser } from '@/lib/identity';
import { track } from '@/lib/track';
import { linkOneSignalIdentity, unlinkOneSignalIdentity, setOneSignalTags } from '@/lib/onesignal';
import { syncPushToken } from '@/lib/pushTokens';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const queryClient = useQueryClient();
  const config = useAppConfig();
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState<boolean>(true);
  const [hasKnownAccount, setHasKnownAccount] = useState<boolean>(false);
  const [pendingRecovery, setPendingRecovery] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      console.log('AuthProvider getSession', Boolean(data.session));
      if (!isMounted) return;

      if (!data.session) {
        // Check if this device has had an account before
        const flag = await AsyncStorage.getItem(HAS_ACCOUNT_KEY).catch(() => null);
        if (flag === 'true') {
          setHasKnownAccount(true);
        } else {
          // Fallback: check Adapty for active subscription (handles reinstall scenario)
          try {
            const adaptyProfile = await Promise.race<boolean>([
              adapty.getProfile().then(
                (p) => p?.accessLevels?.['premium']?.isActive === true
              ),
              new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)),
            ]);
            if (adaptyProfile) setHasKnownAccount(true);
          } catch {
            // no-op — Adapty unavailable
          }
        }
      } else {
        // Active session — ensure flag is written
        AsyncStorage.setItem(HAS_ACCOUNT_KEY, 'true').catch(() => {});
      }

      setSession(data.session);
      setIsSessionLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      console.log('AuthProvider auth state changed', event, Boolean(nextSession));
      setSession(nextSession);
      setIsSessionLoading(false);

      if (nextSession?.user) {
        AsyncStorage.setItem(HAS_ACCOUNT_KEY, 'true').catch(() => {});
        setHasKnownAccount(true);
        Sentry.setUser({
          id: nextSession.user.id,
          email: nextSession.user.email,
        });
        // Link Adapty profile with Supabase user
        adapty.identify(nextSession.user.id).catch((err) =>
          console.warn('[Adapty] identify failed:', err)
        );
        identifyUser(nextSession.user.id);
        linkOneSignalIdentity(nextSession.user.id);
        syncPushToken(nextSession.user.id).catch(() => {});
        if (event === 'INITIAL_SESSION') {
          track('user_signed_in', { method: 'session_restore' });
        }
      } else {
        Sentry.setUser(null);
        adapty.logout().catch(() => {});
        unlinkOneSignalIdentity();
        resetUser();
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
      const type = params.get('type');

      if (!accessToken || !refreshToken) return;

      console.log('[Auth] Deep link received, setting session... type:', type);

      // Mark recovery intent BEFORE setSession so the useEffect below can
      // navigate once the session lands — avoids a cold-start race where
      // router.replace fires before the navigation container is ready.
      if (type === 'recovery') {
        setPendingRecovery(true);
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        console.error('[Auth] Deep link session error:', error.message);
        Sentry.captureException(error, { tags: { context: 'deep_link_auth' } });
        setPendingRecovery(false);
        return;
      }
    }

    const subscription = Linking.addEventListener('url', handleDeepLink);
    // Handle cold start — app opened via deep link
    void Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => subscription.remove();
  }, []);

  // Navigate to reset-password once the session is established from a recovery
  // deep link. Using a separate effect avoids the cold-start race where
  // router.replace fires before the navigation container is mounted.
  useEffect(() => {
    if (pendingRecovery && session) {
      console.log('[Auth] Recovery session ready, navigating to reset-password');
      setPendingRecovery(false);
      router.replace('/reset-password');
    }
  }, [pendingRecovery, session]);

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

  // Sync OneSignal tags once user profile is available
  useEffect(() => {
    const uid = session?.user?.id;
    const profile = profileQuery.data;
    if (!uid || !profile) return;

    const tags: Record<string, string> = {};
    if (profile.target_level) tags.cefr_level = profile.target_level;
    if (profile.subscription_tier) tags.subscription_status = profile.subscription_tier;
    if (Object.keys(tags).length > 0) setOneSignalTags(tags);
  }, [session?.user?.id, profileQuery.data?.target_level, profileQuery.data?.subscription_tier]);

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
      hasKnownAccount,
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
      hasKnownAccount,
      refreshProfile,
      signOutMutation.mutateAsync,
      signOutMutation.isPending,
    ]
  );
});
