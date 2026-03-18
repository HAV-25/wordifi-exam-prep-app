import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AudioPlayer } from '@/components/AudioPlayer';
import { QuestionCard } from '@/components/QuestionCard';
import { ScoreRing } from '@/components/ScoreRing';
import { StimulusCard } from '@/components/StimulusCard';
import Colors from '@/constants/colors';
import type { AppQuestion } from '@/types/database';

function performanceLabel(score: number): string {
  if (score < 50) {
    return 'Keep practising! 💪';
  }
  if (score < 75) {
    return 'Good effort! 👍';
  }
  if (score < 90) {
    return 'Well done! ⭐';
  }
  return 'Excellent! 🏆';
}

export default function ResultsScreen() {
  const params = useLocalSearchParams<{ scorePct?: string; correctCount?: string; total?: string; level?: string; section?: string; teil?: string; questions?: string; answers?: string }>();
  const [expandedStimulusId, setExpandedStimulusId] = useState<string | null>(null);
  const scorePct = Number(params.scorePct ?? '0');
  const correctCount = Number(params.correctCount ?? '0');
  const total = Number(params.total ?? '0');
  const level = params.level ?? 'A1';
  const section = params.section ?? 'Hören';
  const teil = params.teil ?? '1';
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

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Results', headerBackVisible: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.heroMeta}>{section} · Teil {teil} · {level}</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.scoreLine}>{correctCount} / {total}</Text>
              <Text style={styles.performance}>{performanceLabel(scorePct)}</Text>
              <Text style={styles.xpLine}>+{correctCount} XP</Text>
            </View>
            <ScoreRing label="Score" score={scorePct} size={96} />
          </View>
        </View>

        <View style={styles.reviewWrap}>
          {questions.map((question, index) => {
            const selectedAnswer = (answers[question.id] ?? '').toLowerCase();
            const isCorrect = selectedAnswer === question.correct_answer.toLowerCase();
            const selectedOption = question.options.find((option) => option.key.toLowerCase() === selectedAnswer);
            const correctOption = question.options.find((option) => option.key.toLowerCase() === question.correct_answer.toLowerCase());
            return (
              <QuestionCard key={question.id} title={question.question_text} subtitle={`Question ${index + 1}`}>
                <View style={styles.answerRow}><Text style={[styles.answerBadge, isCorrect ? styles.correctBadge : styles.incorrectBadge]}>{isCorrect ? '✓' : '✗'}</Text><Text style={[styles.answerText, isCorrect ? styles.correctText : styles.incorrectText]}>Your answer: {(selectedOption?.text ?? selectedAnswer) || 'No answer'}</Text></View>
                {!isCorrect ? <Text style={styles.correctAnswerText}>Correct answer: {correctOption?.text ?? question.correct_answer}</Text> : null}
                {section === 'Hören' && question.audio_url ? <AudioPlayer audioUrl={question.audio_url} /> : null}
                {section === 'Lesen' && question.stimulus_text ? (
                  <View>
                    <Pressable accessibilityLabel="Show passage" onPress={() => setExpandedStimulusId((value) => (value === question.id ? null : question.id))} style={styles.showPassageButton} testID={`show-passage-${question.id}`}>
                      <Text style={styles.showPassageText}>{expandedStimulusId === question.id ? 'Hide passage' : 'Show passage'}</Text>
                    </Pressable>
                    {expandedStimulusId === question.id ? <StimulusCard text={question.stimulus_text} type={question.stimulus_type} collapsible={false} /> : null}
                  </View>
                ) : null}
              </QuestionCard>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable accessibilityLabel="Practice again" onPress={() => router.replace({ pathname: '/practice', params: { level, section, teil } })} style={styles.primaryButton} testID="practice-again-button">
          <Text style={styles.primaryButtonText}>Practice Again</Text>
        </Pressable>
        <View style={styles.footerRow}>
          <Pressable accessibilityLabel="Try a different teil" onPress={() => router.replace('/')} style={styles.secondaryButton} testID="different-teil-button"><Text style={styles.secondaryButtonText}>Try a Different Teil</Text></Pressable>
          <Pressable accessibilityLabel="Go home" onPress={() => router.replace('/')} style={styles.secondaryButton} testID="home-button"><Text style={styles.secondaryButtonText}>Home</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, gap: 16, paddingBottom: 180 },
  heroCard: { borderRadius: 28, backgroundColor: Colors.primary, padding: 20, gap: 16 },
  heroMeta: { color: 'rgba(255,255,255,0.74)', fontWeight: '700' },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  heroTextWrap: { flex: 1, gap: 8 },
  scoreLine: { color: Colors.surface, fontSize: 34, fontWeight: '800' },
  performance: { color: Colors.surface, fontSize: 18, fontWeight: '700' },
  xpLine: { color: 'rgba(255,255,255,0.74)', fontWeight: '700' },
  reviewWrap: { gap: 12 },
  answerRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  answerBadge: { width: 26, height: 26, borderRadius: 13, textAlign: 'center', lineHeight: 26, overflow: 'hidden', fontWeight: '800' },
  correctBadge: { backgroundColor: Colors.accentSoft, color: Colors.accent },
  incorrectBadge: { backgroundColor: Colors.dangerSoft, color: Colors.danger },
  answerText: { flex: 1, fontWeight: '700' },
  correctText: { color: Colors.accent },
  incorrectText: { color: Colors.danger },
  correctAnswerText: { color: Colors.accent, fontWeight: '700' },
  showPassageButton: { minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceMuted },
  showPassageText: { color: Colors.primary, fontWeight: '700' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, gap: 10, backgroundColor: Colors.background },
  primaryButton: { minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary },
  primaryButtonText: { color: Colors.surface, fontWeight: '800', fontSize: 16 },
  footerRow: { flexDirection: 'row', gap: 10 },
  secondaryButton: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  secondaryButtonText: { color: Colors.primary, fontWeight: '700', textAlign: 'center' },
});
