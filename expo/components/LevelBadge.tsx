import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/colors';

type LevelBadgeProps = {
  level: string;
};

export function LevelBadge({ level }: LevelBadgeProps) {
  return (
    <View style={styles.badge} testID="level-badge">
      <Text style={styles.text}>{level}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.primarySoft,
  },
  text: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});
