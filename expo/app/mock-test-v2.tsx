/**
 * Mock Test V2 — Digital Exam Lite
 *
 * Phase state machine driven by examBlueprint.ts.
 * Sections play sequentially with natural breaks (Continue / Pause & resume).
 * Save/resume via mock_tests.saved_state within 24h window.
 *
 * Gated behind MOCK_V2_ENABLED feature flag — if false, redirects to old /mock-test.
 */
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Pause, Trophy } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/colors';
import { B } from '@/theme/banani';
import {
  type ExamBlueprintSection,
  type ExamSectionKey,
  getBlueprint,
} from '@/lib/examBlueprint';
import { MOCK_V2_ENABLED } from '@/lib/featureFlags';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabaseClient';
import { shuffleArray } from '@/theme/constants';
import type { AppQuestion } from '@/types/database';
import { SectionPlayerMCQ, type MCQSectionResult } from '@/components/mockv2/SectionPlayerMCQ';
import { SectionPlayerSchreiben, type SchreibenSectionResult } from '@/components/mockv2/SectionPlayerSchreiben';
import { SectionPlayerSprachbausteine } from '@/components/mockv2/SectionPlayerSprachbausteine';
import { SectionPlayerSprechen, type SprechenSectionResult } from '@/components/mockv2/SectionPlayerSprechen';
import { fetchRecentlyAnsweredIds } from '@/lib/questionDedup';
import {
  completeMockV2,
  createMockV2Session,
  saveMockV2State,
  type SavedSectionResult,
} from '@/lib/mockV2Helpers';

// ─── Phase state machine ──────────────────────────────────────────────────────
type Phase =
  | { type: 'loading' }
  | { type: 'section'; sectionIndex: number }
  | { type: 'transition'; fromSectionIndex: number }
  | { type: 'submitting' }
  | { type: 'completed' };

// Per-section results collected during the test run.
// Extended with detail payloads for the end-of-test results screen.
type SectionResult = {
  section: ExamSectionKey;
  scorePct: number;
  questionsCorrect?: number;
  questionsTotal?: number;
  timeTakenSeconds: number;
  /** Full question objects (MCQ/TF/matching/Sprachbausteine). */
  questions?: unknown[];
  /** Selected answers keyed by question_id. */
  answers?: Record<string, string>;
  /** Schreiben: per-teil user text + AI assessment. Sprechen: per-teil scores.
   *  Sprachbausteine: per-teil full question + blank-by-blank answers (for review). */
  teilAssessments?: Array<{
    teil: number;
    userText?: string;
    assessment?: unknown;
    scores?: { overall?: number; fluency?: number; grammar?: number; vocabulary?: number };
    /** Sprachbausteine only — the full question (with correct_answer JSON map). */
    question?: unknown;
    /** Sprachbausteine only — user's per-blank answers for this teil. */
    blankAnswers?: Record<string, string>;
  }>;
};

