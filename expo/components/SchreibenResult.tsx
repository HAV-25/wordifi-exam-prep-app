import { Check, X, Share2 } from 'lucide-react-native';
import React, { useCallback } from 'react';
import {
  Platform,
  Pressable,
  Share as RNShare,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ScoreRing } from '@/components/ScoreRing';
import { colors, fontSize, radius, shadows, spacing } from '@/theme';
import type { AssessmentResult } from '@/types/schreiben';

interface SchreibenResultProps {
  assessment: AssessmentResult;
  taskType: string;
  level: string;
  teil: number;
}

export function SchreibenResult({ assessment, taskType, level, teil }: SchreibenResultProps) {
  const scorePct = assessment.max_score > 0
    ? Math.round((assessment.overall_score / assessment.max_score) * 100)
    : 0;

  const handleShare = useCallback(async () => {
    const passLabel = assessment.passed ? 'Bestanden' : 'Nicht bestanden';
    const message = `wordifi — Schreiben ${level} Teil ${teil}\n${assessment.overall_score}/${assessment.max_score} — ${passLabel}\n\n${assessment.encouragement}\n\nwordifi.app`;

    try {
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({ text: message });
        }
      } else {
        await RNShare.share({ message });
      }
    } catch (err) {
      console.log('SchreibenResult share error', err);
    }
  }, [assessment, level, teil]);

  return (
    <View style={styles.container} testID="schreiben-result">
      <View style={[styles.scoreCard, shadows.card]}>
        <ScoreRing score={scorePct} label="Schreiben" size={96} />
        <View style={styles.scoreRow}>
          <Text style={styles.scoreFraction}>
            {assessment.overall_score} / {assessment.max_score}
          </Text>
          <View style={[styles.passBadge, assessment.passed ? styles.passBadgeGreen : styles.passBadgeRed]}>
            {assessment.passed ? (
              <Check color={colors.green} size={14} />
            ) : (
              <X color={colors.red} size={14} />
            )}
            <Text style={[styles.passText, assessment.passed ? styles.passTextGreen : styles.passTextRed]}>
              {assessment.passed ? 'Bestanden' : 'Nicht bestanden'}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.sectionCard, shadows.card]}>
        <Text style={styles.sectionTitle}>AUFGABENPUNKTE</Text>
        {assessment.points_coverage.map((pt, idx) => (
          <View key={idx} style={styles.pointItem}>
            <View style={styles.pointHeader}>
              <Text style={[styles.pointIcon, pt.addressed ? styles.pointIconGreen : styles.pointIconRed]}>
                {pt.addressed ? '✓' : '✗'}
              </Text>
              <Text style={[styles.pointLabel, !pt.addressed && styles.pointLabelRed]}>
                {pt.point}
              </Text>
            </View>
            {pt.comment ? (
              <Text style={styles.pointComment}>{pt.comment}</Text>
            ) : null}
          </View>
        ))}
      </View>

      {taskType !== 'form_fill' && assessment.language_feedback ? (
        <View style={[styles.sectionCard, shadows.card]}>
          <Text style={styles.sectionTitle}>SPRACHLICHE RÜCKMELDUNG</Text>
          <FeedbackRow label="Grammatik" value={assessment.language_feedback.grammar} />
          <View style={styles.feedbackDivider} />
          <FeedbackRow label="Rechtschreibung" value={assessment.language_feedback.spelling} />
          <View style={styles.feedbackDivider} />
          <FeedbackRow label="Register" value={assessment.language_feedback.register} />
          <View style={styles.feedbackDivider} />
          <FeedbackRow label="Satzbau" value={assessment.language_feedback.sentence_structure} />
        </View>
      ) : null}

      {assessment.encouragement ? (
        <View style={[styles.encouragementCard, shadows.card]}>
          <Text style={styles.encouragementText}>💬 "{assessment.encouragement}"</Text>
        </View>
      ) : null}

      <Pressable
        onPress={handleShare}
        style={[styles.shareBtn, shadows.card]}
        testID="schreiben-share"
      >
        <Share2 color={colors.blue} size={18} />
        <Text style={styles.shareBtnText}>Ergebnis teilen</Text>
      </Pressable>
    </View>
  );
}

function FeedbackRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.feedbackRow}>
      <Text style={styles.feedbackLabel}>{label}</Text>
      <Text style={styles.feedbackValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  scoreCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.lg,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  scoreFraction: {
    fontSize: fontSize.displayLg,
    fontWeight: '800' as const,
    color: colors.navy,
  },
  passBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  passBadgeGreen: {
    backgroundColor: '#DDF8EA',
  },
  passBadgeRed: {
    backgroundColor: '#FCE3E3',
  },
  passText: {
    fontSize: fontSize.bodySm,
    fontWeight: '700' as const,
  },
  passTextGreen: {
    color: colors.green,
  },
  passTextRed: {
    color: colors.red,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.label,
    color: colors.muted,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  pointItem: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  pointHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  pointIcon: {
    fontSize: fontSize.bodyLg,
    fontWeight: '800' as const,
    width: 22,
  },
  pointIconGreen: {
    color: colors.green,
  },
  pointIconRed: {
    color: colors.red,
  },
  pointLabel: {
    fontSize: fontSize.bodyMd,
    color: colors.text,
    flex: 1,
    lineHeight: fontSize.bodyMd * 1.5,
  },
  pointLabelRed: {
    color: colors.red,
  },
  pointComment: {
    fontSize: fontSize.bodySm,
    color: colors.muted,
    paddingLeft: 30,
    lineHeight: fontSize.bodySm * 1.5,
  },
  feedbackRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  feedbackLabel: {
    fontSize: fontSize.label,
    color: colors.muted,
    fontWeight: '600' as const,
    width: 110,
  },
  feedbackValue: {
    fontSize: fontSize.bodyMd,
    color: colors.text,
    flex: 1,
    lineHeight: fontSize.bodyMd * 1.5,
  },
  feedbackDivider: {
    height: 0.5,
    backgroundColor: colors.border,
  },
  encouragementCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  encouragementText: {
    fontSize: fontSize.bodyMd,
    color: colors.text,
    fontStyle: 'italic',
    lineHeight: fontSize.bodyMd * 1.6,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  shareBtnText: {
    fontSize: fontSize.bodyMd,
    color: colors.blue,
    fontWeight: '700' as const,
  },
});
