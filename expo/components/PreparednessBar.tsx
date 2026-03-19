import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';

type PreparednessBarProps = {
  score: number;
  compact?: boolean;
};

function getBarColor(score: number): string {
  if (score < 40) return colors.red;
  if (score < 70) return colors.amber;
  return colors.green;
}

export function PreparednessBar({ score, compact = false }: PreparednessBarProps) {
  const animatedWidth = useRef(new Animated.Value(0)).current;
  const clampedScore = Math.max(0, Math.min(100, score));
  const color = getBarColor(clampedScore);

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: clampedScore,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [clampedScore, animatedWidth]);

  const widthInterpolation = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  if (compact) {
    return (
      <View style={styles.compactWrap}>
        <View style={styles.compactTrack}>
          <Animated.View style={[styles.compactFill, { width: widthInterpolation, backgroundColor: color }]} />
        </View>
        <Text style={[styles.compactScore, { color }]}>{Math.round(clampedScore)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="preparedness-bar">
      <View style={styles.labelRow}>
        <Text style={styles.label}>Exam Readiness</Text>
        <Text style={[styles.scoreText, { color }]}>{Math.round(clampedScore)}%</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: widthInterpolation, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '800' as const,
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  compactWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  compactTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  compactFill: {
    height: '100%',
    borderRadius: 999,
  },
  compactScore: {
    fontSize: 13,
    fontWeight: '800' as const,
    minWidth: 26,
    textAlign: 'right' as const,
  },
});