export default function MockTestV2Screen() {
  const params = useLocalSearchParams<{
    level?: string;
    mockTestId?: string;
    resumeStateJson?: string;
  }>();
  const { profile, user } = useAuth();
  const level = params.level ?? profile?.target_level ?? 'B1';
  const userId = user?.id ?? '';

  const blueprint = useMemo(() => getBlueprint(level), [level]);

  const [phase, setPhase] = useState<Phase>({ type: 'loading' });
  const [results, setResults] = useState<SectionResult[]>([]);
  const [mockTestId, setMockTestId] = useState<string>(params.mockTestId ?? '');
  const sessionStartedAtRef = useRef<string>(new Date().toISOString());

  // ── Feature flag gate + session init (fresh or resumed) ──────────────────
  useEffect(() => {
    if (!MOCK_V2_ENABLED) {
      console.log('[MockV2] Flag OFF — redirecting to /mock-test');
      router.replace('/mock-test');
      return;
    }
    (async () => {
      try {
        // Resume path: params includes an existing mockTestId + resumeStateJson
        if (params.mockTestId && params.resumeStateJson) {
          const saved = JSON.parse(params.resumeStateJson) as {
            phaseSectionIndex: number;
            results: SavedSectionResult[];
            startedAt: string;
          };
          sessionStartedAtRef.current = saved.startedAt;
          setResults(saved.results as SectionResult[]);
          setPhase({ type: 'section', sectionIndex: saved.phaseSectionIndex });
          console.log('[MockV2] Resumed at section', saved.phaseSectionIndex);
          return;
        }
        // Fresh start
        if (userId) {
          const id = await createMockV2Session(userId, level, profile?.exam_type ?? 'TELC');
          setMockTestId(id);
        }
        setPhase({ type: 'section', sectionIndex: 0 });
      } catch (err) {
        console.log('[MockV2] init error', err);
        setPhase({ type: 'section', sectionIndex: 0 });
      }
    })();
  }, []);

  // ── AppState listener: save on background ───────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' && mockTestId && phase.type === 'section') {
        void saveMockV2State(
          mockTestId,
          {
            level,
            phaseSectionIndex: phase.sectionIndex,
            results: results as SavedSectionResult[],
            startedAt: sessionStartedAtRef.current,
          },
          blueprint[phase.sectionIndex]?.section ?? 'horen'
        );
      }
    });
    return () => sub.remove();
  }, [mockTestId, phase, results, level, blueprint]);

  // ── Android back button handler ──────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handlePauseAndExit();
      return true; // prevent default
    });
    return () => sub.remove();
  }, []);

  // ── Phase transitions ────────────────────────────────────────────────────
  const handleSectionComplete = useCallback(async (result: SectionResult) => {
    const newResults = [...results, result];
    setResults(newResults);
    setPhase((prev) => {
      if (prev.type !== 'section') return prev;
      return { type: 'transition', fromSectionIndex: prev.sectionIndex };
    });
    // Save after each section (completed section included in state)
    if (mockTestId && phase.type === 'section') {
      await saveMockV2State(
        mockTestId,
        {
          level,
          phaseSectionIndex: phase.sectionIndex + 1, // next section to play
          results: newResults as SavedSectionResult[],
          startedAt: sessionStartedAtRef.current,
        },
        blueprint[phase.sectionIndex + 1]?.section ?? 'completed'
      );
    }
  }, [results, mockTestId, phase, level, blueprint]);

  const handleContinueToNext = useCallback(async () => {
    if (phase.type !== 'transition') return;
    const nextIndex = phase.fromSectionIndex + 1;
    if (nextIndex >= blueprint.length) {
      // All sections done → finalize
      setPhase({ type: 'submitting' });
      if (mockTestId) {
        try {
          const scores = await completeMockV2(mockTestId, results as SavedSectionResult[]);
          router.replace({
            pathname: '/mock-results-v2' as any,
            params: {
              mockTestId,
              level,
              overallScorePct: String(scores.overallPct),
              set1ScorePct: String(scores.set1Pct),
              set2ScorePct: String(scores.set2Pct),
              overallPass: scores.overallPass ? '1' : '0',
              resultsJson: JSON.stringify(results),
            },
          });
        } catch (err) {
          console.log('[MockV2] completion error', err);
          setPhase({ type: 'completed' });
        }
      } else {
        setPhase({ type: 'completed' });
      }
      return;
    }
    setPhase({ type: 'section', sectionIndex: nextIndex });
  }, [phase, blueprint, mockTestId, results, level]);

  const handlePauseAndExit = useCallback(() => {
    Alert.alert(
      'Pause Mock Test?',
      'Your progress will be saved. You can resume from the Mock Test tab within 24 hours.',
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'Save & exit',
          style: 'destructive',
          onPress: async () => {
            if (mockTestId && phase.type === 'section') {
              await saveMockV2State(
                mockTestId,
                {
                  level,
                  phaseSectionIndex: phase.sectionIndex,
                  results: results as SavedSectionResult[],
                  startedAt: sessionStartedAtRef.current,
                },
                blueprint[phase.sectionIndex]?.section ?? 'horen'
              );
            }
            router.back();
          },
        },
      ]
    );
  }, [mockTestId, phase, results, level, blueprint]);

  // ── Render ───────────────────────────────────────────────────────────────
  if (phase.type === 'loading') {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Mock Test', headerShown: true }} />
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Preparing your mock exam...</Text>
      </View>
    );
  }

  if (phase.type === 'section') {
    const section = blueprint[phase.sectionIndex]!;
    return (
      <SafeAreaView style={styles.screen}>
        <Stack.Screen options={{ title: '', headerShown: true, headerBackVisible: false }} />
        <SectionRouter
          level={level}
          section={section}
          sectionIndex={phase.sectionIndex}
          totalSections={blueprint.length}
          userId={userId}
          onComplete={handleSectionComplete}
          onPause={handlePauseAndExit}
        />
      </SafeAreaView>
    );
  }

  if (phase.type === 'transition') {
    const completedSection = blueprint[phase.fromSectionIndex]!;
    const lastResult = results[results.length - 1];
    const nextSection = blueprint[phase.fromSectionIndex + 1];
    const isLastSection = phase.fromSectionIndex === blueprint.length - 1;

    return (
      <SafeAreaView style={styles.screen}>
        <Stack.Screen options={{ title: '', headerShown: true, headerBackVisible: false }} />
        <TransitionScreen
          completedSection={completedSection}
          lastResult={lastResult ?? null}
          nextSection={nextSection}
          isLastSection={isLastSection}
          onContinue={handleContinueToNext}
          onPause={handlePauseAndExit}
        />
      </SafeAreaView>
    );
  }

  if (phase.type === 'submitting') {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Scoring', headerShown: true, headerBackVisible: false }} />
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Calculating your results...</Text>
      </View>
    );
  }

  return null;
}

