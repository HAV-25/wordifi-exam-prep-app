/**
 * SectionPlayerSchreiben — Mock V2 writing section.
 * Iterates through all Teile, uses existing SchreibenQuestion + assessSchreiben.
 * Single section timer covers all teils.
 */
import { Clock, PenLine } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SchreibenQuestion } from '@/components/SchreibenQuestion';
import { assessSchreiben, fetchSchreibenQuestions } from '@/lib/schreibenHelpers';
import { B } from '@/theme/banani';
import type { AppQuestion } from '@/types/database';
import { SCHREIBEN_TASK_TYPE, type AssessmentResult } from '@/types/schreiben';

export type SchreibenSectionResult = {
  teilResults: Array<{
    teil: number;
    userText: string;
    assessment: AssessmentResult | null;
  }>;
  overallScorePct: number;  // average of all teils
  timeTakenSeconds: number;
};

type Props = {
  level: string;
  teils: number[];
  timeLimitSeconds: number;
  onComplete: (result: SchreibenSectionResult) => void;
  sectionIndex: number;
  totalSections: number;
};

export function SectionPlayerSchreiben({ level, teils, timeLimitSeconds, onComplete, sectionIndex, totalSections }: Props) {
  const [currentTeilIndex, setCurrentTeilIndex] = useState(0);
  const [teilQuestions, setTeilQuestions] = useState<Record<number, AppQuestion>>({});
  const [isLoadingQ, setIsLoadingQ] = useState(true);
  const [teilResults, setTeilResults] = useState<SchreibenSectionResult['teilResults']>([]);
  const [currentAssessment, setCurrentAssessment] = useState<AssessmentResult | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(timeLimitSeconds);
  const sessionStart = useRef(Date.now());
  const timerPulse = useRef(new Animated.Value(1)).current;

  const currentTeil = teils[currentTeilIndex]!;
  const currentQuestion = teilQuestions[currentTeil] ?? null;
  const taskType = SCHREIBEN_TASK_TYPE[level]?.[currentTeil] ?? 'form_fill';
  const isLastTeil = currentTeilIndex === teils.length - 1;

  // ── Fetch one question per teil on mount ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded: Record<number, AppQuestion> = {};
      for (const teil of teils) {
        const qs = await fetchSchreibenQuestions(level, teil, 1);
        if (qs.length > 0) loaded[teil] = qs[0]!;
      }
      if (!cancelled) {
        setTeilQuestions(loaded);
        setIsLoadingQ(false);
      }
    })();
    return () => { cancelled = true; };
  }, [level, teils]);

  // ── Section timer (30 min block covering all teils) ──────────────────
  const finalizeSection = useCallback((resultsArg: SchreibenSectionResult['teilResults']) => {
    const scores = resultsArg.map((r) => {
      if (!r.assessment) return 0;
      const pct = r.assessment.max_score > 0 ? (r.assessment.overall_score / r.assessment.max_score) * 100 : 0;
      return Math.round(pct);
    });
    const overall = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const timeTaken = Math.round((Date.now() - sessionStart.current) / 1000);
    onComplete({
      teilResults: resultsArg,
      overallScorePct: overall,
      timeTakenSeconds: timeTaken,
    });
  }, [onComplete]);

  useEffect(() => {
    if (timeLimitSeconds <= 0) return;
    const iv = setInterval(() => {
      const elapsed = Math.round((Date.now() - sessionStart.current) / 1000);
      const remain = Math.max(0, timeLimitSeconds - elapsed);
      setRemainingSeconds(remain);
      if (remain <= 0) {
        clearInterval(iv);
        // Force-submit: whatever we have so far
        finalizeSection(teilResults);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [timeLimitSeconds, finalizeSection, teilResults]);

  useEffect(() => {
    if (remainingSeconds <= 120 && remainingSeconds > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(timerPulse, { toValue: 1.1, duration: 400, useNativeDriver: true }),
          Animated.timing(timerPulse, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [remainingSeconds, timerPulse]);

  // ── Handle submission of current teil ────────────────────────────────
  const handleSubmitTeil = useCallback(async (userText: string, wordCount: number) => {
    if (!currentQuestion) return;
    setIsLoading(true);
    setIsSubmitted(true);
    try {
      const assessment = await assessSchreiben(currentQuestion, userText, wordCount, taskType, null);
      setCurrentAssessment(assessment);
      setTeilResults((prev) => [...prev, { teil: currentTeil, userText, assessment }]);
    } catch (err) {
      console.log('[MockV2 Schreiben] assess error', err);
      setTeilResults((prev) => [...prev, { teil: currentTeil, userText, assessment: null }]);
    } finally {
      setIsLoading(false);
    }
  }, [currentQuestion, taskType, currentTeil]);

  const handleNextTeil = useCallback(() => {
    if (isLastTeil) {
      finalizeSection(teilResults);
    } else {
      setCurrentTeilIndex((i) => i + 1);
      setCurrentAssessment(null);
      setIsSubmitted(false);
      setIsLoading(false);
    }
  }, [isLastTeil, teilResults, finalizeSection]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  if (isLoadingQ) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={B.primary} size="large" />
        <Text style={styles.loadingText}>Loading Schreiben questions...</Text>
      </View>
    );
  }

  if (!currentQuestion) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>No Schreiben questions available.</Text>
        <Pressable style={styles.skipBtn} onPress={() => finalizeSection(teilResults)}>
          <Text style={styles.skipBtnText}>Skip to next section</Text>
        </Pressable>
      </View>
    );
  }

  const isTimeLow = remainingSeconds <= 120;

  return (
    <View style={styles.wrap}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.metaRow}>
          <Text style={styles.teilCount}>Teil {currentTeilIndex + 1} of {teils.length}</Text>
          <View style={styles.sectionPill}>
            <PenLine color="#8B5CF6" size={14} />
            <Text style={styles.sectionPillText}>Schreiben</Text>
          </View>
          <Text style={styles.levelText}>{level} · Section {sectionIndex + 1}/{totalSections}</Text>
          <Animated.View style={[styles.timerChip, isTimeLow && styles.timerChipUrgent, { transform: [{ scale: timerPulse }] }]}>
            <Clock color={isTimeLow ? '#EF4444' : B.muted} size={12} />
            <Text style={[styles.timerText, isTimeLow && styles.timerTextUrgent]}>{formatTime(remainingSeconds)}</Text>
          </Animated.View>
        </View>
      </View>

      {/* Body — reuse SchreibenQuestion */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <SchreibenQuestion
          question={currentQuestion}
          task_type={taskType}
          onSubmit={handleSubmitTeil}
          isSubmitted={isSubmitted}
          isLoading={isLoading}
          assessment={currentAssessment}
        />
      </ScrollView>

      {/* Footer: only shows after assessment */}
      {isSubmitted && currentAssessment && !isLoading ? (
        <View style={styles.footer}>
          <Pressable style={styles.nextBtn} onPress={handleNextTeil}>
            <Text style={styles.nextBtnText}>
              {isLastTeil ? 'Finish Schreiben' : `Next: Teil ${currentTeilIndex + 2}`}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: B.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingText: { fontSize: 14, color: B.muted, fontWeight: '600' as const, textAlign: 'center' },

  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, backgroundColor: B.card, borderBottomWidth: 1, borderBottomColor: B.border },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  teilCount: { fontSize: 13, fontWeight: '800' as const, color: B.primary },
  sectionPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(139,92,246,0.12)' },
  sectionPillText: { fontSize: 11, fontWeight: '700' as const, color: '#8B5CF6' },
  levelText: { fontSize: 11, fontWeight: '600' as const, color: B.muted, flex: 1 },
  timerChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F1F5F9' },
  timerChipUrgent: { backgroundColor: '#FEE2E2' },
  timerText: { fontSize: 12, fontWeight: '800' as const, color: B.muted, fontVariant: ['tabular-nums'] },
  timerTextUrgent: { color: '#EF4444' },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 24 },

  footer: { padding: 20, paddingTop: 12, backgroundColor: B.card, borderTopWidth: 1, borderTopColor: B.border },
  nextBtn: {
    minHeight: 54, borderRadius: 27, backgroundColor: B.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: B.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 3,
  },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' as const },
  skipBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: '#F1F5F9' },
  skipBtnText: { color: B.muted, fontSize: 14, fontWeight: '700' as const },
});
