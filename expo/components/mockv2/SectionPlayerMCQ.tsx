/**
 * SectionPlayerMCQ — reusable component for MCQ/TF sections inside Mock V2.
 *
 * Used for: Hören, Lesen, Sprachbausteine.
 * Wraps existing helpers: fetchSectionalQuestions / fetchSprachbausteineQuestions.
 * Renders: progress bar + timer + stimulus (Lesen) + audio (Hören) + question + options.
 *
 * Props are pure — the component knows nothing about mock vs sectional.
 * Parent orchestrator decides what to do with the result.
 */
import { BookOpenText, Clock, Headphones, Puzzle } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AudioPlayer } from '@/components/AudioPlayer';
import { OptionButton } from '@/components/OptionButton';
import { StimulusCard, shouldShowStimulus } from '@/components/StimulusCard';
import { B } from '@/theme/banani';
import type { AppQuestion } from '@/types/database';
import { useQuestionMeta } from '@/lib/useQuestionTypeMeta';

export type MCQSectionResult = {
  answers: Record<string, string>;
  scorePct: number;
  questionsCorrect: number;
  questionsTotal: number;
  timeTakenSeconds: number;
};

type Props = {
  level: string;
  section: 'Hören' | 'Lesen' | 'Sprachbausteine';
  questions: AppQuestion[];
  timeLimitSeconds: number;
  onComplete: (result: MCQSectionResult) => void;
  sectionIndex: number;
  totalSections: number;
};

