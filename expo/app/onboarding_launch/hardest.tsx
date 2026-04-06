/**
 * Onboarding Launch — Screen 07: Challenge Choice
 * Source: Banani flow FtXTL2Xb5WF4 / screen NXmzOYg1i_kc
 * Step 6 of 10
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { onboardingStore, HardestId } from './_store';

// ─── Data ─────────────────────────────────────────────────────────────────────

const OPTIONS: { id: HardestId; emoji: string; title: string; subtitle: string }[] = [
  { id: 'reading',    emoji: '👁️',  title: 'Reading (Lesen)',        subtitle: 'Understanding long German texts under time pressure' },
  { id: 'listening',  emoji: '👂',  title: 'Listening (Hören)',       subtitle: 'Following spoken German at exam speed' },
  { id: 'writing',    emoji: '✍️',  title: 'Writing (Schreiben)',     subtitle: 'Producing correct written German under exam conditions' },
  { id: 'speaking',   emoji: '🗣️', title: 'Speaking (Sprechen)',     subtitle: 'Expressing yourself clearly and confidently in German' },
  { id: 'grammar',    emoji: '🔤', title: 'Grammar and Vocabulary',   subtitle: 'Getting the rules right under exam pressure' },
  { id: 'everything', emoji: '📊', title: 'Everything',               subtitle: 'I need help across all sections' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HardestScreen() {
  const [selected, setSelected] = useState<HardestId | null>(null);

  function handleContinue() {
    if (!selected) return;
    onboardingStore.hardest = selected;
    router.push('/onboarding_launch/daily-commitment');
  }

  return (
    <View style={styles.root}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: '60%' }]} />
      </View>

      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* Nav row */}
        <View style={styles.navRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
            <ArrowLeft size={24} color="#374151" />
          </Pressable>
          <Text style={styles.stepLabel}>STEP 6 OF 10</Text>
          <View style={styles.navSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Headline */}
          <Text style={styles.headline}>Which part of the exam do you find hardest?</Text>
          <Text style={styles.subCopy}>Pick your biggest challenge. This shapes your entire plan.</Text>
          <Text style={styles.chooseLabel}>CHOOSE ONE</Text>

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

          {/* CTA */}
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
        </ScrollView>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFF' },

  progressTrack: { height: 4, backgroundColor: '#EBF1FF', width: '100%' },
  progressFill: { height: '100%', backgroundColor: '#2B70EF', borderTopRightRadius: 4, borderBottomRightRadius: 4 },

  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 },

  navRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  stepLabel: { flex: 1, textAlign: 'center', fontFamily: 'Outfit_800ExtraBold', fontSize: 13, color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase' },
  navSpacer: { width: 40 },

  headline: { fontFamily: 'Outfit_800ExtraBold', fontSize: 32, lineHeight: 38, color: '#374151', marginBottom: 12, letterSpacing: -0.5 },
  subCopy: { fontFamily: 'NunitoSans_400Regular', fontSize: 15, lineHeight: 22, color: '#374151', marginBottom: 32 },
  chooseLabel: { fontFamily: 'Outfit_800ExtraBold', fontSize: 12, color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },

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
