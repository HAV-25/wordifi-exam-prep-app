/**
 * WORDIFI — CTAButton (Primary)
 * Source of truth: Design Language v1.0 · Section 1.7
 *
 * The single most important interactive element in the app.
 * The blue glow shadow is non-negotiable — it defines the premium feel.
 */

import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { colors, textStyles, radius, touchTargets, shadows, duration, layout } from '@/theme';

interface CTAButtonProps {
  label:      string;
  onPress:    () => void;
  disabled?:  boolean;
  style?:     ViewStyle;
  testID?:    string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function CTAButton({ label, onPress, disabled = false, style, testID }: CTAButtonProps) {
  const scale = useSharedValue(1);
  const bgOpacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity:   bgOpacity.value,
  }));

  const handlePressIn = () => {
    scale.value      = withTiming(0.97, { duration: duration.instant });
    bgOpacity.value  = withTiming(0.9,  { duration: duration.instant });
  };

  const handlePressOut = () => {
    scale.value      = withTiming(1.0,  { duration: duration.instant });
    bgOpacity.value  = withTiming(1.0,  { duration: duration.instant });
  };

  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[styles.button, disabled && styles.disabled, animatedStyle, style]}
    >
      <Text style={styles.label}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height:           touchTargets.cta,
    borderRadius:     radius.pill,
    backgroundColor:  colors.blue,
    alignItems:       'center',
    justifyContent:   'center',
    marginHorizontal: layout.screenPadding,
    // Blue glow — essential, non-negotiable
    ...shadows.ctaButton,
    // Glass inner shine — top half only (approximate with opacity)
    // Full linear gradient requires expo-linear-gradient:
    // LinearGradient: rgba(255,255,255,0.08) → transparent, top to mid
  },
  label: {
    ...textStyles.ctaLabel,
    color: colors.white,
    // SENTENCE CASE — enforced by design. Never pass UPPERCASE strings.
  },
  disabled: {
    opacity: 0.5,
  },
});
