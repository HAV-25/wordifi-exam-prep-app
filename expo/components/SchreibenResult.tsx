import { Check, X, ChevronDown, ChevronUp } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { colors, fontSize, radius, shadows, spacing } from '@/theme';
import type { AssessmentResult, CorrectionItem, ScoreBreakdownItem } from '@/types/schreiben';

interface SchreibenResultProps {
  assessment: AssessmentResult;
  taskType: string;
  level: string;
  teil: number;
}

const DEFAULT_BREAKDOWN_COLORS = [colors.green, '#6C5CE7', colors.blue];

const CORRECTION_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  error: { label: 'ERROR', color: colors.red, bgColor: '#FCE3E3' },
  suggestion: { label: 'SUGGESTION', color: colors.amber, bgColor: '#FFF8E7' },
  excellent: { label: 'EXCELLENT', color: colors.green, bgColor: '#DDF8EA' },
};

export function SchreibenResult({ assessment, taskType, level, teil }: SchreibenResultProps) {
  const scorePct = assessment.max_score > 0
    ? Math.round((assessment.overall_score / assessment.max_score) * 100)
    : 0;

  const moderationFlagged = Boolean(assessment.moderation_flagged);
  const hasScoreDetails = assessment.score_details && assessment.score_details.length > 0;
  const hasCorrections = assessment.corrections && assessment.corrections.length > 0;

  return (
    <View style={styles.container} testID="schreiben-result">
      <ScoreHeroCard scorePct={scorePct} assessment={assessment} />

      {/* Moderation blocked — replaces all feedback cards */}
      {moderationFlagged ? (
        <View style={[styles.moderationCard, shadows.card]}>
          <Text style={styles.moderationTitle}>Response Could Not Be Evaluated</Text>
          <Text style={styles.moderationBody}>
            Your response could not be assessed because it contained content that violates our usage policy.
          </Text>
          <Text style={styles.moderationHint}>
            Please keep responses relevant to the exam task and write in German.
          </Text>
        </View>
      ) : (
        <>
          {hasScoreDetails ? (
            <ScoreBreakdownCard items={assessment.score_details!} />
          ) : null}

          <View style={[styles.sectionCard, shadows.card]}>
            <Text style={styles.sectionTitle}>TASK POINTS</Text>
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

          {hasCorrections ? (
            <CorrectionsCard corrections={assessment.corrections!} />
          ) : null}

          {taskType !== 'form_fill' && assessment.language_feedback ? (
            <LanguageFeedbackCard feedback={assessment.language_feedback} />
          ) : null}
        </>
      )}
    </View>
  );
}

