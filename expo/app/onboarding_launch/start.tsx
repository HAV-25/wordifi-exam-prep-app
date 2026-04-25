/**
 * Onboarding Launch — "Ready to start?" screen.
 * Non-blocking onboarding choice:
 *   "Start 72-hour free trial" → presents RevenueCat paywall → then routes to /auth
 *   "Continue free"            → routes directly to /auth (no paywall)
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Zap } from 'lucide-react-native';

import { presentRevenueCatPaywall } from '@/lib/revenuecatPaywall';
import { savePendingOnboarding } from '@/lib/profileHelpers';
import { track } from '@/lib/track';
import { colors } from '@/theme';
import { onboardingStore, onboardingSessionNonce } from './_store';

export default function StartScreen() {
  const [isStartingTrial, setIsStartingTrial] = useState(false);

  async function handleStartTrial() {
    if (isStartingTrial) return;
    setIsStartingTrial(true);
    try {
      track('paywall_viewed', { source_screen: 'onboarding_start' });
      const result = await presentRevenueCatPaywall();
      if (!result.purchased && !result.restored) {
        track('paywall_dismissed', { source_screen: 'onboarding_start' });
      }
    } catch (err) {
      console.error('[Start] presentRevenueCatPaywall error:', err);
    } finally {
      await savePendingOnboarding(onboardingStore, onboardingSessionNonce);
      router.replace('/auth?mode=signUp');
    }
  }

  async function handleContinueFree() {
    await savePendingOnboarding(onboardingStore, onboardingSessionNonce);
    router.replace('/auth?mode=signUp');
  }

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
      <View style={s.content}>
        {/* Headline */}
        <Text style={s.headline}>Ready to start?</Text>
        <Text style={s.subline}>
          Try everything free for 72 hours — no payment needed right now.
        </Text>

        {/* Feature list */}
        <View style={s.featureList}>
          {[
            'Unlimited daily practice questions',
            'Full Schreiben & Sprechen sections',
            'Mock exam simulations',
            'Streak tracking & readiness score',
          ].map((f) => (
            <View key={f} style={s.featureRow}>
              <View style={s.featureDot} />
              <Text style={s.featureText}>{f}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* CTAs */}
      <View style={s.ctaWrap}>
        <Pressable
          style={({ pressed }) => [s.primaryCta, pressed && { opacity: 0.88 }]}
          onPress={handleStartTrial}
          disabled={isStartingTrial}
          accessibilityRole="button"
          accessibilityLabel="Start 72-hour free trial"
        >
          {isStartingTrial ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Zap color="#FFFFFF" size={20} />
              <Text style={s.primaryCtaText}>Start 72-hour free trial</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={s.secondaryCta}
          onPress={handleContinueFree}
          disabled={isStartingTrial}
          accessibilityRole="button"
          accessibilityLabel="Continue free"
        >
          <Text style={s.secondaryCtaText}>Continue free</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    justifyContent: 'center',
  },
  headline: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 36,
    color: '#374151',
    letterSpacing: -0.8,
    marginBottom: 12,
  },
  subline: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 16,
    color: '#94A3B8',
    lineHeight: 24,
    marginBottom: 40,
  },
  featureList: {
    gap: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2B70EF',
    flexShrink: 0,
  },
  featureText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  ctaWrap: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 0,
  },
  primaryCta: {
    width: '100%',
    height: 60,
    backgroundColor: '#2B70EF',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
    shadowColor: '#2B70EF',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 32,
    elevation: 10,
  },
  primaryCtaText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  secondaryCta: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  secondaryCtaText: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    color: '#94A3B8',
  },
});
