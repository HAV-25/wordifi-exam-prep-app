import { useMutation, useQuery } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AudioPlayer } from '@/components/AudioPlayer';
import { EmptyState } from '@/components/EmptyState';
import { OptionButton } from '@/components/OptionButton';
import { QuestionCard } from '@/components/QuestionCard';
import { StimulusCard } from '@/components/StimulusCard';
import Colors from '@/constants/colors';
import { submitCompletedSession } from '@/lib/sessionHelpers';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/providers/AuthProvider';
import type { AppQuestion } from '@/types/database';

export default function PracticeScreen() {
  const params = useLocalSearchParams<{ level?: string; section?: string; teil?: string; examType?: string }>();
  const { user, profile, refreshProfile } = useAuth();
  const level = params.level ?? profile?.target_level ?? 'A1';
  const section = params.section ?? 'Hören';
  const teil = Number(params.teil ?? '1');
  const examType = params.examType ?? profile?.exam_type ?? 'telc';
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const sessionStartTimeRef = useRef<number>(Date.now());

  const questionsQuery = useQuery({
    queryKey: ['questions', level, section, teil, examType],
    queryFn: async (): Promise<AppQuestion[]> => {
      let query = supabase
        .from('app_questions')
        .select('*')
        .eq('level', level)
        .eq('section', section)
        .eq('teil', teil)
        .eq('is_active', true)
        .order('question_number', { ascending: true });
      if (examType) {
        query = query.eq('exam_type', examType);
      }
      const { data, error } = await query;
      if (error) {
        console.log('PracticeScreen questions error', error);
        throw error;
      }
      return (data ?? []) as AppQuestion[];
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (questionList: AppQuestion[]) => {
      return submitCompletedSession({
        userId: user?.id ?? '',
        questions: questionList,
        answers,
        level,
        section,
        teil,
        examType,
        sessionStartTime: sessionStartTimeRef.current,
        profile,
      });
    },
    onSuccess: async (result, questionList) => {
      await refreshProfile();
      router.replace({
        pathname: '/results',
        params: {
          sessionId: result.sessionId,
          scorePct: String(result.scorePct),
          correctCount: String(result.correctCount),
          total: String(result.total),
          level,
          section,
          teil: String(teil),
          questions: JSON.stringify(questionList),
          answers: JSON.stringify(answers),
        },
      });
    },
  });

  const questions = questionsQuery.data ?? [];
  const currentQuestion = questions[currentIndex] ?? null;
  const progress = useMemo<number>(() => {
    if (questions.length === 0) {
      return 0;
    }
    return ((currentIndex + 1) / questions.length) * 100;
  }, [currentIndex, questions.length]);

  const selectedAnswer = currentQuestion ? answers[currentQuestion.id] ?? '' : '';

  const handleBack = () => {
    if (Object.keys(answers).length > 0) {
      Alert.alert('Leave this session?', 'Your progress will be lost.', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => router.back() },
      ]);
      return;
    }
    router.back();
  };

  const handleNext = async () => {
    if (!currentQuestion) {
      return;
    }
    if (currentIndex === questions.length - 1) {
      await submitMutation.mutateAsync(questions);
      return;
    }
    setCurrentIndex((value) => value + 1);
  };

  const renderOptions = () => {
    if (!currentQuestion) {
      return null;
    }
    return currentQuestion.options.map((option) => {
      const normalizedValue = option.key.toLowerCase();
      const isSelected = selectedAnswer === normalizedValue;
      return (
        <OptionButton
          key={`${currentQuestion.id}-${option.key}`}
          label={option.text}
          leading={option.key}
          selected={isSelected}
          onPress={() => setAnswers((value) => ({ ...value, [currentQuestion.id]: normalizedValue }))}
          testID={`option-${option.key}`}
        />
      );
    });
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'Practice',
          headerLeft: () => (
            <Pressable accessibilityLabel="Go back" onPress={handleBack} style={styles.headerButton} testID="practice-back-button">
              <Text style={styles.headerButtonText}>Back</Text>
            </Pressable>
          ),
        }}
      />
      <View style={styles.headerCard}>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
        <View style={styles.headerRow}><Text style={styles.counter}>Question {Math.min(currentIndex + 1, Math.max(questions.length, 1))} of {Math.max(questions.length, 1)}</Text><Text style={styles.meta}>{section} · Teil {teil} · {level}</Text></View>
      </View>

      {questionsQuery.isLoading ? (
        <View style={styles.loadingWrap}>{Array.from({ length: 3 }).map((_, index) => <View key={index} style={styles.skeleton} />)}</View>
      ) : questions.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState title="This Teil has no questions yet. We're adding content soon." description="Try another Teil or check back soon." actionLabel="Go Back" onActionPress={() => router.back()} testID="practice-empty-state" />
        </View>
      ) : currentQuestion ? (
        <ScrollView contentContainerStyle={styles.content}>
          {section === 'Hören' && currentQuestion.audio_url ? <AudioPlayer audioUrl={currentQuestion.audio_url} /> : null}
          {section === 'Lesen' && currentQuestion.stimulus_text ? <StimulusCard text={currentQuestion.stimulus_text} type={currentQuestion.stimulus_type} /> : null}
          <QuestionCard title={currentQuestion.question_text} subtitle={currentQuestion.question_type.replace('_', ' ')}>
            {renderOptions()}
          </QuestionCard>
        </ScrollView>
      ) : null}

      {questions.length > 0 && currentQuestion ? (
        <View style={styles.footer}>
          <Pressable accessibilityLabel={currentIndex === questions.length - 1 ? 'Submit test' : 'Next question'} disabled={!selectedAnswer || submitMutation.isPending} onPress={handleNext} style={[styles.nextButton, !selectedAnswer ? styles.nextButtonDisabled : null]} testID="next-question-button">
            <Text style={styles.nextButtonText}>{currentIndex === questions.length - 1 ? 'Submit Test' : 'Next'}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  headerCard: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 10 },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: Colors.ringTrack, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: Colors.accent },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  counter: { color: Colors.primary, fontWeight: '800' },
  meta: { color: Colors.textMuted, fontWeight: '600' },
  headerButton: { minHeight: 40, justifyContent: 'center', paddingRight: 12 },
  headerButtonText: { color: Colors.primary, fontWeight: '700' },
  loadingWrap: { padding: 20, gap: 12 },
  skeleton: { height: 120, borderRadius: 24, backgroundColor: Colors.surfaceMuted },
  emptyWrap: { flex: 1, padding: 20, justifyContent: 'center' },
  content: { padding: 20, gap: 14, paddingBottom: 120 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, backgroundColor: Colors.background },
  nextButton: { minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary },
  nextButtonDisabled: { opacity: 0.4 },
  nextButtonText: { color: Colors.surface, fontSize: 16, fontWeight: '800' },
});
