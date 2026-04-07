/**
 * Onboarding Launch — Screen 08: Time Commitment
 * Source: Banani flow FtXTL2Xb5WF4 / screen hie-W6TxJ9Qs
 * Step 7 of 10 — defaults to 15 min (recommended) pre-selected
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenLayout } from '@/components/ScreenLayout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { onboardingStore, DailyMinutes, DAILY_MINUTES_DISPLAY } from './_store';

const OPTIONS: DailyMinutes[] = [5, 15, 25, 30];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DailyCommitmentScreen() {
  const [selected, setSelected] = useState<DailyMinutes>(15);

  const ctaFooter = (
    <Pressable
      onPress={() => { onboardingStore.dailyMinutes = selected; router.push('/onboarding_launch/learner-style'); }}
      style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaPressed]}
      accessibilityRole="button"
      accessibilityLabel="Continue"
    >
      <Text style={styles.ctaText}>Continue →</Text>
    </Pressable>
  );

  return (
    <View style={styles.root}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: '70%' }]} />
      </View>

      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* Nav row */}
        <View style={styles.navRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
            <ArrowLeft size={24} color="#374151" />
          </Pressable>
          <Text style={styles.stepLabel}>STEP 7 OF 10</Text>
          <View style={styles.navSpacer} />
        </View>

        <ScreenLayout footer={ctaFooter} contentContainerStyle={styles.scroll}>
          {/* Headline */}
          <Text style={styles.headline}>How many minutes can you practice each day?</Text>
          <Text style={styles.subCopy}>Every minute counts. Pick what works for you.</Text>

          {/* Cards */}
          <View style={styles.cardList}>
            {OPTIONS.map((id) => {
              const { label, description, emoji, recommended } = DAILY_MINUTES_DISPLAY[id];
              const isSelected = selected === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setSelected(id)}
                  style={({ pressed }) => [
                    styles.card,
                    isSelected && styles.cardSelected,
                    pressed && styles.cardPressed,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={label}
                >
                  {recommended && (
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedText}>Recommended 🔥</Text>
                    </View>
                  )}
                  <Text style={styles.emoji}>{emoji}</Text>
                  <View style={styles.cardContent}>
                    <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
                      {label}
                    </Text>
                    <Text style={styles.cardSubtitle}>{description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScreenLayout>
      </SafeAreaView>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFF' },

  progressTrack: { height: 4, backgroundColor: '#EBF1FF', width: '100%' },
  progressFill: { height: '100%', backgroundColor: '#2B70EF', borderTopRightRadius: 4, borderBottomRightRadius: 4 },

  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 16 },

  navRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  stepLabel: { flex: 1, textAlign: 'center', fontFamily: 'Outfit_800ExtraBold', fontSize: 13, color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase' },
  navSpacer: { width: 40 },

  headline: { fontFamily: 'Outfit_800ExtraBold', fontSize: 32, lineHeight: 37, color: '#374151', marginBottom: 12, letterSpacing: -0.5 },
  subCopy: { fontFamily: 'NunitoSans_400Regular', fontSize: 16, lineHeight: 24, color: '#374151', marginBottom: 32 },

  cardList: { gap: 16, marginBottom: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 12,
    elevation: 2,
  },
  cardSelected: { borderColor: '#2B70EF', backgroundColor: '#F0F5FF' },
  cardPressed: { transform: [{ scale: 0.98 }] },

  // Recommended badge — absolute top-right
  recommendedBadge: {
    position: 'absolute',
    top: -12,
    right: 16,
    backgroundColor: '#F0C808',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    shadowColor: '#F0C808',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
    zIndex: 1,
  },
  recommendedText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 11,
    color: '#374151',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  emoji: { fontSize: 28, width: 32, textAlign: 'center' },
  cardContent: { flex: 1, gap: 4 },
  cardTitle: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 16, color: '#374151' },
  cardTitleSelected: { color: '#2B70EF' },
  cardSubtitle: { fontFamily: 'NunitoSans_400Regular', fontSize: 15, color: '#94A3B8', lineHeight: 21 },

  ctaButton: { width: '100%', height: 60, backgroundColor: '#2B70EF', borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#2B70EF', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 8 },
  ctaPressed: { opacity: 0.88 },
  ctaText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 18, color: '#FFFFFF', letterSpacing: -0.3 },
});
