import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Outfit_800ExtraBold } from '@expo-google-fonts/outfit';
import {
  NunitoSans_400Regular,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
} from '@expo-google-fonts/nunito-sans';
import { useFonts } from 'expo-font';
import { Redirect, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
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

Sentry.init({
  dsn: 'https://108675a38db2e4a51c253936dcaf84aa@o4510781679992832.ingest.de.sentry.io/4511166563483728',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RouteGate() {
  const segments = useSegments();
  const { isLoading, session, hasCompletedOnboarding } = useAuth();
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

  // TEST MODE: onboarding bypassed — go straight to auth, home after login
  if (!session && !isAuthRoute && !isOnboardingRoute) {
    return <Redirect href="/auth" />;
  }

  if (session && (isAuthRoute || isOnboardingRoute)) {
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
        <Stack.Screen name="sprechen-test" options={{ title: 'Sprechen' }} />
        <Stack.Screen name="sprechen-realtime" options={{ title: 'Sprechen Live' }} />
        <Stack.Screen name="sectional-results" options={{ title: 'Results', headerBackVisible: false }} />
        <Stack.Screen name="mock-test" options={{ title: 'Mock Test' }} />
        <Stack.Screen name="mock-results" options={{ title: 'Mock Results', headerBackVisible: false }} />
        <Stack.Screen name="sprachbausteine-test" options={{ title: 'Sprachbausteine', headerShown: false }} />
        <Stack.Screen name="sprachbausteine-results" options={{ title: 'Sprachbausteine Results', headerShown: false }} />
        <Stack.Screen name="profile-setup" options={{ title: 'Profile Setup' }} />
        <Stack.Screen name="leaderboard" options={{ headerShown: false }} />
        <Stack.Screen name="review-mistakes" options={{ headerShown: false }} />
        <Stack.Screen name="desktop-code" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="desktop-active" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
      </Stack>
    </>
  );
}

export default Sentry.wrap(function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_800ExtraBold,
    NunitoSans_400Regular,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
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
