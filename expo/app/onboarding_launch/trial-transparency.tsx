/**
 * Onboarding Launch — Screen 15: Trial Transparency
 * Source: Banani flow FtXTL2Xb5WF4 / screen BBnD7fk7CKFS
 *
 * Dot animation: each step dot starts grey → turns blue when its step is
 * "active" → turns green when complete, then the next dot turns blue.
 * Sequence: grey→blue→green for dot1, then dot2, then dot3 stays blue.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { colors } from '@/theme';
import { ScreenLayout } from '@/components/ScreenLayout';
import { GlowOrb } from '@/components/GlowOrb';

// ─── Data ─────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    label: 'Step 1 · Right Now',
    highlight: 'Full plan unlocks immediately.',
    body: 'You pay nothing today.',
  },
  {
    label: 'Step 2 · Next 72 Hours',
    highlight: 'Practice daily.',
    body: 'Still completely free.',
  },
  {
    label: 'Step 3 · After 72 Hours',
    highlight: 'Only then will you be charged.',
    body: 'You will receive a reminder before your trial ends. Cancel anytime within 72 hours and you will never be charged.',
  },
] as const;

const TRUST_ITEMS = [
  { emoji: '🔒', text: 'Cancel anytime — one tap, no questions asked' },
  { emoji: '📧', text: 'Reminder sent before trial ends' },
  { emoji: '⭐', text: '4.8 stars — thousands trust Wordifi' },
] as const;

// ─── Dot color interpolation ──────────────────────────────────────────────────
// Animated.Value: 0 = grey, 1 = blue, 2 = green

const DOT_COLORS = {
  inputRange:  [0, 1, 2],
  outputRange: ['#CBD5E1', '#2B70EF', '#22C55E'],
};

// Timing: each phase (grey→blue, blue→green) takes 400ms with 400ms hold
// Dot 1: blue at 400ms, green at 1200ms
// Dot 2: blue at 1600ms, green at 2400ms
// Dot 3: blue at 2800ms (stays blue)
const DOT_TRANSITION = 400;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TrialTransparencyScreen() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      // Dot 1: grey → blue → green
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(dot1, { toValue: 1, duration: DOT_TRANSITION, useNativeDriver: false }),
        Animated.delay(400),
        Animated.timing(dot1, { toValue: 2, duration: DOT_TRANSITION, useNativeDriver: false }),
      ]),
      // Dot 2: grey → blue → green (starts when dot1 turns green)
      Animated.sequence([
        Animated.delay(1600),
        Animated.timing(dot2, { toValue: 1, duration: DOT_TRANSITION, useNativeDriver: false }),
        Animated.delay(400),
        Animated.timing(dot2, { toValue: 2, duration: DOT_TRANSITION, useNativeDriver: false }),
      ]),
      // Dot 3: grey → blue (stays blue — the "current" future step)
      Animated.sequence([
        Animated.delay(2800),
        Animated.timing(dot3, { toValue: 1, duration: DOT_TRANSITION, useNativeDriver: false }),
      ]),
    ]).start();
  }, []);

  const dot1Color = dot1.interpolate(DOT_COLORS);
  const dot2Color = dot2.interpolate(DOT_COLORS);
  const dot3Color = dot3.interpolate(DOT_COLORS);
  const dotColors = [dot1Color, dot2Color, dot3Color];

  const ctaFooter = (
    <Pressable
      onPress={() => router.push('/onboarding_launch/paywall')}
      style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
      accessibilityRole="button"
      accessibilityLabel="I understand — show me my plan"
    >
      <Text style={styles.ctaText}>I understand — show me my plan</Text>
      <ArrowRight size={24} color="#FFFFFF" />
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <GlowOrb top={-100} right={-100} />

      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScreenLayout footer={ctaFooter} contentContainerStyle={styles.scroll} backgroundColor={colors.background}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headline}>Here is exactly what happens next.</Text>
            <Text style={styles.subCopy}>No surprises. No hidden charges. Just complete transparency.</Text>
          </View>

          {/* Timeline */}
          <View style={styles.timeline}>
            {STEPS.map((step, i) => (
              <View key={step.label} style={styles.stepNode}>
                {/* Left column: dot + connector */}
                <View style={styles.leftCol}>
                  <Animated.View style={[styles.dot, { backgroundColor: dotColors[i] }]} />
                  {i < STEPS.length - 1 && <View style={styles.connector} />}
                </View>

                {/* Step content */}
                <View style={styles.stepContent}>
                  <Text style={styles.stepLabel}>{step.label}</Text>
                  <Text style={styles.stepDesc}>
                    <Text style={styles.stepHighlight}>{step.highlight}</Text>
                    {step.body ? ` ${step.body}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Trust stack */}
          <View style={styles.trustCard}>
            {TRUST_ITEMS.map(({ emoji, text }) => (
              <View key={text} style={styles.trustRow}>
                <Text style={styles.trustEmoji}>{emoji}</Text>
                <Text style={styles.trustText}>{text}</Text>
              </View>
            ))}
          </View>

          {/* Warm close */}
          <Text style={styles.warmClose}>
            We are confident that by the end of your trial you will not want to leave. But the choice is always yours.
          </Text>

        </ScreenLayout>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },

  safe:   { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 44 },

  // ── Header ──────────────────────────────────────────────────────────────────
  header:  { marginBottom: 36 },
  headline: { fontFamily: 'Outfit_800ExtraBold', fontSize: 32, lineHeight: 35, color: '#374151', letterSpacing: -0.8, marginBottom: 12, maxWidth: 320 },
  subCopy:  { fontFamily: 'NunitoSans_400Regular', fontSize: 16, lineHeight: 23, color: '#94A3B8', maxWidth: 312 },

  // ── Timeline ─────────────────────────────────────────────────────────────────
  timeline: { marginBottom: 36 },

  stepNode:    { flexDirection: 'row', gap: 16, marginBottom: 0 },
  leftCol:     { alignItems: 'center', width: 20 },

  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: colors.background, // white border punches it out of connector line
    flexShrink: 0,
  },
  connector: {
    width: 2,
    flex: 1,
    backgroundColor: 'rgba(43,112,239,0.12)',
    borderRadius: 2,
    marginTop: 4,
    marginBottom: -4, // bridge gap to next node
    minHeight: 32,
  },

  stepContent: { flex: 1, paddingBottom: 32 },
  stepLabel:   { fontFamily: 'Outfit_800ExtraBold', fontSize: 11, color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  stepDesc:    { fontFamily: 'NunitoSans_400Regular', fontSize: 15, lineHeight: 22, color: '#374151' },
  stepHighlight: { fontFamily: 'NunitoSans_700Bold' },

  // ── Trust stack ─────────────────────────────────────────────────────────────
  trustCard: {
    backgroundColor: 'rgba(255,255,255,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.60)',
    borderRadius: 20,
    padding: 20,
    gap: 16,
    marginBottom: 'auto' as any,
    marginBottom: 32,
  },
  trustRow:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  trustEmoji: { fontSize: 18, lineHeight: 22 },
  trustText: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 14, color: '#374151', lineHeight: 18, flex: 1 },

  // ── Warm close ───────────────────────────────────────────────────────────────
  warmClose: { fontFamily: 'NunitoSans_400Regular', fontSize: 14, lineHeight: 21, color: '#94A3B8', textAlign: 'center', paddingHorizontal: 12, marginBottom: 20 },

  // ── CTA ──────────────────────────────────────────────────────────────────────
  cta: {
    width: '100%',
    height: 60,
    backgroundColor: colors.primary,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 32,
    elevation: 10,
  },
  ctaPressed: { opacity: 0.88 },
  ctaText:    { fontFamily: 'Outfit_800ExtraBold', fontSize: 16, color: '#FFFFFF', letterSpacing: -0.2 },
});