// ─── Section router — picks the right player per section type ──────────────
function SectionRouter({
  level,
  section,
  sectionIndex,
  totalSections,
  userId,
  onComplete,
  onPause,
}: {
  level: string;
  section: ExamBlueprintSection;
  sectionIndex: number;
  totalSections: number;
  userId: string;
  onComplete: (result: SectionResult) => void;
  onPause: () => void;
}) {
  const [questions, setQuestions] = useState<AppQuestion[] | null>(null);
  const timeLimitSec = section.timeMinutes * 60;

  useEffect(() => {
    // These players fetch their own questions internally
    if (section.section === 'Schreiben' || section.section === 'Sprechen' || section.section === 'Sprachbausteine') {
      setQuestions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('app_questions')
        .select('*')
        .eq('level', level)
        .eq('section', section.section)
        .eq('is_active', true);
      const all = (data ?? []) as AppQuestion[];

      // Fetch 30-day seen questions once for dedup
      let dedup: { seen: Set<string>; seenAt: Map<string, string> } = { seen: new Set(), seenAt: new Map() };
      if (userId) {
        try { dedup = await fetchRecentlyAnsweredIds(userId); } catch { /* fall back to no dedup */ }
      }

      // Pick questions per teil according to blueprint
      const picked: AppQuestion[] = [];
      section.teils.forEach((teil, ti) => {
        const teilPool = all.filter((q) => q.teil === teil);
        const target = section.questionsPerTeil?.[ti] ?? teilPool.length;
        // Group by source_clip_id to preserve hybrid pairs
        const clipGroups = new Map<string, AppQuestion[]>();
        for (const q of teilPool) {
          const key = q.source_clip_id ?? q.id;
          const group = clipGroups.get(key) ?? [];
          group.push(q);
          clipGroups.set(key, group);
        }

        // Dedup-aware partitioning at clip-group level
        const unseenGroups: AppQuestion[][] = [];
        const seenGroupsWithAge: Array<{ group: AppQuestion[]; age: string }> = [];
        for (const g of clipGroups.values()) {
          const anySeen = g.some((q) => dedup.seen.has(q.id));
          if (!anySeen) {
            unseenGroups.push(g);
          } else {
            const mostRecent = g.reduce((acc, q) => {
              const ts = dedup.seenAt.get(q.id) ?? '';
              return ts > acc ? ts : acc;
            }, '');
            seenGroupsWithAge.push({ group: g, age: mostRecent });
          }
        }
        seenGroupsWithAge.sort((a, b) => a.age.localeCompare(b.age));
        const prioritized = [
          ...shuffleArray(unseenGroups),
          ...seenGroupsWithAge.map((x) => x.group),
        ];

        const out: AppQuestion[] = [];
        for (const g of prioritized) {
          if (out.length >= target) break;
          out.push(...g);
        }
        const trimmed = out.slice(0, target).sort((a, b) => {
          const ca = a.source_clip_id ?? '', cb = b.source_clip_id ?? '';
          if (ca !== cb) return ca < cb ? -1 : 1;
          return (a.question_number ?? 0) - (b.question_number ?? 0);
        });
        picked.push(...trimmed);
      });

      if (!cancelled) setQuestions(picked);
    })();
    return () => { cancelled = true; };
  }, [level, section.section, section.teils, section.questionsPerTeil, userId]);

  if (!questions) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={B.primary} size="large" />
        <Text style={styles.loadingText}>Loading {section.section}...</Text>
      </View>
    );
  }

  // MCQ/TF sections (Hören, Lesen only — Sprachbausteine has its own player)
  if (section.section === 'Hören' || section.section === 'Lesen') {
    if (questions.length === 0) {
      return (
        <View style={styles.center}>
          <Text style={styles.loadingText}>No {section.section} questions available for {level}.</Text>
          <Pressable
            style={styles.simulateBtn}
            onPress={() => onComplete({ section: section.section, scorePct: 0, questionsCorrect: 0, questionsTotal: 0, timeTakenSeconds: 0 })}
          >
            <Text style={styles.simulateBtnText}>Skip section</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <SectionPlayerMCQ
        level={level}
        section={section.section}
        questions={questions}
        timeLimitSeconds={timeLimitSec}
        sectionIndex={sectionIndex}
        totalSections={totalSections}
        onComplete={(r: MCQSectionResult) => onComplete({
          section: section.section,
          scorePct: r.scorePct,
          questionsCorrect: r.questionsCorrect,
          questionsTotal: r.questionsTotal,
          timeTakenSeconds: r.timeTakenSeconds,
          questions: r.questions,
          answers: r.answers,
        })}
      />
    );
  }

  if (section.section === 'Sprachbausteine') {
    return (
      <SectionPlayerSprachbausteine
        level={level}
        userId={userId}
        timeLimitSeconds={timeLimitSec}
        sectionIndex={sectionIndex}
        totalSections={totalSections}
        onComplete={(r) => onComplete({
          section: 'Sprachbausteine',
          scorePct: r.scorePct,
          questionsCorrect: r.questionsCorrect,
          questionsTotal: r.questionsTotal,
          timeTakenSeconds: r.timeTakenSeconds,
          // Per-teil payload: each teil carries its own question + blank answers
          // so the final results screen can render per-blank correctness.
          teilAssessments: [
            { teil: 1, question: r.t1Question, blankAnswers: r.t1Answers },
            { teil: 2, question: r.t2Question, blankAnswers: r.t2Answers },
          ],
          // Keep flat answers map for backwards-compat with existing review code paths.
          answers: { ...r.t1Answers, ...r.t2Answers } as Record<string, string>,
        })}
      />
    );
  }

  if (section.section === 'Schreiben') {
    return (
      <SectionPlayerSchreiben
        level={level}
        teils={section.teils}
        timeLimitSeconds={timeLimitSec}
        sectionIndex={sectionIndex}
        totalSections={totalSections}
        onComplete={(r: SchreibenSectionResult) => onComplete({
          section: 'Schreiben',
          scorePct: r.overallScorePct,
          timeTakenSeconds: r.timeTakenSeconds,
          teilAssessments: r.teilResults.map((t) => ({
            teil: t.teil,
            userText: t.userText,
            assessment: t.assessment,
          })),
        })}
      />
    );
  }

  if (section.section === 'Sprechen') {
    return (
      <SectionPlayerSprechen
        level={level}
        teils={section.teils}
        sectionIndex={sectionIndex}
        totalSections={totalSections}
        onComplete={(r: SprechenSectionResult) => onComplete({
          section: 'Sprechen',
          scorePct: r.overallScorePct,
          timeTakenSeconds: r.timeTakenSeconds,
          teilAssessments: r.teilScores.map((s) => ({
            teil: s.teil,
            scores: { overall: s.overall, fluency: s.fluency, grammar: s.grammar, vocabulary: s.vocabulary },
            transcript: s.transcript ?? '',
          })),
        })}
      />
    );
  }

  return null;
}

