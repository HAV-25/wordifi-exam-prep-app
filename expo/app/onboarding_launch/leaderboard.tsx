/**
 * Onboarding Launch — Screen 10: Leaderboard Teaser
 * Source: Stitch screen 4045ec04ddeb49cd9d302d6a5e854066
 * Step 10 of 10 — Social proof / motivational leaderboard
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { onboardingStore } from './_store';
import { colors } from '@/theme';

// ─── Leaderboard data ─────────────────────────────────────────────────────────

type LeaderEntry = {
  rank: number;
  name: string;
  flag: string;
  badge: string;
  pct: number;
  days: string;
  isUser?: boolean;
};

const ENTRIES: LeaderEntry[] = [
  { rank: 1, name: 'Maria',  flag: '🇧🇷', badge: 'LEVEL B1 PASSED',   pct: 91, days: '47 days' },
  { rank: 2, name: 'Yusuf',  flag: '🇹🇷', badge: 'Intensive Track',   pct: 84, days: '31 days' },
  { rank: 3, name: 'Priya',  flag: '🇮🇳', badge: 'Vocabulary Master', pct: 79, days: '24 days' },
  { rank: 4, name: 'You',    flag: '🏳️', badge: 'JOURNEY STARTED',   pct: 22, days: 'Day 1', isUser: true },
];

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

function LeaderRow({ entry }: { entry: LeaderEntry }) {
  const medal = entry.rank <= 3 ? RANK_MEDALS[entry.rank - 1] : null;
  return (
    <View style={[styles.row, entry.isUser && styles.rowUser]}>
      <Text style={styles.rankMedal}>{medal ?? `#${entry.rank}`}</Text>
      <View style={styles.rowFlag}>
        <Text style={{ fontSize: 20 }}>{entry.flag}</Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowName, entry.isUser && styles.rowNameUser]}>{entry.name}</Text>
          <View style={[styles.rowBadge, entry.isUser && styles.rowBadgeUser]}>
            <Text style={[styles.rowBadgeText, entry.isUser && styles.rowBadgeTextUser]}>
              {entry.badge}
            </Text>
          </View>
        </View>
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[
              styles.progressFill,
              { width: `${entry.pct}%` },
              entry.isUser && styles.progressFillUser,
            ]} />
          </View>
          <Text style={styles.progressPct}>{entry.pct}%</Text>
        </View>
        <Text style={styles.rowDays}>{entry.days}</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LeaderboardTeaserScreen() {
  const levelLabel = onboardingStore.level ?? 'B1';

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* Header progress */}
        <View style={styles.navRow}>
          <View style={styles.progressWrapOuter}>
            <View style={styles.progressTrackOuter}>
              <View style={[styles.progressFillOuter, { width: '100%' }]}>
                <View style={styles.progressDot} />
              </View>
            </View>
            <Text style={styles.stepLabel}>Step 10 of 10</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Headline */}
          <Text style={styles.headline}>You are not the only one{'\n'}on this journey.</Text>
          <Text style={styles.subhead}>These learners started exactly where you are today.</Text>

          {/* Leaderboard card */}
          <View style={styles.boardCard}>
            <Text style={styles.boardLabel}>WORDIFI LEARNERS · WORLDWIDE 🌍</Text>
            {ENTRIES.map((e) => (
              <React.Fragment key={e.name}>
                <LeaderRow entry={e} />
                {e.rank < ENTRIES.length && <View style={styles.rowDivider} />}
              </React.Fragment>
            ))}
          </View>

          {/* Testimonial */}
          <View style={styles.testimonial}>
            <Text style={styles.testimonialText}>
              "Maria started at 19%. She sat her Goethe {levelLabel} six weeks later."
            </Text>
          </View>

          {/* Tagline */}
          <Text style={styles.tagline}>
            Your name belongs on this list. Let's put it there.
          </Text>

          <Text style={styles.footnote}>Thousands of learners worldwide</Text>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Sticky CTA */}
        <View style={styles.footer}>
          <SafeAreaView edges={['bottom']}>
            <Pressable
              onPress={() => router.push('/onboarding_launch/plan-builder')}
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

  navRow: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  progressWrapOuter: { gap: 6 },
  progressTrackOuter: { height: 8, backgroundColor: colors.surfaceContainerHighest, borderRadius: 4, overflow: 'hidden' },
  progressFillOuter: { height: '100%', backgroundColor: colors.primary, position: 'relative' },
  progressDot: { position: 'absolute', right: 0, top: 0, height: '100%', width: 8, backgroundColor: colors.secondaryFixed, shadowColor: colors.secondaryFixed, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8 },
  stepLabel: { fontFamily: 'NunitoSans_700Bold', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.onSurfaceVariant },

  scroll: { paddingHorizontal: 24, paddingTop: 16 },
  headline: { fontFamily: 'Outfit_800ExtraBold', fontSize: 26, lineHeight: 34, color: colors.onPrimaryContainer, marginBottom: 8, letterSpacing: -0.3 },
  subhead: { fontFamily: 'NunitoSans_400Regular', fontSize: 14, lineHeight: 21, color: colors.onSurfaceVariant, marginBottom: 20 },

  boardCard: { backgroundColor: colors.navy, borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  boardLabel: { fontFamily: 'NunitoSans_700Bold', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: colors.teal, marginBottom: 16 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  rowUser: { backgroundColor: `${colors.primary}18`, borderRadius: 12, paddingHorizontal: 8, marginHorizontal: -8 },
  rankMedal: { width: 28, textAlign: 'center', fontSize: 18 },
  rowFlag: { width: 28, alignItems: 'center' },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  rowName: { fontFamily: 'Outfit_800ExtraBold', fontSize: 14, color: colors.onPrimary },
  rowNameUser: { color: colors.secondaryFixed },
  rowBadge: { backgroundColor: `${colors.onPrimary}18`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  rowBadgeUser: { backgroundColor: `${colors.secondaryFixed}25` },
  rowBadgeText: { fontFamily: 'NunitoSans_700Bold', fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase', color: `${colors.onPrimary}80` },
  rowBadgeTextUser: { color: colors.secondaryFixed },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  progressTrack: { flex: 1, height: 4, backgroundColor: `${colors.onPrimary}20`, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: `${colors.onPrimary}50`, borderRadius: 2 },
  progressFillUser: { backgroundColor: colors.secondaryFixed },
  progressPct: { fontFamily: 'NunitoSans_700Bold', fontSize: 11, color: `${colors.onPrimary}70`, width: 34, textAlign: 'right' },
  rowDays: { fontFamily: 'NunitoSans_400Regular', fontSize: 11, color: `${colors.onPrimary}50` },
  rowDivider: { height: 1, backgroundColor: `${colors.onPrimary}10`, marginVertical: 2 },

  testimonial: { backgroundColor: `${colors.primary}10`, borderRadius: 14, padding: 16, marginBottom: 14 },
  testimonialText: { fontFamily: 'NunitoSans_400Regular', fontSize: 13, lineHeight: 20, color: colors.onSurfaceVariant, fontStyle: 'italic' },

  tagline: { fontFamily: 'Outfit_800ExtraBold', fontSize: 16, lineHeight: 24, color: colors.onPrimaryContainer, textAlign: 'center', marginBottom: 8 },
  footnote: { fontFamily: 'NunitoSans_400Regular', fontSize: 12, color: colors.outline, textAlign: 'center' },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 16, backgroundColor: `${colors.background}F5` },
  ctaWrap: { borderRadius: 24, overflow: 'hidden', shadowColor: colors.blueShadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 16, elevation: 8, marginBottom: 8 },
  cta: { paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 24 },
  ctaText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 16, color: colors.onPrimary, letterSpacing: 0.3 },
});
