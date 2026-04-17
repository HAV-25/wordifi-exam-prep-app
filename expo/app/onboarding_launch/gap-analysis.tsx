/**
 * Onboarding Launch — Screen 09: Gap Analysis
 * Source: Banani flow FtXTL2Xb5WF4 / screen 2XbFRdXDM05S
 * BEFORE state (user's current situation) vs CERTIFIED state (goal)
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowDown, ArrowRight } from 'lucide-react-native';
import { ScreenLayout } from '@/components/ScreenLayout';
import {
  onboardingStore,
  CERT_SHORT,
  TIMELINE_LABELS,
  READINESS_DISPLAY,
  HARDEST_DISPLAY,
} from './_store';
import { colors } from '@/theme';
import { GlowOrb } from '@/components/GlowOrb';

// ─── InfoRow ─────────────────────────────────────────────────────────────────

function InfoRow({
  emoji,
  strong,
  descriptor,
  variant,
}: {
  emoji: string;
  strong: string;
  descriptor: string;
  variant: 'before' | 'goal';
}) {
  const isGoal = variant === 'goal';
  return (
    <View style={styles.infoRow}>
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <Text style={[styles.rowCopy, isGoal && styles.rowCopyGoal]}>
        <Text style={[styles.rowStrong, isGoal && styles.rowStrongGoal]}>{strong}</Text>
        {` — ${descriptor}`}
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GapAnalysisScreen() {
  const { cert, level, timeline, readiness, hardest } = onboardingStore;

  const certShort     = cert ? CERT_SHORT[cert] : '—';
  const levelLabel    = level ?? '—';
  const timelineLabel = timeline ? TIMELINE_LABELS[timeline] : '—';
  const readinessInfo = readiness ? READINESS_DISPLAY[readiness] : { emoji: '😐', label: 'Getting there' };
  const hardestInfo   = hardest ? HARDEST_DISPLAY[hardest] : { emoji: '📊', label: 'All sections' };

  const ctaFooter = (
    <Pressable
      onPress={() => router.push('/onboarding_launch/notifications')}
      style={styles.cta}
      accessibilityRole="button"
      accessibilityLabel="Show me how"
    >
      <Text style={styles.ctaText}>Show me how</Text>
      <ArrowRight size={22} color="#FFFFFF" />
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <GlowOrb top={-100} right={-100} />

      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScreenLayout
          backgroundColor="transparent"
          footer={ctaFooter}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headline}>Here is where you{'\n'}stand today.</Text>
            <Text style={styles.subCopy}>Honest. Clear. No guessing.</Text>
          </View>

          {/* Cards stack */}
          <View style={styles.cardsStack}>
            {/* BEFORE card */}
            <View style={styles.beforeCard}>
              <View style={styles.labelBefore}>
                <Text style={styles.labelBeforeText}>BEFORE</Text>
              </View>
              <View style={styles.rowList}>
                <InfoRow emoji="📍"               strong={`${certShort} ${levelLabel}`} descriptor="your target"      variant="before" />
                <InfoRow emoji={readinessInfo.emoji} strong={readinessInfo.label}        descriptor="your confidence"  variant="before" />
                <InfoRow emoji={hardestInfo.emoji}   strong={hardestInfo.label}          descriptor="your biggest gap" variant="before" />
                <InfoRow emoji="⏱️"               strong={timelineLabel}               descriptor="your window"      variant="before" />
              </View>
            </View>

            {/* Bridge */}
            <View style={styles.bridge}>
              <Text style={styles.bridgeGap}>GAP</Text>
              <View style={styles.bridgeArrow}>
                <ArrowDown size={22} color={colors.primary} />
              </View>
              <Text style={styles.bridgeHighlight}>WORDIFI CLOSES IT</Text>
            </View>

            {/* CERTIFIED card */}
            <View style={styles.certCard}>
              <View style={styles.celebrationDots}>
                <View style={[styles.dot, styles.dotYellow]} />
                <View style={[styles.dot, styles.dotWhite]} />
                <View style={[styles.dot, styles.dotBlue]} />
              </View>
              <View style={styles.labelCert}>
                <Text style={styles.labelCertText}>CERTIFIED</Text>
              </View>
              <View style={styles.rowList}>
                <InfoRow emoji="🎓" strong={`${certShort} ${levelLabel}`} descriptor="achieved"   variant="goal" />
                <InfoRow emoji="💪" strong="Fully confident"               descriptor="your state" variant="goal" />
                <InfoRow emoji="✅" strong="All sections"                  descriptor="mastered"   variant="goal" />
                <InfoRow emoji="🏆" strong="On exam day"                   descriptor="ready"      variant="goal" />
              </View>
            </View>
          </View>
        </ScreenLayout>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },

  // ── Layout ──────────────────────────────────────────────────────────────────
  safe:       { flex: 1, paddingHorizontal: 24, paddingTop: 28 },
  header:     { marginBottom: 28 },
  headline:   { fontFamily: 'Outfit_800ExtraBold', fontSize: 36, lineHeight: 38, color: '#374151', letterSpacing: -1.4, marginBottom: 14 },
  subCopy:    { fontFamily: 'NunitoSans_600SemiBold', fontSize: 15, lineHeight: 22, color: '#94A3B8' },
  cardsStack: { flex: 1, gap: 18 },

  // ── BEFORE card ─────────────────────────────────────────────────────────────
  beforeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    shadowColor: '#374151',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 28,
    elevation: 4,
  },
  labelBefore: {
    alignSelf: 'flex-start',
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  labelBeforeText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 12, color: '#94A3B8', letterSpacing: 1.4 },

  // ── Bridge ──────────────────────────────────────────────────────────────────
  bridge:          { alignItems: 'center', gap: 10, paddingVertical: 2 },
  bridgeGap:       { fontFamily: 'Outfit_800ExtraBold', fontSize: 12, color: '#94A3B8', letterSpacing: 1.4 },
  bridgeArrow: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.10,
    shadowRadius: 28,
    elevation: 4,
  },
  bridgeHighlight: { fontFamily: 'Outfit_800ExtraBold', fontSize: 12, color: colors.primary, letterSpacing: 1.4 },

  // ── CERTIFIED card ──────────────────────────────────────────────────────────
  certCard: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 22,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 40,
    elevation: 10,
  },
  celebrationDots: { position: 'absolute', top: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:             { borderRadius: 999 },
  dotYellow:       { width: 10, height: 10, backgroundColor: '#F0C808' },
  dotWhite:        { width: 8,  height: 8,  backgroundColor: 'rgba(255,255,255,0.72)' },
  dotBlue:         { width: 8,  height: 8,  backgroundColor: 'rgba(255,255,255,0.42)' },

  labelCert: {
    alignSelf: 'flex-start',
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  labelCertText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 12, color: '#FFFFFF', letterSpacing: 1.4 },

  // ── Info rows ────────────────────────────────────────────────────────────────
  rowList:       { gap: 14 },
  infoRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  rowEmoji:      { width: 28, minWidth: 28, fontSize: 22, lineHeight: 28, textAlign: 'center' },
  rowCopy:       { flex: 1, fontFamily: 'NunitoSans_400Regular', fontSize: 15, lineHeight: 20, color: '#94A3B8' },
  rowCopyGoal:   { color: 'rgba(255,255,255,0.76)' },
  rowStrong:     { fontFamily: 'NunitoSans_600SemiBold', color: '#374151' },
  rowStrongGoal: { color: '#FFFFFF' },

  // ── CTA ─────────────────────────────────────────────────────────────────────
  cta: {
    width: '100%',
    height: 60,
    backgroundColor: colors.primary,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 34,
    elevation: 10,
  },
  ctaText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 18, color: '#FFFFFF', letterSpacing: -0.3 },
});
