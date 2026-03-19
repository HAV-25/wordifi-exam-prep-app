/**
 * WORDIFI — GermanFlagBadge
 * Source of truth: Design Language v1.0 · Section 4.2
 *
 * A small stylised German flag badge.
 * Used in exactly two places:
 *   1. Next to wordmark on Splash screen
 *   2. Inside category chip on Question screens (02–06)
 *
 * NEVER use elsewhere.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/theme';

interface GermanFlagBadgeProps {
  width?:  number;
  height?: number;
}

export function GermanFlagBadge({ width = 18, height = 12 }: GermanFlagBadgeProps) {
  const stripeHeight = height / 3;

  return (
    <View style={[styles.container, { width, height, borderRadius: 3 }]}>
      <View style={[styles.stripe, { height: stripeHeight, backgroundColor: colors.flagStripeBlack }]} />
      <View style={[styles.stripe, { height: stripeHeight, backgroundColor: colors.flagStripeRed }]} />
      <View style={[styles.stripe, { height: stripeHeight, backgroundColor: colors.flagStripeGold }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  stripe: {
    width: '100%',
  },
});
