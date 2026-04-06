/**
 * Onboarding Launch — Screen 01: Splash
 * Source: Stitch project 17418085725444489838 / screen ef4075340603499ba4cb9ff9f86555a9
 * Version: 1.0
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Circle, Path, Rect, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colors } from '@/theme';

// ─── Door arch illustration ───────────────────────────────────────────────────

function DoorIllustration() {
  return (
    <Svg width={180} height={220} viewBox="0 0 180 220">
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={colors.tertiaryFixed} stopOpacity="0.4" />
          <Stop offset="100%" stopColor={colors.tertiaryFixed} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Ambient glow behind arch */}
      <Circle cx="90" cy="100" r="90" fill="url(#glow)" />

      {/* Outer frame */}
      <Path
        d="M28,210 L28,100 Q28,30 90,30 Q152,30 152,100 L152,210 Z"
        fill={colors.tertiary}
        opacity={0.9}
      />
      {/* Inner door fill — lighter gold */}
      <Path
        d="M40,210 L40,104 Q40,46 90,46 Q140,46 140,104 L140,210 Z"
        fill={colors.tertiaryContainer}
      />
      {/* Inner glow — bright centre */}
      <Path
        d="M52,210 L52,108 Q52,62 90,62 Q128,62 128,108 L128,210 Z"
        fill={colors.tertiaryFixed}
        opacity={0.5}
      />
      {/* Door handle */}
      <Circle cx={118} cy={148} r={7} fill={colors.tertiary} />
      <Circle cx={118} cy={148} r={4} fill={colors.tertiaryFixed} />

      {/* Step / base plinth */}
      <Rect x={8} y={208} width={164} height={8} rx={4} fill={colors.tertiary} opacity={0.6} />
      <Rect x={0} y={214} width={180} height={6} rx={3} fill={colors.tertiary} opacity={0.35} />
    </Svg>
  );
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipValue}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SplashOnboarding() {
  const heroFade = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(40)).current;
  const cardFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(heroFade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(cardSlide, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(cardFade, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={styles.root}>
      {/* ── Hero — blue gradient ── */}
      <LinearGradient
        colors={[colors.primary, colors.primaryContainer]}
        angle={150}
        useAngle
        style={styles.hero}
      >
        <SafeAreaView edges={['top']} style={styles.heroSafe}>
          <Animated.View style={[styles.illustrationWrap, { opacity: heroFade }]}>
            <DoorIllustration />
          </Animated.View>
          <Text style={styles.certRow}>Goethe · TELC · ÖSD</Text>
        </SafeAreaView>
      </LinearGradient>

      {/* ── Bottom content card ── */}
      <Animated.View
        style={[
          styles.card,
          { opacity: cardFade, transform: [{ translateY: cardSlide }] },
        ]}
      >
        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatChip value="50K+" label="LEARNERS" />
          <View style={styles.statDivider} />
          <StatChip value="A1–C1" label="ALL LEVELS" />
          <View style={styles.statDivider} />
          <StatChip value="4.8 ★" label="RATING" />
        </View>

        {/* Headline */}
        <Text style={styles.headline}>
          One app.{'\n'}One mission.{'\n'}You pass.
        </Text>

        {/* Body */}
        <Text style={styles.body}>
          Real readiness — built exclusively for German certification.
        </Text>

        {/* CTA */}
        <Pressable
          onPress={() => router.push('/onboarding_launch/cert')}
          style={({ pressed }) => [styles.ctaWrap, pressed && styles.ctaPressed]}
          accessibilityRole="button"
          accessibilityLabel="Start my plan"
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryContainer]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>Start my plan →</Text>
          </LinearGradient>
        </Pressable>

        {/* Returning user link */}
        <Pressable
          onPress={() => { router.dismissAll(); router.replace('/auth'); }}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
          style={styles.signInLink}
        >
          <Text style={styles.signInText}>
            Already a user?{' '}
            <Text style={styles.signInLinkText}>Jump straight in</Text>
          </Text>
        </Pressable>

        <SafeAreaView edges={['bottom']} />
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Hero
  hero: {
    flex: 1,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroSafe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 24,
  },
  illustrationWrap: {
    marginBottom: 20,
  },
  certRow: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
  },

  // Card
  card: {
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 8,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
  },
  chipValue: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 18,
    color: colors.onSurface,
    lineHeight: 22,
  },
  chipLabel: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.outlineVariant,
    opacity: 0.5,
  },

  // Text
  headline: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 34,
    lineHeight: 42,
    color: colors.onSurface,
    marginBottom: 10,
  },
  body: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: colors.onSurfaceVariant,
    marginBottom: 28,
  },

  // CTA
  ctaWrap: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: colors.blueShadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 12,
  },
  ctaPressed: {
    opacity: 0.88,
  },
  cta: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderRadius: 24,
  },
  ctaText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 16,
    color: colors.onPrimary,
    letterSpacing: 0.3,
  },
  signInLink: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  signInText: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  signInLinkText: {
    fontFamily: 'NunitoSans_700Bold',
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
