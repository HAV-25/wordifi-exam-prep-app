/**
 * Sprachbausteine Test Screen — B1 only
 * Teil 1: Word bank gap-fill (10 blanks, 13 words)
 * Teil 2: Multiple choice a/b/c per blank (8 blanks)
 */
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Colors from '@/constants/colors';
import { colors } from '@/theme';
import {
  completeSprachbausteineSession,
  createSectionalSession,
  type BlankAnswers,
} from '@/lib/sectionalHelpers';
import { useAuth } from '@/providers/AuthProvider';
import type { AppQuestion } from '@/types/database';

// ─── Types ───────────────────────────────────────────────────────────────────

type T1Options = { type: 'word_bank'; instruction: string; words: string[] };
type T2Option = { blank: number; choices: { id: string; text: string }[] };

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Split stimulus text on (N) gap markers, returning alternating text/blankNum segments */
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

// ─── Sub-components ───────────────────────────────────────────────────────────

type GapChipProps = {
  num: string;
  word: string | undefined;
  isSelected: boolean;
  onPress: () => void;
};

function GapChip({ num, word, isSelected, onPress }: GapChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.gapChip,
        word ? styles.gapChipFilled : styles.gapChipEmpty,
        isSelected && styles.gapChipSelected,
      ]}
      accessibilityLabel={word ? `Gap ${num}: ${word}` : `Gap ${num}: empty`}
    >
      <Text style={[styles.gapChipText, !word && styles.gapChipTextEmpty]}>
        {word ?? `(${num})`}
      </Text>
    </Pressable>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function SprachbausteineTestScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    t1Question?: string;
    t2Question?: string;
    level?: string;
    examType?: string;
    isTimed?: string;
    startPhase?: string;
  }>();

  const { user, profile, refreshProfile } = useAuth();
  const userId = user?.id ?? '';
  const level = params.level ?? profile?.target_level ?? 'B1';
  const examType = params.examType ?? profile?.exam_type ?? 'TELC';
  const isTimed = params.isTimed === '1';

  const t1Question = useMemo<AppQuestion | null>(() => {
    try { return JSON.parse(params.t1Question ?? 'null') as AppQuestion; }
    catch { return null; }
  }, [params.t1Question]);

  const t2Question = useMemo<AppQuestion | null>(() => {
    try { return JSON.parse(params.t2Question ?? 'null') as AppQuestion; }
    catch { return null; }
  }, [params.t2Question]);

  // Phase: 't1' → 't2' → 'submitting'
  const initialPhase = params.startPhase === 't2' ? 't2' : 't1';
  const [phase, setPhase] = useState<'t1' | 't2' | 'submitting'>(initialPhase);
  const [t1Answers, setT1Answers] = useState<BlankAnswers>({});
  const [t2Answers, setT2Answers] = useState<BlankAnswers>({});
  const [t1SelectedBlank, setT1SelectedBlank] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const sessionStartTimeRef = useRef<number>(Date.now());
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Progress: T1 = 0-50%, T2 = 50-100%
  useEffect(() => {
    const target = phase === 't1' ? 0 : 50;
    Animated.timing(progressAnim, { toValue: target, duration: 300, useNativeDriver: false }).start();
  }, [phase, progressAnim]);

  // Create session on mount
  useEffect(() => {
    if (!t1Question || !t2Question || !userId) return;
    // total blanks = 18 (10 + 8), stored at session level
    const totalBlanks = 18;
    createSectionalSession({
      userId,
      level,
      section: 'Sprachbausteine',
      teil: 0,
      examType,
      questionsTotal: totalBlanks,
      isTimed,
    })
      .then((id) => {
        console.log('SprachbausteineTest session created', id);
        setSessionId(id);
      })
      .catch((err) => console.log('SprachbausteineTest createSession error', err));
  }, [userId, level, examType, isTimed, t1Question, t2Question]);

  // ─── T1 word bank logic ─────────────────────────────────────────────────────

  const t1Opts = useMemo<T1Options | null>(() => {
    if (!t1Question) return null;
    return parseT1Options(t1Question.options as unknown[]);
  }, [t1Question]);

  const t1Words: string[] = useMemo(() => t1Opts?.words ?? [], [t1Opts]);
  const t1PlacedWords = useMemo(() => new Set(Object.values(t1Answers)), [t1Answers]);
  const t1AvailableWords = useMemo(
    () => t1Words.filter((w) => !t1PlacedWords.has(w)),
    [t1Words, t1PlacedWords]
  );

  const t1StimulusParts = useMemo(() => {
    if (!t1Question?.stimulus_text) return [];
    return splitStimulus(t1Question.stimulus_text);
  }, [t1Question]);

  const handleT1GapPress = useCallback((num: string) => {
    if (t1Answers[num]) {
      // Clear the gap — return word to bank
      setT1Answers((prev) => {
        const next = { ...prev };
        delete next[num];
        return next;
      });
      setT1SelectedBlank(null);
    } else {
      // Select this blank for next word tap
      setT1SelectedBlank((prev) => (prev === num ? null : num));
    }
  }, [t1Answers]);

  const handleWordPress = useCallback((word: string) => {
    if (t1SelectedBlank) {
      setT1Answers((prev) => ({ ...prev, [t1SelectedBlank]: word }));
      setT1SelectedBlank(null);
    } else {
      // Fill next empty blank in order
      if (!t1Question) return;
      const parts = splitStimulus(t1Question.stimulus_text ?? '');
      const gapNums = parts.filter((p) => p.kind === 'gap').map((p) => (p as { kind: 'gap'; num: string }).num);
      const nextEmpty = gapNums.find((n) => !t1Answers[n]);
      if (nextEmpty) {
        setT1Answers((prev) => ({ ...prev, [nextEmpty]: word }));
      }
    }
  }, [t1SelectedBlank, t1Answers, t1Question]);

  // ─── T2 MCQ logic ───────────────────────────────────────────────────────────

  const t2Opts = useMemo<T2Option[]>(() => {
    if (!t2Question) return [];
    return parseT2Options(t2Question.options as unknown[]);
  }, [t2Question]);

  const t2StimulusParts = useMemo(() => {
    if (!t2Question?.stimulus_text) return [];
    return splitStimulus(t2Question.stimulus_text);
  }, [t2Question]);

  // ─── Navigation ─────────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    if (phase === 't2' && t1Question) {
      setPhase('t1');
      return;
    }
    Alert.alert('Leave test?', 'Your progress will be lost.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => router.back() },
    ]);
  }, [phase, t1Question]);

  const handleContinueToT2 = useCallback(() => {
    if (!t2Question) {
      // Single-teil mode: skip t2, go directly to submit
      void handleSubmit();
      return;
    }
    Animated.timing(progressAnim, { toValue: 50, duration: 300, useNativeDriver: false }).start();
    setPhase('t2');
  }, [progressAnim, t2Question, handleSubmit]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting || !sessionId) return;
    // Need at least one question
    if (!t1Question && !t2Question) return;
    setIsSubmitting(true);
    setPhase('submitting');

    try {
      const timeTaken = Math.max(1, Math.round((Date.now() - sessionStartTimeRef.current) / 1000));
      // Use dummy empty question for the missing teil in single-teil mode
      const effectiveT1 = t1Question ?? t2Question!;
      const effectiveT2 = t2Question ?? t1Question!;
      const result = await completeSprachbausteineSession({
        sessionId,
        userId,
        t1Question: effectiveT1,
        t2Question: effectiveT2,
        t1Answers: t1Question ? t1Answers : {},
        t2Answers: t2Question ? t2Answers : {},
        timeTakenSeconds: timeTaken,
        profile,
      });

      await refreshProfile();

      router.replace({
        pathname: '/sprachbausteine-results',
        params: {
          sessionId,
          t1Question: JSON.stringify(t1Question),
          t2Question: JSON.stringify(t2Question),
          t1Answers: JSON.stringify(t1Question ? t1Answers : {}),
          t2Answers: JSON.stringify(t2Question ? t2Answers : {}),
          scorePct: String(result.scorePct),
          totalCorrect: String(result.totalCorrect),
          totalBlanks: String(result.totalBlanks),
          level,
          timeTaken: String(timeTaken),
        },
      });
    } catch (err) {
      console.log('SprachbausteineTest handleSubmit error', err);
      setIsSubmitting(false);
      setPhase(t2Question ? 't2' : 't1');
    }
  }, [isSubmitting, sessionId, t1Question, t2Question, t1Answers, t2Answers, userId, profile, refreshProfile, level]);

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  // ─── Empty guard ─────────────────────────────────────────────────────────────

  const isSingleTeil = !t1Question || !t2Question;

  if (!t1Question && !t2Question) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Sprachbausteine', headerShown: false }} />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>📚</Text>
          <Text style={styles.emptyTitle}>Noch keine Fragen verfügbar</Text>
          <Text style={styles.emptyDesc}>Dieser Abschnitt wird bald freigeschaltet.</Text>
          <Pressable onPress={() => router.back()} style={styles.emptyBackButton}>
            <Text style={styles.emptyBackText}>Zurück</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  const isT1Phase = phase === 't1';
  const currentTeil = isT1Phase ? 1 : 2;

  const t1AllFilled = t1Words.length > 0 && Object.keys(t1Answers).length === 10;
  const t2AllAnswered = t2Opts.length > 0 && t2Opts.every((o) => t2Answers[String(o.blank)]);
  const canProceed = isT1Phase ? t1AllFilled : t2AllAnswered;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Sprachbausteine', headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={handleBack} style={styles.backBtn} accessibilityLabel="Go back">
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Sprachbausteine</Text>
          <Text style={styles.headerSub}>Teil {currentTeil} · B1</Text>
        </View>
        <View style={styles.teilBadge}>
          <Text style={styles.teilBadgeText}>{currentTeil}/2</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Section label */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionLabelText}>
            {isT1Phase
              ? 'Teil 1 — Ergänzen Sie die Lücken mit Wörtern aus dem Wortkasten'
              : 'Teil 2 — Wählen Sie die richtige Antwort (a, b oder c)'}
          </Text>
        </View>

        {/* Stimulus text with gaps */}
        <View style={styles.stimulusCard}>
          <Text style={styles.stimulusLabel}>
            {isT1Phase ? t1Opts?.instruction ?? '' : ''}
          </Text>
          <Text style={styles.stimulusBody}>
            {isT1Phase
              ? t1StimulusParts.map((part, i) => {
                  if (part.kind === 'text') {
                    return <Text key={i} style={styles.stimulusText}>{part.value}</Text>;
                  }
                  return (
                    <GapChip
                      key={i}
                      num={part.num}
                      word={t1Answers[part.num]}
                      isSelected={t1SelectedBlank === part.num}
                      onPress={() => handleT1GapPress(part.num)}
                    />
                  );
                })
              : t2StimulusParts.map((part, i) => {
                  if (part.kind === 'text') {
                    return <Text key={i} style={styles.stimulusText}>{part.value}</Text>;
                  }
                  return (
                    <View key={i} style={styles.t2InlineGap}>
                      <Text style={styles.t2InlineGapNum}>({part.num})</Text>
                    </View>
                  );
                })}
          </Text>
        </View>

        {/* T1: Word bank */}
        {isT1Phase && (
          <View style={styles.wordBank}>
            <View style={styles.wordBankHeader}>
              <Text style={styles.wordBankTitle}>Wortkasten</Text>
              <Text style={styles.wordBankCount}>{t1AvailableWords.length} übrig</Text>
            </View>
            <View style={styles.wordChipRow}>
              {t1Words.map((word) => {
                const isPlaced = t1PlacedWords.has(word);
                return (
                  <Pressable
                    key={word}
                    onPress={() => !isPlaced && handleWordPress(word)}
                    style={[styles.wordChip, isPlaced && styles.wordChipUsed]}
                    disabled={isPlaced}
                    accessibilityLabel={`Word: ${word}`}
                  >
                    <Text style={[styles.wordChipText, isPlaced && styles.wordChipTextUsed]}>
                      {word}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* T2: Per-blank choice rows */}
        {!isT1Phase && (
          <View style={styles.t2Choices}>
            {t2Opts.map((blankOpt) => {
              const blankKey = String(blankOpt.blank);
              const selected = t2Answers[blankKey];
              return (
                <View key={blankKey} style={styles.t2BlankRow}>
                  <View style={styles.t2BlankNumWrap}>
                    <Text style={styles.t2BlankNum}>({blankOpt.blank})</Text>
                  </View>
                  <View style={styles.t2ChoiceButtons}>
                    {blankOpt.choices.map((choice) => {
                      const isChosen = selected === choice.id;
                      return (
                        <Pressable
                          key={choice.id}
                          onPress={() => setT2Answers((prev) => ({ ...prev, [blankKey]: choice.id }))}
                          style={[styles.t2ChoiceBtn, isChosen && styles.t2ChoiceBtnSelected]}
                          accessibilityLabel={`Blank ${blankOpt.blank} option ${choice.id}: ${choice.text}`}
                        >
                          <Text style={[styles.t2ChoiceId, isChosen && styles.t2ChoiceIdSelected]}>
                            {choice.id}
                          </Text>
                          <Text style={[styles.t2ChoiceText, isChosen && styles.t2ChoiceTextSelected]}>
                            {choice.text}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Footer CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={isT1Phase ? handleContinueToT2 : handleSubmit}
          disabled={!canProceed || isSubmitting}
          style={[styles.ctaBtn, (!canProceed || isSubmitting) && styles.ctaBtnDisabled]}
          accessibilityLabel={isT1Phase ? 'Continue to Teil 2' : 'Submit'}
        >
          <Text style={styles.ctaBtnText}>
            {isSubmitting ? 'Wird gespeichert…' : isT1Phase ? 'Weiter zu Teil 2 →' : 'Test abschließen'}
          </Text>
        </Pressable>
        {isT1Phase && !t1AllFilled && (
          <Text style={styles.footerHint}>
            {Object.keys(t1Answers).length}/10 Lücken ausgefüllt
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.background,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 28,
    color: Colors.textMuted,
    lineHeight: 32,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 18,
    color: colors.navy,
  },
  headerSub: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  teilBadge: {
    backgroundColor: colors.blue + '18',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  teilBadgeText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 13,
    color: colors.blue,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.border,
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.blue,
    borderRadius: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 20,
  },
  sectionLabel: {
    backgroundColor: colors.blue + '12',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sectionLabelText: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    color: colors.blue,
    lineHeight: 18,
  },
  stimulusCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  stimulusLabel: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  stimulusBody: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    color: colors.navy,
    lineHeight: 26,
    flexWrap: 'wrap',
  },
  stimulusText: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    color: colors.navy,
    lineHeight: 26,
  },
  // Gap chips (T1)
  gapChip: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginHorizontal: 2,
    marginVertical: 2,
  },
  gapChipEmpty: {
    backgroundColor: Colors.border,
    borderWidth: 1.5,
    borderColor: Colors.textMuted + '40',
    borderStyle: 'dashed',
  },
  gapChipFilled: {
    backgroundColor: colors.blue + '18',
    borderWidth: 1.5,
    borderColor: colors.blue + '50',
  },
  gapChipSelected: {
    borderColor: colors.blue,
    borderWidth: 2,
    backgroundColor: colors.blue + '25',
  },
  gapChipText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 14,
    color: colors.blue,
  },
  gapChipTextEmpty: {
    color: Colors.textMuted,
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
  },
  // T2 inline gap markers
  t2InlineGap: {
    backgroundColor: colors.amber + '20',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginHorizontal: 2,
  },
  t2InlineGapNum: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 13,
    color: colors.amber,
  },
  // Word bank
  wordBank: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  wordBankHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordBankTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 15,
    color: colors.navy,
  },
  wordBankCount: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
  wordChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordChip: {
    backgroundColor: colors.blue + '15',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: colors.blue + '40',
  },
  wordChipUsed: {
    backgroundColor: Colors.border,
    borderColor: Colors.border,
    opacity: 0.45,
  },
  wordChipText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 14,
    color: colors.blue,
  },
  wordChipTextUsed: {
    color: Colors.textMuted,
  },
  // T2 choices
  t2Choices: {
    gap: 12,
  },
  t2BlankRow: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  t2BlankNumWrap: {
    minWidth: 36,
    paddingTop: 2,
  },
  t2BlankNum: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 14,
    color: colors.navy,
  },
  t2ChoiceButtons: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  t2ChoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    minWidth: 80,
  },
  t2ChoiceBtnSelected: {
    backgroundColor: colors.blue + '15',
    borderColor: colors.blue,
  },
  t2ChoiceId: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 12,
    color: Colors.textMuted,
    textTransform: 'lowercase',
  },
  t2ChoiceIdSelected: {
    color: colors.blue,
  },
  t2ChoiceText: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 14,
    color: colors.navy,
  },
  t2ChoiceTextSelected: {
    fontFamily: 'NunitoSans_600SemiBold',
    color: colors.blue,
  },
  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  ctaBtn: {
    backgroundColor: colors.blue,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaBtnDisabled: {
    opacity: 0.45,
  },
  ctaBtnText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  footerHint: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  // Empty state
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 18,
    color: colors.navy,
    textAlign: 'center',
  },
  emptyDesc: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  emptyBackButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.blue,
    borderRadius: 12,
  },
  emptyBackText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
});
