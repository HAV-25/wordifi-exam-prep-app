import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const DOT_LENGTH   = 5;
const BORDER_COLOR = '#2B70EF';
const TRACK_COLOR  = 'rgba(43,112,239,0.10)';
const BORDER_R     = 18;
const DURATION     = 4800;

/** SVG path that traces a rounded rectangle border, inset by 1.5px so the stroke is fully visible. */
function rrPath(w: number, h: number, r: number): string {
  const x = 1.5, y = 1.5;
  const iw = w - 3, ih = h - 3;
  return (
    `M ${x + r} ${y} ` +
    `L ${x + iw - r} ${y} ` +
    `Q ${x + iw} ${y} ${x + iw} ${y + r} ` +
    `L ${x + iw} ${y + ih - r} ` +
    `Q ${x + iw} ${y + ih} ${x + iw - r} ${y + ih} ` +
    `L ${x + r} ${y + ih} ` +
    `Q ${x} ${y + ih} ${x} ${y + ih - r} ` +
    `L ${x} ${y + r} ` +
    `Q ${x} ${y} ${x + r} ${y} Z`
  );
}

type Props = { children: React.ReactNode };

export function GlowBorderCard({ children }: Props) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const offset = useSharedValue(0);

  useEffect(() => {
    if (!dims) return;
    const { w, h } = dims;
    const perim =
      2 * (w - 2 * BORDER_R) +
      2 * (h - 2 * BORDER_R) +
      2 * Math.PI * BORDER_R;

    offset.value = 0;
    offset.value = withRepeat(
      withTiming(-perim, { duration: DURATION, easing: Easing.linear }),
      -1,
      false,
    );
  }, [dims]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
  }));

  return (
    <View
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setDims({ w: width, h: height });
      }}
    >
      {children}
      {dims !== null && (() => {
        const { w, h } = dims;
        const perim =
          2 * (w - 2 * BORDER_R) +
          2 * (h - 2 * BORDER_R) +
          2 * Math.PI * BORDER_R;
        const path = rrPath(w, h, BORDER_R);
        return (
          <Svg
            width={w}
            height={h}
            style={{ position: 'absolute', top: 0, left: 0 }}
            pointerEvents="none"
          >
            <Path d={path} fill="none" stroke={TRACK_COLOR} strokeWidth={1.5} />
            <AnimatedPath
              animatedProps={animatedProps}
              d={path}
              fill="none"
              stroke={BORDER_COLOR}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={`${DOT_LENGTH} ${(perim - DOT_LENGTH).toFixed(1)}`}
            />
          </Svg>
        );
      })()}

    </View>
  );
}
