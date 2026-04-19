import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Headphones, BookOpenText, HelpCircle, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CTA_BUTTON_HEIGHT = 94;    // footer: 20px pad + 54px button + 20px pad
const BOTTOM_CONTENT_BUFFER = 24; // breathing room below last content item
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AudioPlayer } from '@/components/AudioPlayer';
import { OptionButton } from '@/components/OptionButton';
import { StimulusCard, shouldShowStimulus } from '@/components/StimulusCard';
import Colors from '@/constants/colors';
import { colors } from '@/theme';
import {
  completeSectionalSession,
  createSectionalSession,
} from '@/lib/sectionalHelpers';
import { useQuestionMeta } from '@/lib/useQuestionTypeMeta';
import { useAuth } from '@/providers/AuthProvider';
import type { AppQuestion } from '@/types/database';

export default function SectionalTestScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    level?: string;
    section?: string;
    teil?: string;
    examType?: string;
    isTimed?: string;
    timeLimitSeconds?: string;
    questions?: string;
  }>();

  const { user, profile, refreshProfile } = useAuth();
  const userId = user?.id ?? '';

  const level = params.level ?? profile?.target_level ?? 'A1';
  const section = params.section ?? 'Hören';
  const teil = Number(params.teil ?? '1');
  const examType = params.examType ?? profile?.exam_type ?? 'telc';
  const isTimed = params.isTimed === '1';
  const timeLimitSeconds = Number(params.timeLimitSeconds ?? '0');

  const questions = useMemo<AppQuestion[]>(() => {
    try {
      return JSON.parse(params.questions ?? '[]') as AppQuestion[];
    } catch {
      return [];
    }
  }, [params.questions]);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(timeLimitSeconds);
  const [showTooltip, setShowTooltip] = useState(false);

  const sessionStartTimeRef = useRef<number>(Date.now());
  const timerStartRef = useRef<number>(Date.now());
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerPulse = useRef(new Animated.Value(1)).current;

  const currentQuestion = questions[currentIndex] ?? null;
  const currentMeta = useQuestionMeta(currentQuestion?.source_structure_type);
  const selectedAnswer = currentQuestion ? (answers[currentQuestion.id] ?? '') : '';

  useEffect(() => {
    if (questions.length === 0 || !userId) return;

    createSectionalSession({
      userId,
      level,
      section,
      teil,
      examType,
      questionsTotal: questions.length,
      isTimed,
    })
      .then((id) => {
        console.log('SectionalTest session created', id);
        setSessionId(id);
      })
      .catch((err) => console.log('SectionalTest createSession error', err));
  }, [userId, level, section, teil, examType, questions.length, isTimed]);

  useEffect(() => {
    if (!isTimed || timeLimitSeconds <= 0) return;

    timerStartRef.current = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.round((Date.now() - timerStartRef.current) / 1000);
      const remaining = Math.max(0, timeLimitSeconds - elapsed);
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        handleAutoSubmit();
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimed, timeLimitSeconds]);

  useEffect(() => {
    if (isTimed && remainingSeconds <= 60 && remainingSeconds > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(timerPulse, { toValue: 1.15, duration: 400, useNativeDriver: true }),
          Animated.timing(timerPulse, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [isTimed, remainingSeconds, timerPulse]);

  useEffect(() => {
    if (questions.length === 0) return;
    const target = ((currentIndex + 1) / questions.length) * 100;
    Animated.timing(progressAnim, {
      toValue: target,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentIndex, questions.length, progressAnim]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting || !sessionId) return;
    setIsSubmitting(true);

    try {
      const timeTaken = Math.max(1, Math.round((Date.now() - sessionStartTimeRef.current) / 1000));
      const result = await completeSectionalSession({
        sessionId,
        userId,
        questions,
        answers,
        timeTakenSeconds: timeTaken,
        profile,
      });

      await refreshProfile();

      router.replace({
        pathname: '/sectional-results',
        params: {
          sessionId,
          scorePct: String(result.scorePct),
          correctCount: String(result.correctCount),
          total: String(result.total),
          level,
          section,
          teil: String(teil),
          isTimed: isTimed ? '1' : '0',
          timeTaken: String(timeTaken),
          questions: JSON.stringify(questions),
          answers: JSON.stringify(answers),
        },
      });
    } catch (err) {
      console.log('SectionalTest handleSubmit error', err);
      setIsSubmitting(false);
    }
  }, [isSubmitting, sessionId, userId, questions, answers, profile, refreshProfile, level, section, teil, isTimed]);

  const handleAutoSubmit = useCallback(() => {
    console.log('SectionalTest auto-submitting due to timer');
    void handleSubmit();
  }, [handleSubmit]);

  const handleBack = useCallback(() => {
    if (Object.keys(answers).length > 0) {
      Alert.alert('Leave this test?', 'Your progress will be lost.', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => router.back() },
      ]);
      return;
    }
    router.back();
  }, [answers]);

  const handleNext = useCallback(() => {
    if (!currentQuestion) return;

    if (currentIndex === questions.length - 1) {
      void handleSubmit();
      return;
    }
    setCurrentIndex((v) => v + 1);
  }, [currentIndex, questions.length, currentQuestion, handleSubmit]);

  const formatTime = useCallback((seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  const closeTooltip = useCallback(() => setShowTooltip(false), []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  if (questions.length === 0) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Sectional Test', headerShown: true }} />
        <View style={styles.emptyWrap}>
          <View style={styles.emptyContent}>
            <Text style={styles.emptyEmoji}>📚</Text>
            <Text style={styles.emptyTitle}>No questions available yet</Text>
            <Text style={styles.emptyDesc}>This section will be unlocked soon.</Text>
            <Pressable
              onPress={() => router.back()}
              style={styles.emptyBackButton}
              testID="sectional-empty-back"
            >
              <Text style={styles.emptyBackText}>Back</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const renderOptions = () => {
    if (!currentQuestion) return null;

    const category = currentMeta?.question_category;
    // For hybrid teils (e.g. B1 Hören T1), category is 'hybrid' but individual
    // questions have question_type 'true_false' or 'mcq'. Check both.
    const isBinaryByCategory = category === 'true_false' || category === 'yes_no';
    const isBinaryByQuestionType = currentQuestion.question_type === 'true_false' || currentQuestion.question_type === 'ja_nein';

    // True/False or Yes/No — binary horizontal layout
    if (isBinaryByCategory || isBinaryByQuestionType) {
      const isYesNo = category === 'yes_no' || currentQuestion.question_type === 'ja_nein';
      const fallbackOpts = isYesNo
        ? [{ key: 'ja', text: 'Ja' }, { key: 'nein', text: 'Nein' }]
        : [{ key: 'richtig', text: 'Richtig' }, { key: 'falsch', text: 'Falsch' }];
      const opts = currentQuestion.options?.length > 0
        ? currentQuestion.options
        : fallbackOpts;

      return (
        <View style={styles.binaryRow}>
          {opts.map((option, idx) => {
            const normalizedKey = option.key.toLowerCase();
            const isSelected = selectedAnswer === normalizedKey;
            return (
              <View key={`${currentQuestion.id}-${option.key}`} style={styles.binaryFlex}>
                <OptionButton
                  label={option.text}
                  variant="binary"
                  binaryPositive={idx === 0}
                  selected={isSelected}
                  onPress={() =>
                    setAnswers((prev) => ({
                      ...prev,
                      [currentQuestion.id]: normalizedKey,
                    }))
                  }
                  testID={`sectional-option-${option.key}`}
                />
              </View>
            );
          })}
        </View>
      );
    }

    // Speaker matching (Hören)
    if (category === 'matching' && section === 'Hören') {
      const opts = currentQuestion.options?.length > 0
        ? currentQuestion.options
        : [];

      const letters = ['a', 'b', 'c', 'd'];
      return opts.map((option, idx) => {
        const normalizedKey = option.key.toLowerCase();
        const isSelected = selectedAnswer === normalizedKey;
        const badgeLetter = letters[idx] ?? option.key.toLowerCase();
        const leadingNode = (
          <View style={styles.speakerBadge}>
            <Text style={styles.speakerBadgeText}>{badgeLetter}</Text>
          </View>
        );
        return (
          <OptionButton
            key={`${currentQuestion.id}-${option.key}`}
            label={option.text}
            leadingNode={leadingNode}
            selected={isSelected}
            onPress={() =>
              setAnswers((prev) => ({
                ...prev,
                [currentQuestion.id]: normalizedKey,
              }))
            }
            testID={`sectional-option-${option.key}`}
          />
        );
      });
    }

    // Default (multiple choice, matching, etc.)
    const opts = currentQuestion.options?.length > 0
      ? currentQuestion.options
      : [];

    return opts.map((option) => {
      const normalizedKey = option.key.toLowerCase();
      const isSelected = selectedAnswer === normalizedKey;
      return (
        <OptionButton
          key={`${currentQuestion.id}-${option.key}`}
          label={option.text}
          leading={option.key}
          selected={isSelected}
          onPress={() =>
            setAnswers((prev) => ({
              ...prev,
              [currentQuestion.id]: normalizedKey,
            }))
          }
          testID={`sectional-option-${option.key}`}
        />
      );
    });
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: '',
          headerLeft: () => (
            <Pressable
              accessibilityLabel="Go back"
              onPress={handleBack}
              style={styles.headerBtn}
              testID="sectional-back-button"
            >
              <Text style={styles.headerBtnText}>Back</Text>
            </Pressable>
          ),
          headerRight: isTimed
            ? () => (
                <Animated.View style={[
                  styles.timerChip,
                  remainingSeconds <= 60 ? styles.timerChipUrgent : null,
                  remainingSeconds <= 60 ? { transform: [{ scale: timerPulse }] } : null,
                ]}>
                  <Text style={[
                    styles.timerText,
                    remainingSeconds <= 60 ? styles.timerTextUrgent : null,
                  ]}>
                    {formatTime(remainingSeconds)}
                  </Text>
                </Animated.View>
              )
            : undefined,
        }}
      />

      <View style={styles.headerCard}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
        <View style={styles.headerRow}>
          <Text style={styles.counter}>
            Question {Math.min(currentIndex + 1, questions.length)} of {questions.length}
          </Text>
          <View style={styles.metaRow}>
            <Pressable onPress={() => setShowTooltip(true)} style={styles.helpBtn}>
              <HelpCircle color={Colors.textMuted} size={20} />
            </Pressable>
            <View style={[styles.sectionPill, section === 'Hören' ? styles.horenPill : styles.lesenPill]}>
              {section === 'Hören' ? (
                <Headphones color="#fff" size={11} />
              ) : (
                <BookOpenText color="#fff" size={11} />
              )}
              <Text style={styles.sectionPillText}>{section}</Text>
            </View>
            <View style={styles.metaTextBlock}>
              <Text style={styles.metaLevelTeil}>{level} · Teil {teil}</Text>
              <Text style={styles.metaTypeName}>{currentMeta?.name_en ?? ''}</Text>
            </View>
          </View>
        </View>
      </View>

      {currentQuestion ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + CTA_BUTTON_HEIGHT + BOTTOM_CONTENT_BUFFER }]} showsVerticalScrollIndicator={false}>
          {section === 'Hören' && currentQuestion.audio_url ? (
            <AudioPlayer audioUrl={currentQuestion.audio_url} />
          ) : null}

          {currentQuestion.stimulus_text && shouldShowStimulus(level, section, teil) ? (
            <StimulusCard
              text={currentQuestion.stimulus_text}
              type={currentQuestion.stimulus_type}
              collapsible={section === 'Lesen'}
            />
          ) : null}

          <View style={styles.questionCard}>
            {currentQuestion.question_text ? (
              <Text style={styles.questionText}>{currentQuestion.question_text}</Text>
            ) : null}
          </View>

          <View style={styles.optionsWrap}>
            {renderOptions()}
          </View>
        </ScrollView>
      ) : null}

      {currentQuestion ? (
        <View style={[styles.footer, { bottom: insets.bottom }]}>
          <Pressable
            accessibilityLabel={
              currentIndex === questions.length - 1 ? 'Submit test' : 'Next question'
            }
            disabled={!selectedAnswer || isSubmitting}
            onPress={handleNext}
            style={[
              styles.nextButton,
              (!selectedAnswer || isSubmitting) ? styles.nextButtonDisabled : null,
            ]}
            testID="sectional-next-button"
          >
            <Text style={styles.nextButtonText}>
              {isSubmitting
                ? 'Submitting...'
                : currentIndex === questions.length - 1
                ? 'Submit Test'
                : 'Next'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Modal
        transparent
        animationType="fade"
        visible={showTooltip}
        onRequestClose={closeTooltip}
      >
        <Pressable style={styles.tooltipScrim} onPress={closeTooltip}>
          <Pressable style={styles.tooltipCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.tooltipTitleRow}>
              <Text style={styles.tooltipTitle}>{currentMeta?.name_en ?? ''}</Text>
              <Pressable onPress={closeTooltip}>
                <X color={Colors.textMuted} size={18} />
              </Pressable>
            </View>
            <Text style={styles.tooltipBody}>{currentMeta?.tooltip_en ?? ''}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  emptyWrap: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  headerBtn: {
    minHeight: 40,
    justifyContent: 'center',
    paddingRight: 12,
  },
  headerBtnText: {
    color: Colors.primary,
    fontWeight: '700' as const,
  },
  timerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: Colors.surfaceMuted,
  },
  timerChipUrgent: {
    backgroundColor: Colors.dangerSoft,
  },
  timerText: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: Colors.primary,
    fontVariant: ['tabular-nums'],
  },
  timerTextUrgent: {
    color: Colors.danger,
  },
  headerCard: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: Colors.ringTrack,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.accent,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  counter: {
    color: Colors.primary,
    fontWeight: '800' as const,
    fontSize: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helpBtn: {
    padding: 2,
  },
  metaTextBlock: {
    gap: 2,
  },
  metaLevelTeil: {
    fontSize: 12,
    color: Colors.textBody,
    fontWeight: '400' as const,
  },
  metaTypeName: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '400' as const,
  },
  sectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
  },
  horenPill: {
    backgroundColor: colors.blue,
  },
  lesenPill: {
    backgroundColor: '#6A1B9A',
  },
  sectionPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  meta: {
    color: Colors.textMuted,
    fontWeight: '600' as const,
    fontSize: 13,
  },
  content: {
    padding: 20,
    gap: 14,
    paddingBottom: 120,
  },
  questionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 10,
  },
  questionType: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  questionText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  optionsWrap: {
    gap: 10,
  },
  binaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  binaryFlex: {
    flex: 1,
  },
  speakerBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakerBadgeText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: Colors.primary,
    fontFamily: 'Outfit_800ExtraBold',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    backgroundColor: Colors.background,
  },
  nextButton: {
    minHeight: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  nextButtonDisabled: {
    opacity: 0.4,
  },
  nextButtonText: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: '800' as const,
  },
  emptyContent: {
    alignItems: 'center',
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.primary,
    textAlign: 'center' as const,
  },
  emptyDesc: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center' as const,
  },
  emptyBackButton: {
    marginTop: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  emptyBackText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  tooltipScrim: {
    flex: 1,
    backgroundColor: Colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    maxWidth: 300,
    marginHorizontal: 24,
    width: '100%' as const,
  },
  tooltipTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tooltipTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  tooltipBody: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: Colors.textBody,
    marginTop: 8,
    lineHeight: 19,
  },
});
