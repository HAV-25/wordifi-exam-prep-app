import { Stack, router, useLocalSearchParams } from 'expo-router';
import { PenLine } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CTAButton } from '@/components/CTAButton';
import { EmptyState } from '@/components/EmptyState';
import { SchreibenQuestion } from '@/components/SchreibenQuestion';
import { SchreibenResult } from '@/components/SchreibenResult';
import { colors, fontSize, radius, shadows, spacing } from '@/theme';
import { assessSchreiben, fetchExistingSubmission } from '@/lib/schreibenHelpers';
import { updatePreparednessScore } from '@/lib/streamHelpers';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/providers/AuthProvider';
import type { AppQuestion } from '@/types/database';
import type { AssessmentResult } from '@/types/schreiben';
import { SCHREIBEN_TASK_TYPE, SCHREIBEN_TASK_LABELS } from '@/types/schreiben';

type QuestionState = {
  isSubmitted: boolean;
  isLoading: boolean;
  assessment: AssessmentResult | null;
  error: string | null;
  isLoadingCached: boolean;
};

export default function SchreibenTestScreen() {
  const params = useLocalSearchParams<{
    level?: string;
    teil?: string;
    questions?: string;
  }>();

  const { user, profile, refreshProfile } = useAuth();
  const userId = user?.id ?? '';

  const level = params.level ?? profile?.target_level ?? 'A1';
  const teil = Number(params.teil ?? '1');

  const questions = useMemo<AppQuestion[]>(() => {
    try {
      return JSON.parse(params.questions ?? '[]') as AppQuestion[];
    } catch {
      return [];
    }
  }, [params.questions]);

  const taskType = useMemo(() => {
    return SCHREIBEN_TASK_TYPE[level]?.[teil] ?? 'form_fill';
  }, [level, teil]);

  const taskLabel = SCHREIBEN_TASK_LABELS[taskType] ?? taskType;

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [questionStates, setQuestionStates] = useState<Record<number, QuestionState>>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [totalScore, setTotalScore] = useState<number>(0);
  const [totalMaxScore, setTotalMaxScore] = useState<number>(0);
  const [showSummary, setShowSummary] = useState<boolean>(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const sessionStartTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (questions.length === 0 || !userId) return;

    const createSession = async () => {
      try {
        const examType = profile?.exam_type ?? 'TELC';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from('test_sessions') as any)
          .insert({
            user_id: userId,
            session_type: 'sectional',
            level,
            section: 'Schreiben',
            teil,
            exam_type: examType,
            score_pct: 0,
            questions_total: questions.length,
            questions_correct: 0,
            time_taken_seconds: 0,
            is_timed: false,
            completed_at: null,
          })
          .select('id')
          .single();

        if (error) {
          console.log('SchreibenTest createSession error', error);
          return;
        }
        console.log('SchreibenTest session created', (data as { id: string }).id);
        setSessionId((data as { id: string }).id);
      } catch (err) {
        console.log('SchreibenTest createSession unexpected error', err);
      }
    };

    void createSession();
  }, [userId, level, teil, questions.length, profile?.exam_type]);

  useEffect(() => {
    if (questions.length === 0) return;
    const target = ((currentIndex + 1) / questions.length) * 100;
    Animated.timing(progressAnim, {
      toValue: target,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentIndex, questions.length, progressAnim]);

  const checkedIndicesRef = useRef<Set<number>>(new Set());

  const checkCachedAssessment = useCallback(async (index: number) => {
    const question = questions[index];
    if (!question || !userId) return;

    if (checkedIndicesRef.current.has(index)) return;
    checkedIndicesRef.current.add(index);

    setQuestionStates((prev) => {
      const existing = prev[index];
      if (existing?.assessment || existing?.isLoading || existing?.isLoadingCached) return prev;
      return {
        ...prev,
        [index]: {
          isSubmitted: false,
          isLoading: false,
          assessment: null,
          error: null,
          isLoadingCached: true,
        },
      };
    });

    try {
      const cached = await fetchExistingSubmission(userId, question.id);
      if (cached) {
        console.log('SchreibenTest found cached assessment for question', index);
        setQuestionStates((prev) => ({
          ...prev,
          [index]: {
            isSubmitted: true,
            isLoading: false,
            assessment: cached,
            error: null,
            isLoadingCached: false,
          },
        }));
        setTotalScore((prev) => prev + cached.overall_score);
        setTotalMaxScore((prev) => prev + cached.max_score);
      } else {
        setQuestionStates((prev) => ({
          ...prev,
          [index]: {
            isSubmitted: false,
            isLoading: false,
            assessment: null,
            error: null,
            isLoadingCached: false,
          },
        }));
      }
    } catch (err) {
      console.log('SchreibenTest checkCachedAssessment error', err);
      checkedIndicesRef.current.delete(index);
      setQuestionStates((prev) => ({
        ...prev,
        [index]: {
          isSubmitted: false,
          isLoading: false,
          assessment: null,
          error: null,
          isLoadingCached: false,
        },
      }));
    }
  }, [questions, userId]);

  useEffect(() => {
    if (questions.length === 0 || !userId) return;
    void checkCachedAssessment(currentIndex);
  }, [currentIndex, questions.length, userId, checkCachedAssessment]);

  const currentQuestion = questions[currentIndex] ?? null;
  const currentState = questionStates[currentIndex] ?? {
    isSubmitted: false,
    isLoading: false,
    assessment: null,
    error: null,
    isLoadingCached: false,
  };

  const handleSubmit = useCallback(async (userText: string, wordCount: number) => {
    if (!currentQuestion) return;

    setQuestionStates((prev) => ({
      ...prev,
      [currentIndex]: { isSubmitted: true, isLoading: true, assessment: null, error: null, isLoadingCached: false },
    }));

    const timeoutId = setTimeout(() => {
      setQuestionStates((prev) => {
        const state = prev[currentIndex];
        if (state?.isLoading) {
          return {
            ...prev,
            [currentIndex]: {
              ...state,
              isLoading: false,
              error: 'Bewertung nicht verfügbar. Bitte versuche es später.',
            },
          };
        }
        return prev;
      });
    }, 15000);

    try {
      const result = await assessSchreiben(currentQuestion, userText, wordCount, taskType, sessionId);

      clearTimeout(timeoutId);

      setQuestionStates((prev) => ({
        ...prev,
        [currentIndex]: { isSubmitted: true, isLoading: false, assessment: result, error: null, isLoadingCached: false },
      }));

      setTotalScore((prev) => prev + result.overall_score);
      setTotalMaxScore((prev) => prev + result.max_score);

      if (userId) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('user_answers') as any).insert({
            session_id: sessionId,
            user_id: userId,
            question_id: currentQuestion.id,
            selected_answer: userText,
            is_correct: result.passed,
            time_taken_seconds: null,
          });
        } catch (err) {
          console.log('SchreibenTest save answer error', err);
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.log('SchreibenTest assessSchreiben error', err);
      setQuestionStates((prev) => ({
        ...prev,
        [currentIndex]: {
          isSubmitted: true,
          isLoading: false,
          assessment: null,
          error: 'Bewertung nicht verfügbar. Bitte versuche es später.',
          isLoadingCached: false,
        },
      }));
    }
  }, [currentQuestion, currentIndex, taskType, sessionId, userId]);

  const handleRetry = useCallback(() => {
    setQuestionStates((prev) => ({
      ...prev,
      [currentIndex]: { isSubmitted: false, isLoading: false, assessment: null, error: null, isLoadingCached: false },
    }));
  }, [currentIndex]);

  const finishTest = useCallback(async () => {
    if (!sessionId || !userId) {
      setShowSummary(true);
      return;
    }

    try {
      const timeTaken = Math.max(1, Math.round((Date.now() - sessionStartTimeRef.current) / 1000));
      const scorePct = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;
      const passedCount = Object.values(questionStates).filter((s) => s.assessment?.passed).length;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('test_sessions') as any)
        .update({
          score_pct: scorePct,
          questions_correct: passedCount,
          time_taken_seconds: timeTaken,
          completed_at: new Date().toISOString(),
          retest_available_at: getRetestDate(),
        })
        .eq('id', sessionId);

      const today = new Date().toISOString().split('T')[0] ?? '';
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0] ?? '';
      let newStreak = profile?.streak_count ?? 0;
      if (profile?.last_active_date === yesterday) {
        newStreak = (profile?.streak_count ?? 0) + 1;
      } else if (profile?.last_active_date !== today) {
        newStreak = 1;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('user_profiles') as any)
        .update({
          xp_total: (profile?.xp_total ?? 0) + passedCount,
          last_active_date: today,
          streak_count: newStreak,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      await updatePreparednessScore(userId, 5);
      await refreshProfile();
    } catch (err) {
      console.log('SchreibenTest finishTest error', err);
    }

    setShowSummary(true);
  }, [sessionId, userId, totalScore, totalMaxScore, questionStates, profile, refreshProfile]);

  const handleNext = useCallback(() => {
    if (currentIndex === questions.length - 1) {
      void finishTest();
      return;
    }
    setCurrentIndex((v) => v + 1);
  }, [currentIndex, questions.length, finishTest]);

  const handleBack = useCallback(() => {
    const hasAnswered = Object.keys(questionStates).length > 0;
    if (hasAnswered) {
      Alert.alert('Diesen Test verlassen?', 'Dein Fortschritt geht verloren.', [
        { text: 'Bleiben', style: 'cancel' },
        { text: 'Verlassen', style: 'destructive', onPress: () => router.back() },
      ]);
      return;
    }
    router.back();
  }, [questionStates]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  if (questions.length === 0) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Schreiben', headerShown: true }} />
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Keine Schreiben-Fragen verfügbar"
            description="Wir fügen bald neue Inhalte hinzu."
            actionLabel="Zurück"
            onActionPress={() => router.back()}
            testID="schreiben-empty-state"
          />
        </View>
      </View>
    );
  }

  if (showSummary) {
    const scorePct = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;
    const passedCount = Object.values(questionStates).filter((s) => s.assessment?.passed).length;

    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Ergebnis', headerBackVisible: false }} />
        <ScrollView contentContainerStyle={styles.summaryContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.summaryHero, shadows.card]}>
            <View style={styles.summaryIconWrap}>
              <PenLine color={colors.white} size={24} />
            </View>
            <Text style={styles.summaryTitle}>Schreiben · Teil {teil}</Text>
            <Text style={styles.summarySubtitle}>{level} · {taskLabel}</Text>
            <Text style={styles.summaryScore}>{totalScore} / {totalMaxScore}</Text>
            <Text style={styles.summaryPct}>{scorePct}%</Text>
            <Text style={styles.summaryPassed}>
              {passedCount} von {questions.length} bestanden
            </Text>
          </View>

          {questions.map((q, idx) => {
            const state = questionStates[idx];
            const a = state?.assessment;
            if (!a) return null;
            return (
              <View key={q.id} style={[styles.summaryItem, shadows.card]}>
                <View style={styles.summaryItemHeader}>
                  <Text style={[styles.summaryItemIcon, a.passed ? styles.greenText : styles.redText]}>
                    {a.passed ? '✓' : '✗'}
                  </Text>
                  <Text style={styles.summaryItemTitle}>Frage {idx + 1}</Text>
                  <Text style={styles.summaryItemScore}>{a.overall_score}/{a.max_score}</Text>
                </View>
                {a.encouragement ? (
                  <Text style={styles.summaryItemEncouragement}>{a.encouragement}</Text>
                ) : null}
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <CTAButton
            label="Zurück zu den Tests"
            onPress={() => router.replace('/(tabs)/tests')}
            style={styles.footerBtn}
            testID="back-to-tests"
          />
        </View>
      </View>
    );
  }

  const isLoadingCached = currentState.isLoadingCached;

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: '',
          headerLeft: () => (
            <Pressable
              accessibilityLabel="Zurück"
              onPress={handleBack}
              style={styles.headerBtn}
              testID="schreiben-back-button"
            >
              <Text style={styles.headerBtnText}>Zurück</Text>
            </Pressable>
          ),
        }}
      />

      <View style={styles.headerCard}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
        <View style={styles.headerRow}>
          <Text style={styles.counter}>
            Frage {Math.min(currentIndex + 1, questions.length)} von {questions.length}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.sectionPill}>
              <PenLine color={colors.white} size={11} />
              <Text style={styles.sectionPillText}>Schreiben</Text>
            </View>
            <Text style={styles.meta}>Teil {teil} · {level}</Text>
          </View>
        </View>
      </View>

      {isLoadingCached ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.blue} size="large" />
          <Text style={styles.loadingText}>Wird geladen...</Text>
        </View>
      ) : currentQuestion ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {currentState.assessment ? (
            <SchreibenResult
              assessment={currentState.assessment}
              taskType={taskType}
              level={level}
              teil={teil}
            />
          ) : (
            <SchreibenQuestion
              question={currentQuestion}
              task_type={taskType}
              onSubmit={handleSubmit}
              isSubmitted={currentState.isSubmitted}
              isLoading={currentState.isLoading}
              assessment={currentState.assessment}
            />
          )}

          {currentState.error ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>{currentState.error}</Text>
              <Pressable onPress={handleRetry} style={styles.retryBtn} testID="schreiben-retry">
                <Text style={styles.retryText}>Erneut versuchen</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      ) : null}

      {currentState.assessment && !currentState.isLoading ? (
        <View style={styles.footer}>
          <CTAButton
            label={currentIndex === questions.length - 1 ? 'Test abschließen' : 'Nächste Frage →'}
            onPress={handleNext}
            style={styles.footerBtn}
            testID="schreiben-next"
          />
        </View>
      ) : null}
    </View>
  );
}

function getRetestDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0] ?? '';
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  emptyWrap: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  headerBtn: {
    minHeight: 40,
    justifyContent: 'center',
    paddingRight: spacing.md,
  },
  headerBtnText: {
    color: colors.navy,
    fontWeight: '700' as const,
    fontSize: fontSize.bodyMd,
  },
  headerCard: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.ringTrack,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.blue,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  counter: {
    color: colors.navy,
    fontWeight: '800' as const,
    fontSize: fontSize.bodyMd,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: '#D84315',
  },
  sectionPillText: {
    color: colors.white,
    fontSize: fontSize.micro,
    fontWeight: '700' as const,
  },
  meta: {
    color: colors.muted,
    fontWeight: '600' as const,
    fontSize: fontSize.bodySm,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
    paddingBottom: 140,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  footerBtn: {
    marginHorizontal: 0,
  },
  errorWrap: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  errorText: {
    fontSize: fontSize.bodyMd,
    color: colors.red,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: {
    fontSize: fontSize.bodyMd,
    color: colors.navy,
    fontWeight: '700' as const,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.bodyMd,
    color: colors.muted,
    fontWeight: '600' as const,
  },
  summaryContent: {
    padding: spacing.xl,
    gap: spacing.lg,
    paddingBottom: 140,
  },
  summaryHero: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#D84315',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  summaryTitle: {
    fontSize: fontSize.displaySm,
    fontWeight: '800' as const,
    color: colors.white,
  },
  summarySubtitle: {
    fontSize: fontSize.bodyMd,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '600' as const,
  },
  summaryScore: {
    fontSize: 34,
    fontWeight: '800' as const,
    color: colors.white,
    marginTop: spacing.md,
  },
  summaryPct: {
    fontSize: fontSize.displayMd,
    fontWeight: '800' as const,
    color: colors.teal,
  },
  summaryPassed: {
    fontSize: fontSize.bodyMd,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '600' as const,
  },
  summaryItem: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  summaryItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryItemIcon: {
    fontSize: fontSize.bodyLg,
    fontWeight: '800' as const,
    width: 22,
  },
  greenText: {
    color: colors.green,
  },
  redText: {
    color: colors.red,
  },
  summaryItemTitle: {
    fontSize: fontSize.bodyMd,
    fontWeight: '700' as const,
    color: colors.navy,
    flex: 1,
  },
  summaryItemScore: {
    fontSize: fontSize.bodyMd,
    fontWeight: '800' as const,
    color: colors.navy,
  },
  summaryItemEncouragement: {
    fontSize: fontSize.bodySm,
    color: colors.muted,
    fontStyle: 'italic',
    paddingLeft: 30,
  },
});
