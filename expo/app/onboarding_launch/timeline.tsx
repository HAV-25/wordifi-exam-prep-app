/**
 * Onboarding Launch — Screen 05: Timeframe Choice
 * Source: Banani flow FtXTL2Xb5WF4 / screen P_H6YuOeWqZi
 * Step 4 of 10
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { onboardingStore, TimelineId } from './_store';
import { ScreenLayout } from '@/components/ScreenLayout';

// ─── Data ─────────────────────────────────────────────────────────────────────

const OPTIONS: { id: TimelineId; emoji: string; title: string; subtitle: string }[] = [
  { id: 'lt4w',   emoji: '⚡', title: 'Less than 4 weeks',    subtitle: 'I need to pass very soon' },
  { id: '1to3m',  emoji: '🔥', title: '1 to 3 months',        subtitle: 'My exam is coming up soon' },
  { id: '3to6m',  emoji: '📅', title: '3 to 6 months',        subtitle: 'I have some time to prepare well' },
  { id: 'gt6m',   emoji: '🗓️', title: 'More than 6 months',  subtitle: 'I am preparing well in advance' },
  { id: 'none',   emoji: '❓', title: 'No exam date set yet', subtitle: 'I am preparing before booking' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TimelineScreen() {
  const [selected, setSelected] = useState<TimelineId | null>(null);

  function handleContinue() {
    if (!selected) return;
    onboardingStore.timeline = selected;
    router.push('/onboarding_launch/readiness');
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
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: '40%' }]} />
      </View>

      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* Nav row */}
        <View style={styles.navRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
            <ArrowLeft size={24} color="#374151" />
          </Pressable>
          <Text style={styles.stepLabel}>STEP 4 OF 10</Text>
          <View style={styles.navSpacer} />
        </View>

        <ScreenLayout footer={ctaFooter} contentContainerStyle={styles.scroll}>
          {/* Headline */}
          <Text style={styles.headline}>How long until your exam date?</Text>
          <Text style={styles.subCopy}>Every window is the right window. What matters is starting today.</Text>

          {/* Cards */}
          <View style={styles.cardList}>
            {OPTIONS.map((opt) => (
              <Pressable
                key={opt.id}
                onPress={() => setSelected(opt.id)}
                style={({ pressed }) => [
                  styles.card,
                  selected === opt.id && styles.cardSelected,
                  pressed && styles.cardPressed,
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: selected === opt.id }}
                accessibilityLabel={opt.title}
              >
                <Text style={styles.emoji}>{opt.emoji}</Text>
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, selected === opt.id && styles.cardTitleSelected]}>
                    {opt.title}
                  </Text>
                  <Text style={styles.cardSubtitle}>{opt.subtitle}</Text>
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
  root: { flex: 1, backgroundColor: '#F8FAFF' },

  progressTrack: { height: 4, backgroundColor: '#EBF1FF', width: '100%' },
  progressFill: { height: '100%', backgroundColor: '#2B70EF', borderTopRightRadius: 4, borderBottomRightRadius: 4 },

  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 32 },

  navRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  stepLabel: { flex: 1, textAlign: 'center', fontFamily: 'Outfit_800ExtraBold', fontSize: 13, color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase' },
  navSpacer: { width: 40 },

  headline: { fontFamily: 'Outfit_800ExtraBold', fontSize: 32, lineHeight: 38, color: '#374151', marginBottom: 12, letterSpacing: -0.5 },
  subCopy: { fontFamily: 'NunitoSans_400Regular', fontSize: 15, lineHeight: 22, color: '#374151', marginBottom: 32 },

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
  cardSelected: { borderColor: '#2B70EF', backgroundColor: '#F0F5FF' },
  cardPressed: { transform: [{ scale: 0.98 }] },
  emoji: { fontSize: 28, lineHeight: 32 },
  cardContent: { flex: 1, gap: 4 },
  cardTitle: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 18, color: '#374151', lineHeight: 22 },
  cardTitleSelected: { color: '#2B70EF' },
  cardSubtitle: { fontFamily: 'NunitoSans_400Regular', fontSize: 15, color: '#94A3B8', lineHeight: 21 },

  ctaButton: { width: '100%', height: 64, backgroundColor: '#2B70EF', borderRadius: 100, alignItems: 'center', justifyContent: 'center', shadowColor: '#2B70EF', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.5, shadowRadius: 32, elevation: 10 },
  ctaDisabled: { backgroundColor: '#E2E8F0', shadowOpacity: 0, elevation: 0 },
  ctaPressed: { opacity: 0.88 },
  ctaText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 20, color: '#FFFFFF', letterSpacing: -0.5 },
  ctaTextDisabled: { color: '#94A3B8' },
});
