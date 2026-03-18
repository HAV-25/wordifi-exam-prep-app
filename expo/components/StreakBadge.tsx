import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/colors';

type StreakBadgeProps = {
  count: number;
};

export function StreakBadge({ count }: StreakBadgeProps) {
  return (
    <View style={styles.badge} testID="streak-badge">
      <Text style={styles.text}>🔥 {count} days</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  text: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});