function ScoreHeroCard({ scorePct, assessment }: { scorePct: number; assessment: AssessmentResult }) {
  const ringSize = 120;
  const strokeWidth = 10;
  const ringRadius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * ringRadius;
  const animatedProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: scorePct,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [scorePct, animatedProgress]);

  const ringColor = scorePct >= 70 ? colors.green : scorePct >= 40 ? colors.amber : colors.red;

  const offset = circumference - (scorePct / 100) * circumference;

  return (
    <View style={[styles.heroCard, shadows.card]}>
      <View style={styles.ringContainer}>
        <Svg height={ringSize} width={ringSize}>
          <Circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={ringRadius}
            stroke={colors.ringTrack}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {Platform.OS === 'web' ? (
            <G style={{ transformOrigin: `${ringSize / 2}px ${ringSize / 2}px` }}>
              <Circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={ringRadius}
                stroke={ringColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={offset}
                strokeLinecap="round"
                rotation="-90"
              />
            </G>
          ) : (
            <Circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={ringRadius}
              stroke={ringColor}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${ringSize / 2}, ${ringSize / 2}`}
            />
          )}
        </Svg>
        <View style={styles.ringCenter}>
          <Text style={[styles.ringPct, { color: ringColor }]}>{scorePct}%</Text>
        </View>
      </View>
      <Text style={styles.heroLabel}>Overall Score</Text>
      <View style={[styles.passBadge, assessment.passed ? styles.passBadgeGreen : styles.passBadgeRed]}>
        {assessment.passed ? (
          <Check color={colors.green} size={14} />
        ) : (
          <X color={colors.red} size={14} />
        )}
        <Text style={[styles.passText, assessment.passed ? styles.passTextGreen : styles.passTextRed]}>
          {assessment.passed ? 'Passed' : 'Not passed'}
        </Text>
      </View>
    </View>
  );
}

function ScoreBreakdownCard({ items }: { items: ScoreBreakdownItem[] }) {
  return (
    <View style={[styles.breakdownCard, shadows.card]}>
      {items.map((item, idx) => (
        <ScoreBarRow
          key={idx}
          label={item.label}
          score={item.score}
          maxScore={item.max_score}
          barColor={item.color ?? DEFAULT_BREAKDOWN_COLORS[idx % DEFAULT_BREAKDOWN_COLORS.length]!}
        />
      ))}
    </View>
  );
}

function ScoreBarRow({
  label,
  score,
  maxScore,
  barColor,
}: {
  label: string;
  score: number;
  maxScore: number;
  barColor: string;
}) {
  const pct = maxScore > 0 ? Math.min(score / maxScore, 1) : 0;
  const animWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: pct * 100,
      duration: 800,
      delay: 200,
      useNativeDriver: false,
    }).start();
  }, [pct, animWidth]);

  const widthInterp = animWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            { width: widthInterp, backgroundColor: barColor },
          ]}
        />
      </View>
      <View style={[styles.barScoreBadge, { backgroundColor: barColor + '18' }]}>
        <Text style={[styles.barScoreText, { color: barColor }]}>
          {score}/{maxScore}
        </Text>
      </View>
    </View>
  );
}

function CorrectionsCard({ corrections }: { corrections: CorrectionItem[] }) {
  const [expanded, setExpanded] = useState<boolean>(true);

  return (
    <View style={[styles.sectionCard, shadows.card]}>
      <Pressable
        style={styles.correctionHeaderRow}
        onPress={() => setExpanded((v) => !v)}
        testID="corrections-toggle"
      >
        <Text style={styles.sectionTitle}>CORRECTIONS & NOTES</Text>
        {expanded ? (
          <ChevronUp color={colors.muted} size={18} />
        ) : (
          <ChevronDown color={colors.muted} size={18} />
        )}
      </Pressable>

      {expanded ? (
        <View style={styles.correctionsList}>
          {corrections.map((c, idx) => (
            <CorrectionRow key={idx} item={c} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function CorrectionRow({ item }: { item: CorrectionItem }) {
  const config = CORRECTION_CONFIG[item.type] ?? CORRECTION_CONFIG.suggestion!;

  return (
    <View style={[styles.correctionItem, { borderLeftColor: config.color }]}>
      <View style={[styles.correctionTypeBadge, { backgroundColor: config.bgColor }]}>
        <View style={[styles.correctionDot, { backgroundColor: config.color }]} />
        <Text style={[styles.correctionTypeText, { color: config.color }]}>
          {config.label}
        </Text>
      </View>

      {item.type === 'excellent' ? (
        <Text style={[styles.correctionExcellentText, { color: config.color }]}>
          {item.original || item.corrected}
        </Text>
      ) : (
        <View style={styles.correctionTextRow}>
          <Text style={styles.correctionOriginal}>
            {item.original}
          </Text>
          {item.corrected ? (
            <>
              <Text style={styles.correctionArrow}> → </Text>
              <Text style={[styles.correctionCorrected, { color: config.color }]}>
                {item.corrected}
              </Text>
            </>
          ) : null}
          {item.context ? (
            <Text style={styles.correctionContext}>{item.context}</Text>
          ) : null}
        </View>
      )}

      <Text style={styles.correctionExplanation}>{item.explanation}</Text>
    </View>
  );
}

function LanguageFeedbackCard({
  feedback,
}: {
  feedback: { grammar: string; spelling: string; register: string; sentence_structure: string };
}) {
  const [expanded, setExpanded] = useState<boolean>(false);

  return (
    <View style={[styles.sectionCard, shadows.card]}>
      <Pressable
        style={styles.correctionHeaderRow}
        onPress={() => setExpanded((v) => !v)}
        testID="language-feedback-toggle"
      >
        <Text style={styles.sectionTitle}>LANGUAGE FEEDBACK</Text>
        {expanded ? (
          <ChevronUp color={colors.muted} size={18} />
        ) : (
          <ChevronDown color={colors.muted} size={18} />
        )}
      </Pressable>

      {expanded ? (
        <View style={styles.feedbackContent}>
          <FeedbackRow label="Grammar" value={feedback.grammar} />
          <View style={styles.feedbackDivider} />
          <FeedbackRow label="Spelling" value={feedback.spelling} />
          <View style={styles.feedbackDivider} />
          <FeedbackRow label="Register" value={feedback.register} />
          <View style={styles.feedbackDivider} />
          <FeedbackRow label="Sentence structure" value={feedback.sentence_structure} />
        </View>
      ) : null}
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
  heroCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  ringContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPct: {
    fontSize: 28,
    fontWeight: '800' as const,
  },
  heroLabel: {
    fontSize: fontSize.bodyMd,
    color: colors.muted,
    fontWeight: '600' as const,
    marginTop: spacing.xs,
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
  breakdownCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  barLabel: {
    fontSize: fontSize.bodySm,
    color: colors.text,
    fontWeight: '600' as const,
    width: 100,
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.ringTrack,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  barScoreBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.xs,
    minWidth: 44,
    alignItems: 'center',
  },
  barScoreText: {
    fontSize: fontSize.label,
    fontWeight: '800' as const,
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
  correctionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  correctionsList: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  correctionItem: {
    borderLeftWidth: 3,
    paddingLeft: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  correctionTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.xs,
    marginBottom: spacing.xs,
  },
  correctionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  correctionTypeText: {
    fontSize: fontSize.micro,
    fontWeight: '800' as const,
    letterSpacing: 0.8,
  },
  correctionTextRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 2,
  },
  correctionOriginal: {
    fontSize: fontSize.displaySm,
    fontWeight: '700' as const,
    color: colors.text,
    textDecorationLine: 'line-through',
    textDecorationColor: colors.red,
  },
  correctionArrow: {
    fontSize: fontSize.displaySm,
    color: colors.muted,
    fontWeight: '600' as const,
  },
  correctionCorrected: {
    fontSize: fontSize.displaySm,
    fontWeight: '700' as const,
  },
  correctionContext: {
    fontSize: fontSize.bodyMd,
    color: colors.text,
    fontWeight: '400' as const,
  },
  correctionExcellentText: {
    fontSize: fontSize.displaySm,
    fontWeight: '700' as const,
    lineHeight: fontSize.displaySm * 1.5,
  },
  correctionExplanation: {
    fontSize: fontSize.bodySm,
    color: colors.muted,
    lineHeight: fontSize.bodySm * 1.5,
    marginTop: 2,
  },
  feedbackContent: {
    marginTop: spacing.sm,
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

  // ── Moderation blocked ────────────────────────────────────────────────────
  moderationCard: {
    backgroundColor: '#FFF4F4',
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.red,
  },
  moderationTitle: {
    color: colors.red,
    fontSize: fontSize.bodyLg,
    fontWeight: '800' as const,
  },
  moderationBody: {
    color: colors.bodyText,
    fontSize: fontSize.bodyMd,
    fontWeight: '500' as const,
    lineHeight: 22,
  },
  moderationHint: {
    color: colors.muted,
    fontSize: fontSize.bodySm,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
});
