/**
 * Onboarding Launch — Screen 09: Gap Analysis
 * Source: Stitch screen b3b8b309abb545afa59dd0909382726e
 * Step 9 of 10 — Dynamic TODAY card + static CERTIFIED card
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import {
  onboardingStore,
  CERT_SHORT,
  TIMELINE_LABELS,
  READINESS_DISPLAY,
  HARDEST_DISPLAY,
} from './_store';
import { colors } from '@/theme';

// ─── Row components ───────────────────────────────────────────────────────────

function TodayRow({ emoji, value, descriptor }: { emoji: string; value: string; descriptor: string }) {
  return (
    <View style={styles.todayRow}>
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.todayValue}>{value}</Text>
        <Text style={styles.todayDescriptor}>{descriptor}</Text>
      </View>
    </View>
  );
}

function CertRow({ emoji, value, descriptor }: { emoji: string; value: string; descriptor: string }) {
  return (
    <View style={styles.certRow}>
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.certValue}>{value}</Text>
        <Text style={styles.certDescriptor}>{descriptor}</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GapAnalysisScreen() {
  const { cert, level, timeline, readiness, hardest } = onboardingStore;

  const certShort = cert ? CERT_SHORT[cert] : '—';
  const levelLabel = level ?? '—';
  const timelineLabel = timeline ? TIMELINE_LABELS[timeline] : '—';
  const readinessInfo = readiness ? READINESS_DISPLAY[readiness] : { emoji: '😐', label: 'Getting there' };
  const hardestInfo = hardest ? HARDEST_DISPLAY[hardest] : { emoji: '📊', label: 'All sections' };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* Wordifi W logo */}
        <View style={styles.logoWrap}>
          <LinearGradient
            colors={[colors.primary, colors.primaryContainer]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.logoMark}
          >
            <Text style={styles.logoLetter}>W</Text>
          </LinearGradient>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Headline */}
          <Text style={styles.headline}>Here is where you stand today.</Text>
          <Text style={styles.subhead}>Honest. Clear. No guessing.</Text>

          {/* TODAY card */}
          <View style={styles.todayCard}>
            <Text style={styles.todayTag}>TODAY</Text>

            <TodayRow emoji="📍" value={`${certShort} ${levelLabel}`} descriptor="your target" />
            <View style={styles.rowDivider} />
            <TodayRow emoji={readinessInfo.emoji} value={readinessInfo.label} descriptor="your confidence" />
            <View style={styles.rowDivider} />
            <TodayRow emoji={hardestInfo.emoji} value={hardestInfo.label} descriptor="your biggest gap" />
            <View style={styles.rowDivider} />
            <TodayRow emoji="⏱️" value={timelineLabel} descriptor="your window" />
          </View>

          {/* Gap bridge label */}
          <View style={styles.bridge}>
            <View style={styles.bridgeLine} />
            <Text style={styles.bridgeLabel}>GAP  ↓  WORDIFI CLOSES IT</Text>
            <View style={styles.bridgeLine} />
          </View>

          {/* CERTIFIED card */}
          <LinearGradient
            colors={[colors.primary, colors.primaryContainer]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.certCard}
          >
            <Text style={styles.certTag}>CERTIFIED</Text>

            <CertRow emoji="🎓" value={`${certShort} ${levelLabel}`} descriptor="achieved" />
            <View style={styles.certDivider} />
            <CertRow emoji="💪" value="Fully confident" descriptor="your state" />
            <View style={styles.certDivider} />
            <CertRow emoji="✅" value="All sections" descriptor="mastered" />
            <View style={styles.certDivider} />
            <CertRow emoji="🏆" value="On exam day" descriptor="ready" />
          </LinearGradient>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Sticky CTA */}
        <View style={styles.footer}>
          <SafeAreaView edges={['bottom']}>
            <Pressable
              onPress={() => router.push('/onboarding_launch/notifications')}
              style={styles.ctaWrap}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryContainer]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                <Text style={styles.ctaText}>Show me how</Text>
                <ArrowRight size={20} color={colors.onPrimary} />
              </LinearGradient>
            </Pressable>
          </SafeAreaView>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },

  logoWrap: { alignItems: 'center', paddingTop: 20, paddingBottom: 0 },
  logoMark: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { fontFamily: 'Outfit_800ExtraBold', fontSize: 22, color: colors.onPrimary },

  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 },
  headline: { fontFamily: 'Outfit_800ExtraBold', fontSize: 26, lineHeight: 34, color: colors.onPrimaryContainer, textAlign: 'center', marginBottom: 8, letterSpacing: -0.3 },
  subhead: { fontFamily: 'NunitoSans_400Regular', fontSize: 14, color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 24 },

  // TODAY card
  todayCard: {
    backgroundColor: colors.navy,
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  todayTag: { fontFamily: 'NunitoSans_700Bold', fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: colors.teal, marginBottom: 14 },

  todayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  rowEmoji: { fontSize: 20, width: 32, textAlign: 'center' },
  rowBody: { flex: 1, marginLeft: 12 },
  todayValue: { fontFamily: 'Outfit_800ExtraBold', fontSize: 15, color: colors.onPrimary },
  todayDescriptor: { fontFamily: 'NunitoSans_400Regular', fontSize: 12, color: `${colors.onPrimary}60`, marginTop: 1 },
  rowDivider: { height: 1, backgroundColor: `${colors.onPrimary}12`, marginLeft: 44 },

  // Gap bridge
  bridge: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, gap: 10 },
  bridgeLine: { flex: 1, height: 1, backgroundColor: `${colors.outlineVariant}40` },
  bridgeLabel: { fontFamily: 'NunitoSans_700Bold', fontSize: 10, letterSpacing: 1.2, color: colors.outline, textTransform: 'uppercase' },

  // CERTIFIED card
  certCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  certTag: { fontFamily: 'NunitoSans_700Bold', fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: `${colors.onPrimary}CC`, marginBottom: 14 },
  certRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  certValue: { fontFamily: 'Outfit_800ExtraBold', fontSize: 15, color: colors.onPrimary },
  certDescriptor: { fontFamily: 'NunitoSans_400Regular', fontSize: 12, color: `${colors.onPrimary}70`, marginTop: 1 },
  certDivider: { height: 1, backgroundColor: `${colors.onPrimary}20`, marginLeft: 44 },

  // Footer
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 16, backgroundColor: `${colors.background}F5` },
  ctaWrap: { borderRadius: 24, overflow: 'hidden', shadowColor: colors.blueShadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 16, elevation: 8, marginBottom: 8 },
  cta: { paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 24 },
  ctaText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 16, color: colors.onPrimary, letterSpacing: 0.3 },
});
