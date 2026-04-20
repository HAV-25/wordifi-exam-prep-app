/**
 * Sprachbausteine Results Screen
 * Shows per-blank feedback: green = correct, red = wrong (with correct answer shown)
 */
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ChevronRight, Share2 } from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import ConfettiBurst, { type ConfettiBurstRef } from '@/components/ConfettiBurst';
import { ScoreRing } from '@/components/ScoreRing';
import ShareResultSheet from '@/components/ShareResultSheet';
import Colors from '@/constants/colors';
import { colors } from '@/theme';
import { useAuth } from '@/providers/AuthProvider';
import type { AppQuestion } from '@/types/database';
import type { BlankAnswers } from '@/lib/sectionalHelpers';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type ParsedCorrect = Record<string, string>;

function parseCorrect(correctAnswerStr: string): ParsedCorrect {
  try { return JSON.parse(correctAnswerStr) as ParsedCorrect; }
  catch { return {}; }
}

function splitStimulus(text: string): Array<{ kind: 'text'; value: string } | { kind: 'gap'; num: string }> {
  const parts = text.split(/\((\d+)\)/);
  return parts.map((part, i) => {
    if (i % 2 === 1) return { kind: 'gap' as const, num: part };
    return { kind: 'text' as const, value: part };
  });
}

