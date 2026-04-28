import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import Colors from '@/constants/colors';

type ScoreRingProps = {
  score: number;
  label: string;
  size?: number;
  color?: string;
};

export function ScoreRing({ score, label, size = 104, color = Colors.accent }: ScoreRingProps) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useMemo<number>(() => Math.min(Math.max(score, 0), 100), [score]);
  const offset = circumference - (progress / 100) * circumference;

  return (
    <View style={styles.container} testID="score-ring">
      <Svg height={size} width={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={Colors.ringTrack} strokeWidth={strokeWidth} fill="none" />
        {Platform.OS === 'web' ? (
          <G style={{ transformOrigin: `${size / 2}px ${size / 2}px` }}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
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
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        )}
      </Svg>
      <View style={[styles.center, { height: size }]}>
        <Text style={[styles.score, { color }]}>{Math.round(progress)}%</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 10,
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontSize: 22,
    fontWeight: '800',
  },
  label: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
});
