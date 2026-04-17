/**
 * Mock Results V2 — Set 1 / Set 2 grouped scoring with collapsible per-section
 * question-level review.
 *
 * The mock test runs fully silent — no scores are shown during the test.
 * Everything is revealed here: overall verdict, Set 1 / Set 2 split,
 * per-section scores, and tap-to-expand question-by-question review
 * with explanations for MCQ/TF, Sprachbausteine blanks, Schreiben
 * assessments, and Sprechen scores.
 */
import { Stack, router, useLocalSearchParams } from 'expo-router';
import {
  BookOpenText,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Headphones,
  Mic,
  PenLine,
  Puzzle,
  Trophy,
  X as XIcon,
  XCircle,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

// ─── Shared types (loose — matches JSON payload shape) ─────────────────────────
type AppQuestionLoose = {
  id: string;
  question_text?: string;
  question_type?: string;
  correct_answer?: string | Record<string, string>;
  options?: Array<{ key: string; text: string }>;
  explanation_en?: string | null;
  explanation_de?: string | null;
  teil?: number;
  question_number?: number | null;
};

type TeilAssessment = {
  teil: number;
  userText?: string;
  assessment?: {
    overall_score?: number;
    max_score?: number;
    passed?: boolean;
    encouragement?: string;
    feedback?: string;
    grammar_feedback?: string;
    vocabulary_feedback?: string;
    task_completion_feedback?: string;
  };
  scores?: { overall?: number; fluency?: number; grammar?: number; vocabulary?: number };
};

// ─── Main screen ───────────────────────────────────────────────────────────────
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
        <SetCard title="Set 2 — Oral" subtitle="Sprechen" scorePct={set2Pct} passed={set2Pass} sections={set2Sections} />

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

// ─── Set card (written / oral grouping) ───────────────────────────────────────
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
        {sections.map((s) => (
          <SectionDrilldown key={s.section} section={s} />
        ))}
      </View>
    </View>
  );
}