// ─── Transition screen between sections ─────────────────────────────────────
function TransitionScreen({
  completedSection,
  nextSection,
  isLastSection,
  onContinue,
  onPause,
}: {
  completedSection: ExamBlueprintSection;
  lastResult: SectionResult | null; // kept in prop signature for caller compatibility, not used
  nextSection: ExamBlueprintSection | undefined;
  isLastSection: boolean;
  onContinue: () => void;
  onPause: () => void;
}) {
  return (
    <View style={styles.transitionWrap}>
      <View style={styles.transitionCheck}>
        <Trophy color={B.success} size={40} />
      </View>
      <Text style={styles.transitionTitle}>{completedSection.section} complete</Text>
      <Text style={styles.transitionNeutralSub}>
        Your answers are saved. Results will be shown at the end of the mock.
      </Text>

      <View style={styles.transitionDivider} />

      {isLastSection ? (
        <>
          <Text style={styles.transitionNextLabel}>All sections complete</Text>
          <Text style={styles.transitionNextName}>Tap below to see your results</Text>
          <Pressable style={styles.continueBtn} onPress={onContinue}>
            <Text style={styles.continueBtnText}>See my results</Text>
            <ArrowRight color="#fff" size={20} />
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.transitionNextLabel}>Next section</Text>
          <Text style={styles.transitionNextName}>{nextSection?.section}</Text>
          <Text style={styles.transitionNextMeta}>
            {nextSection?.timeMinutes} min · {nextSection?.teils.length} Teile
          </Text>

          <Pressable style={styles.continueBtn} onPress={onContinue}>
            <Text style={styles.continueBtnText}>Continue to {nextSection?.section}</Text>
            <ArrowRight color="#fff" size={20} />
          </Pressable>

          <Pressable style={styles.pauseLink} onPress={onPause}>
            <Pause color={B.muted} size={14} />
            <Text style={styles.pauseLinkText}>Pause & resume later</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: B.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: B.background },
  loadingText: { fontSize: 15, fontWeight: '600' as const, color: B.muted },

  // Placeholder (Phase 2 will replace)
  placeholderWrap: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 },
  placeholderLabel: { fontSize: 13, fontWeight: '700' as const, color: B.muted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  placeholderTitle: { fontSize: 28, fontWeight: '800' as const, color: B.questionColor },
  placeholderSub: { fontSize: 14, fontWeight: '600' as const, color: B.muted },
  placeholderNote: { fontSize: 13, color: B.muted, textAlign: 'center', marginTop: 12, paddingHorizontal: 24 },
  simulateBtn: {
    marginTop: 20,
    backgroundColor: B.primary,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  simulateBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' as const },
  pauseBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, marginTop: 8 },
  pauseBtnText: { fontSize: 13, fontWeight: '600' as const, color: B.muted },

  // Transition screen
  transitionWrap: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center', gap: 12 },
  transitionCheck: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  transitionTitle: { fontSize: 26, fontWeight: '800' as const, color: B.questionColor, textAlign: 'center' },
  transitionNeutralSub: { fontSize: 14, fontWeight: '500' as const, color: B.muted, textAlign: 'center', lineHeight: 20, marginTop: 8, paddingHorizontal: 24 },
  transitionDivider: { width: '60%', height: 1, backgroundColor: B.border, marginVertical: 20 },
  transitionNextLabel: { fontSize: 12, fontWeight: '700' as const, color: B.muted, textTransform: 'uppercase' as const, letterSpacing: 0.6 },
  transitionNextName: { fontSize: 22, fontWeight: '800' as const, color: B.primary, marginTop: 4 },
  transitionNextMeta: { fontSize: 14, fontWeight: '600' as const, color: B.muted, marginTop: 4, marginBottom: 24 },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    backgroundColor: B.primary,
    borderRadius: 999,
    paddingVertical: 18, paddingHorizontal: 32,
    minWidth: 240,
    shadowColor: B.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 4,
    marginTop: 8,
  },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' as const },
  pauseLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 16, marginTop: 4 },
  pauseLinkText: { fontSize: 14, fontWeight: '600' as const, color: B.muted },
});
