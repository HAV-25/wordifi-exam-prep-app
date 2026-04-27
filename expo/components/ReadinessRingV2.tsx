import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Mask, Rect, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, fontFamily, fontSize } from '@/theme';
import { duration } from '@/theme/motion';
import { getBandLabel, READINESS_BANDS } from '@/lib/gamificationHelpers';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Ring geometry (matches reference HTML prototype)
const VIEWBOX   = 200;
const CX        = 100;
const CY        = 100;
const R         = 78;
const SW        = 22;
const CIRCUM    = 2 * Math.PI * R; // ≈ 490.09

// Pre-computed arc lengths for each band (fraction of circumference)
// Bands: 0–19 (19%), 20–39 (20%), 40–59 (20%), 60–74 (15%), 75–89 (15%), 90–100 (11%)
const BAND_ARCS = [
  { stroke: '#E24B4A', dashLen: 93.1,  offset: 0       }, // 0–19
  { stroke: '#EF9F27', dashLen: 98.0,  offset: -93.1   }, // 20–39
  { stroke: '#F4C430', dashLen: 98.0,  offset: -191.1  }, // 40–59
  { stroke: '#97C459', dashLen: 73.5,  offset: -289.1  }, // 60–74
  { stroke: '#639922', dashLen: 73.5,  offset: -362.6  }, // 75–89
  { stroke: '#1D9E75', dashLen: 53.9,  offset: -436.1  }, // 90–100
] as const;

type Props = {
  normalizedScore: number;
  size?: number;
};

export function ReadinessRingV2({ normalizedScore, size = 200 }: Props) {
  const score   = Math.min(Math.max(normalizedScore, 0), 100);
  const label   = getBandLabel(score);
  const labelColor = READINESS_BANDS.find(
    (b) => score >= b.min && score <= b.max,
  )?.color ?? '#1D9E75';

  // ── Animated mask arc (Reanimated — UI thread) ──────────────────────────────
  const filledTarget = (score / 100) * CIRCUM;
  const filledAnim   = useSharedValue(0);

  useEffect(() => {
    filledAnim.value = withTiming(filledTarget, {
      duration: duration.scoreRing,
      easing: Easing.bezier(0.0, 0.0, 0.2, 1.0),
    });
  }, [filledTarget]);

  const maskProps = useAnimatedProps(() => ({
    strokeDasharray: `${filledAnim.value} ${CIRCUM - filledAnim.value}`,
  }));

  // ── Score count-up (JS thread, rAF-based) ────────────────────────────────────
  const [displayScore, setDisplayScore] = useState(0);
  const rafRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (rafRef.current) clearTimeout(rafRef.current);
    const startTime = Date.now();
    const dur = duration.scoreRing;

    function tick() {
      const t = Math.min((Date.now() - startTime) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      // Keep one decimal place by rounding to nearest 0.5
      const raw = eased * score;
      setDisplayScore(Math.round(raw * 2) / 2);
      if (t < 1) rafRef.current = setTimeout(tick, 16);
    }
    tick();
    return () => { if (rafRef.current) clearTimeout(rafRef.current); };
  }, [score]);

  const maskId = `readiness-mask-${Math.round(score)}`;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        width={size}
        height={size}
      >
        <Defs>
          <Mask id={maskId}>
            {/* Black background hides everything by default */}
            <Rect width={VIEWBOX} height={VIEWBOX} fill="black" />
            {/* White arc reveals only the filled portion */}
            <AnimatedCircle
              animatedProps={maskProps}
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke="white"
              strokeWidth={SW}
              strokeDashoffset={0}
              rotation={-90}
              origin={`${CX}, ${CY}`}
              strokeLinecap="butt"
            />
          </Mask>
        </Defs>

        {/* Grey track (full circle — shows the "gap to 100") */}
        <Circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke={colors.ringTrack}
          strokeWidth={SW}
        />

        {/* Colour bands — always full circle arcs, revealed through mask */}
        <G mask={`url(#${maskId})`}>
          {BAND_ARCS.map((band) => (
            <Circle
              key={band.stroke}
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke={band.stroke}
              strokeWidth={SW}
              strokeDasharray={`${band.dashLen} ${CIRCUM - band.dashLen}`}
              strokeDashoffset={band.offset}
              rotation={-90}
              origin={`${CX}, ${CY}`}
            />
          ))}
        </G>
      </Svg>

      {/* Centre text — overlaid absolutely */}
      <View style={styles.centre} pointerEvents="none">
        <Text style={styles.scoreText}>
          {displayScore % 1 === 0
            ? `${displayScore.toFixed(1)}`
            : `${displayScore}`}
        </Text>
        <Text style={styles.denomText}>/ 100</Text>
      </View>

      {/* Band label below ring */}
      <Text style={[styles.bandLabel, { color: labelColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  centre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 28, // offset upward to sit in ring centre, not counting label
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  scoreText: {
    fontFamily: fontFamily.display,
    fontSize: 34,
    fontWeight: '800',
    color: colors.onSurface,
    lineHeight: 36,
    letterSpacing: -1,
  },
  denomText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.mutedGray,
    lineHeight: 16,
  },
  bandLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
});
