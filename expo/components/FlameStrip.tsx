import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

import { AnimatedFlame } from '@/components/AnimatedFlame';
import type { DailyRollupRow } from '@/types/gamification';
import { aggregateFlameStrip } from '@/lib/gamificationHelpers';

type Props = {
  /** Raw daily rollup rows — may span multiple CEFR levels and more than 7 dates. */
  days: DailyRollupRow[];
};

/**
 * Renders 7 horizontal slots (oldest → newest, left to right).
 * A flame appears for each date where streak_requirement_met was true
 * for ANY CEFR level that day (v2.8 §1.2 global streak logic).
 * Empty slots show a faded outline square.
 */
export function FlameStrip({ days }: Props) {
  const metFlags = useMemo(() => aggregateFlameStrip(days), [days]);

  // Pad / trim to exactly 7 slots, prepending empties if fewer dates
  const slots: boolean[] = Array(7).fill(false);
  const startIdx = Math.max(0, 7 - metFlags.length);
  metFlags.forEach((v, i) => { slots[startIdx + i] = v; });

  return (
    <View style={styles.strip}>
      {slots.map((met, i) =>
        met ? (
          <View key={i} style={styles.slot}>
            <AnimatedFlame size={22} animated={false} />
          </View>
        ) : (
          <View key={i} style={[styles.slot, styles.emptySlot]} />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slot: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlot: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'transparent',
  },
});
