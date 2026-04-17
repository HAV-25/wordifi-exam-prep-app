/**
 * SectionPlayerSprachbausteine — Mock V2 player for Sprachbausteine (B1 only).
 *
 * V1 compressed scope: lightweight player with shared 15-min timer.
 *   - T1 (word bank gap-fill): renders stimulus with embedded gap chips, user
 *     taps word → next empty blank; taps gap → clear.
 *   - T2 (MCQ per blank): renders list of blanks, each with a/b/c options.
 *
 * Reuses logic from sprachbausteine-test.tsx (same helpers and rendering patterns).
 * On complete: reports aggregate score across all 18 blanks (10 T1 + 8 T2).
 */
import { Clock, Puzzle } from 'lucide-react-native';
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

import { B } from '@/theme/banani';
import { fetchSprachbausteineQuestions, type BlankAnswers } from '@/lib/sectionalHelpers';
import type { AppQuestion } from '@/types/database';

// ─── Types + helpers (mirrored from sprachbausteine-test.tsx) ─────────────────
type T1Options = { type: 'word_bank'; instruction: string; words: string[] };
type T2Option = { blank: number; choices: { id: string; text: string }[] };

function splitStimulus(text: string): Array<{ kind: 'text'; value: string } | { kind: 'gap'; num: string }> {
  const parts = text.split(/\((\d+)\)/);
  return parts.map((part, i) => {
    if (i % 2 === 1) return { kind: 'gap' as const, num: part };
    return { kind: 'text' as const, value: part };
  });
}

function parseT1Options(options: unknown[]): T1Options | null {
  const opt = options?.[0] as Record<string, unknown> | undefined;
  if (!opt || opt['type'] !== 'word_bank') return null;
  return opt as unknown as T1Options;
}

function parseT2Options(options: unknown[]): T2Option[] {
  return (options ?? []) as T2Option[];
}

function scoreBlankAnswers(userAnswers: BlankAnswers, correctAnswerStr: string): { correct: number; total: number } {
  let correctMap: Record<string, string>;
  try {
    correctMap = JSON.parse(correctAnswerStr) as Record<string, string>;
  } catch {
    return { correct: 0, total: 0 };
  }
  const total = Object.keys(correctMap).length;
  const correct = Object.entries(correctMap).filter(([k, v]) => userAnswers[k] === v).length;
  return { correct, total };
}

export type SprachbausteineSectionResult = {
  scorePct: number;
  questionsCorrect: number;
  questionsTotal: number;
  t1Answers: BlankAnswers;
  t2Answers: BlankAnswers;
  timeTakenSeconds: number;
};

type Props = {
  level: string;
  userId: string;
  timeLimitSeconds: number;
  sectionIndex: number;
  totalSections: number;
  onComplete: (result: SprachbausteineSectionResult) => void;
};

