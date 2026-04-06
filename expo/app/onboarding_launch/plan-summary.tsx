/**
 * Onboarding Launch — Screen 14: Plan Summary
 * Source: Banani flow FtXTL2Xb5WF4 / screen WJjigMJcr1Xa
 *
 * Animation sequence:
 *  1. Header + plan card visible immediately (static)
 *  2. Checklist items reveal staggered: checkmark pops in → text slides in from left
 *  3. Emotional close box fades in after all items
 *  4. CTA + social proof fade in last
 *  5. ✦ stars in emotional close pulse infinitely (starts at mount, visible when box fades in)
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowRight, CheckCircle2 } from 'lucide-react-native';
import {
  onboardingStore,
  CERT_SHORT,
  TIMELINE_LABELS,
  DAILY_MINUTES_DISPLAY,
  LEARNER_STYLE_DISPLAY,
  HardestId,
} from './_store';
import { colors } from '@/theme';

// ─── Timing ──────────────────────────────────────────────────────────────────

const ITEM_START = 500;   // ms after mount when first checkmark pops
const ITEM_GAP   = 420;   // ms stagger between items
const CHECK_DUR  = 280;   // checkmark pop+fade duration
const TEXT_DELAY = 140;   // text starts this many ms after its check begins
const TEXT_DUR   = 220;   // text slide+fade duration
// Last item (i=4): starts at 500 + 4*420 = 2180ms, done at ~2180+280+140+220 = 2820ms
const CLOSE_DELAY = 3050;
const CTA_DELAY   = 3450;

// ─── Local label maps ─────────────────────────────────────────────────────────

const HARDEST_FULL: Record<HardestId, string> = {
  reading:    'Reading (Lesen)',
  listening:  'Listening (Hören)',
  writing:    'Writing (Schreiben)',
  speaking:   'Speaking (Sprechen)',
  grammar:    'Grammar & Vocabulary',
  everything: 'All sections',
};

// ─── Checklist data ───────────────────────────────────────────────────────────

const ITEMS: { title: string; sub: string }[] = [
  { title: 'Daily Test Stream',        sub: 'Your weakest sections first, every day' },
  { title: 'Sectional Tests',          sub: 'Hören and Lesen practice twice a week' },
  { title: 'Full Mock Test',           sub: 'One complete simulation before exam day' },
  { title: 'Daily Preparedness Score', sub: 'Always know exactly where you stand' },
  { title: 'Streak System',            sub: '16 minutes a day keeps your score climbing' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PlanSummaryScreen() {
  // One set of animated values per checklist item
  const itemAnims = useRef(
    Array.from({ length: ITEMS.length }, () => ({
      checkOpacity: new Animated.Value(0),
      checkScale:   new Animated.Value(0),
      textOpacity:  new Animated.Value(0),
      textX:        new Animated.Value(-14),
    }))
  ).current;

  const closeOpacity = useRef(new Animated.Value(0)).current;
  const ctaOpacity   = useRef(new Animated.Value(0)).current;
  const starScale    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Build per-item staggered animations
    const itemSeq = itemAnims.map((anim, i) => {
      const d = ITEM_START + i * ITEM_GAP;
      return Animated.parallel([
        // Checkmark: fade in
        Animated.timing(anim.checkOpacity, {
          toValue: 1, duration: CHECK_DUR, delay: d, useNativeDriver: true,
        }),
        // Checkmark: spring pop (overshoot for tactile feel)
        Animated.sequence([
          Animated.delay(d),
          Animated.spring(anim.checkScale, {
            toValue: 1, tension: 240, friction: 6, useNativeDriver: true,
          }),
        ]),
        // Text: fade in (after check)
        Animated.timing(anim.textOpacity, {
          toValue: 1, duration: TEXT_DUR, delay: d + TEXT_DELAY, useNativeDriver: true,
        }),
        // Text: slide in from left
        Animated.timing(anim.textX, {
          toValue: 0, duration: TEXT_DUR, delay: d + TEXT_DELAY, useNativeDriver: true,
        }),
      ]);
    });

    // Run all item anims + close + CTA in parallel (each with own delay)
    Animated.parallel([
      ...itemSeq,
      Animated.timing(closeOpacity, { toValue: 1, duration: 450, delay: CLOSE_DELAY, useNativeDriver: true }),
      Animated.timing(ctaOpacity,   { toValue: 1, duration: 450, delay: CTA_DELAY,   useNativeDriver: true }),
    ]).start();

    // Infinite pulsing stars — starts at mount, visible only when box fades in
    Animated.loop(
      Animated.sequence([
        Animated.timing(starScale, { toValue: 1.45, duration: 900, useNativeDriver: true }),
        Animated.timing(starScale, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ── Data from store ──────────────────────────────────────────────────────────

  const { cert, level, timeline, dailyMinutes, learnerStyle, hardest } = onboardingStore;

  const planRows = [
    { key: 'YOUR EXAM',             val: cert ? `${CERT_SHORT[cert]} ${level ?? ''}`.trim() : (level ?? '—') },
    { key: 'YOUR TIMELINE',         val: timeline ? TIMELINE_LABELS[timeline] : '—' },
    { key: 'YOUR DAILY COMMITMENT', val: dailyMinutes ? DAILY_MINUTES_DISPLAY[dailyMinutes].label : '—' },
    { key: 'YOUR STYLE',            val: learnerStyle ? LEARNER_STYLE_DISPLAY[learnerStyle].title : '—' },
    { key: 'YOUR BIGGEST FOCUS',    val: hardest ? HARDEST_FULL[hardest] : '—' },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Yellow radial glow top-right */}
      <View style={styles.glow} />

      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Header (static) ──────────────────────────────────────────────── */}
          <View style={styles.header}>
            <View style={styles.celebRow}>
              <View style={styles.microBadge}>
                <Text style={styles.microBadgeEmoji}>✨</Text>
                <Text style={styles.microBadgeText}>PERSONALISED FOR YOU</Text>
              </View>
            </View>
            <Text style={styles.headline}>Your personal certification plan is ready.</Text>
            <Text style={styles.subCopy}>
              Built around everything you just told us. This plan exists for one person — you.
            </Text>
          </View>

          {/* ── Plan card (static) ────────────────────────────────────────────── */}
          <View style={styles.planCard}>
            <View style={styles.planCardHeader}>
              <View style={styles.planCardHeading}>
                <Text style={styles.planCardEmoji}>📋</Text>
                <Text style={styles.planCardLabel}>Your Wordifi Plan</Text>
              </View>
              <View style={styles.readyChip}>
                <Text style={styles.readyChipText}>Ready to start</Text>
              </View>
            </View>

            {planRows.map((row, i) => (
              <View
                key={row.key}
                style={[styles.planRow, i === planRows.length - 1 && styles.planRowLast]}
              >
                <Text style={styles.planKey}>{row.key}</Text>
                <Text style={styles.planVal}>{row.val}</Text>
              </View>
            ))}
          </View>

          {/* ── Section header (static) ────────────────────────────────────────── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>What Wordifi will do for you</Text>
            <View style={styles.sectionPill}>
              <Text style={styles.sectionPillText}>5 ways</Text>
            </View>
          </View>

          {/* ── Animated checklist ───────────────────────────────────────────── */}
          <View style={styles.checklist}>
            {ITEMS.map((item, i) => (
              <View key={item.title} style={styles.checkItem}>
                {/* Checkmark: scale-pop + fade */}
                <Animated.View
                  style={[
                    styles.checkIconWrap,
                    {
                      opacity:   itemAnims[i].checkOpacity,
                      transform: [{ scale: itemAnims[i].checkScale }],
                    },
                  ]}
                >
                  <CheckCircle2 size={20} color="#22C55E" />
                </Animated.View>

                {/* Text: slide-in from left + fade */}
                <Animated.Text
                  style={[
                    styles.checkContent,
                    {
                      opacity:   itemAnims[i].textOpacity,
                      transform: [{ translateX: itemAnims[i].textX }],
                    },
                  ]}
                >
                  <Text style={styles.checkTitle}>{item.title}</Text>
                  {` · ${item.sub}`}
                </Animated.Text>
              </View>
            ))}
          </View>

          {/* ── Emotional close — fades in after checklist ──────────────────── */}
          <Animated.View style={[styles.emotionalClose, { opacity: closeOpacity }]}>
            {/* Pulsing ✦ stars */}
            <Animated.Text style={[styles.starTL, { transform: [{ scale: starScale }] }]}>
              ✦
            </Animated.Text>
            <Animated.Text style={[styles.starBR, { transform: [{ scale: starScale }] }]}>
              ✦
            </Animated.Text>

            <Text style={styles.closeText}>
              Learners on this exact plan pass at{' '}
              <Text style={styles.closeHighlight}>3.2x the rate</Text>
              {' '}of those who study without structure.{'\n\n'}
              The only question is — do you start today?
            </Text>
          </Animated.View>

          {/* ── CTA + social proof — fade in last ────────────────────────────── */}
          <Animated.View style={{ opacity: ctaOpacity }}>
            <Pressable
              onPress={() => router.push('/onboarding_launch/trial-transparency')}
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
              accessibilityRole="button"
              accessibilityLabel="Yes — start my plan today"
            >
              <Text style={styles.ctaText}>Yes — start my plan today</Text>
              <ArrowRight size={24} color="#FFFFFF" />
            </Pressable>

            <View style={styles.socialProof}>
              <Text style={styles.stars}>★★★★★</Text>
              <Text style={styles.socialProofText}>4.9/5 User Rating · 12k+ Learners Worldwide</Text>
            </View>
          </Animated.View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },

  // Soft yellow glow top-right
  glow: {
    position: 'absolute',
    top: -90,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#F0C808',
    opacity: 0.10,
  },

  safe:   { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 44, paddingBottom: 32 },

  // ── Header ──────────────────────────────────────────────────────────────────
  header:   { marginBottom: 24 },
  celebRow: { marginBottom: 16 },

  microBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(240,200,8,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(240,200,8,0.28)',
    borderRadius: 999,
  },
  microBadgeEmoji: { fontSize: 14, lineHeight: 17 },
  microBadgeText:  { fontFamily: 'Outfit_800ExtraBold', fontSize: 12, color: '#374151', letterSpacing: 0.6 },

  headline: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 32,
    lineHeight: 35,
    color: '#374151',
    letterSpacing: -0.8,
    marginBottom: 12,
    maxWidth: 320,
  },
  subCopy: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 16,
    lineHeight: 23,
    color: '#94A3B8',
    maxWidth: 312,
  },

  // ── Plan card ────────────────────────────────────────────────────────────────
  planCard: {
    backgroundColor: '#FAFBFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 24,
    marginBottom: 28,
    overflow: 'hidden',
    shadowColor: '#374151',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.08,
    shadowRadius: 44,
    elevation: 8,
  },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: 'rgba(43,112,239,0.03)',
    gap: 12,
  },
  planCardHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planCardEmoji:   { fontSize: 15, lineHeight: 18 },
  planCardLabel: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 12,
    color: colors.primary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  readyChip: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(240,200,8,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(240,200,8,0.30)',
  },
  readyChipText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 11, color: '#374151', letterSpacing: 0.4 },

  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 16,
  },
  planRowLast: { borderBottomWidth: 0 },
  planKey: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 11,
    color: '#94A3B8',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  planVal: {
    fontFamily: 'NunitoSans_700Bold',
    fontSize: 15,
    color: '#374151',
    textAlign: 'right',
    lineHeight: 20,
    flex: 1,
  },

  // ── Section header ──────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  sectionLabel: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 12,
    color: '#94A3B8',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(240,200,8,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(240,200,8,0.28)',
  },
  sectionPillText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 11, color: '#374151', letterSpacing: 0.4 },

  // ── Animated checklist ───────────────────────────────────────────────────────
  checklist: { gap: 14, marginBottom: 28 },

  checkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#374151',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 2,
  },
  checkIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  checkContent: {
    flex: 1,
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: '#94A3B8',
  },
  checkTitle: { fontFamily: 'NunitoSans_700Bold', color: '#374151' },

  // ── Emotional close ──────────────────────────────────────────────────────────
  emotionalClose: {
    backgroundColor: 'rgba(240,200,8,0.11)',
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#374151',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 28,
    elevation: 2,
  },
  // Pulsing ✦ stars — absolutely positioned corners
  starTL: {
    position: 'absolute',
    top: 12,
    left: 14,
    fontSize: 16,
    lineHeight: 20,
    color: 'rgba(160,120,0,0.55)',
  },
  starBR: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    fontSize: 16,
    lineHeight: 20,
    color: 'rgba(160,120,0,0.55)',
  },
  closeText: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: '#374151',
    textAlign: 'center',
    zIndex: 1,
  },
  closeHighlight: { fontFamily: 'Outfit_800ExtraBold' },

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
    marginBottom: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 32,
    elevation: 10,
  },
  ctaPressed: { opacity: 0.88 },
  ctaText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 18, color: '#FFFFFF' },

  // ── Social proof ─────────────────────────────────────────────────────────────
  socialProof:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  stars:           { fontSize: 14, letterSpacing: 2, color: '#F0C808' },
  socialProofText: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 13, color: '#94A3B8', textAlign: 'center' },
});
