/**
 * Onboarding Launch — Screen 14: Refined Plan Summary
 * Source: Stitch screen 8f3973709c054b0fb8fc4056304755e7
 * Final summary before paywall — routes to trial-transparency
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowRight, CheckCircle } from 'lucide-react-native';
import {
  onboardingStore,
  CERT_SHORT,
  TIMELINE_LABELS,
  DAILY_MINUTES_DISPLAY,
  LEARNER_STYLE_DISPLAY,
  HARDEST_DISPLAY,
} from './_store';
import { colors } from '@/theme';

const FEATURES = [
  'Daily Test Stream targeting weakest sections',
  'Sectional Tests for Hören and Lesen twice weekly',
  'Full Mock Test before exam day',
  'Daily Readiness Score tracking',
  'Streak System to keep you consistent',
] as const;

export default function PlanSummaryScreen() {
  const { cert, level, timeline, dailyMinutes, learnerStyle, hardest } = onboardingStore;

  const certLabel = cert ? `${CERT_SHORT[cert]} ${level ?? ''}`.trim() : (level ?? '—');
  const timelineLabel = timeline ? TIMELINE_LABELS[timeline] : '—';
  const dailyLabel = dailyMinutes ? DAILY_MINUTES_DISPLAY[dailyMinutes].label : '15 minutes';
  const styleLabel = learnerStyle ? LEARNER_STYLE_DISPLAY[learnerStyle].title : '—';
  const hardestLabel = hardest ? HARDEST_DISPLAY[hardest].label : '—';

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* Wordifi logo mark */}
        <View style={styles.logoWrap}>
          <LinearGradient
            colors={[colors.primary, colors.primaryContainer]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.logoMark}
          >
            <Text style={styles.logoLetter}>W</Text>
          </LinearGradient>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.headline}>Your personal certification plan is ready.</Text>

          {/* Plan detail card */}
          <View style={styles.planCard}>
            <Text style={styles.cardSectionLabel}>YOUR EXAM PLAN</Text>

            {[
              { label: 'YOUR EXAM',             value: certLabel },
              { label: 'YOUR TIMELINE',          value: timelineLabel },
              { label: 'YOUR DAILY COMMITMENT',  value: dailyLabel },
              { label: 'YOUR STYLE',             value: styleLabel },
              { label: 'YOUR BIGGEST FOCUS',     value: hardestLabel },
            ].map(({ label, value }, i, arr) => (
              <React.Fragment key={label}>
                <View style={styles.planRow}>
                  <Text style={styles.planLabel}>{label}</Text>
                  <Text style={styles.planValue}>{value}</Text>
                </View>
                {i < arr.length - 1 && <View style={styles.planDivider} />}
              </React.Fragment>
            ))}
          </View>

          {/* Features */}
          <View style={styles.featuresCard}>
            <Text style={styles.featuresTitle}>What's included</Text>
            {FEATURES.map((f) => (
              <View key={f} style={styles.featureRow}>
                <CheckCircle size={16} color={colors.primary} />
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>

          {/* Social proof */}
          <View style={styles.socialProof}>
            <View style={styles.socialStat}>
              <Text style={styles.socialStatValue}>3.2x</Text>
              <Text style={styles.socialStatLabel}>pass rate on this plan</Text>
            </View>
            <View style={styles.socialDivider} />
            <View style={styles.socialStat}>
              <Text style={styles.socialStatValue}>4.9★</Text>
              <Text style={styles.socialStatLabel}>average rating</Text>
            </View>
            <View style={styles.socialDivider} />
            <View style={styles.socialStat}>
              <Text style={styles.socialStatValue}>12K+</Text>
              <Text style={styles.socialStatLabel}>learners worldwide</Text>
            </View>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Sticky CTA */}
        <View style={styles.footer}>
          <SafeAreaView edges={['bottom']}>
            <Pressable
              onPress={() => router.push('/onboarding_launch/trial-transparency')}
              style={styles.ctaWrap}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryContainer]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                <Text style={styles.ctaText}>Yes — start my plan today</Text>
                <ArrowRight size={20} color={colors.onPrimary} />
              </LinearGradient>
            </Pressable>
            <Text style={styles.cancelNote}>Cancel anytime within 72 hours · No charge today</Text>
          </SafeAreaView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },

  logoWrap: { alignItems: 'center', paddingTop: 20, paddingBottom: 0 },
  logoMark: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { fontFamily: 'Outfit_800ExtraBold', fontSize: 22, color: colors.onPrimary },

  scroll: { paddingHorizontal: 24, paddingTop: 16 },
  headline: { fontFamily: 'Outfit_800ExtraBold', fontSize: 24, lineHeight: 32, color: colors.onPrimaryContainer, textAlign: 'center', marginBottom: 20, letterSpacing: -0.3 },

  planCard: { backgroundColor: colors.navy, borderRadius: 20, padding: 20, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  cardSectionLabel: { fontFamily: 'NunitoSans_700Bold', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: colors.teal, marginBottom: 14 },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  planLabel: { fontFamily: 'NunitoSans_700Bold', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: `${colors.onPrimary}70` },
  planValue: { fontFamily: 'Outfit_800ExtraBold', fontSize: 14, color: colors.onPrimary, flex: 1, textAlign: 'right' },
  planDivider: { height: 1, backgroundColor: `${colors.onPrimary}12` },

  featuresCard: { backgroundColor: colors.surfaceContainerLow, borderRadius: 16, padding: 16, marginBottom: 14, gap: 10 },
  featuresTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 14, color: colors.onSurface, marginBottom: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  featureText: { fontFamily: 'NunitoSans_400Regular', fontSize: 13, lineHeight: 19, color: colors.onSurfaceVariant, flex: 1 },

  socialProof: { flexDirection: 'row', backgroundColor: `${colors.primary}08`, borderRadius: 14, padding: 16, alignItems: 'center' },
  socialStat: { flex: 1, alignItems: 'center' },
  socialStatValue: { fontFamily: 'Outfit_800ExtraBold', fontSize: 20, color: colors.primary, marginBottom: 2 },
  socialStatLabel: { fontFamily: 'NunitoSans_400Regular', fontSize: 10, color: colors.onSurfaceVariant, textAlign: 'center' },
  socialDivider: { width: 1, height: 32, backgroundColor: colors.outlineVariant, opacity: 0.5 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 16, backgroundColor: `${colors.background}F5` },
  ctaWrap: { borderRadius: 24, overflow: 'hidden', shadowColor: colors.blueShadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 16, elevation: 8, marginBottom: 8 },
  cta: { paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 24 },
  ctaText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 16, color: colors.onPrimary, letterSpacing: 0.3 },
  cancelNote: { fontFamily: 'NunitoSans_400Regular', fontSize: 11, color: colors.outline, textAlign: 'center', marginBottom: 8 },
});
