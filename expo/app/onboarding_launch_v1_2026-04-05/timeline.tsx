/**
 * Onboarding Launch — Screen 04: Timeline Question
 * Step 4 of 10 — "How long until your exam date?"
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import Svg, { Path, Ellipse, Line, Circle } from 'react-native-svg';
import { onboardingStore, TimelineId } from './_store';
import { colors } from '@/theme';

// ─── Hourglass illustration ───────────────────────────────────────────────────

function HourglassIllustration() {
  return (
    <Svg width={120} height={150} viewBox="0 0 120 150">
      {/* Top bulb */}
      <Path
        d="M20 10 Q20 55 60 75 Q100 55 100 10 Z"
        fill={colors.primaryContainer}
        opacity={0.9}
      />
      {/* Bottom bulb */}
      <Path
        d="M20 140 Q20 95 60 75 Q100 95 100 140 Z"
        fill={colors.primary}
        opacity={0.85}
      />
      {/* Frame top */}
      <Line x1="12" y1="8" x2="108" y2="8" stroke={colors.onPrimaryContainer} strokeWidth={6} strokeLinecap="round" />
      {/* Frame bottom */}
      <Line x1="12" y1="142" x2="108" y2="142" stroke={colors.onPrimaryContainer} strokeWidth={6} strokeLinecap="round" />
      {/* Sand drip */}
      <Path
        d="M57 75 Q60 85 60 95"
        fill="none"
        stroke={colors.tertiaryFixed}
        strokeWidth={3}
        strokeLinecap="round"
      />
      {/* Sand pile in bottom */}
      <Ellipse cx={60} cy={128} rx={22} ry={8} fill={colors.tertiaryFixed} opacity={0.7} />
      {/* Sand in top (partially drained) */}
      <Path
        d="M28 14 Q28 40 60 62 Q92 40 92 14 Z"
        fill={colors.secondaryFixed}
        opacity={0.5}
      />
      {/* Neck dots */}
      <Circle cx={60} cy={75} r={3} fill={colors.tertiaryFixed} />
    </Svg>
  );
}

// ─── Timeline options ─────────────────────────────────────────────────────────

const OPTIONS: { id: TimelineId; emoji: string; title: string; subtitle: string }[] = [
  { id: 'lt4w',   emoji: '⚡', title: 'Less than 4 weeks',    subtitle: 'I need to prepare fast' },
  { id: '1to3m',  emoji: '🔥', title: '1 to 3 months',        subtitle: 'I have some time to build momentum' },
  { id: '3to6m',  emoji: '📅', title: '3 to 6 months',        subtitle: 'I can go deep and practice everything' },
  { id: 'gt6m',   emoji: '🗓️', title: 'More than 6 months',  subtitle: 'I want to build a strong foundation' },
  { id: 'none',   emoji: '❓', title: 'No exam date set yet', subtitle: "I'll figure out my timeline later" },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TimelineScreen() {
  const [selected, setSelected] = useState<TimelineId | null>(null);

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
              <View style={[styles.progressFill, { width: '40%' }]}>
                <View style={styles.progressDot} />
              </View>
            </View>
            <Text style={styles.stepLabel}>Step 4 of 10</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Illustration */}
        <View style={styles.illustrationWrap}>
          <HourglassIllustration />
        </View>

        {/* Headline */}
        <Text style={styles.headline}>How long until your exam date?</Text>
        <Text style={styles.subhead}>Every window is the right window.{'\n'}What matters is starting today.</Text>

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
            onPress={() => { if (selected) { onboardingStore.timeline = selected; router.push('/onboarding_launch/readiness'); } }}
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

  scroll: { paddingHorizontal: 24, paddingTop: 16 },
  illustrationWrap: { alignItems: 'center', marginBottom: 20 },
  headline: { fontFamily: 'Outfit_800ExtraBold', fontSize: 28, lineHeight: 36, color: colors.onPrimaryContainer, marginBottom: 10, letterSpacing: -0.3 },
  subhead: { fontFamily: 'NunitoSans_400Regular', fontSize: 15, lineHeight: 22, color: colors.onSurfaceVariant, marginBottom: 24 },

  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerLowest, borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: `${colors.outlineVariant}1A`, shadowColor: colors.onSurface, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardSelected: { borderColor: `${colors.primary}33`, backgroundColor: colors.surfaceContainerLow, elevation: 4 },
  cardPressed: { transform: [{ scale: 0.98 }] },
  emoji: { fontSize: 26, marginRight: 16, width: 32, textAlign: 'center' },
  cardBody: { flex: 1 },
  cardTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 15, color: colors.onSurface, marginBottom: 3 },
  cardTitleSelected: { color: colors.primary },
  cardSubtitle: { fontFamily: 'NunitoSans_400Regular', fontSize: 12, lineHeight: 17, color: colors.onSurfaceVariant },
  checkDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  checkInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.onPrimary },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 16, backgroundColor: `${colors.background}F5` },
  ctaWrap: { borderRadius: 24, overflow: 'hidden', shadowColor: colors.blueShadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 16, elevation: 8, marginBottom: 8 },
  ctaDisabled: { shadowOpacity: 0, elevation: 0 },
  cta: { paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 24 },
  ctaText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 16, color: colors.onPrimary, letterSpacing: 0.3 },
  ctaTextDisabled: { color: colors.outline },
});
