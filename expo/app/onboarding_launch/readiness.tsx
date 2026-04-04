/**
 * Onboarding Launch — Screen 05 (canvas 04): Readiness Question
 * Source: Stitch screen f9e79e6341d44713a73535653bf8acbf
 * Step 5 of 10 — "How ready are you for your exam today?"
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { onboardingStore } from './_store';
import { colors } from '@/theme';

// ─── Readiness options ────────────────────────────────────────────────────────

type ReadinessId = 'not_at_all' | 'not_very' | 'somewhat' | 'mostly' | 'very';

const OPTIONS: { id: ReadinessId; emoji: string; title: string; subtitle: string }[] = [
  { id: 'not_at_all', emoji: '😰', title: 'Not ready at all',  subtitle: 'I am just starting out' },
  { id: 'not_very',   emoji: '😟', title: 'Not very ready',    subtitle: 'I have studied but I feel unsure' },
  { id: 'somewhat',   emoji: '😐', title: 'Somewhat ready',    subtitle: 'I know some things but have gaps' },
  { id: 'mostly',     emoji: '😊', title: 'Mostly ready',      subtitle: 'I feel good but want to make sure' },
  { id: 'very',       emoji: '💪', title: 'Very ready',        subtitle: 'I just want to confirm and practice' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ReadinessScreen() {
  const [selected, setSelected] = useState<ReadinessId | null>(null);

  return (
    <View style={styles.root}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.navRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={colors.primary} />
          </Pressable>
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: '50%' }]}>
                <View style={styles.progressDot} />
              </View>
            </View>
            <Text style={styles.stepLabel}>Step 5 of 10</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Headline */}
        <Text style={styles.headline}>How ready are you for your exam today?</Text>
        <Text style={styles.subhead}>Be honest. There are no wrong answers here.</Text>

        {/* Cards */}
        {OPTIONS.map(({ id, emoji, title, subtitle }) => (
          <Pressable
            key={id}
            onPress={() => setSelected(id)}
            style={({ pressed }) => [
              styles.card,
              selected === id && styles.cardSelected,
              pressed && styles.cardPressed,
            ]}
          >
            <Text style={styles.emoji}>{emoji}</Text>
            <View style={styles.cardBody}>
              <Text style={[styles.cardTitle, selected === id && styles.cardTitleSelected]}>
                {title}
              </Text>
              <Text style={styles.cardSubtitle}>{subtitle}</Text>
            </View>
            {selected === id && (
              <View style={styles.checkDot}><View style={styles.checkInner} /></View>
            )}
          </Pressable>
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.footer}>
        <SafeAreaView edges={['bottom']}>
          <Pressable
            onPress={() => { if (selected) { onboardingStore.readiness = selected; router.push('/onboarding_launch/readiness-check'); } }}
            disabled={!selected}
            style={[styles.ctaWrap, !selected && styles.ctaDisabled]}
          >
            <LinearGradient
              colors={selected ? [colors.primary, colors.primaryContainer] : [colors.surfaceContainerHigh, colors.surfaceContainerHigh]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              <Text style={[styles.ctaText, !selected && styles.ctaTextDisabled]}>Continue</Text>
              <ArrowRight size={20} color={selected ? colors.onPrimary : colors.outline} />
            </LinearGradient>
          </Pressable>
        </SafeAreaView>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: { backgroundColor: `${colors.background}F5`, shadowColor: colors.onSurface, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  navRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12, gap: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  progressWrap: { flex: 1, gap: 6 },
  progressTrack: { height: 8, backgroundColor: colors.surfaceContainerHighest, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, position: 'relative' },
  progressDot: { position: 'absolute', right: 0, top: 0, height: '100%', width: 8, backgroundColor: colors.secondaryFixed, shadowColor: colors.secondaryFixed, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8 },
  stepLabel: { fontFamily: 'NunitoSans_700Bold', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.onSurfaceVariant },

  scroll: { paddingHorizontal: 24, paddingTop: 24 },
  headline: { fontFamily: 'Outfit_800ExtraBold', fontSize: 30, lineHeight: 38, color: colors.onPrimaryContainer, marginBottom: 10, letterSpacing: -0.3 },
  subhead: { fontFamily: 'NunitoSans_400Regular', fontSize: 16, lineHeight: 24, color: colors.onSurfaceVariant, marginBottom: 28 },

  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerLowest, borderRadius: 24, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: `${colors.outlineVariant}1A`, shadowColor: colors.onSurface, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardSelected: { borderColor: `${colors.primary}33`, backgroundColor: colors.surfaceContainerLow, elevation: 4 },
  cardPressed: { transform: [{ scale: 0.98 }] },
  emoji: { fontSize: 30, marginRight: 16 },
  cardBody: { flex: 1 },
  cardTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 16, color: colors.onSurface, marginBottom: 3 },
  cardTitleSelected: { color: colors.primary },
  cardSubtitle: { fontFamily: 'NunitoSans_400Regular', fontSize: 12, color: colors.onSurfaceVariant },
  checkDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  checkInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.onPrimary },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 16, backgroundColor: `${colors.background}F5` },
  ctaWrap: { borderRadius: 24, overflow: 'hidden', shadowColor: colors.blueShadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 16, elevation: 8, marginBottom: 8 },
  ctaDisabled: { shadowOpacity: 0, elevation: 0 },
  cta: { paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 24 },
  ctaText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 16, color: colors.onPrimary, letterSpacing: 0.3 },
  ctaTextDisabled: { color: colors.outline },
});
