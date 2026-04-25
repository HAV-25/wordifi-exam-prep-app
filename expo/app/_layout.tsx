import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Outfit_800ExtraBold } from '@expo-google-fonts/outfit';
import {
  NunitoSans_400Regular,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
} from '@expo-google-fonts/nunito-sans';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { useFonts } from 'expo-font';
import { Redirect, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { WalkthroughProvider } from '@/components/walkthrough';
import { colors } from '@/theme';
import { AccessProvider } from '@/providers/AccessProvider';
import { AppConfigProvider } from '@/providers/AppConfigProvider';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { QuestionTypeMetaProvider, useQuestionTypeMetaContext } from '@/lib/useQuestionTypeMeta';
import * as Sentry from '@sentry/react-native';
import Purchases from 'react-native-purchases';
import { initPostHog } from '@/lib/posthog';
import { initOneSignal } from '@/lib/onesignal';
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: 0.2,
  debug: __DEV__,
  sendDefaultPii: true,
  enableLogs: true,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],
});

void SplashScreen.preventAutoHideAsync();

Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '' });

const queryClient = new QueryClient();

function RouteGate() {
  const segments = useSegments();
  const { isLoading, session, hasCompletedOnboarding, hasKnownAccount } = useAuth();
  const { isMetaLoading } = useQuestionTypeMetaContext();

  useEffect(() => {
    if (!isLoading && !isMetaLoading) {
      void SplashScreen.hideAsync();
    }
  }, [isLoading, isMetaLoading]);

  if (isLoading || isMetaLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.navy} size="large" />
      </View>
    );
  }

  const topSegment = segments[0] ?? '';
  const isAuthRoute = topSegment === 'auth' || topSegment === 'check-email';
  const isOnboardingRoute =
    topSegment === 'onboarding_prelaunch' || topSegment === 'onboarding_launch';
  // Password reset arrives via deep link — session is set inside AuthProvider
  // after the route renders, so don't redirect away while that's happening
  const isResetPasswordRoute = topSegment === 'reset-password';

  // No session → returning user goes to sign-in, new user goes to onboarding
  if (!session && !isAuthRoute && !isOnboardingRoute && !isResetPasswordRoute) {
    return <Redirect href={hasKnownAccount ? '/auth' : '/onboarding_launch'} />;
  }

  // Has session but onboarding not complete → send back to onboarding
  if (session && !hasCompletedOnboarding && !isOnboardingRoute && !isAuthRoute) {
    return <Redirect href="/onboarding_launch" />;
  }

  // Fully onboarded user on auth or onboarding route → go home
  if (session && hasCompletedOnboarding && (isAuthRoute || isOnboardingRoute)) {
    return <Redirect href="/" />;
  }

  return null;
}

function RootLayoutNav() {
  return (
    <>
      <RouteGate />
      <Stack screenOptions={{ headerBackTitle: 'Back', headerTintColor: colors.navy }}>
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="check-email" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding_prelaunch" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding_launch" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="practice" options={{ title: 'Practice' }} />
        <Stack.Screen name="results" options={{ title: 'Results', headerBackVisible: false }} />
        <Stack.Screen name="sectional-test" options={{ title: 'Sectional Test' }} />
        <Stack.Screen name="schreiben-test" options={{ title: 'Schreiben' }} />
        <Stack.Screen name="sprechen-realtime" options={{ title: 'Sprechen Live' }} />
        <Stack.Screen name="sectional-results" options={{ title: 'Results', headerBackVisible: false }} />
        <Stack.Screen name="mock-test" options={{ title: 'Mock Test' }} />
        <Stack.Screen name="mock-results" options={{ title: 'Mock Results', headerBackVisible: false }} />
        <Stack.Screen name="sprachbausteine-test" options={{ title: 'Sprachbausteine', headerShown: false }} />
        <Stack.Screen name="sprachbausteine-results" options={{ title: 'Sprachbausteine Results', headerShown: false }} />
        <Stack.Screen name="profile-setup" options={{ title: 'Profile Setup' }} />
        <Stack.Screen name="notification-settings" options={{ title: 'Notifications' }} />
        <Stack.Screen name="leaderboard" options={{ headerShown: false }} />
        <Stack.Screen name="review-mistakes" options={{ headerShown: false }} />
        <Stack.Screen name="desktop-code" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="desktop-active" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
      </Stack>
    </>
  );
}

function SentryFallback() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F8FAFF' }}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: '#0A0E1A', marginBottom: 8 }}>
        Something went wrong
      </Text>
      <Text style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center' }}>
        The Wordifi team has been notified. Please restart the app.
      </Text>
    </View>
  );
}

export default Sentry.wrap(function RootLayout() {
  useEffect(() => {
    try {
      initPostHog();
    } catch (e) {
      console.warn('[PostHog] init failed', e);
    }
    initOneSignal();
  }, []);

  const [fontsLoaded] = useFonts({
    Outfit_800ExtraBold,
    NunitoSans_400Regular,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
    Pacifico_400Regular,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <Sentry.ErrorBoundary fallback={SentryFallback}>
      <QueryClientProvider client={queryClient}>
        <AppConfigProvider>
        <AuthProvider>
          <AccessProvider>
            <QuestionTypeMetaProvider>
            <SafeAreaProvider>
              <GestureHandlerRootView style={styles.gestureRoot}>
                <ErrorBoundary>
                  <WalkthroughProvider>
                    <RootLayoutNav />
                  </WalkthroughProvider>
                </ErrorBoundary>
              </GestureHandlerRootView>
            </SafeAreaProvider>
            </QuestionTypeMetaProvider>
          </AccessProvider>
        </AuthProvider>
        </AppConfigProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  );
});

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  loadingWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    zIndex: 2,
  },
});
