import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  interpolate,
  Easing,
} from 'react-native-reanimated';

const HOLD_DURATION = 2500; // ms — matches the future auto flip-back hold in OB-04

type ParticleConfig = {
  pos: ViewStyle;
  color: string;
  size: number;
  delay: number; // stagger delay in ms, 0–400 per brief
};

// Values fixed at module load — no per-render randomisation jitter.
// Sizes satisfy brief spec (3–6px), delays satisfy brief spec (0–400ms).
const PARTICLE_CONFIGS: ParticleConfig[] = [
  { pos: { top: '15%', left: '8%' },    color: 'rgba(255,255,255,0.4)', size: 4, delay: 60  },
  { pos: { top: '20%', right: '10%' },  color: 'rgba(201,168,0,0.6)',   size: 5, delay: 210 },
  { pos: { bottom: '25%', left: '15%' }, color: 'rgba(255,255,255,0.4)', size: 3, delay: 340 },
  { pos: { bottom: '20%', right: '8%' }, color: 'rgba(201,168,0,0.6)',   size: 6, delay: 95  },
  { pos: { top: '50%', right: '5%' },   color: 'rgba(255,255,255,0.4)', size: 4, delay: 280 },
];

// ─── Single particle ──────────────────────────────────────────────────────────

type ParticleProps = { config: ParticleConfig; active: boolean };

function Particle({ config, active }: ParticleProps) {
  // One shared value drives both translateY and opacity via interpolate.
  const progress = useSharedValue(0);

  useEffect(() => {
    if (active) {
      progress.value = withDelay(
        config.delay,
        withTiming(1, { duration: HOLD_DURATION, easing: Easing.linear }),
      );
    } else {
      // Reset to 0 so particles replay fresh on the next flip-to-yellow.
      progress.value = 0;
    }
  }, [active]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.8, 0]),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -7]) }],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        config.pos,
        {
          width: config.size,
          height: config.size,
          borderRadius: config.size / 2,
          backgroundColor: config.color,
        },
        animStyle,
      ]}
    />
  );
}

// ─── Container ────────────────────────────────────────────────────────────────

type Props = { active: boolean };

export function ConfettiParticles({ active }: Props) {
  return (
    <View
      style={styles.container}
      pointerEvents="none"
      accessibilityElementsHidden={true}
      importantForAccessibility="no-hide-descendants"
    >
      {PARTICLE_CONFIGS.map((config, i) => (
        <Particle key={i} config={config} active={active} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  particle: {
    position: 'absolute',
  },
});
