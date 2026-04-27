import React, { useState, useRef, useCallback } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, Medal } from 'lucide-react-native';

import type { BadgeLadderEntry } from '@/hooks/useBadgeLadder';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  currentStreakDays: number;
  missedDaysAtRank: number;
  todayRequirementMet: boolean;
  /** Base requirement + tier adjustment for today */
  todayRequirement: number;
  /** null = user has no badge yet (rank 0) */
  currentBadge: BadgeLadderEntry | null;
  /** null = user is at max rank */
  nextBadge: BadgeLadderEntry | null;
};

type StatusState = 'A' | 'B' | 'C' | 'D';

// ─── State derivation ─────────────────────────────────────────────────────────
// Priority: C (quiet) → A (urgent) → D (new user) → B (encouraging)

function deriveState(
  todayRequirementMet: boolean,
  missedDaysAtRank: number,
  currentStreakDays: number,
): StatusState {
  if (todayRequirementMet)   return 'C'; // done for today — stay quiet
  if (missedDaysAtRank > 0)  return 'A'; // at risk — amber warning
  if (currentStreakDays === 0) return 'D'; // no streak yet — gentle nudge
  return 'B';                             // on track — positive encouragement
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Small contextual icon shown adjacent to the streak number on the home screen.
 *
 * State A (amber AlertTriangle): badge rank is at risk due to missed days.
 * State B (green Medal):         streak active, requirement not yet met today.
 * State C (nothing):             today's requirement already met — no clutter.
 * State D (muted Medal):         no streak yet — new user or streak broken.
 *
 * Tooltip is tap-to-open, auto-dismisses after 3 s, dismisses on outside tap.
 * Reuses the exact modal + backdrop pattern from profile.tsx tier tooltip.
 */
export function StreakStatusIcon({
  currentStreakDays,
  missedDaysAtRank,
  todayRequirementMet,
  todayRequirement,
  currentBadge,
  nextBadge,
}: Props) {
  const [visible, setVisible] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = useCallback(() => {
    setVisible(true);
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => setVisible(false), 3000);
  }, []);

  const hideTooltip = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setVisible(false);
  }, []);

  const state = deriveState(todayRequirementMet, missedDaysAtRank, currentStreakDays);

  // State C — no icon, no tooltip
  if (state === 'C') return null;

  // ── Tooltip text ──────────────────────────────────────────────────────────
  let tooltipText = '';

  if (state === 'A') {
    const daysUntilLoss = Math.max(0, (currentBadge?.interval_days ?? 0) - missedDaysAtRank);
    const badgeName = currentBadge?.name ?? 'your badge';
    tooltipText =
      `You've missed ${missedDaysAtRank} day(s).\n` +
      `${daysUntilLoss} more missed day(s) until you lose your ${badgeName}.\n` +
      `Complete ${todayRequirement} questions today to halt further loss.`;

  } else if (state === 'B') {
    if (nextBadge) {
      const daysToNext = Math.max(0, nextBadge.cumulative_day - currentStreakDays);
      const keepPhrase = currentBadge ? `keep your ${currentBadge.name} and ` : '';
      tooltipText =
        `Complete ${todayRequirement} more question(s) today to ` +
        `${keepPhrase}earn ${nextBadge.name} in ${daysToNext} day(s).`;
    } else {
      // Max rank — no next badge
      const badgeName = currentBadge?.name ?? 'your streak';
      tooltipText =
        `Complete ${todayRequirement} more question(s) today to keep your ${badgeName}.`;
    }

  } else {
    // State D — no streak yet
    tooltipText = `Complete ${todayRequirement} questions today to start a new streak.`;
  }

  // ── Icon ──────────────────────────────────────────────────────────────────
  const icon =
    state === 'A' ? (
      <AlertTriangle size={16} color="#F59E0B" />   // amber-500
    ) : state === 'B' ? (
      <Medal size={16} color="#22C55E" />            // green-500
    ) : (
      <Medal size={16} color="#94A3B8" />            // slate-400, muted for State D
    );

  return (
    <>
      <Pressable
        onPress={showTooltip}
        hitSlop={8}
        accessibilityLabel="Streak status"
        accessibilityRole="button"
      >
        {icon}
      </Pressable>

      <Modal
        visible={visible}
        animationType="fade"
        transparent
        onRequestClose={hideTooltip}
      >
        <Pressable style={s.backdrop} onPress={hideTooltip}>
          <View style={s.card}>
            <Text style={s.body}>{tooltipText}</Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    maxWidth: 340,
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#0F1F3D',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.14,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
    }),
  },
  body: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
});
