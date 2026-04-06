/**
 * Onboarding Launch — Screen 04 (canvas 05): Empathy Question
 * Source: Stitch screen 019828c8d4094fb691681d6f8dd02005
 * Step 3 of 10 — "This exam matters. Tell us why."
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { onboardingStore } from './_store';
import {
  ArrowLeft, ArrowRight,
  CreditCard, Briefcase, GraduationCap,
  MapPin, Users, TrendingUp,
} from 'lucide-react-native';
import { colors } from '@/theme';

// ─── Reason options ───────────────────────────────────────────────────────────

type ReasonId = 'visa' | 'work' | 'university' | 'settlement' | 'family' | 'personal';

const REASONS: {
  id: ReasonId;
  Icon: React.FC<{ size: number; color: string }>;
  title: string;
  subtitle: string;
}[] = [
  { id: 'visa',       Icon: CreditCard,     title: 'Visa or residency permit',  subtitle: 'I need this to live or stay in Germany, Austria or Switzerland' },
  { id: 'work',       Icon: Briefcase,      title: 'Work or career',             subtitle: 'My job or a new job requires it' },
  { id: 'university', Icon: GraduationCap,  title: 'University admission',       subtitle: 'I need it to study in a German-speaking country' },
  { id: 'settlement', Icon: MapPin,         title: 'Permanent settlement',       subtitle: 'I am applying for permanent residency or citizenship' },
  { id: 'family',     Icon: Users,          title: 'Family reunion',             subtitle: 'I need it to join my family in a German-speaking country' },
  { id: 'personal',   Icon: TrendingUp,     title: 'Personal goal',              subtitle: 'I want to prove my German level to myself' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EmpathyScreen() {
  const [selected, setSelected] = useState<ReasonId | null>(null);

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
              <View style={[styles.progressFill, { width: '30%' }]}>
                <View style={styles.progressDot} />
              </View>
            </View>
            <Text style={styles.stepLabel}>3 / 10</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Headline */}
        <Text style={styles.headline}>This exam matters.{'\n'}Tell us why.</Text>

        {/* Cards */}
        {REASONS.map(({ id, Icon, title, subtitle }) => (
          <Pressable
            key={id}
            onPress={() => setSelected(id)}
            style={({ pressed }) => [
              styles.card,
              selected === id && styles.cardSelected,
              pressed && styles.cardPressed,
            ]}
          >
            <View style={[styles.iconWrap, selected === id && styles.iconWrapSelected]}>
              <Icon size={22} color={selected === id ? colors.onPrimary : colors.primary} />
            </View>
            <View style={styles.cardBody}>
              <Text style={[styles.cardTitle, selected === id && styles.cardTitleSelected]}>
                {title}
              </Text>
              <Text style={styles.cardSubtitle}>{subtitle}</Text>
            </View>
          </Pressable>
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.footer}>
        <SafeAreaView edges={['bottom']}>
          <Pressable
            onPress={() => { if (selected) { onboardingStore.readiness = null; router.push('/onboarding_launch/timeline'); } }}
            disabled={!selected}
            style={[styles.ctaWrap, !selected && styles.ctaDisabled]}
          >
            <LinearGradient
              colors={selected ? [colors.primary, colors.primaryContainer] : [colors.surfaceContainerHigh, colors.surfaceContainerHigh]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              <Text style={[styles.ctaText, !selected && styles.ctaTextDisabled]}>Continue →</Text>
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
  progressFill: { height: '100%', backgroundColor: colors.primary, position: 'relative', shadowColor: colors.secondaryFixed, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8 },
  progressDot: { position: 'absolute', right: 0, top: 0, height: '100%', width: 8, backgroundColor: colors.secondaryFixed },
  stepLabel: { fontFamily: 'NunitoSans_700Bold', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.onSurfaceVariant },

  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },
  headline: { fontFamily: 'Outfit_800ExtraBold', fontSize: 30, lineHeight: 38, color: colors.onPrimaryContainer, textAlign: 'center', marginBottom: 28, letterSpacing: -0.3 },

  card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surfaceContainerLowest, borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: `${colors.outlineVariant}1A`, shadowColor: colors.onSurface, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardSelected: { borderColor: `${colors.primary}33`, backgroundColor: colors.surfaceContainerLow, elevation: 4 },
  cardPressed: { transform: [{ scale: 0.98 }] },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center', marginRight: 16, marginTop: 2 },
  iconWrapSelected: { backgroundColor: colors.primary },
  cardBody: { flex: 1 },
  cardTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 15, color: colors.onSurface, marginBottom: 4 },
  cardTitleSelected: { color: colors.primary },
  cardSubtitle: { fontFamily: 'NunitoSans_400Regular', fontSize: 13, lineHeight: 18, color: colors.onSurfaceVariant },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 16, backgroundColor: `${colors.surfaceContainerLowest}CC` },
  ctaWrap: { borderRadius: 24, overflow: 'hidden', shadowColor: colors.blueShadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 16, elevation: 8, marginBottom: 8 },
  ctaDisabled: { shadowOpacity: 0, elevation: 0 },
  cta: { paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 24 },
  ctaText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 16, color: colors.onPrimary, letterSpacing: 0.3 },
  ctaTextDisabled: { color: colors.outline },
});
