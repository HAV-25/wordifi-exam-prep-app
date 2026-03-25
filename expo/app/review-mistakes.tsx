import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { StreamCard } from '@/components/StreamCard';
import Colors from '@/constants/colors';
import { colors } from '@/theme';
import { fetchRecentIncorrect } from '@/lib/profileHelpers';
import type { RecentIncorrectAnswer } from '@/lib/profileHelpers';
import { useAuth } from '@/providers/AuthProvider';
import type { AppQuestion } from '@/types/database';

type ScreenState = 'menu' | 'practice' | 'summary';

type PracticeAnswer = {
  selected: string;
  isCorrect: boolean;
};

const SECTION_ORDER = ['Hören', 'Lesen', 'Schreiben', 'Sprechen'] as const;

const SECTION_CONFIG: Record<string, { emoji: string; color: string }> = {
  'Hören': { emoji: '🎧', color: colors.navy },
  'Lesen': { emoji: '📖', color: colors.navy },
  'Schreiben': { emoji: '✍️', color: '#7B1FA2' },
  'Sprechen': { emoji: '🗣️', color: '#00897B' },
};

function toAppQuestion(item: RecentIncorrectAnswer): AppQuestion {
  return {
    id: item.question_id,
    source_clip_id: null,
    source_test_id: null,
    source_structure_type: '',
    level: item.level,
    section: item.section,
    teil: item.teil,
    exam_type: '',
    question_type: item.question_type,
    question_number: null,
    question_text: item.question_text,
    stimulus_text: item.stimulus_text,
    stimulus_type: item.stimulus_type,
    options: item.options,
    correct_answer: item.correct_answer,
    audio_url: item.audio_url,
    audio_script: item.audio_script,
    is_active: true,
    version: null,
    test_number: null,
    created_at: item.created_at,
    explanation_en: item.explanation_en,
    explanation_de: item.explanation_de,
    grammar_rule: item.grammar_rule,
    grammar_rule_de: item.grammar_rule_de,
  };
}

