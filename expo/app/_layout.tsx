import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_700Bold,
} from '@expo-google-fonts/be-vietnam-pro';
import { useFonts } from 'expo-font';
import { Redirect, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { colors } from '@/theme';
import { AccessProvider } from '@/providers/AccessProvider';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { ONBOARDING_VERSION } from '@/constants/onboardingVersion';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RouteGate() {
  const segments = useSegments();
  const { isLoading, session, hasCompletedOnboarding } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      void SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.navy} size="large" />
      </View>
    );
  }

  const topSegment = segments[0] ?? '';
  const isAuthRoute = topSegment === 'auth';
  const isOnboardingRoute =
    topSegment === 'onboarding_prelaunch' || topSegment === 'onboarding_launch';
  const onboardingHref =
    ONBOARDING_VERSION === 'launch' ? '/onboarding_launch' : '/onboarding_prelaunch';

  if (!session && !isAuthRoute && !isOnboardingRoute) {
    return <Redirect href={onboardingHref} />;
  }

  if (session && !hasCompletedOnboarding && !isOnboardingRoute) {
    return <Redirect href={onboardingHref} />;
  }

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
        <Stack.Screen name="leaderboard" options={{ headerShown: false }} />
        <Stack.Screen name="review-mistakes" options={{ headerShown: false }} />
        <Stack.Screen name="desktop-code" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="desktop-active" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_800ExtraBold,
    PlusJakartaSans_600SemiBold,
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_700Bold,
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
      <AuthProvider>
        <AccessProvider>
          <GestureHandlerRootView style={styles.gestureRoot}>
            <ErrorBoundary>
              <RootLayoutNav />
            </ErrorBoundary>
          </GestureHandlerRootView>
        </AccessProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

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
