import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LineChart } from 'lucide-react-native';

import { AccuracyTrendOverlay } from '@/components/AccuracyTrendOverlay';
import { getBandColor } from '@/lib/gamificationHelpers';
import type { DailyRollupRow } from '@/types/gamification';
import { fontFamily } from '@/theme';

type Props = {
  rollup: DailyRollupRow[];
};

/** Returns an ISO date string (YYYY-MM-DD) offset by `daysAgo` from today. */
function isoDateOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

/**
 * Two side-by-side stat cards inside the blue hero card:
 *   Left  — Practiced: sum of questions counted for streak over 7 days
 *   Right — Accuracy: 7-day aggregate %, colour-coded daily bar chart,
 *           graph icon opens AccuracyTrendOverlay.
 */
export function PracticeStatsCards({ rollup }: Props) {
  const [overlayVisible, setOverlayVisible] = useState(false);

  // ── Per-date aggregation (from rollup data) ───────────────────────────────
  const last7 = useMemo(() => {
    const dates = [...new Set(rollup.map((r) => r.activity_date))].sort().slice(-7);
    return dates.map((date) => {
      const dateRows = rollup.filter((r) => r.activity_date === date);
      const counted  = dateRows.reduce((s, r) => s + r.total_questions_counted_for_streak, 0);
      const correct  = dateRows.reduce((s, r) => s + r.stream_questions_correct + r.sectional_questions_correct + r.mock_questions_correct, 0);
      const answered = dateRows.reduce((s, r) => s + r.stream_questions_answered + r.sectional_questions_attempted + r.mock_questions_attempted, 0);
      const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
      return { date, counted, correct, answered, accuracy };
    });
  }, [rollup]);

  // ── 7-day padded array for bar chart — always exactly 7 slots ────────────
  const padded7 = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const iso = isoDateOffset(6 - i); // oldest-left → newest-right
      return last7.find((r) => r.date === iso) ?? {
        date: iso, counted: 0, correct: 0, answered: 0, accuracy: 0,
      };
    });
  }, [last7]);

  // ── Aggregate totals ──────────────────────────────────────────────────────
  const totalPracticed = last7.reduce((s, d) => s + d.counted, 0);
  const totalCorrect   = last7.reduce((s, d) => s + d.correct, 0);
  const totalAnswered  = last7.reduce((s, d) => s + d.answered, 0);
  const overallAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  return (
    <View>
      <View style={styles.row}>

        {/* ── Practiced card (LEFT) ── */}
        <View style={styles.card}>
          <Text style={styles.statCardLabel}>PRACTICED</Text>
          <Text style={styles.statCardValue}>{totalPracticed}</Text>
          <Text style={styles.statCardSub}>last 7 days</Text>
        </View>

        {/* ── Accuracy card (RIGHT) — Variant A ── */}
        <View style={styles.card}>
          {/* Top: label + graph icon */}
          <View style={styles.cardTop}>
            <Text style={styles.statCardLabel}>ACCURACY</Text>
            <Pressable
              onPress={() => setOverlayVisible(true)}
              hitSlop={8}
              accessibilityLabel="View accuracy trend"
              accessibilityRole="button"
            >
              <LineChart size={12} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>

          {/* Value + subline */}
          <Text style={styles.statCardValue}>
            {totalAnswered > 0 ? `${overallAccuracy}%` : '—'}
          </Text>
          <Text style={styles.statCardSub}>last 7 days</Text>

          {/* Colour-coded bar chart — exactly 7 bars */}
          <View style={styles.barsRow}>
            {padded7.map((d) => (
              <View
                key={d.date}
                style={[
                  styles.bar,
                  {
                    height: d.answered > 0
                      ? Math.max(2, Math.round((d.accuracy / 100) * 22))
                      : 1,
                    backgroundColor: d.answered > 0
                      ? getBandColor(d.accuracy)
                      : 'rgba(255,255,255,0.25)',
                    opacity: d.answered > 0 ? 1 : 0.4,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </View>

      {/* 7-day detail overlay */}
      <AccuracyTrendOverlay
        visible={overlayVisible}
        onDismiss={() => setOverlayVisible(false)}
        rollup={rollup}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_BG = 'rgba(255,255,255,0.12)';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  card: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 12,
    gap: 0,
    minHeight: 92,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  statCardLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 9,
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.75)',
  },
  statCardValue: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 20,
    marginTop: 2,
  },
  statCardSub: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 9,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 1,
  },
  barsRow: {
    flexDirection: 'row',
    height: 22,
    alignItems: 'flex-end',
    gap: 1,
    marginTop: 8,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
  },
});
