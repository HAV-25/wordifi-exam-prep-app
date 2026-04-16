import { useMutation, useQuery } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { BookOpenText, HelpCircle, Headphones, X } from 'lucide-react-native';
import React, { useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BAR_HEIGHT = 64;       // rendered bottom tab bar height
const BOTTOM_CONTENT_BUFFER = 24; // breathing room below last content item
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AudioPlayer } from '@/components/AudioPlayer';
import { EmptyState } from '@/components/EmptyState';
import { OptionButton } from '@/components/OptionButton';
import { QuestionCard } from '@/components/QuestionCard';
import { StimulusCard, shouldShowStimulus } from '@/components/StimulusCard';
import Colors from '@/constants/colors';
import { submitCompletedSession } from '@/lib/sessionHelpers';
import { supabase } from '@/lib/supabaseClient';
import { useQuestionMeta } from '@/lib/useQuestionTypeMeta';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';
import type { AppQuestion } from '@/types/database';

export default function PracticeScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ level?: string; section?: string; teil?: string; examType?: string }>();
  const { user, profile, refreshProfile } = useAuth();
  const level = params.level ?? profile?.target_level ?? 'A1';
  const section = params.section ?? 'Hören';
  const teil = Number(params.teil ?? '1');
  const examType = params.examType ?? profile?.exam_type ?? 'telc';
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showTooltip, setShowTooltip] = useState(false);
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
  const meta = useQuestionMeta(currentQuestion?.source_structure_type);
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

    const category = meta?.question_category;

    // True/False or Yes/No — binary horizontal layout
    if (category === 'true_false' || category === 'yes_no') {
      const fallbackOpts = category === 'yes_no'
        ? [{ key: 'ja', text: 'Ja' }, { key: 'nein', text: 'Nein' }]
        : [{ key: 'richtig', text: 'Richtig' }, { key: 'falsch', text: 'Falsch' }];
      const dbOptions = currentQuestion.options.length > 0
        ? currentQuestion.options
        : fallbackOpts;
      return (
        <View style={styles.binaryRow}>
          {dbOptions.map((option, index) => {
            const normalizedValue = option.key.toLowerCase();
            const isSelected = selectedAnswer === normalizedValue;
            return (
              <View key={`${currentQuestion.id}-${option.key}`} style={styles.binaryFlex}>
                <OptionButton
                  label={option.text}
                  variant="binary"
                  binaryPositive={index === 0}
                  selected={isSelected}
                  onPress={() => setAnswers((value) => ({ ...value, [currentQuestion.id]: normalizedValue }))}
                  testID={`option-${option.key}`}
                />
              </View>
            );
          })}
        </View>
      );
    }

    // Speaker Match (Hören + matching)
    if (category === 'matching' && section === 'Hören') {
      const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];
      return currentQuestion.options.map((option, index) => {
        const normalizedValue = option.key.toLowerCase();
        const isSelected = selectedAnswer === normalizedValue;
        const letter = (LETTERS[index] ?? String(index + 1)).toUpperCase();
        const badge = (
          <View style={styles.speakerBadge}>
            <Text style={styles.speakerBadgeText}>{letter}</Text>
          </View>
        );
        return (
          <OptionButton
            key={`${currentQuestion.id}-${option.key}`}
            label={option.text}
            leadingNode={badge}
            selected={isSelected}
            onPress={() => setAnswers((value) => ({ ...value, [currentQuestion.id]: normalizedValue }))}
            testID={`option-${option.key}`}
          />
        );
      });
    }

    // Default
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
        <View style={styles.headerRow}>
          <Text style={styles.counter}>Question {Math.min(currentIndex + 1, Math.max(questions.length, 1))} of {Math.max(questions.length, 1)}</Text>
          <View style={styles.metaZone}>
            <Pressable style={styles.helpBtn} onPress={() => setShowTooltip(true)}>
              <HelpCircle size={20} color={Colors.textMuted} />
            </Pressable>
            <View style={[styles.sectionPill, section === 'Hören' ? styles.horenPill : styles.lesenPill]}>
              {section === 'Hören'
                ? <Headphones color="#fff" size={11} />
                : <BookOpenText color="#fff" size={11} />}
              <Text style={styles.sectionPillText}>{section}</Text>
            </View>
            <View style={styles.metaTextBlock}>
              <Text style={styles.metaLevelTeil}>{level} · Teil {teil}</Text>
              <Text style={styles.metaTypeName}>{meta?.name_en ?? ''}</Text>
            </View>
          </View>
        </View>
      </View>

      {questionsQuery.isLoading ? (
        <View style={styles.loadingWrap}>{Array.from({ length: 3 }).map((_, index) => <View key={index} style={styles.skeleton} />)}</View>
      ) : questions.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState title="This Teil has no questions yet. We're adding content soon." description="Try another Teil or check back soon." actionLabel="Go Back" onActionPress={() => router.back()} testID="practice-empty-state" />
        </View>
      ) : currentQuestion ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + BOTTOM_CONTENT_BUFFER }]}>
          {section === 'Hören' && currentQuestion.audio_url ? <AudioPlayer audioUrl={currentQuestion.audio_url} /> : null}
          {section === 'Lesen' && currentQuestion.stimulus_text && shouldShowStimulus(level, section, teil) ? <StimulusCard text={currentQuestion.stimulus_text} type={currentQuestion.stimulus_type} /> : null}
          <QuestionCard title={currentQuestion.question_text} subtitle={currentQuestion.question_type.replace('_', ' ')}>
            {renderOptions()}
          </QuestionCard>
        </ScrollView>
      ) : null}

      {questions.length > 0 && currentQuestion ? (
        <View style={[styles.footer, { bottom: insets.bottom }]}>
          <Pressable accessibilityLabel={currentIndex === questions.length - 1 ? 'Submit test' : 'Next question'} disabled={!selectedAnswer || submitMutation.isPending} onPress={handleNext} style={[styles.nextButton, !selectedAnswer ? styles.nextButtonDisabled : null]} testID="next-question-button">
            <Text style={styles.nextButtonText}>{currentIndex === questions.length - 1 ? 'Submit Test' : 'Next'}</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal transparent animationType="fade" visible={showTooltip} onRequestClose={() => setShowTooltip(false)}>
        <Pressable style={styles.tooltipScrim} onPress={() => setShowTooltip(false)}>
          <Pressable style={styles.tooltipCard} onPress={() => {}}>
            <View style={styles.tooltipTitleRow}>
              <Text style={styles.tooltipTitle}>{meta?.name_en ?? ''}</Text>
              <Pressable onPress={() => setShowTooltip(false)}>
                <X size={18} color={Colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.tooltipBody}>{meta?.tooltip_en ?? ''}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  headerCard: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 10 },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: Colors.ringTrack, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: Colors.accent },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  counter: { color: Colors.primary, fontWeight: '800' },
  metaZone: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  helpBtn: { padding: 2 },
  sectionPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99 },
  horenPill: { backgroundColor: '#2B70EF' },
  lesenPill: { backgroundColor: '#6A1B9A' },
  sectionPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  metaTextBlock: { gap: 1 },
  metaLevelTeil: { fontSize: 12, color: Colors.textBody, fontWeight: '400' },
  metaTypeName: { fontSize: 12, color: Colors.textMuted, fontWeight: '400' },
  binaryRow: { flexDirection: 'row', gap: 10 },
  binaryFlex: { flex: 1 },
  speakerBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  speakerBadgeText: { fontSize: 16, fontWeight: '800', color: Colors.primary, fontFamily: 'Outfit_800ExtraBold' },
  tooltipScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.scrim, alignItems: 'center', justifyContent: 'center' },
  tooltipCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, maxWidth: 300, marginHorizontal: 24, width: '100%' },
  tooltipTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tooltipTitle: { fontSize: 14, fontWeight: '600', color: Colors.text, flex: 1 },
  tooltipBody: { fontSize: 13, fontWeight: '400', color: Colors.textBody, marginTop: 8, lineHeight: 19 },
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
