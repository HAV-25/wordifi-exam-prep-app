import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { fontFamily } from '@/theme';

type Props = {
  /** 0–100 readiness percentage */
  score: number;
  /** Diameter in px (default 214) */
  size?: number;
  /** Ring stroke width (default 10) */
  strokeWidth?: number;
};

const SUCCESS_GREEN = '#22C55E';
const RING_BG = 'rgba(255,255,255,0.12)';

export function ProgressRing({ score, size = 214, strokeWidth = 10 }: Props) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score, 0), 100);
  const offset = circumference - (pct / 100) * circumference;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={RING_BG}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={SUCCESS_GREEN}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.scoreCore}>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreNumber}>{Math.round(pct)}</Text>
          <Text style={styles.scorePercent}>%</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
  },
  scoreCore: {
    alignItems: 'center',
    gap: 6,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  scoreNumber: {
    fontFamily: fontFamily.display,
    fontSize: 86,
    color: SUCCESS_GREEN,
    lineHeight: 86 * 0.9,
    letterSpacing: -4,
  },
  scorePercent: {
    fontFamily: fontFamily.display,
    fontSize: 34,
    color: SUCCESS_GREEN,
    paddingBottom: 10,
    marginLeft: 4,
  },
});
