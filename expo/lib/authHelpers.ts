import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

import { Platform } from 'react-native';

import { ensureUserProfile } from '@/lib/profileHelpers';
import { supabase } from '@/lib/supabaseClient';

WebBrowser.maybeCompleteAuthSession();

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.log('signInWithEmail error', error);
    throw error;
  }

  if (data.user) {
    await ensureUserProfile(data.user);
  }

  return data;
}

export type SignUpResult =
  | { status: 'confirmation_pending'; email: string }
  | { status: 'signed_in'; data: Awaited<ReturnType<typeof supabase.auth.signUp>>['data'] };

export async function signUpWithEmail(email: string, password: string): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    console.log('signUpWithEmail error', error);
    if (error.message.toLowerCase().includes('already registered')) {
      throw new Error('An account with this email already exists. Try signing in instead.');
    }
    throw error;
  }

  // Confirmation email sent — not an error
  if (data.user && !data.session) {
    return { status: 'confirmation_pending', email };
  }

  // Fully signed in (email confirmation disabled)
  if (data.user && data.session) {
    await ensureUserProfile(data.user);
    return { status: 'signed_in', data };
  }

  throw new Error('Unexpected response from sign up');
}

export async function updateTcAccepted(userId: string, tcVersion: string): Promise<void> {
  await supabase
    .from('user_profiles')
    .update({
      tc_accepted: true,
      tc_accepted_at: new Date().toISOString(),
      tc_version: tcVersion,
    } as never)
    .eq('id', userId);
}

export async function signInWithGoogle() {
  if (Platform.OS === 'web') {
    return signInWithGoogleWeb();
  }
  return signInWithGoogleNative();
}

function getWebOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://2ydqsq98wysdgr153a9qi.rork.app';
}

async function signInWithGoogleWeb() {
  const origin = getWebOrigin();
  const redirectTo = origin;
  console.log('[Auth] Google OAuth web - origin:', origin);
  console.log('[Auth] Google OAuth web - redirectTo:', redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: false,
    },
  });

  if (error) {
    console.log('signInWithGoogle web error', error);
    throw error;
  }

  return data;
}

async function signInWithGoogleNative() {
  const isExpoGo = Constants.appOwnership === 'expo';

  const redirectTo = isExpoGo
    ? makeRedirectUri()
    : makeRedirectUri({ scheme: 'rork-app' });

  console.log('[Auth] Google OAuth native redirectTo:', redirectTo);
  console.log('[Auth] Google OAuth native isExpoGo:', isExpoGo);
  console.log('[Auth] Google OAuth native appOwnership:', Constants.appOwnership);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    console.log('[Auth] signInWithGoogle auth error', error);
    throw error;
  }

  if (!data.url) {
    throw new Error('Google sign-in URL missing');
  }

  console.log('[Auth] Google OAuth opening browser with URL:', data.url.substring(0, 120) + '...');

  const result = await WebBrowser.openAuthSessionAsync(
    data.url,
    redirectTo,
    { preferEphemeralSession: true }
  );

  console.log('[Auth] Google OAuth browser result type:', result.type);

  if (result.type !== 'success') {
    console.log('[Auth] Google OAuth browser result:', JSON.stringify(result));
    if (result.type === 'cancel' || result.type === 'dismiss') {
      return null;
    }
    throw new Error('Google sign-in was cancelled');
  }

  console.log('[Auth] Google OAuth result URL:', result.url?.substring(0, 200));

  const url = result.url;
  let accessToken: string | undefined;
  let refreshToken: string | undefined;

  const hashIndex = url.indexOf('#');
  if (hashIndex !== -1) {
    const hashParams = new URLSearchParams(url.substring(hashIndex + 1));
    accessToken = hashParams.get('access_token') ?? undefined;
    refreshToken = hashParams.get('refresh_token') ?? undefined;
    console.log('[Auth] Extracted tokens from hash fragment');
  }

  if (!accessToken || !refreshToken) {
    const { params, errorCode } = QueryParams.getQueryParams(url);
    console.log('[Auth] QueryParams keys:', Object.keys(params));
    if (errorCode) {
      console.log('[Auth] QueryParams errorCode:', errorCode);
      throw new Error(errorCode);
    }
    accessToken = accessToken ?? params.access_token;
    refreshToken = refreshToken ?? params.refresh_token;
  }

  console.log('[Auth] Google OAuth tokens - hasAccess:', !!accessToken, 'hasRefresh:', !!refreshToken);

  if (!accessToken || !refreshToken) {
    throw new Error('Google session data missing — tokens not found in redirect URL');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError) {
    console.log('[Auth] signInWithGoogle setSession error', sessionError);
    throw sessionError;
  }

  if (sessionData.user) {
    await ensureUserProfile(sessionData.user);
  }

  return sessionData;
}

export async function resetPassword(email: string) {
  const origin = getWebOrigin();
  const redirectTo = `${origin}/reset-password`;
  console.log('[Auth] Reset password origin:', origin);
  console.log('[Auth] Reset password redirectTo:', redirectTo);

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    console.log('resetPassword error', error);
    throw error;
  }
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.log('signOutUser error', error);
    throw error;
  }
}
