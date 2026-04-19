import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { fontFamily } from '@/theme';
import { duration, easing } from '@/theme/motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SUCCESS_GREEN = '#22C55E';
const RING_BG = 'rgba(255,255,255,0.12)';

type Props = {
  /** 0–100 readiness percentage */
  score: number;
  /** Diameter in px (default 214) */
  size?: number;
  /** Ring stroke width (default 10) */
  strokeWidth?: number;
};

export function ProgressRing({ score, size = 214, strokeWidth = 10 }: Props) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score, 0), 100);

  // ── Ring fill (UI thread via Reanimated) ──────────────────────────────────
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(pct, {
      duration: duration.scoreRing,
      easing: Easing.bezier(...easing.decelerate),
    });
  }, [pct]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference - (progress.value / 100) * circumference,
  }));

  // ── Score count-up (JS thread, RAF-based) ─────────────────────────────────
  const [displayInt, setDisplayInt] = useState(0);
  const rafRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (rafRef.current) clearTimeout(rafRef.current);
    const startTime = Date.now();
    const dur = duration.scoreRing;

    function tick() {
      const t = Math.min((Date.now() - startTime) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
      setDisplayInt(Math.round(eased * pct));
      if (t < 1) rafRef.current = setTimeout(tick, 16);
    }
    tick();
    return () => { if (rafRef.current) clearTimeout(rafRef.current); };
  }, [pct]);

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
        <AnimatedCircle
          animatedProps={animatedProps}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={SUCCESS_GREEN}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.scoreCore}>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreNumber}>{displayInt}</Text>
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
