/**
 * Onboarding Launch — Screen 08: Plan Builder Theatre
 * Source: Banani flow FtXTL2Xb5WF4 / screen YzkhS7641TPe
 * Animation: rows reveal top→down staggered, then progress bar fills, then CTA fades in
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import ConfettiBurst, { type ConfettiBurstRef } from '@/components/ConfettiBurst';
import { ScreenLayout } from '@/components/ScreenLayout';
import {
  onboardingStore,
  CERT_SHORT,
  TIMELINE_LABELS,
  DAILY_MINUTES_DISPLAY,
  HardestId,
} from './_store';
import { colors } from '@/theme';

// ─── Timing constants ─────────────────────────────────────────────────────────

const ROW_STAGGER = 380;   // ms between each row appearing
const ROW_DUR     = 340;   // fade+slide duration per row
const PROG_DELAY  = 2100;  // ms after mount when progress section appears
const PROG_DUR    = 2400;  // ms for bar to fill left→right
const CTA_DELAY   = PROG_DELAY + PROG_DUR + 100;

// ─── Label maps ───────────────────────────────────────────────────────────────

const LEVEL_LABEL: Record<string, string> = {
  A1: 'A1 Beginner',
  A2: 'A2 Elementary',
  B1: 'B1 Intermediate',
};

const HARDEST_FULL: Record<HardestId, string> = {
  reading:    'Reading (Lesen)',
  listening:  'Listening (Hören)',
  writing:    'Writing (Schreiben)',
  speaking:   'Speaking (Sprechen)',
  grammar:    'Grammar & Vocabulary',
  everything: 'All sections',
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PlanBuilderScreen() {
  const rowAnims = useRef(
    Array.from({ length: 5 }, () => ({
      opacity:    new Animated.Value(0),
      translateY: new Animated.Value(10),
    }))
  ).current;

  const progressOpacity  = useRef(new Animated.Value(0)).current;
  const progressWidth    = useRef(new Animated.Value(0)).current;
  const buildingOpacity  = useRef(new Animated.Value(0)).current; // fades in with progress, then out
  const ctaOpacity       = useRef(new Animated.Value(0)).current;
  const [done, setDone]  = useState(false);
  const confettiRef      = useRef<ConfettiBurstRef>(null);

  useEffect(() => {
    const rowSeq = rowAnims.map((anim, i) =>
      Animated.parallel([
        Animated.timing(anim.opacity,    { toValue: 1, duration: ROW_DUR, delay: i * ROW_STAGGER, useNativeDriver: true }),
        Animated.timing(anim.translateY, { toValue: 0, duration: ROW_DUR, delay: i * ROW_STAGGER, useNativeDriver: true }),
      ])
    );

    // Row fade-in (staggered)
    rowAnims.forEach((anim, i) => {
      Animated.timing(anim.opacity, { toValue: 1, duration: ROW_DUR, delay: i * ROW_STAGGER, useNativeDriver: true }).start();
      Animated.timing(anim.translateY, { toValue: 0, duration: ROW_DUR, delay: i * ROW_STAGGER, useNativeDriver: true }).start();
    });

    // Progress section fades in
    Animated.timing(progressOpacity, { toValue: 1, duration: 300, delay: PROG_DELAY, useNativeDriver: true }).start();
    // "Building…" fades in then out
    Animated.timing(buildingOpacity, { toValue: 1, duration: 300, delay: PROG_DELAY + 150, useNativeDriver: true }).start();
    Animated.timing(buildingOpacity, { toValue: 0, duration: 300, delay: CTA_DELAY - 200, useNativeDriver: true }).start();
    // CTA + footer fade in
    Animated.timing(ctaOpacity, { toValue: 1, duration: 400, delay: CTA_DELAY, useNativeDriver: true }).start(() => setDone(true));
    // Bar fill uses width (non-native) — must run separately
    Animated.timing(progressWidth, { toValue: 1, duration: PROG_DUR, delay: PROG_DELAY + 300, useNativeDriver: false }).start(() => {
      // Fire confetti from center of the screen when bar completes
      const { width, height } = Dimensions.get('window');
      confettiRef.current?.burst(width / 2, height * 0.45);
    });
  }, []);

  const barWidth = progressWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const { cert, level, timeline, hardest, dailyMinutes } = onboardingStore;

  const rows = [
    { label: 'Your Exam',             value: cert ? `${CERT_SHORT[cert]} ${level ?? ''}`.trim() : '—' },
    { label: 'Your Level',            value: level ? (LEVEL_LABEL[level] ?? level) : '—' },
    { label: 'Your Focus',            value: hardest ? HARDEST_FULL[hardest] : '—' },
    { label: 'Your Timeline',         value: timeline ? TIMELINE_LABELS[timeline] : '—' },
    { label: 'Your Daily Commitment', value: dailyMinutes ? DAILY_MINUTES_DISPLAY[dailyMinutes].label : '—' },
  ];

  const ctaFooter = (
    <Animated.View style={{ opacity: ctaOpacity }}>
      <Text style={styles.footerText}>No one else has a plan exactly like this one.</Text>
      <Pressable
        onPress={() => done && router.push('/onboarding_launch/gap-analysis')}
        style={styles.cta}
        accessibilityRole="button"
        accessibilityLabel="See my plan"
      >
        <Text style={styles.ctaText}>See my plan</Text>
        <ArrowRight size={24} color={colors.primary} />
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={styles.root}>
      {/* Confetti burst — fires when progress bar completes */}
      <ConfettiBurst ref={confettiRef} />

      {/* Decorative orbs */}
      <View style={[styles.orb, styles.orbOne]} />
      <View style={[styles.orb, styles.orbTwo]} />
      <View style={[styles.orb, styles.orbThree]} />

      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScreenLayout
          scrollable={false}
          backgroundColor="transparent"
          footer={ctaFooter}
        >
          {/* Spark dots — top right */}
          <View style={styles.sparkRow}>
            <View style={styles.sparks}>
              <View style={[styles.spark, styles.sparkA]} />
              <View style={[styles.spark, styles.sparkB]} />
              <View style={[styles.spark, styles.sparkC]} />
            </View>
          </View>

          {/* Headline + sub-copy */}
          <Text style={styles.headline}>Your Wordifi plan is ready.</Text>
          <Text style={styles.subCopy}>Built around everything you just told us.</Text>

          {/* Plan card with pill badge */}
          <View style={styles.cardWrap}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Personalised for you ✨</Text>
            </View>

            <View style={styles.card}>
              {rows.map((row, i) => (
                <Animated.View
                  key={row.label}
                  style={[
                    styles.planRow,
                    i === 0 && styles.planRowFirst,
                    i === rows.length - 1 && styles.planRowLast,
                    i < rows.length - 1 && styles.planRowDivider,
                    {
                      opacity:   rowAnims[i].opacity,
                      transform: [{ translateY: rowAnims[i].translateY }],
                    },
                  ]}
                >
                  <Text style={styles.planLabel}>{row.label}</Text>
                  <Text style={styles.planValue}>{row.value}</Text>
                </Animated.View>
              ))}

              {/* Progress section — appears after all rows */}
              <Animated.View style={[styles.progressSection, { opacity: progressOpacity }]}>
                <Animated.Text style={[styles.progressText, { opacity: buildingOpacity }]}>
                  Building your plan...
                </Animated.Text>
                <View style={styles.progressTrack}>
                  <Animated.View style={[styles.progressFill, { width: barWidth }]} />
                </View>
              </Animated.View>
            </View>
          </View>
        </ScreenLayout>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary, overflow: 'hidden' },
  safe: { flex: 1, paddingHorizontal: 24, paddingTop: 28 },

  // ── Decorative orbs ─────────────────────────────────────────────────────────
  orb:      { position: 'absolute', borderRadius: 999 },
  orbOne:   { width: 120, height: 120, backgroundColor: 'rgba(255,255,255,0.12)', top: 84,    right: -28 },
  orbTwo:   { width: 72,  height: 72,  backgroundColor: 'rgba(240,200,8,0.18)',   top: 350,   left: -20  },
  orbThree: { width: 88,  height: 88,  backgroundColor: 'rgba(255,255,255,0.08)', bottom: 118, right: -18 },

  // ── Spark dots ──────────────────────────────────────────────────────────────
  sparkRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 24 },
  sparks:   { flexDirection: 'row', gap: 8, alignItems: 'center' },
  spark:    { borderRadius: 999 },
  sparkA:   { width: 6,  height: 6,  backgroundColor: 'rgba(255,255,255,0.9)'  },
  sparkB:   { width: 10, height: 10, backgroundColor: 'rgba(240,200,8,0.95)'   },
  sparkC:   { width: 5,  height: 5,  backgroundColor: 'rgba(255,255,255,0.7)'  },

  // ── Header ──────────────────────────────────────────────────────────────────
  headline: { fontFamily: 'Outfit_800ExtraBold', fontSize: 40, lineHeight: 42, color: '#FFFFFF', marginBottom: 12, letterSpacing: -1.2 },
  subCopy:  { fontFamily: 'NunitoSans_400Regular', fontSize: 16, lineHeight: 24, color: 'rgba(255,255,255,0.88)', marginBottom: 36, maxWidth: 280 },

  // ── Card + pill ─────────────────────────────────────────────────────────────
  cardWrap: { marginTop: 14 },

  pill: {
    position: 'absolute',
    top: -14,
    right: 16,
    zIndex: 2,
    backgroundColor: '#F0C808',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 6,
  },
  pillText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 12, color: '#374151', letterSpacing: 0.4 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.16,
    shadowRadius: 48,
    elevation: 16,
  },

  // ── Plan rows ────────────────────────────────────────────────────────────────
  planRow:        { paddingVertical: 16, gap: 4 },
  planRowFirst:   { paddingTop: 0 },
  planRowLast:    { paddingBottom: 12 },
  planRowDivider: { borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  planLabel:      { fontFamily: 'Outfit_800ExtraBold', fontSize: 11, color: colors.primary, letterSpacing: 1, textTransform: 'uppercase' },
  planValue:      { fontFamily: 'Outfit_800ExtraBold', fontSize: 20, color: '#374151', lineHeight: 24, letterSpacing: -0.5 },

  // ── Progress section ────────────────────────────────────────────────────────
  progressSection: { paddingTop: 20, marginTop: 4, gap: 12 },
  progressText:    { fontFamily: 'NunitoSans_600SemiBold', fontSize: 14, color: '#94A3B8' },
  progressTrack:   { height: 4, backgroundColor: 'rgba(43,112,239,0.12)', borderRadius: 999, overflow: 'hidden' },
  progressFill:    { position: 'absolute', left: 0, top: 0, height: '100%', backgroundColor: colors.primary, borderRadius: 999 },

  // ── Footer ──────────────────────────────────────────────────────────────────
  footerText: { fontFamily: 'NunitoSans_400Regular', fontSize: 15, color: 'rgba(255,255,255,0.84)', textAlign: 'center', marginBottom: 20 },

  cta: {
    width: '100%',
    height: 64,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 32,
    elevation: 12,
  },
  ctaText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 20, color: colors.primary, letterSpacing: -0.5 },
});
