/**
 * Onboarding Launch — Screen 16: Paywall
 * Source: Banani flow FtXTL2Xb5WF4
 *
 * Animation sequence:
 *  1. Header + offer card visible immediately (static)
 *  2. Checklist items reveal staggered: checkmark pops in → text slides in from left
 *  3. Review cards fade in after all items complete
 *  4. Sticky footer CTA always visible
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CheckCircle2, ArrowRight } from 'lucide-react-native';
import { colors } from '@/theme';
import { ScreenLayout } from '@/components/ScreenLayout';
import { savePendingOnboarding } from '@/lib/profileHelpers';
import { onboardingStore, onboardingSessionNonce } from './_store';

// ─── Timing ──────────────────────────────────────────────────────────────────

const ITEM_START = 400;   // ms after mount when first checkmark pops
const ITEM_GAP   = 300;   // ms stagger between items (slightly tighter for 7 items)
const CHECK_DUR  = 280;
const TEXT_DELAY = 140;
const TEXT_DUR   = 220;
// Last item (i=6): starts at 400 + 6*300 = 2200ms, done at ~2200+280+140+220 = 2840ms
const REVIEWS_DELAY = 3000;

// ─── Data ─────────────────────────────────────────────────────────────────────

const ITEMS = [
  { title: 'Daily Test Stream',         sub: 'Adaptive questions targeting your weak spots' },
  { title: 'Sectional Tests',           sub: 'Full Hören, Lesen & Schreiben practice sets' },
  { title: 'Full Mock Tests',           sub: 'Exam-day simulations with official timing' },
  { title: 'Daily Preparedness Score',  sub: 'Always know exactly where you stand' },
  { title: 'Streak System',             sub: 'Stay consistent — streaks accelerate progress' },
  { title: 'Instant AI Feedback',       sub: 'Explanations on every mistake, right away' },
  { title: 'Exam Countdown',            sub: 'Smart reminders so you never lose momentum' },
] as const;

const REVIEWS = [
  {
    name: 'Priya S.',
    flag: '🇮🇳',
    text: '"I passed B2 on my first attempt. The daily score kept me hooked."',
    cert: 'Goethe B2',
  },
  {
    name: 'Yusuf K.',
    flag: '🇹🇷',
    text: '"The mock tests felt exactly like the real exam. No surprises on the day."',
    cert: 'ÖSD B1',
  },
] as const;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PaywallScreen() {
  const itemAnims = useRef(
    Array.from({ length: ITEMS.length }, () => ({
      checkOpacity: new Animated.Value(0),
      checkScale:   new Animated.Value(0),
      textOpacity:  new Animated.Value(0),
      textX:        new Animated.Value(-14),
    }))
  ).current;

  const reviewsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const itemSeq = itemAnims.map((anim, i) => {
      const d = ITEM_START + i * ITEM_GAP;
      return Animated.parallel([
        Animated.timing(anim.checkOpacity, {
          toValue: 1, duration: CHECK_DUR, delay: d, useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(d),
          Animated.spring(anim.checkScale, {
            toValue: 1, tension: 240, friction: 6, useNativeDriver: true,
          }),
        ]),
        Animated.timing(anim.textOpacity, {
          toValue: 1, duration: TEXT_DUR, delay: d + TEXT_DELAY, useNativeDriver: true,
        }),
        Animated.timing(anim.textX, {
          toValue: 0, duration: TEXT_DUR, delay: d + TEXT_DELAY, useNativeDriver: true,
        }),
      ]);
    });

    Animated.parallel([
      ...itemSeq,
      Animated.timing(reviewsOpacity, {
        toValue: 1, duration: 480, delay: REVIEWS_DELAY, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const ctaFooter = (
    <>
      <Text style={styles.trustLine}>
        🔒  No charge today · Cancel anytime · Reminder before trial ends
      </Text>

      <Pressable
        onPress={async () => {
          await savePendingOnboarding(onboardingStore, onboardingSessionNonce);
          router.dismissAll();
          router.replace('/auth');
        }}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        accessibilityRole="button"
        accessibilityLabel="Start my free trial — 72 hours free"
      >
        <Text style={styles.ctaText}>Start my free trial — 72 hours free</Text>
        <ArrowRight size={22} color="#FFFFFF" />
      </Pressable>

      <Pressable
        onPress={async () => {
          await savePendingOnboarding(onboardingStore, onboardingSessionNonce);
          router.replace('/auth');
        }}
        style={styles.secondary}
        accessibilityRole="button"
        accessibilityLabel="Continue with 5 free questions per day"
      >
        <Text style={styles.secondaryText}>Continue with 5 free questions per day</Text>
      </Pressable>
    </>
  );

  return (
    <View style={styles.root}>
      {/* Yellow glow top-right */}
      <View style={styles.glow} />

      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScreenLayout
          backgroundColor="transparent"
          footer={ctaFooter}
          contentContainerStyle={styles.scroll}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headline}>Everything your plan needs.{'\n'}Unlocked.</Text>
            <Text style={styles.subCopy}>
              Start your 72-hour free trial today. Your Preparedness Score is waiting to climb.
            </Text>
          </View>

          {/* Offer card */}
          <View style={styles.offerCard}>
            <View style={styles.offerCardTop}>
              <View style={styles.offerBadge}>
                <Text style={styles.offerBadgeText}>✨ Wordifi Pro</Text>
              </View>
              <View style={styles.trialChip}>
                <Text style={styles.trialChipText}>72 hrs FREE</Text>
              </View>
            </View>
            <Text style={styles.priceText}>72 hours free</Text>
            <Text style={styles.priceAfter}>then €14.99 / month — cancel anytime</Text>
          </View>

          {/* Section label */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>What you unlock today</Text>
            <View style={styles.sectionPill}>
              <Text style={styles.sectionPillText}>7 features</Text>
            </View>
          </View>

          {/* Animated checklist */}
          <View style={styles.checklist}>
            {ITEMS.map((item, i) => (
              <View key={item.title} style={styles.checkItem}>
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

          {/* Review cards */}
          <Animated.View style={[styles.reviewsWrap, { opacity: reviewsOpacity }]}>
            <Text style={styles.reviewsLabel}>What learners say</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.reviewsScroll}
            >
              {REVIEWS.map((r) => (
                <View key={r.name} style={styles.reviewCard}>
                  <View style={styles.reviewerRow}>
                    <Text style={styles.reviewerFlag}>{r.flag}</Text>
                    <View>
                      <Text style={styles.reviewerName}>{r.name}</Text>
                      <Text style={styles.reviewerCert}>{r.cert}</Text>
                    </View>
                  </View>
                  <Text style={styles.reviewText}>{r.text}</Text>
                  <Text style={styles.reviewStars}>★★★★★</Text>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        </ScreenLayout>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },

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
  scroll: { paddingHorizontal: 24, paddingTop: 44 },

  // ── Header ──────────────────────────────────────────────────────────────────
  header:   { marginBottom: 24 },
  headline: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 34,
    lineHeight: 38,
    color: '#374151',
    letterSpacing: -1,
    marginBottom: 12,
  },
  subCopy: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 16,
    lineHeight: 23,
    color: '#94A3B8',
    maxWidth: 320,
  },

  // ── Offer card ───────────────────────────────────────────────────────────────
  offerCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'rgba(43,112,239,0.25)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 28,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 6,
  },
  offerCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  offerBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(43,112,239,0.08)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(43,112,239,0.18)',
  },
  offerBadgeText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 14,
    color: colors.primary,
    letterSpacing: 0.2,
  },
  trialChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#22C55E',
    borderRadius: 999,
  },
  trialChipText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  priceText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 28,
    color: '#374151',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  priceAfter: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },

  // ── Section header ──────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
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
  sectionPillText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 11,
    color: '#374151',
    letterSpacing: 0.4,
  },

  // ── Checklist ───────────────────────────────────────────────────────────────
  checklist: { gap: 12, marginBottom: 32 },

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

  // ── Reviews ─────────────────────────────────────────────────────────────────
  reviewsWrap:   { marginBottom: 8 },
  reviewsLabel:  {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 12,
    color: '#94A3B8',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  reviewsScroll: { gap: 12, paddingRight: 24 },
  reviewCard: {
    width: 280,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    padding: 18,
    gap: 10,
    shadowColor: '#374151',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 3,
  },
  reviewerRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewerFlag: { fontSize: 22, lineHeight: 26 },
  reviewerName: { fontFamily: 'NunitoSans_700Bold', fontSize: 15, color: '#374151' },
  reviewerCert: { fontFamily: 'NunitoSans_400Regular', fontSize: 13, color: '#94A3B8' },
  reviewText:   {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: '#374151',
    fontStyle: 'italic',
  },
  reviewStars:  { fontSize: 13, letterSpacing: 2, color: '#F0C808' },

  // ── Footer ──────────────────────────────────────────────────────────────────
  trustLine: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 18,
  },
  cta: {
    width: '100%',
    height: 60,
    backgroundColor: colors.primary,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 32,
    elevation: 10,
  },
  ctaPressed: { opacity: 0.88 },
  ctaText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  secondary: { height: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 14,
    color: '#94A3B8',
  },
});
