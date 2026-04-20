import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ChevronRight, Share2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FOOTER_HEIGHT = 220;       // share(56) + primary(54) + secondary(48) + gaps(20) + pad(32) + extra
const BOTTOM_CONTENT_BUFFER = 24; // breathing room below last content item
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { AppHeader } from '@/components/AppHeader';
import { AudioPlayer } from '@/components/AudioPlayer';
import ConfettiBurst, { type ConfettiBurstRef } from '@/components/ConfettiBurst';
import { QuestionCard } from '@/components/QuestionCard';
import { ScoreRing } from '@/components/ScoreRing';
import ShareResultSheet from '@/components/ShareResultSheet';
import { StimulusCard, shouldShowStimulus } from '@/components/StimulusCard';
import Colors from '@/constants/colors';
import { colors } from '@/theme';
import { B } from '@/theme/banani';
import { updateReadinessScore } from '@/lib/streamHelpers';
import { useQuestionMeta } from '@/lib/useQuestionTypeMeta';
import { XP_RATES } from '@/theme/constants';
import { useAuth } from '@/providers/AuthProvider';
import type { AppQuestion } from '@/types/database';

function performanceLabel(score: number): { text: string; color: string } {
  if (score >= 70) return { text: 'Exam-ready performance', color: colors.green };
  if (score >= 40) return { text: 'Good progress — keep practising', color: colors.amber };
  return { text: 'Every answer is a learning step', color: 'rgba(255,255,255,0.74)' };
}

