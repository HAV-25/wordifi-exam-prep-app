/**
 * ConfettiBurst
 *
 * Absolute-fill overlay that bursts 20 confetti shapes from a given (x, y)
 * coordinate (relative to this component's parent View). Call via:
 *
 *   const ref = useRef<ConfettiBurstRef>(null);
 *   ref.current?.burst(x, y);
 *
 * The caller is responsible for:
 *  - Checking AccessibilityInfo.isReduceMotionEnabled() and skipping if true.
 *  - Positioning this component as a sibling above other content in the
 *    screen root View (pointerEvents="none" means it won't block touches).
 */
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

const PIECE_COUNT = 20;
const CONFETTI_COLORS = [
  colors.flagGold,
  colors.flagRed,
  colors.accentTeal,
  colors.primaryBlue,
];

type PieceData = {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  rotate: Animated.Value;
  color: string;
  isCircle: boolean;
  /** Base angle in degrees (0=right, 90=down, 180=left, 270=up). */
  angle: number;
  speed: number;
  /** Extra downward distance on the fall phase. */
  extraFall: number;
};

export type ConfettiBurstRef = {
  burst: (x: number, y: number) => void;
};

function createPieces(): PieceData[] {
  // Classic LCG — deterministic across mounts, no external dependencies.
  let seed = 0x12345678;
  const rand = () => {
    seed = ((seed * 1103515245) + 12345) >>> 0;
    return seed / 0xffffffff;
  };

  return Array.from({ length: PIECE_COUNT }, (_, i) => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    opacity: new Animated.Value(0),
    rotate: new Animated.Value(0),
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    isCircle: i % 2 === 0,
    // Spread evenly around a full circle with ±8° jitter
    angle: (i / PIECE_COUNT) * 360 + rand() * 16 - 8,
    speed: 95 + rand() * 145,   // 95–240 px
    extraFall: 80 + rand() * 120, // 80–200 px beyond burst point
  }));
}

const ConfettiBurst = forwardRef<ConfettiBurstRef>(function ConfettiBurst(_, ref) {
  const piecesRef = useRef<PieceData[] | null>(null);
  if (!piecesRef.current) {
    piecesRef.current = createPieces();
  }
  const pieces = piecesRef.current;
  const runningAnim = useRef<Animated.CompositeAnimation | null>(null);

  useImperativeHandle(ref, () => ({
    burst(bx: number, by: number) {
      // Stop any in-progress burst
      runningAnim.current?.stop();

      // Reset all pieces to the burst origin, invisible
      for (const p of pieces) {
        p.x.setValue(bx);
        p.y.setValue(by);
        p.opacity.setValue(0);
        p.rotate.setValue(0);
      }

      const animations = pieces.map((p) => {
        const rad = (p.angle * Math.PI) / 180;
        const dx = Math.cos(rad) * p.speed;
        // All pieces arc upward first (confetti physics), then fall.
        // Horizontal pieces barely rise; vertical pieces rise most.
        const riseY = -(Math.abs(Math.sin(rad)) * p.speed + 55);
        const fallY = by + p.extraFall + 190;

        return Animated.parallel([
          // Horizontal: linear over full 1200ms
          Animated.timing(p.x, {
            toValue: bx + dx,
            duration: 1200,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          // Vertical: rise (ease-out) then fall (ease-in gravity)
          Animated.sequence([
            Animated.timing(p.y, {
              toValue: by + riseY,
              duration: 380,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(p.y, {
              toValue: fallY,
              duration: 820,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          // Opacity: snap in → hold → fade out (last 300ms)
          Animated.sequence([
            Animated.timing(p.opacity, { toValue: 1, duration: 60,  useNativeDriver: true }),
            Animated.timing(p.opacity, { toValue: 1, duration: 840, useNativeDriver: true }),
            Animated.timing(p.opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]),
          // Rotation: one full spin
          Animated.timing(p.rotate, {
            toValue: 1,
            duration: 1200,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]);
      });

      const anim = Animated.parallel(animations);
      runningAnim.current = anim;
      anim.start(() => { runningAnim.current = null; });
    },
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => {
        const rotateInterp = p.rotate.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', i % 2 === 0 ? '360deg' : '-270deg'],
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: p.isCircle ? 6 : 4,
              height: p.isCircle ? 6 : 10,
              borderRadius: p.isCircle ? 3 : 1,
              backgroundColor: p.color,
              opacity: p.opacity,
              transform: [
                { translateX: p.x },
                { translateY: p.y },
                { rotate: rotateInterp },
              ],
            }}
          />
        );
      })}
    </View>
  );
});

export default ConfettiBurst;