function performanceLabel(score: number): { text: string; color: string } {
  if (score >= 70) return { text: 'Excellent! Exam-ready performance', color: colors.green };
  if (score >= 40) return { text: 'Good progress — keep practising', color: colors.amber };
  return { text: 'Every blank is a learning step 💪', color: colors.navy };
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

// ─── Sub-component: per-teil blank feedback ───────────────────────────────────

type BlankFeedbackProps = {
  label: string;
  question: AppQuestion;
  userAnswers: BlankAnswers;
};

function BlankFeedback({ label, question, userAnswers }: BlankFeedbackProps) {
  const correctMap = useMemo(() => parseCorrect(question.correct_answer), [question.correct_answer]);
  const parts = useMemo(() => splitStimulus(question.stimulus_text ?? ''), [question.stimulus_text]);

  const correct = Object.entries(correctMap).filter(([k, v]) => userAnswers[k] === v).length;
  const total = Object.keys(correctMap).length;

  return (
    <View style={styles.teilSection}>
      <View style={styles.teilHeader}>
        <Text style={styles.teilLabel}>{label}</Text>
        <View style={[styles.teilScorePill, { backgroundColor: correct >= total * 0.7 ? colors.green + '20' : colors.amber + '20' }]}>
          <Text style={[styles.teilScoreText, { color: correct >= total * 0.7 ? colors.green : colors.amber }]}>
            {correct}/{total}
          </Text>
        </View>
      </View>

      {/* Stimulus with colour-coded gaps */}
      <View style={styles.stimulusCard}>
        <Text style={styles.stimulusBody}>
          {parts.map((part, i) => {
            if (part.kind === 'text') {
              return <Text key={i} style={styles.stimulusText}>{part.value}</Text>;
            }
            const blankNum = part.num;
            const userVal = userAnswers[blankNum];
            const correctVal = correctMap[blankNum];
            const isCorrect = userVal === correctVal;
            const isEmpty = !userVal;

            return (
              <View
                key={i}
                style={[
                  styles.resultGapChip,
                  isCorrect ? styles.resultGapCorrect : isEmpty ? styles.resultGapEmpty : styles.resultGapWrong,
                ]}
              >
                {isCorrect ? (
                  <Text style={[styles.resultGapText, styles.resultGapTextCorrect]}>{userVal}</Text>
                ) : (
                  <View style={styles.resultGapInner}>
                    {userVal ? (
                      <Text style={[styles.resultGapText, styles.resultGapTextWrong]}>{userVal}</Text>
                    ) : null}
                    <Text style={[styles.resultGapText, styles.resultGapTextCorrectSmall]}>✓ {correctVal}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </Text>
      </View>

      {/* Per-blank answer table */}
      <View style={styles.blankTable}>
        {Object.entries(correctMap).map(([k, correctVal]) => {
          const userVal = userAnswers[k];
          const isCorrect = userVal === correctVal;
          return (
            <View key={k} style={styles.blankRow}>
              <Text style={styles.blankNum}>({k})</Text>
              <Text style={[styles.blankUserAnswer, isCorrect ? styles.blankCorrectText : styles.blankWrongText]}>
                {userVal ?? '—'}
              </Text>
              {!isCorrect && (
                <Text style={styles.blankCorrectAnswer}>✓ {correctVal}</Text>
              )}
              <Text style={styles.blankStatus}>{isCorrect ? '✓' : '✗'}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function SprachbausteineResultsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [sheetVisible, setSheetVisible] = useState(false);
  const confettiRef = useRef<ConfettiBurstRef>(null);
  const shareButtonRef = useRef<View>(null);
  const rootViewRef = useRef<View>(null);

  const params = useLocalSearchParams<{
    sessionId?: string;
    t1Question?: string;
    t2Question?: string;
    t1Answers?: string;
    t2Answers?: string;
    scorePct?: string;
    totalCorrect?: string;
    totalBlanks?: string;
    level?: string;
    timeTaken?: string;
  }>();

  const t1Question = useMemo<AppQuestion | null>(() => {
    try { return JSON.parse(params.t1Question ?? 'null') as AppQuestion; }
    catch { return null; }
  }, [params.t1Question]);

  const t2Question = useMemo<AppQuestion | null>(() => {
    try { return JSON.parse(params.t2Question ?? 'null') as AppQuestion; }
    catch { return null; }
  }, [params.t2Question]);

  const t1Answers = useMemo<BlankAnswers>(() => {
    try { return JSON.parse(params.t1Answers ?? '{}') as BlankAnswers; }
    catch { return {}; }
  }, [params.t1Answers]);

  const t2Answers = useMemo<BlankAnswers>(() => {
    try { return JSON.parse(params.t2Answers ?? '{}') as BlankAnswers; }
    catch { return {}; }
  }, [params.t2Answers]);

  const scorePct = Number(params.scorePct ?? '0');
  const totalCorrect = Number(params.totalCorrect ?? '0');
  const totalBlanks = Number(params.totalBlanks ?? '0');
  const timeTaken = Number(params.timeTaken ?? '0');

  const perf = performanceLabel(scorePct);
  const examType = profile?.exam_type ?? 'German language';

  const handleSharePress = useCallback(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!reduced) {
          shareButtonRef.current?.measureInWindow((bx, by, bw, bh) => {
            rootViewRef.current?.measureInWindow((rx, ry) => {
              confettiRef.current?.burst(bx - rx + bw / 2, by - ry + bh / 2);
            });
          });
        }
        setTimeout(() => setSheetVisible(true), reduced ? 0 : 600);
      })
      .catch(() => setSheetVisible(true));
  }, []);

  return (
    <View ref={rootViewRef} style={[styles.screen, { paddingTop: insets.top }]}>
      <ConfettiBurst ref={confettiRef} />
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: 20, paddingBottom: insets.bottom + 140 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Score header */}
        <View style={styles.scoreHeader}>
          <ScoreRing score={scorePct} label="Score" size={100} />
          <View style={styles.scoreHeaderText}>
            <Text style={styles.scoreSectionName}>Sprachbausteine</Text>
            <Text style={[styles.perfLabel, { color: perf.color }]}>{perf.text}</Text>
            <Text style={styles.scoreDetail}>
              {totalCorrect}/{totalBlanks} gaps correct · {formatDuration(timeTaken)}
            </Text>
          </View>
        </View>

        {/* T1 feedback */}
        {t1Question && (
          <BlankFeedback
            label="Teil 1 — Word Bank"
            question={t1Question}
            userAnswers={t1Answers}
          />
        )}

        {/* T2 feedback */}
        {t2Question && (
          <BlankFeedback
            label="Teil 2 — Multiple Choice"
            question={t2Question}
            userAnswers={t2Answers}
          />
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          ref={shareButtonRef}
          onPress={handleSharePress}
          style={styles.shareButton}
          accessibilityLabel="Share your result"
          testID="sprachbausteine-results-share"
        >
          <Share2 size={20} color={Colors.accent} />
          <Text style={styles.shareButtonText}>Share your result</Text>
          <ChevronRight size={16} color={Colors.textMuted} />
        </Pressable>
        <Pressable
          onPress={() => router.replace('/(tabs)/tests')}
          style={styles.ctaBtn}
          accessibilityLabel="Back to Sectional"
          testID="sprachbausteine-results-back-sectional"
        >
          <Text style={styles.ctaBtnText}>Back to Sectional</Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace('/')}
          style={styles.ctaBtnSecondary}
          accessibilityLabel="Home"
          testID="sprachbausteine-results-home"
        >
          <Text style={styles.ctaBtnSecondaryText}>Home</Text>
        </Pressable>
      </View>

      <ShareResultSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        section="Sprachbausteine"
        level={params.level ?? 'B1'}
        teilNameEn="Sprachbausteine"
        teilNameDe="Sprachbausteine"
        score={totalCorrect}
        total={totalBlanks}
        scorePct={scorePct}
        examType={examType}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 24,
  },
  // Score header
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    gap: 20,
  },
  scoreHeaderText: {
    flex: 1,
    gap: 4,
  },
  scoreSectionName: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 20,
    color: colors.navy,
  },
  perfLabel: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
  },
  scoreDetail: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  // Teil sections
  teilSection: {
    gap: 12,
  },
  teilHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teilLabel: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 16,
    color: colors.navy,
  },
  teilScorePill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  teilScoreText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 13,
  },
  // Stimulus
  stimulusCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  stimulusBody: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    color: colors.navy,
    lineHeight: 28,
    flexWrap: 'wrap',
  },
  stimulusText: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    color: colors.navy,
    lineHeight: 28,
  },
  // Result gap chips in stimulus
  resultGapChip: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginHorizontal: 2,
    marginVertical: 2,
  },
  resultGapCorrect: {
    backgroundColor: colors.green + '20',
  },
  resultGapWrong: {
    backgroundColor: colors.red + '15',
  },
  resultGapEmpty: {
    backgroundColor: Colors.border,
  },
  resultGapInner: {
    gap: 1,
  },
  resultGapText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 13,
    lineHeight: 18,
  },
  resultGapTextCorrect: {
    color: colors.green,
  },
  resultGapTextWrong: {
    color: colors.red,
    textDecorationLine: 'line-through',
  },
  resultGapTextCorrectSmall: {
    color: colors.green,
    fontSize: 12,
    fontFamily: 'NunitoSans_400Regular',
  },
  // Blank table
  blankTable: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  blankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  blankNum: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 13,
    color: colors.navy,
    minWidth: 32,
  },
  blankUserAnswer: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 14,
    flex: 1,
  },
  blankCorrectText: {
    color: colors.green,
  },
  blankWrongText: {
    color: colors.red,
    textDecorationLine: 'line-through',
  },
  blankCorrectAnswer: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    color: colors.green,
    flex: 1,
  },
  blankStatus: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 14,
    minWidth: 20,
    textAlign: 'right',
    color: Colors.textMuted,
  },
  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
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
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 16,
    color: Colors.white,
  },
  ctaBtn: {
    backgroundColor: colors.blue,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaBtnText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  ctaBtnSecondary: {
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaBtnSecondaryText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 15,
    color: colors.navy,
  },
});