function scoreColor(score: number): string {
  if (score >= 70) return colors.green;
  if (score >= 40) return colors.amber;
  return 'rgba(255,255,255,0.9)';
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function retestDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function AnimatedXpText({ value, style }: { value: Animated.AnimatedInterpolation<number>; style: object }) {
  const [display, setDisplay] = useState<number>(0);

  useEffect(() => {
    const id = value.addListener(({ value: v }) => {
      setDisplay(Math.round(v));
    });
    return () => value.removeListener(id);
  }, [value]);

  return <Text style={style}>{display}</Text>;
}

export default function SectionalResultsScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const userId = user?.id ?? '';
  const hasUpdatedReadiness = useRef<boolean>(false);

  useEffect(() => {
    if (userId && !hasUpdatedReadiness.current) {
      hasUpdatedReadiness.current = true;
      updateReadinessScore(userId, 5).catch((err) =>
        console.log('SectionalResults updateReadiness error', err)
      );
    }
  }, [userId]);

  const params = useLocalSearchParams<{
    sessionId?: string;
    scorePct?: string;
    correctCount?: string;
    total?: string;
    level?: string;
    section?: string;
    teil?: string;
    isTimed?: string;
    timeTaken?: string;
    questions?: string;
    answers?: string;
  }>();

  const [expandedStimulusId, setExpandedStimulusId] = useState<string | null>(null);
  const [expandedExplanationId, setExpandedExplanationId] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const scorePct = Number(params.scorePct ?? '0');
  const correctCount = Number(params.correctCount ?? '0');
  const total = Number(params.total ?? '0');
  const level = params.level ?? 'A1';
  const section = params.section ?? 'Hören';
  const teil = params.teil ?? '1';
  const isTimed = params.isTimed === '1';
  const timeTaken = Number(params.timeTaken ?? '0');

  const questions = useMemo<AppQuestion[]>(() => {
    try {
      return JSON.parse(params.questions ?? '[]') as AppQuestion[];
    } catch {
      return [];
    }
  }, [params.questions]);

  const answers = useMemo<Record<string, string>>(() => {
    try {
      return JSON.parse(params.answers ?? '{}') as Record<string, string>;
    } catch {
      return {};
    }
  }, [params.answers]);

  // Derive Teil name from the meta cache using the first question's structure_type
  const structureType = questions[0]?.source_structure_type;
  const teilMeta = useQuestionMeta(structureType);
  const teilNameEn = teilMeta?.name_en ?? `Teil ${teil}`;
  const teilNameDe = teilMeta?.name_de ?? '';
  const examType = profile?.exam_type ?? 'German language';

  const xpEarned = correctCount * (XP_RATES[level] ?? 1);
  const xpAnim = useRef(new Animated.Value(0)).current;
  const perf = performanceLabel(scorePct);
  const sColor = scoreColor(scorePct);

  useEffect(() => {
    Animated.timing(xpAnim, {
      toValue: xpEarned,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    });
  }, [xpAnim, xpEarned]);

  const xpDisplay = xpAnim.interpolate({
    inputRange: [0, xpEarned || 1],
    outputRange: [0, xpEarned || 1],
  });

  // Confetti + share sheet
  const confettiRef = useRef<ConfettiBurstRef>(null);
  const shareButtonRef = useRef<View>(null);
  const rootViewRef = useRef<View>(null);

  const handleSharePress = useCallback(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!reduced) {
          shareButtonRef.current?.measureInWindow((bx, by, bw, bh) => {
            rootViewRef.current?.measureInWindow((rx, ry) => {
              confettiRef.current?.burst(
                bx - rx + bw / 2,
                by - ry + bh / 2
              );
            });
          });
        }
        setTimeout(() => setSheetVisible(true), reduced ? 0 : 600);
      })
      .catch(() => setSheetVisible(true));
  }, []);

  const retestDate = useMemo(() => retestDateString(), []);

  return (
    <View ref={rootViewRef} style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Confetti overlay — non-interactive, above all content */}
      <ConfettiBurst ref={confettiRef} />

      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader rightElement={
        <Pressable
          ref={shareButtonRef}
          accessibilityLabel="Share your result"
          onPress={handleSharePress}
          style={styles.shareIconBtn}
          testID="sectional-share-button-header"
        >
          <Share2 size={22} color={Colors.accent} />
        </Pressable>
      } />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + FOOTER_HEIGHT + BOTTOM_CONTENT_BUFFER },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroMeta}>
            {section} · Teil {teil} · {level}
            {isTimed ? ' · Timed' : ''}
          </Text>
          <View style={styles.heroRow}>
            <View style={styles.heroTextWrap}>
              <Text style={[styles.performance, { color: perf.color }]}>{perf.text}</Text>
              {isTimed && timeTaken > 0 ? (
                <Text style={styles.timeLine}>⏱ {formatDuration(timeTaken)}</Text>
              ) : null}
              <View style={styles.xpWrap}>
                <Text style={styles.xpLabel}>+</Text>
                <AnimatedXpText value={xpDisplay} style={styles.xpValue} />
                <Text style={styles.xpLabel}> XP</Text>
              </View>
            </View>
            <ScoreRing label="Score" score={scorePct} size={80} />
          </View>
        </View>

        {!['paid_early', 'monthly', 'quarterly', 'winback_monthly', 'winback_quarterly'].includes(profile?.subscription_tier ?? '') ? (
          <View style={styles.retestNotice}>
            <Text style={styles.retestText}>
              You can retest this section in 7 days — {retestDate}
            </Text>
          </View>
        ) : null}

        <View style={styles.reviewWrap}>
          {questions.map((question, index) => {
            const selectedAnswer = (answers[question.id] ?? '').toLowerCase();
            const isCorrect = selectedAnswer === question.correct_answer.toLowerCase();
            const selectedOption = question.options.find(
              (o) => o.key.toLowerCase() === selectedAnswer
            );
            const correctOption = question.options.find(
              (o) => o.key.toLowerCase() === question.correct_answer.toLowerCase()
            );

            return (
              <QuestionCard
                key={question.id}
                title={question.question_text}
                subtitle={`Question ${index + 1}`}
              >
                <View style={[
                  styles.reviewAnswerCard,
                  isCorrect ? styles.reviewAnswerCorrect : styles.reviewAnswerIncorrect,
                ]}>
                  <View style={[
                    styles.reviewAccent,
                    { backgroundColor: isCorrect ? B.success : '#F59E0B' },
                  ]} />
                  <View style={styles.reviewAnswerContent}>
                    <Text style={styles.reviewAnswerLabel}>
                      {isCorrect ? 'Correct' : 'Your answer'}
                    </Text>
                    <Text style={[
                      styles.reviewAnswerValue,
                      { color: isCorrect ? B.success : '#F59E0B' },
                    ]}>
                      {(selectedOption?.text ?? selectedAnswer) || 'No answer'}
                    </Text>
                  </View>
                </View>
                {!isCorrect ? (
                  <View style={[styles.reviewAnswerCard, styles.reviewAnswerCorrectHint]}>
                    <View style={[styles.reviewAccent, { backgroundColor: B.success }]} />
                    <View style={styles.reviewAnswerContent}>
                      <Text style={styles.reviewAnswerLabel}>Correct answer</Text>
                      <Text style={[styles.reviewAnswerValue, { color: B.success }]}>
                        {correctOption?.text ?? question.correct_answer}
                      </Text>
                    </View>
                  </View>
                ) : null}
                {section === 'Hören' && question.audio_url ? (
                  <AudioPlayer audioUrl={question.audio_url} />
                ) : null}
                {section === 'Lesen' && question.stimulus_text && shouldShowStimulus(level, section, teil) ? (
                  <View>
                    <Pressable
                      accessibilityLabel="Show passage"
                      onPress={() =>
                        setExpandedStimulusId((v) =>
                          v === question.id ? null : question.id
                        )
                      }
                      style={styles.showPassageButton}
                      testID={`show-passage-${question.id}`}
                    >
                      <Text style={styles.showPassageText}>
                        {expandedStimulusId === question.id
                          ? 'Hide passage'
                          : 'Show passage'}
                      </Text>
                    </Pressable>
                    {expandedStimulusId === question.id ? (
                      <StimulusCard
                        text={question.stimulus_text}
                        type={question.stimulus_type}
                        collapsible={false}
                      />
                    ) : null}
                  </View>
                ) : null}
                {(question.explanation_de?.trim() || question.explanation_en?.trim()) ? (
                  <>
                    <Pressable
                      onPress={() =>
                        setExpandedExplanationId((v) =>
                          v === question.id ? null : question.id
                        )
                      }
                      style={styles.explanationToggle}
                      testID={`explanation-toggle-${question.id}`}
                    >
                      <Text style={styles.explanationToggleText}>
                        {expandedExplanationId === question.id
                          ? 'Hide explanation ↑'
                          : 'See explanation ↓'}
                      </Text>
                    </Pressable>
                    {expandedExplanationId === question.id ? (
                      <View style={styles.explanationBox}>
                        {question.explanation_de?.trim() ? (
                          <>
                            <Text style={styles.explanationLangLabel}>Erklärung:</Text>
                            <Text style={styles.explanationBoxText}>{question.explanation_de.trim()}</Text>
                          </>
                        ) : null}
                        {question.explanation_de?.trim() && question.explanation_en?.trim() ? (
                          <View style={styles.explanationDivider} />
                        ) : null}
                        {question.explanation_en?.trim() ? (
                          <>
                            <Text style={styles.explanationLangLabel}>Explanation:</Text>
                            <Text style={styles.explanationBoxText}>{question.explanation_en.trim()}</Text>
                          </>
                        ) : null}
                      </View>
                    ) : null}
                  </>
                ) : null}
              </QuestionCard>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { bottom: insets.bottom }]}>
        {/* ── Share button (A1) ─────────────────────────── */}
        <Pressable
          ref={shareButtonRef}
          accessibilityLabel="Share your result"
          onPress={handleSharePress}
          style={styles.shareButton}
          testID="sectional-share-button"
        >
          <Share2 size={20} color={Colors.accent} />
          <Text style={styles.shareButtonText}>Share your result</Text>
          <ChevronRight size={16} color={Colors.textMuted} style={styles.shareChevron} />
        </Pressable>

        <Pressable
          accessibilityLabel="Back to tests"
          onPress={() => router.replace('/(tabs)/tests')}
          style={styles.primaryButton}
          testID="back-to-tests-button"
        >
          <Text style={styles.primaryButtonText}>Back to Tests</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Go home"
          onPress={() => router.replace('/')}
          style={styles.secondaryButton}
          testID="sectional-home-button"
        >
          <Text style={styles.secondaryButtonText}>Home</Text>
        </Pressable>
      </View>

      {/* ── Share preview bottom sheet (B) ──────────────── */}
      <ShareResultSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        section={section}
        level={level}
        teilNameEn={teilNameEn}
        teilNameDe={teilNameDe}
        score={correctCount}
        total={total}
        scorePct={scorePct}
        examType={examType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  shareIconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  heroCard: {
    borderRadius: 28,
    backgroundColor: Colors.primary,
    padding: 20,
    gap: 16,
    overflow: 'hidden' as const,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.74)',
    fontWeight: '700' as const,
    fontSize: 13,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroTextWrap: {
    flex: 1,
    gap: 8,
  },
  scoreLine: {
    fontSize: 42,
    fontWeight: '800' as const,
  },
  performance: {
    fontSize: 15,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  timeLine: {
    color: 'rgba(255,255,255,0.74)',
    fontWeight: '700' as const,
    fontSize: 14,
  },
  xpWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  xpLabel: {
    color: 'rgba(255,255,255,0.74)',
    fontWeight: '700' as const,
    fontSize: 16,
  },
  xpValue: {
    color: colors.amber,
    fontSize: 22,
    fontWeight: '800' as const,
  },
  retestNotice: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 14,
    padding: 14,
  },
  retestText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  reviewWrap: {
    gap: 12,
  },
  reviewAnswerCard: {
    flexDirection: 'row',
    borderRadius: 14,
    backgroundColor: B.card,
    borderWidth: 1,
    borderColor: B.border,
    overflow: 'hidden',
  },
  reviewAnswerCorrect: {},
  reviewAnswerIncorrect: {},
  reviewAnswerCorrectHint: {
    backgroundColor: 'rgba(34,197,94,0.04)',
  },
  reviewAccent: {
    width: 4,
  },
  reviewAnswerContent: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 2,
  },
  reviewAnswerLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: B.muted,
    letterSpacing: 0.3,
  },
  reviewAnswerValue: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  showPassageButton: {
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceMuted,
  },
  showPassageText: {
    color: Colors.primary,
    fontWeight: '700' as const,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 10,
    backgroundColor: Colors.background,
  },

  // ── Share button (A1) ──────────────────────────────────────
  shareButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primaryDeep,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 12,
  },
  shareButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: Colors.white,
    fontFamily: 'Outfit_800ExtraBold',
  },
  shareChevron: {
    marginLeft: 'auto',
  } as object,

  primaryButton: {
    minHeight: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  primaryButtonText: {
    color: Colors.surface,
    fontWeight: '800' as const,
    fontSize: 16,
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontWeight: '700' as const,
    textAlign: 'center',
  },
  explanationToggle: {
    paddingTop: 6,
  },
  explanationToggleText: {
    fontSize: 13,
    color: colors.blue,
    fontWeight: '600' as const,
  },
  explanationBox: {
    backgroundColor: '#F0F4FF',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    gap: 4,
  },
  explanationLangLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.primary,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  explanationBoxText: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.text,
  },
  explanationDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 6,
  },
});