export default function ReviewMistakesScreen() {
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [allQuestions, setAllQuestions] = useState<RecentIncorrectAnswer[]>([]);
  const [screenState, setScreenState] = useState<ScreenState>('menu');

  const [practiceSection, setPracticeSection] = useState<string>('');
  const [practiceQuestions, setPracticeQuestions] = useState<RecentIncorrectAnswer[]>([]);
  const [practiceIndex, setPracticeIndex] = useState<number>(0);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, PracticeAnswer>>({});
  const [practiceAudioUnlocked, setPracticeAudioUnlocked] = useState<Record<string, boolean>>({});

  const [sessionMastered, setSessionMastered] = useState<Set<string>>(new Set());

  const progressBarAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!user) return;
    console.log('ReviewMistakes: loading questions for user', user.id);
    setIsLoading(true);
    fetchRecentIncorrect(user.id)
      .then((data) => {
        console.log('ReviewMistakes: loaded', data.length, 'questions');
        setAllQuestions(data);
      })
      .catch((err) => {
        console.log('ReviewMistakes: fetch error', err);
      })
      .finally(() => setIsLoading(false));
  }, [user]);

  const sectionGroups = useMemo(() => {
    const map = new Map<string, RecentIncorrectAnswer[]>();
    for (const q of allQuestions) {
      const existing = map.get(q.section) ?? [];
      existing.push(q);
      map.set(q.section, existing);
    }
    return map;
  }, [allQuestions]);

  const orderedSections = useMemo(() => {
    return SECTION_ORDER.filter((s) => (sectionGroups.get(s)?.length ?? 0) > 0);
  }, [sectionGroups]);

  const masteryPct = useMemo(() => {
    if (allQuestions.length === 0) return 0;
    return Math.round((sessionMastered.size / allQuestions.length) * 100);
  }, [allQuestions.length, sessionMastered.size]);

  useEffect(() => {
    Animated.timing(progressBarAnim, {
      toValue: masteryPct / 100,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [masteryPct, progressBarAnim]);

  const isSectionMastered = useCallback(
    (section: string) => {
      const questions = sectionGroups.get(section) ?? [];
      if (questions.length === 0) return false;
      return questions.every((q) => sessionMastered.has(q.question_id));
    },
    [sectionGroups, sessionMastered]
  );

  const startPractice = useCallback((section: string) => {
    const questions = sectionGroups.get(section) ?? [];
    console.log('ReviewMistakes: starting practice for', section, 'with', questions.length, 'questions');
    setPracticeSection(section);
    setPracticeQuestions(questions);
    setPracticeIndex(0);
    setPracticeAnswers({});
    setPracticeAudioUnlocked({});
    setScreenState('practice');
  }, [sectionGroups]);

  const retryWrongOnly = useCallback(() => {
    const wrong = practiceQuestions.filter(
      (q) => !practiceAnswers[q.question_id]?.isCorrect
    );
    console.log('ReviewMistakes: retrying', wrong.length, 'wrong answers in', practiceSection);
    setPracticeQuestions(wrong);
    setPracticeIndex(0);
    setPracticeAnswers({});
    setPracticeAudioUnlocked({});
    setScreenState('practice');
  }, [practiceQuestions, practiceAnswers, practiceSection]);

  const handleAnswer = useCallback(
    (_questionId: string, selectedKey: string, isCorrect: boolean) => {
      const currentQ = practiceQuestions[practiceIndex];
      if (!currentQ) return;

      console.log('ReviewMistakes: answered', currentQ.question_id, 'correct:', isCorrect);

      setPracticeAnswers((prev) => ({
        ...prev,
        [currentQ.question_id]: { selected: selectedKey, isCorrect },
      }));

      if (isCorrect) {
        setSessionMastered((prev) => new Set(prev).add(currentQ.question_id));
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      } else {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        }
      }
    },
    [practiceQuestions, practiceIndex]
  );

  const handleNext = useCallback(() => {
    if (practiceIndex < practiceQuestions.length - 1) {
      setPracticeIndex((i) => i + 1);
    } else {
      setScreenState('summary');
    }
  }, [practiceIndex, practiceQuestions.length]);

  const goBackToMenu = useCallback(() => {
    setScreenState('menu');
  }, []);

  const currentQ = practiceQuestions[practiceIndex] ?? null;
  const currentAnswer = currentQ ? practiceAnswers[currentQ.question_id] : undefined;
  const isCurrentAnswered = currentAnswer != null;

  const summaryCorrect = useMemo(() => {
    return practiceQuestions.filter((q) => practiceAnswers[q.question_id]?.isCorrect).length;
  }, [practiceQuestions, practiceAnswers]);

  const summaryHasWrong = summaryCorrect < practiceQuestions.length;

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.navy} />
        <Text style={styles.loadingText}>Loading your questions…</Text>
      </View>
    );
  }

  if (screenState === 'practice' && currentQ) {
    const sectionCfg = SECTION_CONFIG[practiceSection] ?? SECTION_CONFIG['Lesen'];
    return (
      <SafeAreaView style={styles.practiceContainer}>
        <View style={styles.practiceHeader}>
          <Pressable onPress={goBackToMenu} style={styles.practiceBackBtn} testID="practice-back">
            <ChevronLeft color={colors.navy} size={22} />
            <Text style={styles.practiceBackText}>Back</Text>
          </Pressable>
          <View style={[styles.sectionPillSmall, { backgroundColor: sectionCfg.color }]}>
            <Text style={styles.sectionPillSmallText}>{sectionCfg.emoji} {practiceSection}</Text>
          </View>
          <Text style={styles.practiceProgress}>
            {practiceIndex + 1}/{practiceQuestions.length}
          </Text>
        </View>

        <View style={styles.practiceCardWrap}>
          <StreamCard
            question={toAppQuestion(currentQ)}
            onAnswer={handleAnswer}
            isAnswered={isCurrentAnswered}
            selectedAnswer={currentAnswer?.selected ?? null}
            audioUnlocked={practiceAudioUnlocked[currentQ.question_id] ?? false}
            onAudioPlayed={() => {
              setPracticeAudioUnlocked((prev) => ({ ...prev, [currentQ.question_id]: true }));
            }}
            onReportPress={() => {}}
            reviewMode={false}
          />
        </View>

        {isCurrentAnswered ? (
          <View style={styles.practiceFooter}>
            <Pressable style={styles.nextButton} onPress={handleNext} testID="practice-next">
              <Text style={styles.nextButtonText}>
                {practiceIndex === practiceQuestions.length - 1 ? 'See results →' : 'Next →'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  if (screenState === 'summary') {
    const isPerfect = summaryCorrect === practiceQuestions.length;
    return (
      <SafeAreaView style={styles.summaryContainer}>
        <View style={styles.summaryHeader}>
          <Pressable onPress={goBackToMenu} style={styles.practiceBackBtn} testID="summary-back">
            <ChevronLeft color={colors.navy} size={22} />
            <Text style={styles.practiceBackText}>Back</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.summaryContent}>
          <Text style={styles.summaryEmoji}>{isPerfect ? '🏆' : '⚡'}</Text>
          <Text style={styles.summaryHeading}>
            {isPerfect ? 'Section Mastered!' : `${summaryCorrect}/${practiceQuestions.length} Corrected`}
          </Text>
          <Text style={styles.summarySubtext}>
            {isPerfect
              ? `Perfect score on ${practiceSection}!`
              : 'Keep going — practice makes perfect'}
          </Text>

          <View style={styles.summaryBreakdown}>
            {practiceQuestions.map((q) => {
              const ans = practiceAnswers[q.question_id];
              const correct = ans?.isCorrect ?? false;
              return (
                <View key={q.question_id} style={styles.summaryRow}>
                  <View style={[styles.summaryDot, correct ? styles.summaryDotGreen : styles.summaryDotAmber]} />
                  <Text style={styles.summaryRowText} numberOfLines={1}>{q.question_text}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.summaryButtons}>
            {summaryHasWrong ? (
              <Pressable style={styles.retryButton} onPress={retryWrongOnly} testID="retry-wrong">
                <Text style={styles.retryButtonText}>Retry wrong answers</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.backToSectionsBtn, !summaryHasWrong ? styles.backToSectionsBtnFull : null]}
              onPress={goBackToMenu}
              testID="back-to-sections"
            >
              <Text style={styles.backToSectionsBtnText}>Back to all sections</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.menuContainer}>
      <View style={styles.menuHero}>
        <View style={styles.menuHeaderRow}>
          <Pressable onPress={() => router.back()} style={styles.menuBackBtn} testID="menu-back">
            <ChevronLeft color={colors.white} size={22} />
          </Pressable>
          <Text style={styles.menuTitle}>Mistake Mastery</Text>
          <View style={{ width: 22 }} />
        </View>

        <Text style={styles.menuHeroCount}>{allQuestions.length}</Text>
        <Text style={styles.menuHeroLabel}>Questions</Text>
        <Text style={styles.menuHeroSub}>Ready to be mastered</Text>

        <View style={styles.masteryBarWrap}>
          <View style={styles.masteryTrack}>
            <Animated.View
              style={[
                styles.masteryFill,
                {
                  width: progressBarAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.masteryLabel}>Session mastery: {masteryPct}%</Text>
        </View>
      </View>

      <ScrollView
        style={styles.menuScroll}
        contentContainerStyle={styles.menuScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {allQuestions.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>🎯</Text>
            <Text style={styles.emptyText}>No mistakes yet — keep practising!</Text>
          </View>
        ) : (
          orderedSections.map((section) => {
            const questions = sectionGroups.get(section) ?? [];
            const cfg = SECTION_CONFIG[section] ?? SECTION_CONFIG['Lesen'];
            const mastered = isSectionMastered(section);
            const firstQ = questions[0];

            return (
              <View key={section} style={styles.sectionCard}>
                <View style={styles.sectionCardTop}>
                  <View style={[styles.sectionPill, { backgroundColor: cfg.color }]}>
                    <Text style={styles.sectionPillText}>{cfg.emoji} {section}</Text>
                  </View>
                  <View style={styles.questionCountBadge}>
                    <Text style={styles.questionCountText}>{questions.length} question{questions.length === 1 ? '' : 's'}</Text>
                  </View>
                </View>

                {firstQ ? (
                  <Text style={styles.sectionPreview} numberOfLines={2}>
                    {firstQ.question_text}
                  </Text>
                ) : null}

                {mastered ? (
                  <Text style={styles.masteredLabel}>✓ Mastered this session!</Text>
                ) : (
                  <Pressable
                    style={styles.practiceBtn}
                    onPress={() => startPractice(section)}
                    testID={`practice-${section}`}
                  >
                    <Text style={styles.practiceBtnText}>
                      Practice {questions.length} question{questions.length === 1 ? '' : 's'} →
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: colors.muted,
    fontWeight: '500' as const,
  },

  menuContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  menuHero: {
    backgroundColor: colors.navy,
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 4,
  },
  menuHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  menuBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: colors.white,
  },
  menuHeroCount: {
    fontSize: 48,
    fontWeight: '900' as const,
    color: colors.white,
    textAlign: 'center' as const,
    lineHeight: 52,
  },
  menuHeroLabel: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.white,
    textAlign: 'center' as const,
    marginTop: -2,
  },
  menuHeroSub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center' as const,
    marginTop: 2,
  },
  masteryBarWrap: {
    marginTop: 16,
    gap: 6,
  },
  masteryTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden' as const,
  },
  masteryFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.green,
  },
  masteryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600' as const,
  },

  menuScroll: {
    flex: 1,
  },
  menuScrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },

  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    shadowColor: 'rgba(12,25,49,0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  sectionPillText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  sectionPillSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sectionPillSmallText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  questionCountBadge: {
    backgroundColor: '#F0F4FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  questionCountText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: colors.navy,
  },
  sectionPreview: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
    marginTop: 8,
  },
  masteredLabel: {
    marginTop: 16,
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.green,
  },
  practiceBtn: {
    marginTop: 16,
    backgroundColor: colors.navy,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  practiceBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700' as const,
  },

  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: 16,
    color: colors.muted,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },

  practiceContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  practiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  practiceBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingRight: 8,
  },
  practiceBackText: {
    fontSize: 15,
    color: colors.navy,
    fontWeight: '600' as const,
  },
  practiceProgress: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: '600' as const,
  },
  practiceCardWrap: {
    flex: 1,
  },
  practiceFooter: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nextButton: {
    backgroundColor: colors.navy,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700' as const,
  },

  summaryContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  summaryHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryContent: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  summaryEmoji: {
    fontSize: 64,
  },
  summaryHeading: {
    fontSize: 26,
    fontWeight: '900' as const,
    color: colors.navy,
    marginTop: 16,
    textAlign: 'center' as const,
  },
  summarySubtext: {
    fontSize: 15,
    color: colors.muted,
    marginTop: 6,
    textAlign: 'center' as const,
  },
  summaryBreakdown: {
    marginTop: 24,
    width: '100%',
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryDotGreen: {
    backgroundColor: colors.green,
  },
  summaryDotAmber: {
    backgroundColor: colors.amber,
  },
  summaryRowText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  summaryButtons: {
    marginTop: 32,
    width: '100%',
    gap: 12,
  },
  retryButton: {
    backgroundColor: colors.navy,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  backToSectionsBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  backToSectionsBtnFull: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  backToSectionsBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.navy,
  },
});
