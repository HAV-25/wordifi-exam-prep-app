/**
 * Onboarding Launch — Screen 04: Exam Motivation
 * Source: Banani flow FtXTL2Xb5WF4 / screen XVaFB_BiIsRy
 * Step 3 of 10
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { onboardingStore } from './_store';
import { ScreenLayout } from '@/components/ScreenLayout';
import { GlowOrb } from '@/components/GlowOrb';

// ─── Data ─────────────────────────────────────────────────────────────────────

type ReasonId = 'visa' | 'work' | 'university' | 'settlement' | 'family' | 'personal';

const REASONS: { id: ReasonId; emoji: string; title: string; subtitle: string }[] = [
  { id: 'visa',       emoji: '🛂', title: 'Visa or residency permit',  subtitle: 'I need this to live or stay in Germany, Austria or Switzerland' },
  { id: 'work',       emoji: '💼', title: 'Work or career',            subtitle: 'My job or a new job requires it' },
  { id: 'university', emoji: '🎓', title: 'University admission',      subtitle: 'I need it to study in a German-speaking country' },
  { id: 'settlement', emoji: '🏠', title: 'Permanent settlement',      subtitle: 'I am applying for permanent residency or citizenship' },
  { id: 'family',     emoji: '👨‍👩‍👧', title: 'Family reunion',           subtitle: 'I need it to join my family in a German-speaking country' },
  { id: 'personal',   emoji: '📈', title: 'Personal goal',             subtitle: 'I want to prove my German level to myself' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EmpathyScreen() {
  const [selected, setSelected] = useState<ReasonId | null>(null);

  function handleContinue() {
    if (!selected) return;
    onboardingStore.readiness = null;
    router.push('/onboarding_launch/timeline');
  }

  const ctaFooter = (
    <Pressable
      onPress={handleContinue}
      disabled={!selected}
      style={({ pressed }) => [
        styles.ctaButton,
        !selected && styles.ctaDisabled,
        pressed && selected && styles.ctaPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Continue"
    >
      <Text style={[styles.ctaText, !selected && styles.ctaTextDisabled]}>Continue →</Text>
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <GlowOrb top={-100} right={-100} />
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: '30%' }]} />
      </View>

      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* Nav row */}
        <View style={styles.navRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
            <ArrowLeft size={24} color="#374151" />
          </Pressable>
          <Text style={styles.stepLabel}>STEP 3 OF 10</Text>
          <View style={styles.navSpacer} />
        </View>

        <ScreenLayout footer={ctaFooter} contentContainerStyle={styles.scroll}>
          {/* Headline */}
          <Text style={styles.headline}>This exam matters. Tell us why.</Text>

          {/* Cards */}
          <View style={styles.cardList}>
            {REASONS.map((reason) => (
              <Pressable
                key={reason.id}
                onPress={() => setSelected(reason.id)}
                style={({ pressed }) => [
                  styles.card,
                  selected === reason.id && styles.cardSelected,
                  pressed && styles.cardPressed,
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: selected === reason.id }}
                accessibilityLabel={reason.title}
              >
                <Text style={styles.emoji}>{reason.emoji}</Text>
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, selected === reason.id && styles.cardTitleSelected]}>
                    {reason.title}
                  </Text>
                  <Text style={styles.cardSubtitle}>{reason.subtitle}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </ScreenLayout>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFF', overflow: 'hidden' },

  // Progress
  progressTrack: {
    height: 4,
    backgroundColor: '#EBF1FF',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2B70EF',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },

  // Layout
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },

  // Nav
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 0,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  stepLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 13,
    color: '#94A3B8',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  navSpacer: { width: 40 },

  // Headline
  headline: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 32,
    lineHeight: 38,
    color: '#374151',
    marginBottom: 32,
    letterSpacing: -0.5,
  },

  // Cards
  cardList: { gap: 12, marginBottom: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    shadowColor: '#374151',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardSelected: {
    borderColor: '#2B70EF',
    backgroundColor: '#F0F5FF',
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
  },
  emoji: { fontSize: 28, lineHeight: 32 },
  cardContent: { flex: 1, gap: 4 },
  cardTitle: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 18,
    color: '#374151',
    lineHeight: 22,
  },
  cardTitleSelected: { color: '#2B70EF' },
  cardSubtitle: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    color: '#94A3B8',
    lineHeight: 21,
  },

  // CTA
  ctaButton: {
    width: '100%',
    height: 64,
    backgroundColor: '#2B70EF',
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2B70EF',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 10,
  },
  ctaDisabled: {
    backgroundColor: '#E2E8F0',
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaPressed: { opacity: 0.88 },
  ctaText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 20,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  ctaTextDisabled: { color: '#94A3B8' },
});
