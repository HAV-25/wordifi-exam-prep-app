/**
 * Onboarding Launch — Screen 06: Readiness Check
 * Source: Stitch screen cf0be3382816463fb3417edc53ddf78b
 * Step 6 of 10 — "How ready are you for your exam today?" (confirmation/refinement)
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react-native';
import { colors } from '@/theme';

// ─── Readiness options (same set, re-confirmed) ───────────────────────────────

type ReadinessId = 'not_at_all' | 'not_very' | 'somewhat' | 'mostly' | 'very';

const OPTIONS: { id: ReadinessId; emoji: string; title: string; subtitle: string }[] = [
  { id: 'not_at_all', emoji: '😰', title: 'Not ready at all',  subtitle: 'I am just starting out' },
  { id: 'not_very',   emoji: '😟', title: 'Not very ready',    subtitle: 'I have studied but I feel unsure' },
  { id: 'somewhat',   emoji: '😐', title: 'Somewhat ready',    subtitle: 'I know some things but have gaps' },
  { id: 'mostly',     emoji: '😊', title: 'Mostly ready',      subtitle: 'I feel good but want to make sure' },
  { id: 'very',       emoji: '💪', title: 'Very ready',        subtitle: 'I just want to confirm and practice' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ReadinessCheckScreen() {
  // Pre-seed with the answer from the previous screen if passed
  const params = useLocalSearchParams<{ readiness?: ReadinessId }>();
  const [selected, setSelected] = useState<ReadinessId | null>(params.readiness ?? null);

  return (
    <View style={styles.root}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.navRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={colors.primary} />
          </Pressable>
          <Text style={styles.stepText}>Step 6 of 10</Text>
          <View style={styles.navSpacer} />
        </View>
        {/* Progress bar: 60% */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '60%' }]}>
            <View style={styles.progressDot} />
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Headline */}
        <Text style={styles.headline}>How ready are you for your exam today?</Text>
        <Text style={styles.subhead}>Be honest. There are no wrong answers here.</Text>

        {/* Cards */}
        {OPTIONS.map(({ id, emoji, title, subtitle }) => {
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
            >
              <Text style={styles.emoji}>{emoji}</Text>
              <View style={styles.cardBody}>
                <View style={styles.cardTitleRow}>
                  <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
                    {title}
                  </Text>
                  {isSelected && (
                    <CheckCircle size={18} color={colors.primary} style={styles.checkIcon} />
                  )}
                </View>
                <Text style={styles.cardSubtitle}>{subtitle}</Text>
              </View>
            </Pressable>
          );
        })}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.footer}>
        <SafeAreaView edges={['bottom']}>
          <Pressable
            onPress={() => selected && router.push('/onboarding_launch/hardest')}
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

  header: { backgroundColor: `${colors.background}CC` },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: 'NunitoSans_700Bold', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.primary },
  navSpacer: { width: 40 },
  progressTrack: { height: 6, backgroundColor: colors.surfaceContainerHigh, marginHorizontal: 0, overflow: 'hidden', marginBottom: 0 },
  progressFill: { height: '100%', backgroundColor: colors.primary, position: 'relative', shadowColor: colors.secondaryFixed, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 8 },
  progressDot: { position: 'absolute', right: 0, top: 0, height: '100%', width: 8, backgroundColor: colors.secondaryFixed },

  scroll: { paddingHorizontal: 24, paddingTop: 24 },
  headline: { fontFamily: 'Outfit_800ExtraBold', fontSize: 32, lineHeight: 40, color: colors.onPrimaryContainer, marginBottom: 10, letterSpacing: -0.5 },
  subhead: { fontFamily: 'NunitoSans_400Regular', fontSize: 15, lineHeight: 22, color: colors.onSurfaceVariant, marginBottom: 28 },

  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerLowest, borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: colors.onSurface, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 16, elevation: 2, borderWidth: 1, borderColor: `${colors.outline}1A` },
  cardSelected: { backgroundColor: colors.surfaceContainerLow, borderColor: `${colors.primary}33`, borderWidth: 2, shadowOpacity: 0.08, shadowRadius: 24, elevation: 4 },
  cardPressed: { transform: [{ scale: 0.98 }] },
  emoji: { fontSize: 30, marginRight: 16 },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 18, color: colors.onSurface },
  cardTitleSelected: { color: colors.primary },
  checkIcon: { marginLeft: 4 },
  cardSubtitle: { fontFamily: 'NunitoSans_400Regular', fontSize: 14, color: colors.onSurfaceVariant },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 16, backgroundColor: `${colors.background}F0`, shadowColor: colors.onSurface, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.08, shadowRadius: 24 },
  ctaWrap: { borderRadius: 16, overflow: 'hidden', shadowColor: colors.blueShadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 16, elevation: 8, marginBottom: 8 },
  ctaDisabled: { shadowOpacity: 0, elevation: 0 },
  cta: { paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16 },
  ctaText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 18, color: colors.onPrimary, letterSpacing: 0.3 },
  ctaTextDisabled: { color: colors.outline },
});
