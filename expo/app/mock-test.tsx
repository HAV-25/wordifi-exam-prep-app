import { Stack, router } from 'expo-router';
import { Headphones, BookOpenText, AlertTriangle, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CTA_BUTTON_HEIGHT = 56;    // primary CTA / footer height
const BOTTOM_CONTENT_BUFFER = 24; // breathing room below last content item
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { AppHeader } from '@/components/AppHeader';
import { AudioPlayer } from '@/components/AudioPlayer';
import { OptionButton } from '@/components/OptionButton';
import { StimulusCard, shouldShowStimulus } from '@/components/StimulusCard';
import Colors from '@/constants/colors';
import { colors } from '@/theme';
import {
  abandonMockTest,
  completeMockTest,
  createMockTest,
  getMockTiming,
} from '@/lib/mockHelpers';
import { useAuth } from '@/providers/AuthProvider';
import type { AppQuestion } from '@/types/database';

type MockPhase = 'horen' | 'transition' | 'lesen' | 'sprachbausteine' | 'submitting';
type SprachSubPhase = 't1' | 't2';
type BlankAnswers = Record<string, string>;

export default function MockTestScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    level?: string;
    examType?: string;
    isTimed?: string;
    horenQuestions?: string;
    lesenQuestions?: string;
    sprachbausteineT1Question?: string;
    sprachbausteineT2Question?: string;
  }>();

  const { user, profile, refreshProfile } = useAuth();
  const userId = user?.id ?? '';

  const level = params.level ?? profile?.target_level ?? 'A1';
  const examType = profile?.exam_type ?? 'TELC';
  const isTimed = params.isTimed === '1';

  const horenQuestions = useMemo<AppQuestion[]>(() => {
    try {
      return JSON.parse(params.horenQuestions ?? '[]') as AppQuestion[];
    } catch {
      return [];
    }
  }, [params.horenQuestions]);

  const lesenQuestions = useMemo<AppQuestion[]>(() => {
    try {
      return JSON.parse(params.lesenQuestions ?? '[]') as AppQuestion[];
    } catch {
      return [];
    }
  }, [params.lesenQuestions]);

  const sprachbausteineT1 = useMemo<AppQuestion | null>(() => {
    try { return JSON.parse(params.sprachbausteineT1Question ?? 'null') as AppQuestion; }
    catch { return null; }
  }, [params.sprachbausteineT1Question]);

  const sprachbausteineT2 = useMemo<AppQuestion | null>(() => {
    try { return JSON.parse(params.sprachbausteineT2Question ?? 'null') as AppQuestion; }
    catch { return null; }
  }, [params.sprachbausteineT2Question]);

  const hasSprachbausteine = Boolean(sprachbausteineT1 && sprachbausteineT2);

  const allQuestions = useMemo(() => [...horenQuestions, ...lesenQuestions], [horenQuestions, lesenQuestions]);
  const totalQuestions = allQuestions.length + (hasSprachbausteine ? 1 : 0); // +1 represents the combined sprachbausteine block in progress

  const [phase, setPhase] = useState<MockPhase>(horenQuestions.length > 0 ? 'horen' : 'lesen');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [mockTestId, setMockTestId] = useState<string>('');
  const [horenCorrectCount, setHorenCorrectCount] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  // Sprachbausteine phase state
  const [sprachSubPhase, setSprachSubPhase] = useState<SprachSubPhase>('t1');
  const [t1Answers, setT1Answers] = useState<BlankAnswers>({});
  const [t2Answers, setT2Answers] = useState<BlankAnswers>({});
  const [t1SelectedBlank, setT1SelectedBlank] = useState<string | null>(null);

  const sessionStartTimeRef = useRef<number>(Date.now());
  const sectionTimerStartRef = useRef<number>(Date.now());
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerPulse = useRef(new Animated.Value(1)).current;

  const timing = getMockTiming(level);
  const currentSectionTimeLimitSeconds = useMemo(() => {
    if (!isTimed) return 0;
    if (phase === 'horen') return timing.horenMinutes * 60;
    if (phase === 'lesen') return timing.lesenMinutes * 60;
    return 0;
  }, [isTimed, phase, timing]);

  const currentQuestions = useMemo(() => {
    if (phase === 'horen') return horenQuestions;
    if (phase === 'lesen') return lesenQuestions;
    return [];
  }, [phase, horenQuestions, lesenQuestions]);

  const currentQuestion = currentQuestions[currentIndex] ?? null;
  const selectedAnswer = currentQuestion ? (answers[currentQuestion.id] ?? '') : '';

  const globalQuestionIndex = useMemo(() => {
    if (phase === 'horen') return currentIndex;
    return horenQuestions.length + currentIndex;
  }, [phase, currentIndex, horenQuestions.length]);

  useEffect(() => {
    if (totalQuestions === 0 || !userId) return;

    createMockTest({
      userId,
      level,
      examType,
      isTimed,
    })
      .then((id) => {
        console.log('MockTest created', id);
        setMockTestId(id);
      })
      .catch((err) => console.log('MockTest create error', err));
  }, [userId, level, examType, isTimed, totalQuestions]);

  useEffect(() => {
    if (!isTimed || currentSectionTimeLimitSeconds <= 0 || phase === 'transition' || phase === 'submitting') return;

    sectionTimerStartRef.current = Date.now();
    setRemainingSeconds(currentSectionTimeLimitSeconds);

    const interval = setInterval(() => {
      const elapsed = Math.round((Date.now() - sectionTimerStartRef.current) / 1000);
      const remaining = Math.max(0, currentSectionTimeLimitSeconds - elapsed);
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        handleSectionTimeout();
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimed, currentSectionTimeLimitSeconds, phase]);

  useEffect(() => {
    if (isTimed && remainingSeconds <= 60 && remainingSeconds > 0 && phase !== 'transition') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(timerPulse, { toValue: 1.15, duration: 400, useNativeDriver: true }),
          Animated.timing(timerPulse, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [isTimed, remainingSeconds, timerPulse, phase]);

  useEffect(() => {
    if (totalQuestions === 0) return;
    const target = ((globalQuestionIndex + 1) / totalQuestions) * 100;
    Animated.timing(progressAnim, {
      toValue: target,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [globalQuestionIndex, totalQuestions, progressAnim]);

  const handleSectionTimeout = useCallback(() => {
    console.log('MockTest section timeout', phase);
    if (phase === 'horen') {
      const correct = horenQuestions.reduce((count, q) => {
        const sel = (answers[q.id] ?? '').toLowerCase();
        return sel === q.correct_answer.toLowerCase() ? count + 1 : count;
      }, 0);
      setHorenCorrectCount(correct);

      if (lesenQuestions.length > 0) {
        setPhase('transition');
        setCurrentIndex(0);
      } else {
        void handleSubmit();
      }
    } else if (phase === 'lesen') {
      if (hasSprachbausteine) {
        setPhase('sprachbausteine');
        setSprachSubPhase('t1');
        setCurrentIndex(0);
      } else {
        void handleSubmit();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, horenQuestions, lesenQuestions, answers, hasSprachbausteine]);

  const handleSubmit = useCallback(async () => {
    if (phase === 'submitting') return;
    setPhase('submitting');

    try {
      const timeTaken = Math.max(1, Math.round((Date.now() - sessionStartTimeRef.current) / 1000));
      const result = await completeMockTest({
        mockTestId,
        userId,
        level,
        examType,
        isTimed,
        horenQuestions,
        lesenQuestions,
        answers,
        timeTakenSeconds: timeTaken,
        profile,
        sprachbausteineT1Question: sprachbausteineT1,
        sprachbausteineT2Question: sprachbausteineT2,
        t1Answers,
        t2Answers,
      });

      await refreshProfile();

      router.replace({
        pathname: '/mock-results',
        params: {
          mockTestId,
          horenCorrect: String(result.horenCorrect),
          horenTotal: String(result.horenTotal),
          horenPct: String(result.horenPct),
          lesenCorrect: String(result.lesenCorrect),
          lesenTotal: String(result.lesenTotal),
          lesenPct: String(result.lesenPct),
          sprachbausteineCorrect: String(result.sprachbausteineCorrect),
          sprachbausteineTotal: String(result.sprachbausteineTotal),
          sprachbausteinePct: String(result.sprachbausteinePct),
          overallPct: String(result.overallPct),
          totalCorrect: String(result.totalCorrect),
          totalQuestions: String(result.totalQuestions),
          level,
          isTimed: isTimed ? '1' : '0',
          timeTaken: String(timeTaken),
          horenQuestions: params.horenQuestions ?? '[]',
          lesenQuestions: params.lesenQuestions ?? '[]',
          answers: JSON.stringify(answers),
          studyPlan: JSON.stringify(result.studyPlan),
        },
      });
    } catch (err) {
      console.log('MockTest handleSubmit error', err);
      setPhase(hasSprachbausteine ? 'sprachbausteine' : lesenQuestions.length > 0 ? 'lesen' : 'horen');
    }
  }, [phase, mockTestId, userId, level, examType, isTimed, horenQuestions, lesenQuestions, answers, profile, refreshProfile, params.horenQuestions, params.lesenQuestions, sprachbausteineT1, sprachbausteineT2, t1Answers, t2Answers, hasSprachbausteine]);

  const handleBack = useCallback(() => {
    if (Object.keys(answers).length > 0) {
      Alert.alert(
        'Abandon this mock test?',
        'Your progress will be lost and this attempt will count as incomplete.',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Abandon',
            style: 'destructive',
            onPress: () => {
              if (mockTestId) {
                abandonMockTest(mockTestId).catch(() => {});
              }
              router.back();
            },
          },
        ]
      );
      return;
    }
    router.back();
  }, [answers, mockTestId]);

  const handleNext = useCallback(() => {
    if (!currentQuestion) return;

    if (currentIndex === currentQuestions.length - 1) {
      if (phase === 'horen' && lesenQuestions.length > 0) {
        const correct = horenQuestions.reduce((count, q) => {
          const sel = (answers[q.id] ?? '').toLowerCase();
          return sel === q.correct_answer.toLowerCase() ? count + 1 : count;
        }, 0);
        setHorenCorrectCount(correct);
        setPhase('transition');
        setCurrentIndex(0);
        return;
      }
      // After lesen, go to sprachbausteine if available (B1 only)
      if (phase === 'lesen' && hasSprachbausteine) {
        setPhase('sprachbausteine');
        setSprachSubPhase('t1');
        setCurrentIndex(0);
        return;
      }
      void handleSubmit();
      return;
    }
    setCurrentIndex((v) => v + 1);
  }, [currentIndex, currentQuestions.length, currentQuestion, phase, lesenQuestions.length, horenQuestions, answers, handleSubmit, hasSprachbausteine]);

  const handleContinueToLesen = useCallback(() => {
    setPhase('lesen');
    setCurrentIndex(0);
  }, []);

  const formatTime = useCallback((seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  if (totalQuestions === 0) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <AppHeader />
        <View style={styles.emptyWrap}>
          <View style={styles.emptyContent}>
            <Text style={styles.emptyEmoji}>📚</Text>
            <Text style={styles.emptyTitle}>Noch keine Fragen verfügbar</Text>
            <Text style={styles.emptyDesc}>Dieser Abschnitt wird bald freigeschaltet.</Text>
            <Pressable
              onPress={() => router.back()}
              style={styles.emptyBackButton}
              testID="mock-test-empty-back"
            >
              <Text style={styles.emptyBackText}>Zurück</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (phase === 'transition') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <AppHeader />
        <View style={styles.transitionContainer}>
          <View style={styles.transitionCard}>
            <View style={styles.transitionIconWrap}>
              <Headphones color="#fff" size={28} />
            </View>
            <Text style={styles.transitionTitle}>Hören Complete</Text>
            <Text style={styles.transitionScore}>
              {horenCorrectCount} / {horenQuestions.length} correct
            </Text>

            <View style={styles.transitionDivider} />

            <View style={styles.transitionNextWrap}>
              <View style={styles.transitionNextIcon}>
                <BookOpenText color="#fff" size={24} />
              </View>
              <Text style={styles.transitionNextLabel}>Next: Lesen</Text>
              <Text style={styles.transitionNextCount}>
                {lesenQuestions.length} questions
              </Text>
              {isTimed ? (
                <Text style={styles.transitionTimer}>
                  Time: {timing.lesenMinutes} min
                </Text>
              ) : null}
            </View>

            <Pressable
              accessibilityLabel="Continue to Lesen"
              onPress={handleContinueToLesen}
              style={styles.transitionButton}
              testID="continue-to-lesen"
            >
              <Text style={styles.transitionButtonText}>Continue to Lesen</Text>
            </Pressable>

            <View style={styles.warningRow}>
              <AlertTriangle color="#F57F17" size={14} />
              <Text style={styles.warningSmall}>You cannot go back to Hören</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (phase === 'sprachbausteine' && sprachbausteineT1 && sprachbausteineT2) {
    const isT1 = sprachSubPhase === 't1';
    const currentQ = isT1 ? sprachbausteineT1 : sprachbausteineT2;

    // Parse T1 word bank
    const t1Opt = (sprachbausteineT1.options as unknown as Array<Record<string, unknown>>)?.[0];
    const t1Words: string[] = isT1 && t1Opt?.['type'] === 'word_bank'
      ? (t1Opt['words'] as string[]) ?? []
      : [];
    const t1PlacedWords = new Set(Object.values(t1Answers));
    const t1StimulusParts = sprachbausteineT1.stimulus_text
      ? sprachbausteineT1.stimulus_text.split(/\((\d+)\)/).map((p, i) =>
          i % 2 === 1 ? { kind: 'gap' as const, num: p } : { kind: 'text' as const, value: p }
        )
      : [];

    // Parse T2 MCQ
    const t2Opts = !isT1
      ? (sprachbausteineT2.options as unknown as Array<{ blank: number; choices: { id: string; text: string }[] }>) ?? []
      : [];
    const t2StimulusParts = sprachbausteineT2.stimulus_text
      ? sprachbausteineT2.stimulus_text.split(/\((\d+)\)/).map((p, i) =>
          i % 2 === 1 ? { kind: 'gap' as const, num: p } : { kind: 'text' as const, value: p }
        )
      : [];

    const t1AllFilled = t1Words.length > 0 && Object.keys(t1Answers).length === 10;
    const t2AllAnswered = t2Opts.length > 0 && t2Opts.every((o) => t2Answers[String(o.blank)]);
    const canProceed = isT1 ? t1AllFilled : t2AllAnswered;

    const handleT1GapPress = (num: string) => {
      if (t1Answers[num]) {
        setT1Answers((prev) => { const n = { ...prev }; delete n[num]; return n; });
        setT1SelectedBlank(null);
      } else {
        setT1SelectedBlank((prev) => prev === num ? null : num);
      }
    };

    const handleWordPress = (word: string) => {
      if (t1SelectedBlank) {
        setT1Answers((prev) => ({ ...prev, [t1SelectedBlank]: word }));
        setT1SelectedBlank(null);
      } else {
        const nextEmpty = t1StimulusParts
          .filter((p) => p.kind === 'gap')
          .map((p) => (p as { kind: 'gap'; num: string }).num)
          .find((n) => !t1Answers[n]);
        if (nextEmpty) setT1Answers((prev) => ({ ...prev, [nextEmpty]: word }));
      }
    };

    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <AppHeader
          rightElement={
            <Pressable
              accessibilityLabel="Close test"
              onPress={handleBack}
              style={styles.closeBtn}
              hitSlop={8}
            >
              <X color={Colors.textMuted} size={20} />
            </Pressable>
          }
        />
        <View style={styles.headerCard}>
          <View style={styles.mockBadgeRow}>
            <View style={styles.mockBadge}>
              <Text style={styles.mockBadgeText}>Mock Exam</Text>
            </View>
            <View style={[styles.sectionPill, styles.sprachbausteinePill]}>
              <Text style={styles.sectionPillText}>Sprachbausteine T{isT1 ? '1' : '2'}</Text>
            </View>
            <Text style={styles.meta}>{level}</Text>
          </View>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + CTA_BUTTON_HEIGHT + BOTTOM_CONTENT_BUFFER }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sprachSectionLabel}>
            {isT1
              ? 'Teil 1 — Ergänzen Sie die Lücken mit Wörtern aus dem Wortkasten'
              : 'Teil 2 — Wählen Sie die richtige Antwort (a, b oder c)'}
          </Text>

          {/* Stimulus with gaps */}
          <View style={styles.sprachStimulusCard}>
            <Text style={styles.sprachStimulusBody}>
              {(isT1 ? t1StimulusParts : t2StimulusParts).map((part, i) => {
                if (part.kind === 'text') {
                  return <Text key={i} style={styles.sprachStimulusText}>{part.value}</Text>;
                }
                if (isT1) {
                  const word = t1Answers[part.num];
                  const isSelected = t1SelectedBlank === part.num;
                  return (
                    <Pressable
                      key={i}
                      onPress={() => handleT1GapPress(part.num)}
                      style={[
                        styles.sprachGapChip,
                        word ? styles.sprachGapFilled : styles.sprachGapEmpty,
                        isSelected && styles.sprachGapSelected,
                      ]}
                    >
                      <Text style={[styles.sprachGapText, !word && styles.sprachGapTextEmpty]}>
                        {word ?? `(${part.num})`}
                      </Text>
                    </Pressable>
                  );
                }
                return (
                  <View key={i} style={styles.sprachT2InlineGap}>
                    <Text style={styles.sprachT2InlineGapNum}>({part.num})</Text>
                  </View>
                );
              })}
            </Text>
          </View>

          {/* T1: Word bank */}
          {isT1 && (
            <View style={styles.sprachWordBank}>
              <View style={styles.sprachWordBankHeader}>
                <Text style={styles.sprachWordBankTitle}>Wortkasten</Text>
                <Text style={styles.sprachWordBankCount}>
                  {t1Words.filter((w) => !t1PlacedWords.has(w)).length} übrig
                </Text>
              </View>
              <View style={styles.sprachWordChipRow}>
                {t1Words.map((word) => {
                  const isPlaced = t1PlacedWords.has(word);
                  return (
                    <Pressable
                      key={word}
                      onPress={() => !isPlaced && handleWordPress(word)}
                      disabled={isPlaced}
                      style={[styles.sprachWordChip, isPlaced && styles.sprachWordChipUsed]}
                    >
                      <Text style={[styles.sprachWordChipText, isPlaced && styles.sprachWordChipTextUsed]}>
                        {word}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* T2: Per-blank choices */}
          {!isT1 && (
            <View style={styles.sprachT2Choices}>
              {t2Opts.map((blankOpt) => {
                const blankKey = String(blankOpt.blank);
                const selected = t2Answers[blankKey];
                return (
                  <View key={blankKey} style={styles.sprachT2BlankRow}>
                    <Text style={styles.sprachT2BlankNum}>({blankOpt.blank})</Text>
                    <View style={styles.sprachT2ChoiceButtons}>
                      {blankOpt.choices.map((choice) => (
                        <Pressable
                          key={choice.id}
                          onPress={() => setT2Answers((prev) => ({ ...prev, [blankKey]: choice.id }))}
                          style={[
                            styles.sprachT2ChoiceBtn,
                            selected === choice.id && styles.sprachT2ChoiceBtnSelected,
                          ]}
                        >
                          <Text style={[styles.sprachT2ChoiceId, selected === choice.id && styles.sprachT2ChoiceIdSelected]}>
                            {choice.id}
                          </Text>
                          <Text style={[styles.sprachT2ChoiceText, selected === choice.id && styles.sprachT2ChoiceTextSelected]}>
                            {choice.text}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { bottom: insets.bottom }]}>
          <Pressable
            accessibilityLabel={isT1 ? 'Continue to Teil 2' : 'Submit Mock Test'}
            disabled={!canProceed}
            onPress={() => {
              if (isT1) {
                setSprachSubPhase('t2');
              } else {
                void handleSubmit();
              }
            }}
            style={[styles.nextButton, !canProceed && styles.nextButtonDisabled]}
          >
            <Text style={styles.nextButtonText}>
              {isT1 ? 'Weiter zu Teil 2 →' : 'Submit Mock Test'}
            </Text>
          </Pressable>
          {isT1 && !t1AllFilled && (
            <Text style={styles.sprachFooterHint}>
              {Object.keys(t1Answers).length}/10 Lücken ausgefüllt
            </Text>
          )}
        </View>
      </View>
    );
  }

  if (phase === 'submitting') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <AppHeader />
        <View style={styles.submittingWrap}>
          <Text style={styles.submittingEmoji}>📝</Text>
          <Text style={styles.submittingTitle}>Submitting your exam...</Text>
          <Text style={styles.submittingSubtitle}>Calculating your results</Text>
        </View>
      </View>
    );
  }

  const section = phase === 'horen' ? 'Hören' : 'Lesen';
  const isLastQuestion = currentIndex === currentQuestions.length - 1;
  // After lesen, sprachbausteine comes next (B1); after hören, lesen is next
  const isLastSection = (phase === 'lesen' && !hasSprachbausteine) || lesenQuestions.length === 0;
  const buttonLabel = isLastQuestion && isLastSection
    ? 'Submit Mock Test'
    : isLastQuestion && phase === 'lesen' && hasSprachbausteine
    ? 'Continue to Sprachbausteine'
    : isLastQuestion && !isLastSection
    ? 'Continue to Lesen'
    : 'Next';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Brand header */}
      <AppHeader
        rightElement={
          <Pressable
            accessibilityLabel="Abort test"
            onPress={handleBack}
            style={styles.closeBtn}
            testID="mock-back-button"
            hitSlop={8}
          >
            <X color={Colors.textMuted} size={20} />
          </Pressable>
        }
      />

      <View style={styles.headerCard}>
        {isTimed ? (
          <View style={styles.timerRow}>
            <Animated.View
              style={[
                styles.timerChip,
                remainingSeconds <= 60 ? styles.timerChipUrgent : null,
                remainingSeconds <= 60 ? { transform: [{ scale: timerPulse }] } : null,
              ]}
            >
              <Text
                style={[
                  styles.timerText,
                  remainingSeconds <= 60 ? styles.timerTextUrgent : null,
                ]}
              >
                {formatTime(remainingSeconds)}
              </Text>
            </Animated.View>
          </View>
        ) : null}
        <View style={styles.mockBadgeRow}>
          <View style={styles.mockBadge}>
            <Text style={styles.mockBadgeText}>Mock Exam</Text>
          </View>
          <View style={[styles.sectionPill, phase === 'horen' ? styles.horenPill : styles.lesenPill]}>
            {phase === 'horen' ? (
              <Headphones color="#fff" size={11} />
            ) : (
              <BookOpenText color="#fff" size={11} />
            )}
            <Text style={styles.sectionPillText}>{section}</Text>
          </View>
          <Text style={styles.meta}>{level}</Text>
        </View>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
        <Text style={styles.counter}>
          Question {globalQuestionIndex + 1} of {totalQuestions}
        </Text>
      </View>

      {currentQuestion ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + CTA_BUTTON_HEIGHT + BOTTOM_CONTENT_BUFFER }]} showsVerticalScrollIndicator={false}>
          {section === 'Hören' && currentQuestion.audio_url ? (
            <AudioPlayer audioUrl={currentQuestion.audio_url} />
          ) : null}

          {section === 'Lesen' && currentQuestion.stimulus_text && shouldShowStimulus(level, section, currentQuestion.teil) ? (
            <StimulusCard
              text={currentQuestion.stimulus_text}
              type={currentQuestion.stimulus_type}
              collapsible
            />
          ) : null}

          <View style={styles.questionCard}>
            <Text style={styles.questionType}>
              {currentQuestion.question_type.replace('_', ' ').toUpperCase()}
            </Text>
            <Text style={styles.questionText}>{currentQuestion.question_text}</Text>
          </View>

          <View style={styles.optionsWrap}>
            {(() => {
              const isBinary =
                currentQuestion.question_type === 'true_false' ||
                currentQuestion.question_type === 'ja_nein';
              if (isBinary) {
                return (
                  <View style={styles.binaryRow}>
                    {currentQuestion.options.map((option, idx) => {
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
                            testID={`mock-option-${option.key}`}
                          />
                        </View>
                      );
                    })}
                  </View>
                );
              }
              return currentQuestion.options.map((option) => {
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
                    testID={`mock-option-${option.key}`}
                  />
                );
              });
            })()}
          </View>
        </ScrollView>
      ) : null}

      {currentQuestion ? (
        <View style={[styles.footer, { bottom: insets.bottom }]}>
          <Pressable
            accessibilityLabel={buttonLabel}
            disabled={!selectedAnswer}
            onPress={handleNext}
            style={[
              styles.nextButton,
              !selectedAnswer ? styles.nextButtonDisabled : null,
            ]}
            testID="mock-next-button"
          >
            <Text style={styles.nextButtonText}>{buttonLabel}</Text>
          </Pressable>
        </View>
      ) : null}
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
  abortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerBtnText: {
    color: Colors.danger,
    fontWeight: '700' as const,
    fontSize: 15,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerRow: {
    alignItems: 'flex-end',
    paddingBottom: 4,
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
  mockBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mockBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.warning,
  },
  mockBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800' as const,
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
  sprachbausteinePill: {
    backgroundColor: '#7B1FA2',
  },
  sectionPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  meta: {
    color: Colors.textMuted,
    fontWeight: '700' as const,
    fontSize: 13,
    marginLeft: 'auto',
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
  counter: {
    color: Colors.primary,
    fontWeight: '800' as const,
    fontSize: 14,
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
  transitionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Colors.primaryDeep,
  },
  transitionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 32,
    padding: 28,
    alignItems: 'center',
    gap: 14,
    width: '100%',
    maxWidth: 380,
  },
  transitionIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transitionTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  transitionScore: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  transitionDivider: {
    width: '80%',
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  transitionNextWrap: {
    alignItems: 'center',
    gap: 6,
  },
  transitionNextIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#6A1B9A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transitionNextLabel: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  transitionNextCount: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  transitionTimer: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  transitionButton: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginTop: 8,
  },
  transitionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800' as const,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  warningSmall: {
    color: '#F57F17',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  submittingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: Colors.primaryDeep,
  },
  submittingEmoji: {
    fontSize: 48,
  },
  submittingTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#fff',
  },
  submittingSubtitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.7)',
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

  // ── Sprachbausteine phase styles ──────────────────────────────────────────
  sprachSectionLabel: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    color: '#7B1FA2',
    backgroundColor: '#7B1FA220',
    borderRadius: 10,
    padding: 10,
    lineHeight: 18,
  },
  sprachStimulusCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  sprachStimulusBody: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    color: Colors.text,
    lineHeight: 26,
    flexWrap: 'wrap',
  },
  sprachStimulusText: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    color: Colors.text,
  },
  sprachGapChip: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginHorizontal: 2,
    marginVertical: 2,
  },
  sprachGapEmpty: {
    backgroundColor: Colors.border,
    borderWidth: 1.5,
    borderColor: Colors.textMuted + '40',
  },
  sprachGapFilled: {
    backgroundColor: '#7B1FA220',
    borderWidth: 1.5,
    borderColor: '#7B1FA250',
  },
  sprachGapSelected: {
    borderColor: '#7B1FA2',
    borderWidth: 2,
  },
  sprachGapText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 14,
    color: '#7B1FA2',
  },
  sprachGapTextEmpty: {
    color: Colors.textMuted,
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
  },
  sprachT2InlineGap: {
    backgroundColor: '#E65100' + '20',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginHorizontal: 2,
  },
  sprachT2InlineGapNum: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 13,
    color: '#E65100',
  },
  sprachWordBank: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  sprachWordBankHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sprachWordBankTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 14,
    color: Colors.text,
  },
  sprachWordBankCount: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
  sprachWordChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sprachWordChip: {
    backgroundColor: '#7B1FA215',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: '#7B1FA240',
  },
  sprachWordChipUsed: {
    backgroundColor: Colors.border,
    borderColor: Colors.border,
    opacity: 0.45,
  },
  sprachWordChipText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 14,
    color: '#7B1FA2',
  },
  sprachWordChipTextUsed: {
    color: Colors.textMuted,
  },
  sprachT2Choices: {
    gap: 10,
  },
  sprachT2BlankRow: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  sprachT2BlankNum: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 13,
    color: Colors.text,
    minWidth: 32,
    paddingTop: 2,
  },
  sprachT2ChoiceButtons: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sprachT2ChoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    minWidth: 70,
  },
  sprachT2ChoiceBtnSelected: {
    backgroundColor: '#7B1FA215',
    borderColor: '#7B1FA2',
  },
  sprachT2ChoiceId: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 12,
    color: Colors.textMuted,
  },
  sprachT2ChoiceIdSelected: {
    color: '#7B1FA2',
  },
  sprachT2ChoiceText: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    color: Colors.text,
  },
  sprachT2ChoiceTextSelected: {
    fontFamily: 'NunitoSans_600SemiBold',
    color: '#7B1FA2',
  },
  sprachFooterHint: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
});
