/**
 * Mock Results V2 — Set 1 / Set 2 grouped scoring display.
 *
 * Receives route params:
 *   - mockTestId, level, overallScorePct, set1ScorePct, set2ScorePct
 *   - overallPass ('1' | '0'), resultsJson (stringified SavedSectionResult[])
 */
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { BookOpenText, CheckCircle2, Headphones, Mic, PenLine, Puzzle, Trophy, XCircle } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/colors';
import { B } from '@/theme/banani';
import type { SavedSectionResult } from '@/lib/mockV2Helpers';
import { PASS_MARK_PCT } from '@/lib/examBlueprint';

const SECTION_META: Record<string, { icon: any; color: string }> = {
  'Hören':           { icon: Headphones,  color: '#2B70EF' },
  'Lesen':           { icon: BookOpenText, color: '#22C55E' },
  'Sprachbausteine': { icon: Puzzle,      color: '#A37A00' },
  'Schreiben':       { icon: PenLine,     color: '#8B5CF6' },
  'Sprechen':        { icon: Mic,         color: '#F97316' },
};

export default function MockResultsV2Screen() {
  const params = useLocalSearchParams<{
    mockTestId?: string;
    level?: string;
    overallScorePct?: string;
    set1ScorePct?: string;
    set2ScorePct?: string;
    overallPass?: string;
    resultsJson?: string;
  }>();

  const level = params.level ?? 'B1';
  const overallPct = Number(params.overallScorePct ?? '0');
  const set1Pct = Number(params.set1ScorePct ?? '0');
  const set2Pct = Number(params.set2ScorePct ?? '0');
  const overallPass = params.overallPass === '1';
  const set1Pass = set1Pct >= PASS_MARK_PCT;
  const set2Pass = set2Pct >= PASS_MARK_PCT;

  const results: SavedSectionResult[] = useMemo(() => {
    try {
      return JSON.parse(params.resultsJson ?? '[]') as SavedSectionResult[];
    } catch {
      return [];
    }
  }, [params.resultsJson]);

  const set1Sections = results.filter((r) => r.section !== 'Sprechen');
  const set2Sections = results.filter((r) => r.section === 'Sprechen');

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: 'Your Results', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Overall hero */}
        <View style={[styles.hero, overallPass ? styles.heroPass : styles.heroFail]}>
          <View style={styles.heroIconWrap}>
            <Trophy color={overallPass ? '#fff' : 'rgba(255,255,255,0.55)'} size={32} />
          </View>
          <Text style={styles.heroLabel}>Mock Exam — {level}</Text>
          <Text style={styles.heroVerdict}>{overallPass ? 'PASS' : 'NEEDS WORK'}</Text>
          <Text style={styles.heroScore}>{overallPct}%</Text>
          <Text style={styles.heroSub}>Overall score</Text>
        </View>

        {/* Set 1 — Written */}
        <SetCard
          title="Set 1 — Written"
          subtitle={level === 'B1' ? 'Hören · Lesen · Sprachbausteine · Schreiben' : 'Hören · Lesen · Schreiben'}
          scorePct={set1Pct}
          passed={set1Pass}
          sections={set1Sections}
        />

        {/* Set 2 — Oral */}
        <SetCard
          title="Set 2 — Oral"
          subtitle="Sprechen"
          scorePct={set2Pct}
          passed={set2Pass}
          sections={set2Sections}
        />

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable style={styles.primaryBtn} onPress={() => router.replace('/')}>
            <Text style={styles.primaryBtnText}>Back to Home</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => router.replace('/mock' as any)}>
            <Text style={styles.secondaryBtnText}>Mock Tests</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SetCard({
  title,
  subtitle,
  scorePct,
  passed,
  sections,
}: {
  title: string;
  subtitle: string;
  scorePct: number;
  passed: boolean;
  sections: SavedSectionResult[];
}) {
  return (
    <View style={styles.setCard}>
      <View style={styles.setHeader}>
        <View style={styles.setHeaderLeft}>
          <Text style={styles.setTitle}>{title}</Text>
          <Text style={styles.setSubtitle}>{subtitle}</Text>
        </View>
        <View style={[styles.setVerdict, passed ? styles.setVerdictPass : styles.setVerdictFail]}>
          {passed ? <CheckCircle2 color="#22C55E" size={18} /> : <XCircle color="#F59E0B" size={18} />}
          <Text style={[styles.setVerdictText, { color: passed ? '#22C55E' : '#F59E0B' }]}>
            {passed ? 'PASS' : 'Needs work'}
          </Text>
        </View>
      </View>
      <Text style={styles.setScore}>{scorePct}%</Text>

      <View style={styles.sectionList}>
        {sections.map((s) => {
          const meta = SECTION_META[s.section] ?? { icon: Trophy, color: B.muted };
          const Icon = meta.icon;
          const sectionPass = s.scorePct >= PASS_MARK_PCT;
          return (
            <View key={s.section} style={styles.sectionRow}>
              <View style={[styles.sectionIconWrap, { backgroundColor: `${meta.color}18` }]}>
                <Icon color={meta.color} size={18} />
              </View>
              <View style={styles.sectionTextWrap}>
                <Text style={styles.sectionName}>{s.section}</Text>
                {s.questionsTotal != null ? (
                  <Text style={styles.sectionSub}>
                    {s.questionsCorrect}/{s.questionsTotal} correct
                  </Text>
                ) : null}
              </View>
              <View style={styles.sectionRight}>
                <Text style={[styles.sectionPct, { color: sectionPass ? '#22C55E' : '#F59E0B' }]}>
                  {Math.round(s.scorePct)}%
                </Text>
                <Text style={styles.sectionPctLabel}>{sectionPass ? 'PASS' : 'Needs work'}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: B.background },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },

  // Hero
  hero: {
    borderRadius: 24, padding: 24,
    alignItems: 'center', gap: 6,
    shadowColor: '#0F1F3D', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1, shadowRadius: 20, elevation: 4,
  },
  heroPass: { backgroundColor: '#22C55E' },
  heroFail: { backgroundColor: '#475569' },
  heroIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' as const, letterSpacing: 0.5, textTransform: 'uppercase' as const },
  heroVerdict: { color: '#fff', fontSize: 24, fontWeight: '800' as const, marginTop: 4 },
  heroScore: { color: '#fff', fontSize: 56, fontWeight: '800' as const, lineHeight: 64, marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' as const },

  // Set card
  setCard: {
    backgroundColor: B.card, borderRadius: 20, padding: 20, gap: 12,
    borderWidth: 1, borderColor: B.border,
  },
  setHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  setHeaderLeft: { flex: 1, gap: 2 },
  setTitle: { fontSize: 16, fontWeight: '800' as const, color: B.questionColor },
  setSubtitle: { fontSize: 12, fontWeight: '500' as const, color: B.muted },
  setVerdict: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  setVerdictPass: { backgroundColor: 'rgba(34,197,94,0.12)' },
  setVerdictFail: { backgroundColor: 'rgba(245,158,11,0.12)' },
  setVerdictText: { fontSize: 11, fontWeight: '800' as const },
  setScore: { fontSize: 36, fontWeight: '800' as const, color: B.primary, lineHeight: 40 },

  sectionList: { gap: 10, marginTop: 4 },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: '#F8FAFC', borderRadius: 14,
  },
  sectionIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTextWrap: { flex: 1 },
  sectionName: { fontSize: 14, fontWeight: '700' as const, color: B.questionColor },
  sectionSub: { fontSize: 11, fontWeight: '500' as const, color: B.muted, marginTop: 1 },
  sectionRight: { alignItems: 'flex-end' },
  sectionPct: { fontSize: 16, fontWeight: '800' as const },
  sectionPctLabel: { fontSize: 9, fontWeight: '700' as const, color: B.muted, letterSpacing: 0.3, textTransform: 'uppercase' as const, marginTop: 1 },

  // Actions
  actions: { gap: 10, marginTop: 8 },
  primaryBtn: { backgroundColor: B.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' as const },
  secondaryBtn: { backgroundColor: '#F1F5F9', borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  secondaryBtnText: { color: B.muted, fontSize: 14, fontWeight: '700' as const },
});