export function SectionPlayerSprachbausteine({
  level,
  userId,
  timeLimitSeconds,
  sectionIndex,
  totalSections,
  onComplete,
}: Props) {
  const [t1Question, setT1Question] = useState<AppQuestion | null>(null);
  const [t2Question, setT2Question] = useState<AppQuestion | null>(null);
  const [isLoadingQ, setIsLoadingQ] = useState(true);
  const [phase, setPhase] = useState<'t1' | 't2'>('t1');
  const [t1Answers, setT1Answers] = useState<BlankAnswers>({});
  const [t2Answers, setT2Answers] = useState<BlankAnswers>({});
  const [t1SelectedBlank, setT1SelectedBlank] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(timeLimitSeconds);
  const sessionStart = useRef(Date.now());
  const timerPulse = useRef(new Animated.Value(1)).current;

  // ── Fetch T1 + T2 questions on mount ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { t1, t2 } = await fetchSprachbausteineQuestions(level, userId);
        if (cancelled) return;
        setT1Question(t1);
        setT2Question(t2);
      } catch (err) {
        console.log('[MockV2 Sprachbausteine] fetch error', err);
      } finally {
        if (!cancelled) setIsLoadingQ(false);
      }
    })();
    return () => { cancelled = true; };
  }, [level, userId]);

  // ── Finalize + report score ──────────────────────────────────────────
  const finalize = useCallback(() => {
    const t1Score = t1Question ? scoreBlankAnswers(t1Answers, t1Question.correct_answer) : { correct: 0, total: 0 };
    const t2Score = t2Question ? scoreBlankAnswers(t2Answers, t2Question.correct_answer) : { correct: 0, total: 0 };
    const questionsCorrect = t1Score.correct + t2Score.correct;
    const questionsTotal = t1Score.total + t2Score.total;
    const scorePct = questionsTotal > 0 ? Math.round((questionsCorrect / questionsTotal) * 100) : 0;
    const timeTakenSeconds = Math.round((Date.now() - sessionStart.current) / 1000);
    onComplete({
      scorePct,
      questionsCorrect,
      questionsTotal,
      t1Answers,
      t2Answers,
      timeTakenSeconds,
    });
  }, [t1Question, t2Question, t1Answers, t2Answers, onComplete]);

  // ── Section timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (timeLimitSeconds <= 0) return;
    const iv = setInterval(() => {
      const elapsed = Math.round((Date.now() - sessionStart.current) / 1000);
      const remain = Math.max(0, timeLimitSeconds - elapsed);
      setRemainingSeconds(remain);
      if (remain <= 0) {
        clearInterval(iv);
        finalize();
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [timeLimitSeconds, finalize]);

  useEffect(() => {
    if (remainingSeconds <= 60 && remainingSeconds > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(timerPulse, { toValue: 1.1, duration: 400, useNativeDriver: true }),
          Animated.timing(timerPulse, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [remainingSeconds, timerPulse]);

  // ── T1 word bank logic ──────────────────────────────────────────────
  const t1Opts = useMemo<T1Options | null>(() => (t1Question ? parseT1Options(t1Question.options as unknown[]) : null), [t1Question]);
  const t1Words = useMemo(() => t1Opts?.words ?? [], [t1Opts]);
  const t1PlacedWords = useMemo(() => new Set(Object.values(t1Answers)), [t1Answers]);
  const t1AvailableWords = useMemo(() => t1Words.filter((w) => !t1PlacedWords.has(w)), [t1Words, t1PlacedWords]);
  const t1StimulusParts = useMemo(() => (t1Question?.stimulus_text ? splitStimulus(t1Question.stimulus_text) : []), [t1Question]);

  const handleT1GapPress = useCallback((num: string) => {
    if (t1Answers[num]) {
      setT1Answers((prev) => {
        const next = { ...prev };
        delete next[num];
        return next;
      });
      setT1SelectedBlank(null);
    } else {
      setT1SelectedBlank((prev) => (prev === num ? null : num));
    }
  }, [t1Answers]);

  const handleWordPress = useCallback((word: string) => {
    if (t1SelectedBlank) {
      setT1Answers((prev) => ({ ...prev, [t1SelectedBlank]: word }));
      setT1SelectedBlank(null);
    } else if (t1Question) {
      const parts = splitStimulus(t1Question.stimulus_text ?? '');
      const gapNums = parts.filter((p) => p.kind === 'gap').map((p) => (p as { kind: 'gap'; num: string }).num);
      const nextEmpty = gapNums.find((n) => !t1Answers[n]);
      if (nextEmpty) setT1Answers((prev) => ({ ...prev, [nextEmpty]: word }));
    }
  }, [t1SelectedBlank, t1Answers, t1Question]);

  // ── T2 MCQ logic ────────────────────────────────────────────────────
  const t2Opts = useMemo<T2Option[]>(() => (t2Question ? parseT2Options(t2Question.options as unknown[]) : []), [t2Question]);
  const t2StimulusParts = useMemo(() => (t2Question?.stimulus_text ? splitStimulus(t2Question.stimulus_text) : []), [t2Question]);

  const handleT2Select = useCallback((blankNum: number, choiceId: string) => {
    setT2Answers((prev) => ({ ...prev, [String(blankNum)]: choiceId }));
  }, []);

  // ── Navigation ──────────────────────────────────────────────────────
  const canAdvanceT1 = useMemo(() => {
    if (!t1Question?.stimulus_text) return false;
    const parts = splitStimulus(t1Question.stimulus_text);
    const gapNums = parts.filter((p) => p.kind === 'gap').map((p) => (p as { kind: 'gap'; num: string }).num);
    return gapNums.every((n) => t1Answers[n]);
  }, [t1Question, t1Answers]);

  const canAdvanceT2 = useMemo(() => {
    return t2Opts.every((o) => t2Answers[String(o.blank)]);
  }, [t2Opts, t2Answers]);

  const handleNext = useCallback(() => {
    if (phase === 't1') {
      setPhase('t2');
    } else {
      finalize();
    }
  }, [phase, finalize]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  if (isLoadingQ) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={B.primary} size="large" />
        <Text style={styles.loadingText}>Loading Sprachbausteine...</Text>
      </View>
    );
  }

  if (!t1Question || !t2Question) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Sprachbausteine questions not available.</Text>
        <Pressable style={styles.skipBtn} onPress={finalize}>
          <Text style={styles.skipBtnText}>Skip section</Text>
        </Pressable>
      </View>
    );
  }

  const isTimeLow = remainingSeconds <= 60;

  return (
    <View style={styles.wrap}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.metaRow}>
          <Text style={styles.phaseLabel}>Teil {phase === 't1' ? 1 : 2} of 2</Text>
          <View style={styles.sectionPill}>
            <Puzzle color="#A37A00" size={14} />
            <Text style={styles.sectionPillText}>Sprachbausteine</Text>
          </View>
          <Text style={styles.levelText}>{level} · Section {sectionIndex + 1}/{totalSections}</Text>
          <Animated.View style={[styles.timerChip, isTimeLow && styles.timerChipUrgent, { transform: [{ scale: timerPulse }] }]}>
            <Clock color={isTimeLow ? '#EF4444' : B.muted} size={12} />
            <Text style={[styles.timerText, isTimeLow && styles.timerTextUrgent]}>{formatTime(remainingSeconds)}</Text>
          </Animated.View>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {phase === 't1' ? (
          <>
            <View style={styles.questionCard}>
              <Text style={styles.instructionLabel}>Teil 1 · Wortliste</Text>
              <Text style={styles.instructionText}>
                {t1Opts?.instruction ?? 'Fill each gap with a word from the bank below. Each word can only be used once.'}
              </Text>
            </View>

            <View style={styles.stimulusCard}>
              <Text style={styles.stimulusText}>
                {t1StimulusParts.map((part, i) => {
                  if (part.kind === 'text') return <Text key={i}>{part.value}</Text>;
                  const word = t1Answers[part.num];
                  const isSelected = t1SelectedBlank === part.num;
                  return (
                    <Text
                      key={i}
                      onPress={() => handleT1GapPress(part.num)}
                      style={[
                        styles.gapChip,
                        word ? styles.gapChipFilled : styles.gapChipEmpty,
                        isSelected && styles.gapChipSelected,
                      ]}
                    >
                      {word ?? `(${part.num})`}
                    </Text>
                  );
                })}
              </Text>
            </View>

            <View style={styles.wordBank}>
              <Text style={styles.wordBankLabel}>Wortliste ({t1AvailableWords.length} / {t1Words.length})</Text>
              <View style={styles.wordBankRow}>
                {t1AvailableWords.map((w) => (
                  <Pressable key={w} style={styles.wordChip} onPress={() => handleWordPress(w)}>
                    <Text style={styles.wordChipText}>{w}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.questionCard}>
              <Text style={styles.instructionLabel}>Teil 2 · Mehrfachauswahl</Text>
              <Text style={styles.instructionText}>
                Choose the correct word (a, b, or c) for each gap.
              </Text>
            </View>

            {t2StimulusParts.length > 0 ? (
              <View style={styles.stimulusCard}>
                <Text style={styles.stimulusText}>
                  {t2StimulusParts.map((part, i) => {
                    if (part.kind === 'text') return <Text key={i}>{part.value}</Text>;
                    const selected = t2Answers[part.num];
                    return (
                      <Text key={i} style={[styles.gapChip, selected ? styles.gapChipFilled : styles.gapChipEmpty]}>
                        {selected ? `(${part.num}) ${selected}` : `(${part.num}) ?`}
                      </Text>
                    );
                  })}
                </Text>
              </View>
            ) : null}

            {t2Opts.map((opt) => (
              <View key={opt.blank} style={styles.t2BlankBlock}>
                <Text style={styles.t2BlankLabel}>Gap ({opt.blank})</Text>
                <View style={styles.t2ChoicesRow}>
                  {opt.choices.map((choice) => {
                    const isSelected = t2Answers[String(opt.blank)] === choice.id;
                    return (
                      <Pressable
                        key={choice.id}
                        onPress={() => handleT2Select(opt.blank, choice.id)}
                        style={[styles.t2Choice, isSelected && styles.t2ChoiceSelected]}
                      >
                        <Text style={[styles.t2ChoiceKey, isSelected && styles.t2ChoiceKeySelected]}>{choice.id}</Text>
                        <Text style={[styles.t2ChoiceText, isSelected && styles.t2ChoiceTextSelected]}>{choice.text}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          disabled={phase === 't1' ? !canAdvanceT1 : !canAdvanceT2}
          onPress={handleNext}
          style={[
            styles.nextBtn,
            (phase === 't1' ? !canAdvanceT1 : !canAdvanceT2) && styles.nextBtnDisabled,
          ]}
          testID="mockv2-sprachbausteine-next"
        >
          <Text style={styles.nextBtnText}>
            {phase === 't1' ? 'Continue to Teil 2' : 'Finish Sprachbausteine'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: B.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingText: { fontSize: 14, color: B.muted, fontWeight: '600' as const, textAlign: 'center' },

  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, backgroundColor: B.card, borderBottomWidth: 1, borderBottomColor: B.border },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  phaseLabel: { fontSize: 13, fontWeight: '800' as const, color: B.primary },
  sectionPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(240,200,8,0.18)' },
  sectionPillText: { fontSize: 11, fontWeight: '700' as const, color: '#A37A00' },
  levelText: { fontSize: 11, fontWeight: '600' as const, color: B.muted, flex: 1 },
  timerChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F1F5F9' },
  timerChipUrgent: { backgroundColor: '#FEE2E2' },
  timerText: { fontSize: 12, fontWeight: '800' as const, color: B.muted, fontVariant: ['tabular-nums'] },
  timerTextUrgent: { color: '#EF4444' },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 16, paddingBottom: 24 },

  questionCard: { backgroundColor: B.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: B.border, gap: 6 },
  instructionLabel: { fontSize: 11, fontWeight: '800' as const, color: '#A37A00', letterSpacing: 0.5, textTransform: 'uppercase' as const },
  instructionText: { fontSize: 14, fontWeight: '600' as const, color: B.questionColor, lineHeight: 20 },

  stimulusCard: { backgroundColor: B.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: B.border },
  stimulusText: { fontSize: 15, color: B.questionColor, lineHeight: 26 },

  gapChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontWeight: '700' as const, fontSize: 14 },
  gapChipEmpty: { backgroundColor: '#F1F5F9', color: B.muted },
  gapChipFilled: { backgroundColor: 'rgba(43,112,239,0.12)', color: B.primary },
  gapChipSelected: { backgroundColor: B.primary, color: '#fff' },

  wordBank: { backgroundColor: B.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: B.border, gap: 10 },
  wordBankLabel: { fontSize: 11, fontWeight: '800' as const, color: B.muted, letterSpacing: 0.5, textTransform: 'uppercase' as const },
  wordBankRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wordChip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F8FAFC', borderRadius: 999, borderWidth: 1, borderColor: B.border },
  wordChipText: { fontSize: 14, fontWeight: '700' as const, color: B.questionColor },

  t2BlankBlock: { backgroundColor: B.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: B.border, gap: 8 },
  t2BlankLabel: { fontSize: 12, fontWeight: '800' as const, color: '#A37A00', letterSpacing: 0.3 },
  t2ChoicesRow: { gap: 8 },
  t2Choice: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: B.border },
  t2ChoiceSelected: { backgroundColor: 'rgba(43,112,239,0.08)', borderColor: B.primary },
  t2ChoiceKey: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(43,112,239,0.12)', textAlign: 'center', lineHeight: 24, fontSize: 12, fontWeight: '800' as const, color: B.primary },
  t2ChoiceKeySelected: { backgroundColor: B.primary, color: '#fff' },
  t2ChoiceText: { flex: 1, fontSize: 14, fontWeight: '600' as const, color: B.questionColor },
  t2ChoiceTextSelected: { color: B.primary },

  footer: { padding: 20, paddingTop: 12, backgroundColor: B.card, borderTopWidth: 1, borderTopColor: B.border },
  nextBtn: {
    minHeight: 54, borderRadius: 27, backgroundColor: B.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: B.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 3,
  },
  nextBtnDisabled: { opacity: 0.5, backgroundColor: '#CBD5E1' },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' as const },
  skipBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: '#F1F5F9' },
  skipBtnText: { color: B.muted, fontSize: 14, fontWeight: '700' as const },
});