// ─── Collapsible section drill-down ───────────────────────────────────────────
function SectionDrilldown({ section }: { section: SavedSectionResult }) {
  const [expanded, setExpanded] = useState(false);
  const meta = SECTION_META[section.section] ?? { icon: Trophy, color: B.muted };
  const Icon = meta.icon;
  const sectionPass = section.scorePct >= PASS_MARK_PCT;

  return (
    <View style={styles.drillWrap}>
      <Pressable style={styles.sectionRow} onPress={() => setExpanded((v) => !v)} testID={`mockv2-result-section-${section.section}`}>
        <View style={[styles.sectionIconWrap, { backgroundColor: `${meta.color}18` }]}>
          <Icon color={meta.color} size={18} />
        </View>
        <View style={styles.sectionTextWrap}>
          <Text style={styles.sectionName}>{section.section}</Text>
          {section.questionsTotal != null ? (
            <Text style={styles.sectionSub}>
              {section.questionsCorrect}/{section.questionsTotal} correct
            </Text>
          ) : null}
        </View>
        <View style={styles.sectionRight}>
          <Text style={[styles.sectionPct, { color: sectionPass ? '#22C55E' : '#F59E0B' }]}>
            {Math.round(section.scorePct)}%
          </Text>
          <Text style={styles.sectionPctLabel}>{sectionPass ? 'PASS' : 'Needs work'}</Text>
        </View>
        <View style={styles.chevron}>
          {expanded ? <ChevronUp color={B.muted} size={18} /> : <ChevronDown color={B.muted} size={18} />}
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.drillBody}>
          {section.section === 'Schreiben' ? (
            <SchreibenReview teilAssessments={(section.teilAssessments ?? []) as TeilAssessment[]} />
          ) : section.section === 'Sprechen' ? (
            <SprechenReview teilAssessments={(section.teilAssessments ?? []) as TeilAssessment[]} />
          ) : (
            <MCQReview
              questions={(section.questions ?? []) as AppQuestionLoose[]}
              answers={section.answers ?? {}}
              sectionName={section.section}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

// ─── MCQ / TF / Matching / Sprachbausteine review ─────────────────────────────
function MCQReview({
  questions,
  answers,
  sectionName,
}: {
  questions: AppQuestionLoose[];
  answers: Record<string, string>;
  sectionName: string;
}) {
  if (questions.length === 0 && Object.keys(answers).length === 0) {
    return <Text style={styles.drillEmpty}>Detailed review not available.</Text>;
  }

  // Sprachbausteine stores per-blank answers in a flat map — render a simple list.
  if (sectionName === 'Sprachbausteine') {
    const blankKeys = Object.keys(answers).sort();
    return (
      <View style={styles.drillList}>
        <Text style={styles.drillHeader}>Blanks filled: {blankKeys.length}</Text>
        {blankKeys.map((k) => (
          <View key={k} style={styles.blankRow}>
            <Text style={styles.blankLabel}>Gap ({k})</Text>
            <Text style={styles.blankValue}>{answers[k]}</Text>
          </View>
        ))}
        <Text style={styles.drillNote}>
          Per-blank correctness shown after you complete this mock again — we're adding detailed Sprachbausteine review in the next update.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.drillList}>
      {questions.map((q, i) => {
        const correct = typeof q.correct_answer === 'string' ? q.correct_answer.toLowerCase() : '';
        const sel = (answers[q.id] ?? '').toLowerCase();
        const isCorrect = sel === correct && sel.length > 0;
        const answered = sel.length > 0;
        const selectedOpt = q.options?.find((o) => o.key.toLowerCase() === sel);
        const correctOpt = q.options?.find((o) => o.key.toLowerCase() === correct);
        const explanation = q.explanation_en ?? q.explanation_de ?? '';

        return (
          <View key={q.id} style={styles.qReview}>
            <View style={styles.qReviewHeader}>
              <Text style={styles.qReviewNum}>Q{i + 1}</Text>
              <View style={[styles.qReviewStatus, isCorrect ? styles.qStatusCorrect : answered ? styles.qStatusWrong : styles.qStatusSkipped]}>
                {isCorrect ? (
                  <CheckCircle2 color="#22C55E" size={14} />
                ) : answered ? (
                  <XIcon color="#EF4444" size={14} />
                ) : (
                  <XIcon color={B.muted} size={14} />
                )}
                <Text style={[styles.qReviewStatusText, { color: isCorrect ? '#22C55E' : answered ? '#EF4444' : B.muted }]}>
                  {isCorrect ? 'Correct' : answered ? 'Wrong' : 'Skipped'}
                </Text>
              </View>
            </View>
            <Text style={styles.qReviewText}>{q.question_text}</Text>
            <View style={styles.qReviewAnswers}>
              <Text style={styles.qReviewAnsLabel}>Your answer: </Text>
              <Text style={[styles.qReviewAnsValue, { color: isCorrect ? '#22C55E' : '#EF4444' }]}>
                {selectedOpt?.text ?? (answered ? sel : '—')}
              </Text>
            </View>
            {!isCorrect ? (
              <View style={styles.qReviewAnswers}>
                <Text style={styles.qReviewAnsLabel}>Correct: </Text>
                <Text style={[styles.qReviewAnsValue, { color: '#22C55E' }]}>
                  {correctOpt?.text ?? correct}
                </Text>
              </View>
            ) : null}
            {explanation ? (
              <View style={styles.explanationBox}>
                <Text style={styles.explanationLabel}>Explanation</Text>
                <Text style={styles.explanationText}>{explanation}</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// ─── Schreiben review ─────────────────────────────────────────────────────────
function SchreibenReview({ teilAssessments }: { teilAssessments: TeilAssessment[] }) {
  if (teilAssessments.length === 0) {
    return <Text style={styles.drillEmpty}>No Schreiben submissions recorded.</Text>;
  }
  return (
    <View style={styles.drillList}>
      {teilAssessments.map((t) => {
        const score = t.assessment?.overall_score ?? 0;
        const maxScore = t.assessment?.max_score ?? 0;
        const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
        const passed = t.assessment?.passed ?? false;
        return (
          <View key={t.teil} style={styles.schreibenTeil}>
            <View style={styles.schreibenTeilHeader}>
              <Text style={styles.schreibenTeilTitle}>Teil {t.teil}</Text>
              {t.assessment ? (
                <View style={[styles.setVerdict, passed ? styles.setVerdictPass : styles.setVerdictFail]}>
                  <Text style={[styles.setVerdictText, { color: passed ? '#22C55E' : '#F59E0B' }]}>
                    {score}/{maxScore} · {pct}%
                  </Text>
                </View>
              ) : (
                <Text style={styles.drillEmpty}>Not scored</Text>
              )}
            </View>
            {t.userText ? (
              <View style={styles.userTextBox}>
                <Text style={styles.userTextLabel}>Your answer</Text>
                <Text style={styles.userTextValue} numberOfLines={12}>{t.userText}</Text>
              </View>
            ) : null}
            {t.assessment?.feedback ? (
              <View style={styles.explanationBox}>
                <Text style={styles.explanationLabel}>Feedback</Text>
                <Text style={styles.explanationText}>{t.assessment.feedback}</Text>
              </View>
            ) : null}
            {t.assessment?.grammar_feedback ? (
              <View style={styles.explanationBox}>
                <Text style={styles.explanationLabel}>Grammar</Text>
                <Text style={styles.explanationText}>{t.assessment.grammar_feedback}</Text>
              </View>
            ) : null}
            {t.assessment?.vocabulary_feedback ? (
              <View style={styles.explanationBox}>
                <Text style={styles.explanationLabel}>Vocabulary</Text>
                <Text style={styles.explanationText}>{t.assessment.vocabulary_feedback}</Text>
              </View>
            ) : null}
            {t.assessment?.task_completion_feedback ? (
              <View style={styles.explanationBox}>
                <Text style={styles.explanationLabel}>Task completion</Text>
                <Text style={styles.explanationText}>{t.assessment.task_completion_feedback}</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// ─── Sprechen review ─────────────────────────────────────────────────────────
function SprechenReview({ teilAssessments }: { teilAssessments: TeilAssessment[] }) {
  if (teilAssessments.length === 0) {
    return <Text style={styles.drillEmpty}>No Sprechen submissions recorded.</Text>;
  }
  return (
    <View style={styles.drillList}>
      {teilAssessments.map((t) => {
        const s = t.scores ?? {};
        return (
          <View key={t.teil} style={styles.schreibenTeil}>
            <Text style={styles.schreibenTeilTitle}>Teil {t.teil}</Text>
            <View style={styles.rubricGrid}>
              <RubricRow label="Overall" value={s.overall} />
              <RubricRow label="Fluency" value={s.fluency} />
              <RubricRow label="Grammar" value={s.grammar} />
              <RubricRow label="Vocabulary" value={s.vocabulary} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function RubricRow({ label, value }: { label: string; value: number | undefined }) {
  if (value == null) return null;
  return (
    <View style={styles.rubricRow}>
      <Text style={styles.rubricLabel}>{label}</Text>
      <Text style={styles.rubricValue}>{Math.round(value)}%</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: B.background },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },

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

  setCard: { backgroundColor: B.card, borderRadius: 20, padding: 20, gap: 12, borderWidth: 1, borderColor: B.border },
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

  drillWrap: { backgroundColor: '#F8FAFC', borderRadius: 14, overflow: 'hidden' },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  sectionIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTextWrap: { flex: 1 },
  sectionName: { fontSize: 14, fontWeight: '700' as const, color: B.questionColor },
  sectionSub: { fontSize: 11, fontWeight: '500' as const, color: B.muted, marginTop: 1 },
  sectionRight: { alignItems: 'flex-end' },
  sectionPct: { fontSize: 16, fontWeight: '800' as const },
  sectionPctLabel: { fontSize: 9, fontWeight: '700' as const, color: B.muted, letterSpacing: 0.3, textTransform: 'uppercase' as const, marginTop: 1 },
  chevron: { width: 24, alignItems: 'center', justifyContent: 'center' },

  drillBody: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: B.border,
  },
  drillList: { gap: 10, marginTop: 8 },
  drillHeader: { fontSize: 12, fontWeight: '700' as const, color: B.muted, letterSpacing: 0.3 },
  drillEmpty: { fontSize: 13, fontWeight: '500' as const, color: B.muted, padding: 12, textAlign: 'center' },
  drillNote: { fontSize: 11, fontWeight: '500' as const, color: B.muted, padding: 8, fontStyle: 'italic' as const },

  qReview: {
    backgroundColor: B.card, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: B.border, gap: 6,
  },
  qReviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qReviewNum: { fontSize: 11, fontWeight: '800' as const, color: B.muted, letterSpacing: 0.3 },
  qReviewStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  qStatusCorrect: { backgroundColor: 'rgba(34,197,94,0.12)' },
  qStatusWrong: { backgroundColor: 'rgba(239,68,68,0.12)' },
  qStatusSkipped: { backgroundColor: '#F1F5F9' },
  qReviewStatusText: { fontSize: 10, fontWeight: '800' as const },
  qReviewText: { fontSize: 13, fontWeight: '700' as const, color: B.questionColor, lineHeight: 18 },
  qReviewAnswers: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap' },
  qReviewAnsLabel: { fontSize: 12, fontWeight: '700' as const, color: B.muted },
  qReviewAnsValue: { fontSize: 12, fontWeight: '700' as const, flex: 1 },
  explanationBox: { backgroundColor: '#F0F4FF', borderRadius: 8, padding: 10, marginTop: 4 },
  explanationLabel: { fontSize: 10, fontWeight: '800' as const, color: B.primary, letterSpacing: 0.3, textTransform: 'uppercase' as const, marginBottom: 2 },
  explanationText: { fontSize: 12, fontWeight: '500' as const, color: B.foreground, lineHeight: 16 },

  blankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  blankLabel: { fontSize: 12, fontWeight: '800' as const, color: '#A37A00', minWidth: 56 },
  blankValue: { fontSize: 13, fontWeight: '600' as const, color: B.foreground, flex: 1 },

  schreibenTeil: { backgroundColor: B.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: B.border, gap: 8 },
  schreibenTeilHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  schreibenTeilTitle: { fontSize: 14, fontWeight: '800' as const, color: B.questionColor },
  userTextBox: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: B.border },
  userTextLabel: { fontSize: 10, fontWeight: '800' as const, color: B.muted, letterSpacing: 0.3, marginBottom: 4 },
  userTextValue: { fontSize: 12, fontWeight: '500' as const, color: B.foreground, lineHeight: 18 },
  rubricGrid: { gap: 6 },
  rubricRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#F8FAFC', borderRadius: 8 },
  rubricLabel: { fontSize: 12, fontWeight: '700' as const, color: B.muted },
  rubricValue: { fontSize: 13, fontWeight: '800' as const, color: B.primary },

  actions: { gap: 10, marginTop: 8 },
  primaryBtn: { backgroundColor: B.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' as const },
  secondaryBtn: { backgroundColor: '#F1F5F9', borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  secondaryBtnText: { color: B.muted, fontSize: 14, fontWeight: '700' as const },
});
