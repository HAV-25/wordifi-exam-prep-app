/**
 * Onboarding Launch — Screen 08: Plan Builder Theatre
 * Source: Stitch screen 1ebcea0b298142a5a8eb5c2543b8b8b4
 * Custom UX: 3–4s animated progress reveal before showing CTA
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import {
  onboardingStore,
  CERT_SHORT,
  TIMELINE_LABELS,
  HARDEST_DISPLAY,
  DAILY_MINUTES_DISPLAY,
} from './_store';
import { colors } from '@/theme';

const ANIM_DURATION = 3400;

export default function PlanBuilderScreen() {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const buildingOpacity = useRef(new Animated.Value(1)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const [done, setDone] = useState(false);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: ANIM_DURATION,
      useNativeDriver: false,
    }).start(() => {
      Animated.timing(buildingOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      Animated.parallel([
        Animated.timing(ctaOpacity, {
          toValue: 1,
          duration: 400,
          delay: 200,
          useNativeDriver: true,
        }),
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 400,
          delay: 100,
          useNativeDriver: true,
        }),
      ]).start(() => setDone(true));
    });
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const { cert, level, timeline, hardest, dailyMinutes } = onboardingStore;

  const certLabel = cert ? CERT_SHORT[cert] : '—';
  const levelLabel = level ?? '—';
  const timelineLabel = timeline ? TIMELINE_LABELS[timeline] : '—';
  const hardestInfo = hardest ? HARDEST_DISPLAY[hardest] : null;
  const dailyLabel = dailyMinutes ? DAILY_MINUTES_DISPLAY[dailyMinutes].label : '15 minutes';

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* Wordifi W logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logoText}>W</Text>
        </View>

        {/* Headline */}
        <Text style={styles.headline}>Your Wordifi plan{'\n'}is ready.</Text>
        <Text style={styles.subhead}>Built around everything you just told us.</Text>

        {/* Dark summary card */}
        <View style={styles.card}>
          <Text style={styles.cardSectionLabel}>YOUR EXAM PREPARATION</Text>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>YOUR EXAM</Text>
            <Text style={styles.rowValue}>{certLabel} {levelLabel}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>YOUR LEVEL</Text>
            <Text style={styles.rowValue}>{levelLabel}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>YOUR FOCUS</Text>
            <Text style={styles.rowValue}>
              {hardestInfo ? `${hardestInfo.emoji}  ${hardestInfo.label}` : '—'}
            </Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>YOUR TIMELINE</Text>
            <Text style={styles.rowValue}>{timelineLabel}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>DAILY COMMITMENT</Text>
            <Text style={styles.rowValue}>{dailyLabel}</Text>
          </View>

          {/* Animated progress bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
            </View>
            <Animated.Text style={[styles.buildingText, { opacity: buildingOpacity }]}>
              Building your plan...
            </Animated.Text>
          </View>
        </View>

        {/* Tagline — fades in after animation */}
        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
          No one else has a plan exactly like this one.
        </Animated.Text>

        {/* CTA — fades in after animation */}
        <Animated.View style={[styles.ctaWrap, { opacity: ctaOpacity }]}>
          <Pressable
            onPress={() => done && router.push('/onboarding_launch/gap-analysis')}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>See my plan</Text>
            <ArrowRight size={20} color={colors.primary} />
          </Pressable>
        </Animated.View>
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  safe: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },

  logoWrap: { alignItems: 'center', marginBottom: 24 },
  logoText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 32, color: colors.onPrimary },

  headline: { fontFamily: 'Outfit_800ExtraBold', fontSize: 30, lineHeight: 38, color: colors.onPrimary, textAlign: 'center', marginBottom: 8, letterSpacing: -0.3 },
  subhead: { fontFamily: 'NunitoSans_400Regular', fontSize: 13, color: `${colors.onPrimary}B3`, textAlign: 'center', marginBottom: 24 },

  card: {
    backgroundColor: colors.navy,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  cardSectionLabel: {
    fontFamily: 'NunitoSans_700Bold',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.teal,
    marginBottom: 16,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 },
  rowLabel: { fontFamily: 'NunitoSans_700Bold', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: `${colors.onPrimary}70` },
  rowValue: { fontFamily: 'Outfit_800ExtraBold', fontSize: 15, color: colors.onPrimary, flex: 1, textAlign: 'right' },
  divider: { height: 1, backgroundColor: `${colors.onPrimary}12` },

  progressSection: { marginTop: 20, gap: 8 },
  progressTrack: { height: 3, backgroundColor: `${colors.onPrimary}20`, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.teal, borderRadius: 2, shadowColor: colors.teal, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 6 },
  buildingText: { fontFamily: 'NunitoSans_400Regular', fontSize: 12, color: `${colors.onPrimary}60`, textAlign: 'center' },

  tagline: { fontFamily: 'NunitoSans_400Regular', fontSize: 12, color: `${colors.onPrimary}CC`, textAlign: 'center', marginTop: 16, marginBottom: 16 },

  ctaWrap: { borderRadius: 24, overflow: 'hidden', backgroundColor: colors.onPrimary, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  cta: { paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ctaText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 16, color: colors.primary, letterSpacing: 0.3 },
});
