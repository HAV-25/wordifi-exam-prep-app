import React, { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import Svg, { Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';

type Props = {
  /** Diameter of the bounding square (default 40 for main streak, 22 for strip) */
  size?: number;
  /** Set false to render a static flame with no animation (e.g. inside FlameStrip) */
  animated?: boolean;
};

/**
 * SVG flame rendered via react-native-svg.
 * When animated=true (default), the flame pulses with a subtle scale/opacity
 * loop (~1.5 s) using react-native-reanimated.
 * Animation pauses automatically when the app goes to background.
 */
export function AnimatedFlame({ size = 40, animated: shouldAnimate = true }: Props) {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(1);

  // Start / stop pulse based on animated prop and app state
  useEffect(() => {
    if (!shouldAnimate) return;

    function startPulse() {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 750 }),
          withTiming(1.0,  { duration: 750 }),
        ),
        -1,
        false,
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.85, { duration: 750 }),
          withTiming(1.0,  { duration: 750 }),
        ),
        -1,
        false,
      );
    }

    function stopPulse() {
      cancelAnimation(scale);
      cancelAnimation(opacity);
      scale.value   = withTiming(1.0,  { duration: 200 });
      opacity.value = withTiming(1.0,  { duration: 200 });
    }

    startPulse();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') startPulse();
      else stopPulse();
    });

    return () => {
      sub.remove();
      stopPulse();
    };
  }, [shouldAnimate]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  // Flame SVG path — a teardrop/flame silhouette drawn in a 24×24 viewBox
  // Colours: orange body with a warm amber/yellow core
  const flameScale = size / 24;

  return (
    <Animated.View style={[{ width: size, height: size }, shouldAnimate && animStyle]}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
      >
        <Defs>
          <RadialGradient id="flameGrad" cx="50%" cy="70%" r="60%">
            <Stop offset="0%"   stopColor="#FFDD57" stopOpacity={1} />
            <Stop offset="45%"  stopColor="#FF8C00" stopOpacity={1} />
            <Stop offset="100%" stopColor="#CC3300" stopOpacity={1} />
          </RadialGradient>
        </Defs>
        {/* Outer flame body */}
        <Path
          d="M12 2
             C12 2 7 7.5 7 12.5
             C7 15.5 8.5 17.5 10 18.8
             C10 17.2 10.8 15.8 12 15
             C13.2 15.8 14 17.2 14 18.8
             C15.5 17.5 17 15.5 17 12.5
             C17 7.5 12 2 12 2Z"
          fill="url(#flameGrad)"
        />
        {/* Inner core highlight */}
        <Path
          d="M12 10
             C12 10 10 12.5 10 14
             C10 15.1 10.9 16 12 16
             C13.1 16 14 15.1 14 14
             C14 12.5 12 10 12 10Z"
          fill="#FFEEA0"
          opacity={0.75}
        />
      </Svg>
    </Animated.View>
  );
}
