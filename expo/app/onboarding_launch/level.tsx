/**
 * Onboarding Launch — Screen 03: Level Targeting
 * Source: Banani flow FtXTL2Xb5WF4 / screen _ATEWWmSBUV9
 * Step 2 of 10
 */
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Lock } from 'lucide-react-native';
import { onboardingStore } from './_store';
import { ScreenLayout } from '@/components/ScreenLayout';
import { ConvictionAnswerCard } from '@/components/onboarding/ConvictionAnswerCard';
import { LEVEL_CONVICTIONS } from '@/components/onboarding/convictionLookup';

// ─── Data ─────────────────────────────────────────────────────────────────────

type LevelId = 'A1' | 'A2' | 'B1';

const LEVELS: { id: LevelId; emoji: string; title: string; subtitle: string; popular?: boolean }[] = [
  { id: 'A1', emoji: '🌱', title: 'A1 · Beginner',      subtitle: 'Your first step into German' },
  { id: 'A2', emoji: '📗', title: 'A2 · Elementary',    subtitle: 'Everyday conversations and basics' },
  { id: 'B1', emoji: '🔥', title: 'B1 · Intermediate',  subtitle: 'The most important cert for visas and residency', popular: true },
];

const LOCKED = [
  { emoji: '📘', title: 'B2 · Upper Intermediate', subtitle: 'Advanced fluency for work and study' },
  { emoji: '🎓', title: 'C1/C2 · Advanced',        subtitle: 'Near-native proficiency mastery' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LevelScreen() {
  const [selected, setSelected] = useState<LevelId | null>(null);
  const [continueActive, setContinueActive] = useState(false);
  // Holds the cancel handle from the flipped card — called before navigating to
  // abort any pending flip-back timer if Continue is tapped during the hold.
  const cancelFlipBackRef = useRef<(() => void) | null>(null);

  function handleContinue() {
    cancelFlipBackRef.current?.();
    cancelFlipBackRef.current = null;
    if (!selected) return;
    onboardingStore.level = selected;
    router.push('/onboarding_launch/empathy');
  }

  const ctaFooter = (
    <Pressable
      onPress={handleContinue}
      disabled={!continueActive}
      style={({ pressed }) => [
        styles.ctaButton,
        !continueActive && styles.ctaDisabled,
        pressed && continueActive && styles.ctaPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Continue"
    >
      <Text style={[styles.ctaText, !continueActive && styles.ctaTextDisabled]}>Continue →</Text>
    </Pressable>
  );

  return (
    <View style={styles.root}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: '20%' }]} />
      </View>

      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* Nav row */}
        <View style={styles.navRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
            <ArrowLeft size={24} color="#374151" />
          </Pressable>
          <Text style={styles.stepLabel}>STEP 2 OF 10</Text>
          <View style={styles.navSpacer} />
        </View>

        <ScreenLayout footer={ctaFooter} contentContainerStyle={styles.scroll}>
          {/* Headline */}
          <Text style={styles.headline}>What level are you targeting?</Text>

          {/* Selectable conviction cards */}
          <View style={styles.cardList}>
            {LEVELS.map((lvl) => (
              <ConvictionAnswerCard
                key={lvl.id}
                conviction={LEVEL_CONVICTIONS[lvl.id]}
                isSelected={selected === lvl.id}
                onPress={() => setSelected(lvl.id)}
                onFlipComplete={(cancelFn) => {
                  setContinueActive(true);
                  cancelFlipBackRef.current = cancelFn;
                }}
                cardStyle={[styles.card, selected === lvl.id && styles.cardSelected]}
                cardBorderRadius={16}
                accessibilityLabel={lvl.title}
              >
                <Text style={styles.emoji}>{lvl.emoji}</Text>
                <View style={styles.cardContent}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={[styles.cardTitle, selected === lvl.id && styles.cardTitleSelected]}>
                      {lvl.title}
                    </Text>
                    {lvl.popular && (
                      <View style={styles.popularBadge}>
                        <Text style={styles.popularText}>Most Popular 🔥</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardSubtitle}>{lvl.subtitle}</Text>
                </View>
              </ConvictionAnswerCard>
            ))}

            {/* Locked cards — B2 and C1/C2, not selectable, no conviction card */}
            {LOCKED.map((lvl) => (
              <View key={lvl.title} style={[styles.card, styles.cardLocked]}>
                <Text style={styles.emoji}>{lvl.emoji}</Text>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{lvl.title}</Text>
                  <Text style={styles.cardSubtitle}>{lvl.subtitle}</Text>
                </View>
                <Lock size={20} color="#94A3B8" />
              </View>
            ))}
          </View>
        </ScreenLayout>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFF',
  },

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
    backgroundColor: '#ECF2FE', // brief §step-6: soft Primary Blue tint
  },
  cardLocked: {
    opacity: 0.6,
    backgroundColor: '#F8FAFF',
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
  },
  emoji: { fontSize: 28, lineHeight: 32 },
  cardContent: { flex: 1, gap: 4 },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
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

  // Popular badge
  popularBadge: {
    backgroundColor: 'rgba(240, 200, 8, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  popularText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 12,
    color: '#B59500',
  },

  // CTA
  ctaButton: {
    width: '100%',
    height: 64,
    backgroundColor: '#2B70EF',
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
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