export function SectionPlayerMCQ({
  level,
  section,
  questions,
  timeLimitSeconds,
  onComplete,
  sectionIndex,
  totalSections,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(timeLimitSeconds);
  const sessionStart = useRef(Date.now());
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerPulse = useRef(new Animated.Value(1)).current;

  const currentQuestion = questions[currentIndex] ?? null;
  const currentMeta = useQuestionMeta(currentQuestion?.source_structure_type);
  const selectedAnswer = currentQuestion ? (answers[currentQuestion.id] ?? '') : '';

  // ── Timer ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    const timeTaken = Math.round((Date.now() - sessionStart.current) / 1000);
    const correct = questions.reduce((n, q) => {
      const sel = (answers[q.id] ?? '').toLowerCase();
      return sel === q.correct_answer.toLowerCase() ? n + 1 : n;
    }, 0);
    const total = questions.length;
    const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;
    onComplete({ answers, scorePct, questionsCorrect: correct, questionsTotal: total, timeTakenSeconds: timeTaken });
  }, [answers, questions, onComplete]);

  useEffect(() => {
    if (timeLimitSeconds <= 0) return;
    const iv = setInterval(() => {
      const elapsed = Math.round((Date.now() - sessionStart.current) / 1000);
      const remain = Math.max(0, timeLimitSeconds - elapsed);
      setRemainingSeconds(remain);
      if (remain <= 0) {
        clearInterval(iv);
        handleSubmit();
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [timeLimitSeconds, handleSubmit]);

  useEffect(() => {
    if (remainingSeconds <= 60 && remainingSeconds > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(timerPulse, { toValue: 1.12, duration: 400, useNativeDriver: true }),
          Animated.timing(timerPulse, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [remainingSeconds, timerPulse]);

  useEffect(() => {
    if (questions.length === 0) return;
    Animated.timing(progressAnim, {
      toValue: ((currentIndex + 1) / questions.length) * 100,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentIndex, questions.length, progressAnim]);

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  const isLastQuestion = currentIndex === questions.length - 1;
  const canAdvance = selectedAnswer.length > 0;

  const handleNext = useCallback(() => {
    if (isLastQuestion) {
      handleSubmit();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [isLastQuestion, handleSubmit]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // ── Section icon ─────────────────────────────────────────────────────────
  const SectionIcon = section === 'Hören' ? Headphones : section === 'Lesen' ? BookOpenText : Puzzle;
  const sectionColor = section === 'Hören' ? '#2B70EF' : section === 'Lesen' ? '#22C55E' : '#A37A00';

  if (!currentQuestion) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={B.primary} size="large" />
        <Text style={styles.loadingText}>Loading {section}...</Text>
      </View>
    );
  }

  const isTimeLow = remainingSeconds <= 60;
  const category = currentMeta?.question_category;
  const isBinaryByCategory = category === 'true_false' || category === 'yes_no';
  const isBinaryByType = currentQuestion.question_type === 'true_false' || currentQuestion.question_type === 'ja_nein';
  const isBinary = isBinaryByCategory || isBinaryByType;
  const isYesNo = category === 'yes_no' || currentQuestion.question_type === 'ja_nein';
  const isMatching = category === 'matching';
  const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];

  return (
    <View style={styles.wrap}>
      {/* Header: progress + meta */}
      <View style={styles.header}>
        <View style={styles.progressBar}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.questionCount}>
            Question {currentIndex + 1} of {questions.length}
          </Text>
          <View style={[styles.sectionPill, { backgroundColor: `${sectionColor}18` }]}>
            <SectionIcon color={sectionColor} size={14} />
            <Text style={[styles.sectionPillText, { color: sectionColor }]}>{section}</Text>
          </View>
          <Text style={styles.levelText}>{level} · Section {sectionIndex + 1}/{totalSections}</Text>
          <Animated.View style={[styles.timerChip, isTimeLow && styles.timerChipUrgent, { transform: [{ scale: timerPulse }] }]}>
            <Clock color={isTimeLow ? '#EF4444' : B.muted} size={12} />
            <Text style={[styles.timerText, isTimeLow && styles.timerTextUrgent]}>{formatTime(remainingSeconds)}</Text>
          </Animated.View>
        </View>
      </View>

      {/* Body: stimulus / audio / question / options */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {section === 'Hören' && currentQuestion.audio_url ? (
          <AudioPlayer audioUrl={currentQuestion.audio_url} />
        ) : null}
        {section === 'Lesen' && currentQuestion.stimulus_text && shouldShowStimulus(level, section, currentQuestion.teil) ? (
          <StimulusCard text={currentQuestion.stimulus_text} type={currentQuestion.stimulus_type} collapsible />
        ) : null}

        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{currentQuestion.question_text}</Text>
        </View>

        {isBinary ? (
          <View style={styles.binaryRow}>
            {(currentQuestion.options?.length ? currentQuestion.options : (isYesNo
              ? [{ key: 'ja', text: 'Ja' }, { key: 'nein', text: 'Nein' }]
              : [{ key: 'richtig', text: 'Richtig' }, { key: 'falsch', text: 'Falsch' }])
            ).map((option, idx) => {
              const normKey = option.key.toLowerCase();
              return (
                <View key={`${currentQuestion.id}-${option.key}`} style={styles.binaryFlex}>
                  <OptionButton
                    label={option.text}
                    variant="binary"
                    binaryPositive={idx === 0}
                    selected={selectedAnswer === normKey}
                    onPress={() => setAnswers((p) => ({ ...p, [currentQuestion.id]: normKey }))}
                    testID={`mockv2-option-${option.key}`}
                  />
                </View>
              );
            })}
          </View>
        ) : isMatching ? (
          // Matching (e.g. B1 Hören T4 speaker_match) — show a/b/c/d letter badges
          // instead of raw DB keys (which may be speaker names like "julia").
          // option.key is still what gets persisted on tap — scoring unaffected.
          <View style={styles.optionsWrap}>
            {(currentQuestion.options ?? []).map((option, idx) => {
              const normKey = option.key.toLowerCase();
              const badgeLetter = LETTERS[idx] ?? String(idx + 1);
              const leadingNode = (
                <View style={styles.matchBadge}>
                  <Text style={styles.matchBadgeText}>{badgeLetter}</Text>
                </View>
              );
              return (
                <OptionButton
                  key={`${currentQuestion.id}-${option.key}`}
                  label={option.text}
                  leadingNode={leadingNode}
                  selected={selectedAnswer === normKey}
                  onPress={() => setAnswers((p) => ({ ...p, [currentQuestion.id]: normKey }))}
                  testID={`mockv2-option-${option.key}`}
                />
              );
            })}
          </View>
        ) : (
          <View style={styles.optionsWrap}>
            {(currentQuestion.options ?? []).map((option) => {
              const normKey = option.key.toLowerCase();
              return (
                <OptionButton
                  key={`${currentQuestion.id}-${option.key}`}
                  label={option.text}
                  leading={option.key}
                  selected={selectedAnswer === normKey}
                  onPress={() => setAnswers((p) => ({ ...p, [currentQuestion.id]: normKey }))}
                  testID={`mockv2-option-${option.key}`}
                />
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Footer: Next / Submit */}
      <View style={styles.footer}>
        <Pressable
          disabled={!canAdvance}
          onPress={handleNext}
          style={[styles.nextBtn, !canAdvance && styles.nextBtnDisabled]}
          testID="mockv2-next"
        >
          <Text style={styles.nextBtnText}>{isLastQuestion ? `Finish ${section}` : 'Next →'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: B.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: B.muted, fontWeight: '600' as const },

  // Header
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 10, backgroundColor: B.card, borderBottomWidth: 1, borderBottomColor: B.border },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#22C55E' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  questionCount: { fontSize: 13, fontWeight: '800' as const, color: B.primary },
  sectionPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  sectionPillText: { fontSize: 11, fontWeight: '700' as const },
  levelText: { fontSize: 11, fontWeight: '600' as const, color: B.muted, flex: 1 },
  timerChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F1F5F9' },
  timerChipUrgent: { backgroundColor: '#FEE2E2' },
  timerText: { fontSize: 12, fontWeight: '800' as const, color: B.muted, fontVariant: ['tabular-nums'] },
  timerTextUrgent: { color: '#EF4444' },

  // Body
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 16, paddingBottom: 24 },
  questionCard: {
    backgroundColor: B.card, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: B.border,
  },
  questionText: { fontSize: 16, fontWeight: '700' as const, color: B.primary, lineHeight: 24 },
  optionsWrap: { gap: 10 },
  binaryRow: { flexDirection: 'row', gap: 10 },
  binaryFlex: { flex: 1 },
  matchBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(43,112,239,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  matchBadgeText: { fontSize: 16, fontWeight: '800' as const, color: B.primary },

  // Footer
  footer: { padding: 20, paddingTop: 12, backgroundColor: B.card, borderTopWidth: 1, borderTopColor: B.border },
  nextBtn: {
    minHeight: 54, borderRadius: 27, backgroundColor: B.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: B.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 3,
  },
  nextBtnDisabled: { opacity: 0.5, backgroundColor: '#CBD5E1' },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' as const },
});
