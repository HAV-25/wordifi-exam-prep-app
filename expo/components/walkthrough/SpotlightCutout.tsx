import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { TargetRect } from './WalkthroughProvider';

const { width: SW, height: SH } = Dimensions.get('window');
const CORNER_RADIUS = 16;
const SCRIM_COLOR = 'rgba(10, 14, 26, 0.82)';


type Props = {
  rect: TargetRect;
  padding: number;
  reduceMotion: boolean;
};

/**
 * SVG-based spotlight cutout.
 *
 * Renders a full-screen dark scrim with a rounded-rect hole punched at
 * (rect ± padding). Springs to new positions when rect changes.
 * Teleports instantly when reduceMotion is true.
 */
export function SpotlightCutout({ rect, padding, reduceMotion }: Props) {
  const targetX = rect.x - padding;
  const targetY = rect.y - padding;
  const targetW = rect.width + padding * 2;
  const targetH = rect.height + padding * 2;

  // Four Animated.Values drive the hole position — persisted via useRef
  const animX = useRef(new Animated.Value(targetX)).current;
  const animY = useRef(new Animated.Value(targetY)).current;
  const animW = useRef(new Animated.Value(targetW)).current;
  const animH = useRef(new Animated.Value(targetH)).current;

  // Snapshot of current animated coords used to build the SVG path
  const xVal = useRef(targetX);
  const yVal = useRef(targetY);
  const wVal = useRef(targetW);
  const hVal = useRef(targetH);

  const [, tick] = useState(0);
  const forceRepaint = () => tick((n) => n + 1);

  // Subscribe to animation frames so the SVG re-renders while animating
  useEffect(() => {
    const ids = [
      animX.addListener(({ value }) => { xVal.current = value; forceRepaint(); }),
      animY.addListener(({ value }) => { yVal.current = value; forceRepaint(); }),
      animW.addListener(({ value }) => { wVal.current = value; forceRepaint(); }),
      animH.addListener(({ value }) => { hVal.current = value; forceRepaint(); }),
    ];
    return () => {
      animX.removeListener(ids[0]!);
      animY.removeListener(ids[1]!);
      animW.removeListener(ids[2]!);
      animH.removeListener(ids[3]!);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isFirstMount = useRef(true);

  // Animate to new position whenever rect/padding changes
  useEffect(() => {
    if (isFirstMount.current) {
      // Snap to starting position — no slide-in from 0,0
      isFirstMount.current = false;
      animX.setValue(targetX);
      animY.setValue(targetY);
      animW.setValue(targetW);
      animH.setValue(targetH);
      xVal.current = targetX;
      yVal.current = targetY;
      wVal.current = targetW;
      hVal.current = targetH;
      forceRepaint();
      return;
    }

    if (reduceMotion) {
      animX.setValue(targetX);
      animY.setValue(targetY);
      animW.setValue(targetW);
      animH.setValue(targetH);
      xVal.current = targetX;
      yVal.current = targetY;
      wVal.current = targetW;
      hVal.current = targetH;
      forceRepaint();
      return;
    }

    Animated.parallel([
      Animated.spring(animX, { toValue: targetX, damping: 20, stiffness: 180, useNativeDriver: false }),
      Animated.spring(animY, { toValue: targetY, damping: 20, stiffness: 180, useNativeDriver: false }),
      Animated.spring(animW, { toValue: targetW, damping: 20, stiffness: 180, useNativeDriver: false }),
      Animated.spring(animH, { toValue: targetH, damping: 20, stiffness: 180, useNativeDriver: false }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetX, targetY, targetW, targetH, reduceMotion]);

  const x = xVal.current;
  const y = yVal.current;
  const w = wVal.current;
  const h = hVal.current;
  const r = CORNER_RADIUS;

  // Full-screen path + rounded-rect hole (evenodd → hole is transparent)
  const d = [
    `M 0 0 L ${SW} 0 L ${SW} ${SH} L 0 ${SH} Z`,
    `M ${x + r} ${y}`,
    `H ${x + w - r}`,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `V ${y + h - r}`,
    `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `H ${x + r}`,
    `Q ${x} ${y + h} ${x} ${y + h - r}`,
    `V ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `Z`,
  ].join(' ');

  return (
    <Svg
      width={SW}
      height={SH}
      style={{ position: 'absolute', top: 0, left: 0 }}
      pointerEvents="none"
    >
      <Path d={d} fill={SCRIM_COLOR} fillRule="evenodd" />
    </Svg>
  );
}
