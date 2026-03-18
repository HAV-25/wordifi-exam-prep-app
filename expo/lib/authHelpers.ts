import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

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

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    console.log('signUpWithEmail error', error);
    throw error;
  }

  if (data.user) {
    await ensureUserProfile(data.user);
  }

  return data;
}

export async function signInWithGoogle() {
  const redirectTo = makeRedirectUri({ path: 'auth' });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    console.log('signInWithGoogle auth error', error);
    throw error;
  }

  if (!data.url) {
    throw new Error('Google sign-in URL missing');
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== 'success') {
    throw new Error('Google sign-in was cancelled');
  }

  const { params, errorCode } = QueryParams.getQueryParams(result.url);

  if (errorCode) {
    throw new Error(errorCode);
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;

  if (!accessToken || !refreshToken) {
    throw new Error('Google session data missing');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError) {
    console.log('signInWithGoogle setSession error', sessionError);
    throw sessionError;
  }

  if (sessionData.user) {
    await ensureUserProfile(sessionData.user);
  }

  return sessionData;
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.log('signOutUser error', error);
    throw error;
  }
}
