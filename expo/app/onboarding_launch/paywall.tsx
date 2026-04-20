/**
 * Onboarding Launch — Screen 16: Paywall (Adapty Paywall Builder)
 *
 * Presents the Adapty-designed paywall on mount.
 * On purchase success or dismiss, saves onboarding and routes to /auth.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { presentAdaptyPaywall } from '@/lib/adaptyPaywall';
import { savePendingOnboarding } from '@/lib/profileHelpers';
import { track } from '@/lib/track';
import { colors, fontFamily, fontSize } from '@/theme';
import { onboardingStore, onboardingSessionNonce } from './_store';

export default function PaywallScreen() {
  const [isPresenting, setIsPresenting] = useState(true);
  const presentedRef = useRef(false);

  useEffect(() => {
    if (presentedRef.current) return;
    presentedRef.current = true;

    track('paywall_viewed', { source_screen: 'onboarding' });

    async function showPaywall() {
      try {
        const result = await presentAdaptyPaywall();

        if (!result.purchased && !result.restored) {
          track('paywall_dismissed', { source_screen: 'onboarding' });
        }

        // Whether purchased, restored, or dismissed — save onboarding and continue to auth
        await savePendingOnboarding(onboardingStore, onboardingSessionNonce);
        router.replace('/auth?mode=signUp');
      } catch (err) {
        console.error('[Paywall] Error presenting paywall:', err);
        // Fallback: save onboarding and continue as free user
        await savePendingOnboarding(onboardingStore, onboardingSessionNonce);
        router.replace('/auth?mode=signUp');
      } finally {
        setIsPresenting(false);
      }
    }

    void showPaywall();
  }, []);

  // Show a loading state while the Adapty paywall is being fetched/presented
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryBlue} size="large" />
        <Text style={styles.loadingText}>Loading your offer...</Text>
      </View>

      {/* Fallback skip button (visible after paywall dismisses if routing hasn't happened) */}
      {!isPresenting ? (
        <View style={styles.footer}>
          <Pressable
            onPress={async () => {
              await savePendingOnboarding(onboardingStore, onboardingSessionNonce);
              router.replace('/auth?mode=signUp');
            }}
            style={styles.skipBtn}
          >
            <Text style={styles.skipText}>Continue with free plan</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bodyBackground,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.bodyMd,
    color: colors.mutedGray,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  skipText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.bodyMd,
    color: colors.mutedGray,
  },
});
