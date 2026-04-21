/**
 * Onboarding Launch — Screen 14: Plan Summary
 * Source: Banani flow FtXTL2Xb5WF4 / screen dH0FTOGFGsnF
 *
 * Full-bleed Primary Blue background. White feature cards with icon + check
 * shells. Staggered card entrance. Bonus pills + italic closing line.
 * Inverted CTA (white bg, blue text).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowRight, Check, Flame, Sparkles, Target, TrendingUp, Trophy, Zap } from 'lucide-react-native';
import { ScreenLayout } from '@/components/ScreenLayout';
import { colors } from '@/theme';

// ─── Feature data ─────────────────────────────────────────────────────────────

type FeatureIcon = React.ComponentType<{ size: number; color: string }>;

const FEATURES: { Icon: FeatureIcon; title: string; desc: string }[] = [
  { Icon: Zap,        title: 'Daily Stream',     desc: 'Your weakest areas targeted every single day' },
  { Icon: Target,     title: 'Section Practice', desc: 'Master Hören, Lesen, Schreiben and Sprechen' },
  { Icon: Trophy,     title: 'Full Mock Test',   desc: 'Simulate the real exam before exam day' },
  { Icon: TrendingUp, title: 'Readiness Score',  desc: 'Know exactly where you stand after every session' },
  { Icon: Flame,      title: 'Streak System',    desc: 'Daily consistency that turns practice into a pass' },
];

// ─── Animation timing ─────────────────────────────────────────────────────────

const CARD_START   = 180;  // ms after mount when first card appears
const CARD_STAGGER = 100;  // ms between cards
const CARD_DUR     = 260;  // card fade + slide duration
const BONUS_DELAY  = CARD_START + FEATURES.length * CARD_STAGGER + CARD_DUR + 60;
const CTA_DELAY    = BONUS_DELAY + 180;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PlanSummaryScreen() {
  const cardAnims = useRef(
    FEATURES.map(() => ({
      opacity:    new Animated.Value(0),
      translateY: new Animated.Value(10),
    }))
  ).current;

  const bonusOpacity = useRef(new Animated.Value(0)).current;
  const ctaOpacity   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const cardSeq = cardAnims.map((anim, i) =>
      Animated.parallel([
        Animated.timing(anim.opacity, {
          toValue: 1, duration: CARD_DUR,
          delay: CARD_START + i * CARD_STAGGER,
          useNativeDriver: true,
        }),
        Animated.timing(anim.translateY, {
          toValue: 0, duration: CARD_DUR,
          delay: CARD_START + i * CARD_STAGGER,
          useNativeDriver: true,
        }),
      ])
    );

    Animated.parallel([
      ...cardSeq,
      Animated.timing(bonusOpacity, { toValue: 1, duration: 320, delay: BONUS_DELAY, useNativeDriver: true }),
      Animated.timing(ctaOpacity,   { toValue: 1, duration: 320, delay: CTA_DELAY,   useNativeDriver: true }),
    ]).start();
  }, []);

  const ctaFooter = (
    <Animated.View style={{ opacity: ctaOpacity }}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/onboarding_launch/trial-transparency');
        }}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        accessibilityRole="button"
        accessibilityLabel="Yes — start my plan today"
      >
        <Text style={styles.ctaText}>Yes — start my plan today</Text>
        <ArrowRight size={20} color={colors.primary} />
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={styles.root}>
      {/* Background glow orbs — white-tinted circles, approximating the Banani blur */}
      <View style={styles.glowTR} />
      <View style={styles.glowBL} />

      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScreenLayout
          footer={ctaFooter}
          contentContainerStyle={styles.scroll}
          backgroundColor="transparent"
        >

          {/* ── Badge ─────────────────────────────────────────────────────── */}
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Sparkles size={13} color="#374151" />
              <Text style={styles.badgeText}>YOUR WORDIFI PLAN</Text>
            </View>
          </View>

          {/* ── Headline ──────────────────────────────────────────────────── */}
          <Text style={styles.headline}>
            Here's exactly how Wordifi gets you across the finish line.
          </Text>

          {/* ── Feature cards ─────────────────────────────────────────────── */}
          <View style={styles.cardList}>
            {FEATURES.map(({ Icon, title, desc }, i) => (
              <Animated.View
                key={title}
                style={[
                  styles.card,
                  {
                    opacity:   cardAnims[i].opacity,
                    transform: [{ translateY: cardAnims[i].translateY }],
                  },
                ]}
              >
                <View style={styles.iconShell}>
                  <Icon size={18} color={colors.primary} />
                </View>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>{title}</Text>
                  <Text style={styles.cardDesc}>{desc}</Text>
                </View>
                <View style={styles.checkShell}>
                  <Check size={14} color="#22C55E" />
                </View>
              </Animated.View>
            ))}
          </View>

          {/* ── Bonus pills + closing line ────────────────────────────────── */}
          <Animated.View style={[styles.bonusWrap, { opacity: bonusOpacity }]}>
            <Text style={styles.bonusLabel}>Also included —</Text>
            <View style={styles.pillRow}>
              <View style={styles.pill}><Text style={styles.pillText}>✦ Detailed explanations</Text></View>
              <View style={styles.pill}><Text style={styles.pillText}>∞ Unlimited questions</Text></View>
              <View style={styles.pill}><Text style={styles.pillText}>🏆 Global leaderboard</Text></View>
            </View>
            <Text style={styles.closingLine}>
              Everything you need to pass — and nothing you don't.
            </Text>
          </Animated.View>

        </ScreenLayout>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary, overflow: 'hidden' },

  // Background glow orbs (no blur available in RN — approximated with opacity)
  glowTR: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  glowBL: {
    position: 'absolute',
    bottom: -120,
    left: -120,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  safe:   { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 32 },

  // ── Badge ────────────────────────────────────────────────────────────────────
  badgeRow: { alignItems: 'center', marginBottom: 18 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#F0C808',
  },
  badgeText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 11,
    color: '#374151',
    letterSpacing: 0.9,
  },

  // ── Headline ─────────────────────────────────────────────────────────────────
  headline: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 28,
    lineHeight: 33,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 24,
    paddingHorizontal: 4,
  },

  // ── Feature cards ────────────────────────────────────────────────────────────
  cardList: { gap: 10, marginBottom: 20 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#123478',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 6,
  },

  iconShell: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(43,112,239,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: {
    fontFamily: 'NunitoSans_700Bold',
    fontSize: 15,
    color: '#374151',
    marginBottom: 3,
    lineHeight: 18,
  },
  cardDesc: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 14,
  },

  checkShell: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // ── Bonus section ────────────────────────────────────────────────────────────
  bonusWrap: { marginBottom: 16 },

  bonusLabel: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    marginBottom: 10,
  },

  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  pill: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  pillText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },

  closingLine: {
    fontFamily: 'NunitoSans_400Regular',
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
  },

  // ── CTA (inverted: white bg, blue text) ──────────────────────────────────────
  cta: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#0C255B',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    elevation: 10,
  },
  ctaPressed: { opacity: 0.88 },
  ctaText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 18,
    color: colors.primary,
  },
});
