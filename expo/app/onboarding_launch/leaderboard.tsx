/**
 * Onboarding Launch — Screen 11: Leaderboard Teaser
 * Source: Banani flow FtXTL2Xb5WF4 / screen zWIIlP9-7Aaj
 * Social proof screen — worldwide learners motivational card
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { onboardingStore } from './_store';
import { colors } from '@/theme';

// ─── Types & data ─────────────────────────────────────────────────────────────

type LbRow = {
  rank: string;       // emoji medal or '—'
  name: string;
  flag: string;
  level: string;
  score: number;
  days: string;
  passed?: boolean;
  isUser?: boolean;
};

const BASE_ROWS: LbRow[] = [
  { rank: '🥇', name: 'Maria', flag: '🇧🇷', level: 'B1', score: 91, days: '47 days', passed: true },
  { rank: '🥈', name: 'Yusuf', flag: '🇹🇷', level: 'B1', score: 84, days: '31 days' },
  { rank: '🥉', name: 'Priya', flag: '🇮🇳', level: 'A2', score: 79, days: '24 days' },
];

// ─── Row component ────────────────────────────────────────────────────────────

function LeaderRow({ row }: { row: LbRow }) {
  const isUser = !!row.isUser;
  return (
    <View style={[styles.lbRow, isUser && styles.lbRowHighlighted]}>
      <Text style={[styles.lbRank, isUser && styles.lbRankUser]}>{row.rank}</Text>
      <View style={styles.lbDetails}>
        <View style={styles.lbDetailsTop}>
          <Text style={[styles.lbName, isUser && styles.lbNameUser]}>
            {row.name} {row.flag}
          </Text>
          {row.passed && (
            <View style={styles.passedBadge}>
              <Text style={styles.passedBadgeText}>PASSED</Text>
            </View>
          )}
        </View>
        <Text style={[styles.lbMeta, isUser && styles.lbMetaUser]}>
          {row.level}
          <Text style={styles.dot}> · </Text>
          <Text style={[styles.lbScore, isUser && styles.lbScoreUser]}>{row.score}%</Text>
          <Text style={styles.dot}> · </Text>
          {row.days}
        </Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LeaderboardTeaserScreen() {
  const level = onboardingStore.level ?? 'B1';

  const userRow: LbRow = {
    rank: '—',
    name: 'You',
    flag: '🏳️',
    level: `[${level}]`,
    score: 22,
    days: 'Day 1',
    isUser: true,
  };

  const allRows = [...BASE_ROWS, userRow];

  return (
    <View style={styles.root}>
      {/* Decorative orbs */}
      <View style={[styles.orb, styles.orbTopRight]} />
      <View style={[styles.orb, styles.orbBottomLeft]} />

      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headline}>You are not the only one on this journey.</Text>
            <Text style={styles.subCopy}>These learners started exactly where you are today.</Text>
          </View>

          {/* Leaderboard card */}
          <View style={styles.lbCard}>
            <View style={styles.lbLabelWrap}>
              <View style={styles.lbLabel}>
                <Text style={styles.lbLabelText}>WORDIFI LEARNERS · WORLDWIDE 🌍</Text>
              </View>
            </View>

            <View style={styles.lbList}>
              {allRows.map((row, i) => (
                <React.Fragment key={row.name}>
                  <LeaderRow row={row} />
                  {!row.isUser && i < BASE_ROWS.length - 1 && (
                    <View style={styles.rowDivider} />
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>

          {/* Story block */}
          <View style={styles.storyBlock}>
            <Text style={styles.storyQuote}>
              "Maria started at 19%. She sat her Goethe {level} six weeks later. She passed first time."
            </Text>
            <Text style={styles.storyAuthor}>Maria Silva · Goethe {level} · 2024</Text>
          </View>

          {/* Close block */}
          <View style={styles.closeBlock}>
            <Text style={styles.closeLine}>Your name belongs on this list.{'\n'}Let's put it there.</Text>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Sticky footer */}
        <View style={styles.footer}>
          <SafeAreaView edges={['bottom']}>
            <Text style={styles.footerNote}>Thousands of learners worldwide</Text>
            <Pressable
              onPress={() => router.push('/onboarding_launch/plan-builder')}
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
              accessibilityRole="button"
              accessibilityLabel="Show me how"
            >
              <Text style={styles.ctaText}>Show me how</Text>
              <ArrowRight size={22} color="#FFFFFF" />
            </Pressable>
          </SafeAreaView>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },

  // Decorative orbs
  orb:          { position: 'absolute', borderRadius: 999, opacity: 0.18 },
  orbTopRight:  { width: 180, height: 180, backgroundColor: '#F0C808',   top: -72,    right: -64 },
  orbBottomLeft:{ width: 220, height: 220, backgroundColor: colors.primary, bottom: -110, left: -80  },

  safe: { flex: 1 },

  scroll:  { paddingHorizontal: 24, paddingTop: 28 },
  header:  { marginBottom: 24 },
  headline: { fontFamily: 'Outfit_800ExtraBold', fontSize: 34, lineHeight: 37, color: '#374151', letterSpacing: -1, marginBottom: 12 },
  subCopy:  { fontFamily: 'NunitoSans_600SemiBold', fontSize: 15, lineHeight: 22, color: '#94A3B8' },

  // Leaderboard card
  lbCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 24,
    shadowColor: '#374151',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 28,
    elevation: 4,
  },
  lbLabelWrap: { alignItems: 'center', marginBottom: 16 },
  lbLabel:     { height: 32, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.background, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  lbLabelText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 11, color: '#94A3B8', letterSpacing: 1.4 },

  lbList:    {},
  lbRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, gap: 12 },
  lbRowHighlighted: {
    backgroundColor: 'rgba(43,112,239,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(43,112,239,0.4)',
    borderRadius: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  rowDivider: { height: 1, backgroundColor: '#E2E8F0', marginHorizontal: 8 },

  lbRank:     { fontSize: 22, width: 28, textAlign: 'center', lineHeight: 26 },
  lbRankUser: { fontFamily: 'Outfit_800ExtraBold', fontSize: 18, color: colors.primary },

  lbDetails:    { flex: 1, gap: 4 },
  lbDetailsTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lbName:       { fontFamily: 'NunitoSans_700Bold', fontSize: 16, color: '#374151' },
  lbNameUser:   { color: colors.primary },

  passedBadge:     { backgroundColor: '#22C55E', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  passedBadgeText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 11, color: '#FFFFFF', letterSpacing: 0.5 },

  lbMeta:     { fontFamily: 'NunitoSans_600SemiBold', fontSize: 13, color: '#94A3B8' },
  lbMetaUser: { color: colors.primary },
  dot:        { opacity: 0.4 },
  lbScore:    { fontFamily: 'Outfit_800ExtraBold', color: '#374151' },
  lbScoreUser:{ color: colors.primary },

  // Story block
  storyBlock: { alignItems: 'center', paddingHorizontal: 16, marginBottom: 28 },
  storyQuote: { fontFamily: 'NunitoSans_400Regular', fontSize: 15, lineHeight: 22, color: '#374151', fontStyle: 'italic', textAlign: 'center', marginBottom: 8 },
  storyAuthor: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 13, color: '#94A3B8', textAlign: 'center' },

  // Close block
  closeBlock: { alignItems: 'center', marginBottom: 20 },
  closeLine:  { fontFamily: 'Outfit_800ExtraBold', fontSize: 24, lineHeight: 30, color: '#374151', textAlign: 'center', letterSpacing: -0.5 },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: `${colors.background}F5`,
  },
  footerNote: { fontFamily: 'Outfit_800ExtraBold', fontSize: 13, color: '#94A3B8', textAlign: 'center', marginBottom: 16 },

  cta: {
    width: '100%',
    height: 60,
    backgroundColor: colors.primary,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 34,
    elevation: 10,
  },
  ctaPressed: { opacity: 0.88 },
  ctaText:    { fontFamily: 'Outfit_800ExtraBold', fontSize: 18, color: '#FFFFFF', letterSpacing: -0.3 },
});
