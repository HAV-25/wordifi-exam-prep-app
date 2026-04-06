/**
 * Onboarding Launch — Screen 09: Learning Style
 * Source: Banani flow FtXTL2Xb5WF4 / screen 6IQWGji6DIts
 * Step 8 of 10
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { onboardingStore, LearnerStyleId, LEARNER_STYLE_DISPLAY } from './_store';
import { colors } from '@/theme';

const OPTIONS: LearnerStyleId[] = ['sprinter', 'builder', 'sniper', 'explorer'];

export default function LearnerStyleScreen() {
  const [selected, setSelected] = useState<LearnerStyleId | null>(null);

  function handleContinue() {
    if (!selected) return;
    onboardingStore.learnerStyle = selected;
    router.push('/onboarding_launch/leaderboard');
  }

  return (
    <View style={styles.root}>
      {/* Yellow glow top-right */}
      <View style={styles.glow} />

      {/* 4px progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: '80%' }]} />
      </View>

      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* Nav */}
        <View style={styles.navRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
            <ArrowLeft size={24} color="#374151" />
          </Pressable>
          <Text style={styles.stepLabel}>Step 8 of 10</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.headline}>Which style describes you best?</Text>
          <Text style={styles.subCopy}>Pick the one that feels most like you.</Text>

          {/* Answer cards */}
          <View style={styles.cardList}>
            {OPTIONS.map((id) => {
              const { emoji, title, description } = LEARNER_STYLE_DISPLAY[id];
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
                  accessibilityLabel={title}
                >
                  <Text style={styles.cardIcon}>{emoji}</Text>
                  <View style={styles.cardContent}>
                    <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>{title}</Text>
                    <Text style={styles.cardSubtitle}>{description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* "Almost there" card — always visible */}
          <View style={styles.almostCard}>
            <Text style={styles.almostTitle}>Last question done.</Text>
            <Text style={styles.almostSub}>Your plan is complete. Let's show you what's next.</Text>
          </View>

          {/* CTA */}
          <Pressable
            onPress={handleContinue}
            disabled={!selected}
            style={({ pressed }) => [
              styles.cta,
              !selected && styles.ctaDisabled,
              pressed && selected && styles.ctaPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={[styles.ctaText, !selected && styles.ctaTextDisabled]}>Continue →</Text>
          </Pressable>

          <SafeAreaView edges={['bottom']} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },

  // Yellow radial glow top-right
  glow: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#F0C808',
    opacity: 0.13,
  },

  // Progress bar
  progressTrack: { height: 4, backgroundColor: '#E2E8F0', width: '100%' },
  progressFill:  { height: '100%', backgroundColor: colors.primary },

  safe: { flex: 1 },

  // Nav
  navRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, marginTop: 4 },
  backBtn:   { width: 40, height: 40, alignItems: 'center', justifyContent: 'flex-start' },
  stepLabel: { flex: 1, textAlign: 'center', marginRight: 40, fontFamily: 'NunitoSans_600SemiBold', fontSize: 14, color: '#94A3B8' },

  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },

  headline: { fontFamily: 'Outfit_800ExtraBold', fontSize: 32, lineHeight: 37, color: '#374151', marginBottom: 12, letterSpacing: -0.5 },
  subCopy:  { fontFamily: 'NunitoSans_400Regular', fontSize: 16, lineHeight: 23, color: '#94A3B8', marginBottom: 32 },

  // Cards
  cardList: { gap: 12, marginBottom: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    gap: 16,
    shadowColor: '#374151',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  cardSelected:      { borderColor: colors.primary, backgroundColor: '#F0F5FF' },
  cardPressed:       { transform: [{ scale: 0.98 }] },
  cardIcon:          { fontSize: 24, lineHeight: 29 },
  cardContent:       { flex: 1, gap: 4 },
  cardTitle:         { fontFamily: 'NunitoSans_600SemiBold', fontSize: 16, color: '#374151' },
  cardTitleSelected: { color: colors.primary },
  cardSubtitle:      { fontFamily: 'NunitoSans_400Regular', fontSize: 14, lineHeight: 20, color: '#94A3B8' },

  // "Almost there" card
  almostCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
    shadowColor: '#374151',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  almostTitle: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 16, color: '#374151' },
  almostSub:   { fontFamily: 'NunitoSans_400Regular', fontSize: 14, lineHeight: 20, color: '#94A3B8', textAlign: 'center' },

  // CTA
  cta:           { width: '100%', height: 64, backgroundColor: colors.primary, borderRadius: 100, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.5, shadowRadius: 32, elevation: 10 },
  ctaDisabled:   { backgroundColor: '#E2E8F0', shadowOpacity: 0, elevation: 0 },
  ctaPressed:    { opacity: 0.88 },
  ctaText:       { fontFamily: 'Outfit_800ExtraBold', fontSize: 20, color: '#FFFFFF', letterSpacing: -0.5 },
  ctaTextDisabled: { color: '#94A3B8' },
});
