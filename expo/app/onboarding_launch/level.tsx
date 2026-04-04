/**
 * Onboarding Launch — Screen 03: Level Targeting
 * Source: Stitch screen 0e01812a71bb482c873292b14dbbf57d
 * Step 2 of 10
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react-native';
import { onboardingStore } from './_store';
import Svg, { Circle, Path, G } from 'react-native-svg';
import { colors } from '@/theme';

// ─── Mountain illustration ────────────────────────────────────────────────────

function MountainIllustration() {
  return (
    <Svg width={280} height={160} viewBox="0 0 400 200">
      {/* Far background peaks */}
      <Path d="M0 200 L120 80 L220 200 Z" fill={colors.surfaceContainerHighest} />
      <Path d="M180 200 L280 110 L400 200 Z" fill={colors.surfaceContainerHighest} />
      {/* Midground peak */}
      <Path d="M50 200 L200 40 L350 200 Z" fill={colors.inversePrimary} opacity={0.8} />
      {/* Summit glow */}
      <Circle cx={200} cy={40} r={15} fill={colors.tertiaryFixed} />
      <Path d="M180 40 L200 15 L220 40 Z" fill={colors.tertiaryFixedDim} />
      {/* Climber */}
      <G transform="translate(145, 100)">
        <Circle cx={0} cy={0} r={3} fill={colors.onPrimaryContainer} />
        <Path d="M-2 3 L2 3 L4 10 L-4 10 Z" fill={colors.onPrimaryContainer} />
      </G>
      {/* Dashed path */}
      <Path
        d="M50 200 Q 100 180, 145 105 T 200 40"
        fill="none"
        stroke={colors.background}
        strokeDasharray="4 4"
        strokeWidth={2}
      />
    </Svg>
  );
}

// ─── Level options ────────────────────────────────────────────────────────────

type LevelId = 'A1' | 'A2' | 'B1';

const LEVELS: { id: LevelId; emoji: string; title: string; subtitle: string; popular?: boolean }[] = [
  { id: 'A1', emoji: '🌱', title: 'A1 · Beginner', subtitle: 'Your first step into German' },
  { id: 'A2', emoji: '📗', title: 'A2 · Elementary', subtitle: 'Everyday conversations and basics' },
  { id: 'B1', emoji: '🔥', title: 'B1 · Intermediate', subtitle: 'The most important certification for visas and residency', popular: true },
];

const LOCKED = [
  { emoji: '🔒', title: 'B2 · Upper Intermediate', subtitle: 'Coming Soon' },
  { emoji: '🔒', title: 'C1 · Advanced', subtitle: 'Coming Soon' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LevelScreen() {
  const [selected, setSelected] = useState<LevelId | null>(null);

  return (
    <View style={styles.root}>
      {/* Glass header */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.navRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={colors.onSurfaceVariant} />
          </Pressable>
          <Text style={styles.stepLabel}>2 / 10</Text>
          <View style={styles.navSpacer} />
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '20%' }]}>
            <View style={styles.progressDot} />
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Illustration */}
        <View style={styles.illustrationWrap}>
          <MountainIllustration />
        </View>

        {/* Headline */}
        <Text style={styles.headline}>What level are you targeting?</Text>

        {/* Selectable cards */}
        {LEVELS.map((lvl) => (
          <Pressable
            key={lvl.id}
            onPress={() => setSelected(lvl.id)}
            style={({ pressed }) => [
              styles.card,
              selected === lvl.id && styles.cardSelected,
              pressed && styles.cardPressed,
            ]}
          >
            {lvl.popular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>Most Popular 🔥</Text>
              </View>
            )}
            <Text style={styles.cardEmoji}>{lvl.emoji}</Text>
            <View style={styles.cardBody}>
              <Text style={[styles.cardTitle, selected === lvl.id && styles.cardTitleSelected]}>
                {lvl.title}
              </Text>
              <Text style={styles.cardSubtitle}>{lvl.subtitle}</Text>
            </View>
            {selected === lvl.id && (
              <View style={styles.checkDot}><View style={styles.checkInner} /></View>
            )}
          </Pressable>
        ))}

        {/* Locked cards */}
        {LOCKED.map((lvl) => (
          <View key={lvl.title} style={styles.cardLocked}>
            <Text style={styles.cardEmoji}>🔒</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitleLocked}>{lvl.title}</Text>
              <Text style={styles.cardSubtitleLocked}>{lvl.subtitle}</Text>
            </View>
            <Lock size={18} color={colors.outline} />
          </View>
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.footer}>
        <SafeAreaView edges={['bottom']}>
          <Pressable
            onPress={() => { if (selected) { onboardingStore.level = selected; router.push('/onboarding_launch/empathy'); } }}
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

  header: { backgroundColor: `${colors.background}CC`, borderBottomWidth: 0 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceContainerLow, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontFamily: 'Outfit_800ExtraBold', fontSize: 14, color: colors.onSurface },
  navSpacer: { width: 40 },
  progressTrack: { height: 4, backgroundColor: colors.surfaceContainer, marginHorizontal: 24, borderRadius: 4, marginBottom: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primaryContainer, position: 'relative' },
  progressDot: { position: 'absolute', right: -4, top: '50%', marginTop: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.secondaryFixed, shadowColor: colors.secondaryFixed, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 6 },

  scroll: { paddingHorizontal: 24, paddingTop: 8 },
  illustrationWrap: { alignItems: 'center', marginBottom: 24, height: 160 },
  headline: { fontFamily: 'Outfit_800ExtraBold', fontSize: 30, lineHeight: 38, color: colors.onSurface, marginBottom: 20, letterSpacing: -0.3 },

  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerLowest, borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: `${colors.outlineVariant}1A`, shadowColor: colors.onSurface, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardSelected: { borderColor: `${colors.primary}33`, backgroundColor: colors.surfaceContainerLow, elevation: 4 },
  cardPressed: { transform: [{ scale: 0.98 }] },
  cardLocked: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerLow, borderRadius: 16, padding: 20, marginBottom: 12, opacity: 0.55 },
  popularBadge: { position: 'absolute', top: -12, right: 16, backgroundColor: colors.primaryContainer, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  popularText: { fontFamily: 'NunitoSans_700Bold', fontSize: 10, color: colors.onPrimary, letterSpacing: 0.8, textTransform: 'uppercase' },
  cardEmoji: { fontSize: 26, marginRight: 16 },
  cardBody: { flex: 1 },
  cardTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 16, color: colors.onSurface, marginBottom: 3 },
  cardTitleSelected: { color: colors.primary },
  cardTitleLocked: { fontFamily: 'Outfit_800ExtraBold', fontSize: 16, color: colors.outline, marginBottom: 3 },
  cardSubtitle: { fontFamily: 'NunitoSans_400Regular', fontSize: 13, lineHeight: 18, color: colors.onSurfaceVariant },
  cardSubtitleLocked: { fontFamily: 'NunitoSans_400Regular', fontSize: 13, color: colors.outline },
  checkDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  checkInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.onPrimary },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 16, backgroundColor: `${colors.background}F5` },
  ctaWrap: { borderRadius: 24, overflow: 'hidden', shadowColor: colors.blueShadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 16, elevation: 8, marginBottom: 8 },
  ctaDisabled: { shadowOpacity: 0, elevation: 0 },
  cta: { paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 24 },
  ctaText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 16, color: colors.onPrimary, letterSpacing: 0.3 },
  ctaTextDisabled: { color: colors.outline },
});
