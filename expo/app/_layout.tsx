import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Redirect, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { colors } from '@/theme';
import { AccessProvider } from '@/providers/AccessProvider';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';

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
  const isOnboardingRoute = topSegment === 'onboarding';

  if (!session && !isAuthRoute && !isOnboardingRoute) {
    return <Redirect href="/onboarding" />;
  }

  if (session && !hasCompletedOnboarding && !isOnboardingRoute) {
    return <Redirect href="/onboarding" />;
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
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="practice" options={{ title: 'Practice' }} />
        <Stack.Screen name="results" options={{ title: 'Results', headerBackVisible: false }} />
        <Stack.Screen name="sectional-test" options={{ title: 'Sectional Test' }} />
        <Stack.Screen name="schreiben-test" options={{ title: 'Schreiben' }} />
        <Stack.Screen name="sectional-results" options={{ title: 'Results', headerBackVisible: false }} />
        <Stack.Screen name="mock-test" options={{ title: 'Mock Test' }} />
        <Stack.Screen name="mock-results" options={{ title: 'Mock Results', headerBackVisible: false }} />
        <Stack.Screen name="leaderboard" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
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
