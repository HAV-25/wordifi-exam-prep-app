import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { getBandColor } from '@/lib/gamificationHelpers';
import type { DailyRollupRow } from '@/types/gamification';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  onDismiss: () => void;
  rollup: DailyRollupRow[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Returns an ISO date string (YYYY-MM-DD) offset by `daysAgo` from today. */
function isoDateOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Slide-up sheet triggered by the Accuracy card graph icon.
 * Shows a labelled 7-day accuracy breakdown with colour-coded percentages.
 * Always renders exactly 7 rows — inactive days show "0 / 0" and "—".
 */
export function AccuracyTrendOverlay({ visible, onDismiss, rollup }: Props) {
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;

  // ── Open / close animation ────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 12,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setModalVisible(false));
    }
  }, [visible]);

  // ── 7-day computation — always exactly 7 calendar days ───────────────────
  const rows = useMemo(() => {
    // Build a lookup of date → aggregated accuracy
    const byDate = new Map<string, { correct: number; answered: number }>();
    for (const r of rollup) {
      const prev = byDate.get(r.activity_date) ?? { correct: 0, answered: 0 };
      byDate.set(r.activity_date, {
        correct:
          prev.correct +
          r.stream_questions_correct +
          r.sectional_questions_correct +
          r.mock_questions_correct,
        answered:
          prev.answered +
          r.stream_questions_answered +
          r.sectional_questions_attempted +
          r.mock_questions_attempted,
      });
    }

    // Always return 7 entries: today is index 0 (rightmost), 6 days ago is index 6 (leftmost)
    return Array.from({ length: 7 }, (_, i) => {
      const iso = isoDateOffset(6 - i); // oldest first
      const agg = byDate.get(iso);
      const correct = agg?.correct ?? 0;
      const answered = agg?.answered ?? 0;
      const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
      return { date: iso, correct, answered, accuracy };
    });
  }, [rollup]);

  if (!modalVisible) return null;

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
    >
      {/* Backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss}>
        <View style={[StyleSheet.absoluteFill, s.backdrop]} />
      </Pressable>

      {/* Slide card */}
      <Animated.View
        style={[
          s.sheet,
          {
            transform: [{ translateY: slideAnim }],
            paddingBottom: Math.max(insets.bottom, 16) + 8,
          },
        ]}
        pointerEvents="box-none"
      >
        {/* Title row */}
        <View style={s.titleRow}>
          <Text style={s.title}>Accuracy — last 7 days</Text>
          <Pressable onPress={onDismiss} hitSlop={8} accessibilityLabel="Close">
            <X size={18} color="#374151" />
          </Pressable>
        </View>

        {/* 7 rows */}
        {rows.map((row, idx) => (
          <View
            key={row.date}
            style={[s.row, idx === rows.length - 1 && s.rowLast]}
          >
            <Text style={s.rowDate}>{formatDate(row.date)}</Text>
            <Text style={s.rowFraction}>
              {row.answered > 0 ? `${row.correct} / ${row.answered}` : '0 / 0'}
            </Text>
            <Text
              style={[
                s.rowPct,
                { color: row.answered > 0 ? getBandColor(row.accuracy) : '#94A3B8' },
              ]}
            >
              {row.answered > 0 ? `${row.accuracy}%` : '—'}
            </Text>
          </View>
        ))}
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Outfit_500Medium' as string,
    fontSize: 16,
    color: '#0A0E1A',
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowDate: {
    flex: 1,
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    color: '#374151',
  },
  rowFraction: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    color: '#94A3B8',
    marginRight: 16,
  },
  rowPct: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 13,
    minWidth: 36,
    textAlign: 'right',
  },
});
