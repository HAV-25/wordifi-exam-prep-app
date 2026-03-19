/**
 * WORDIFI — CTAButton (Primary)
 * Source of truth: Design Language v1.0 · Section 1.7
 *
 * Uses React Native's built-in Animated API (not reanimated)
 * to avoid adding a dependency not yet installed in this project.
 *
 * The blue glow shadow is non-negotiable — it defines the premium feel.
 */

import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, fontSize, radius, shadows, layout } from '@/theme';

interface CTAButtonProps {
  label:     string;
  onPress:   () => void;
  disabled?: boolean;
  style?:    ViewStyle;
  testID?:   string;
}

export function CTAButton({ label, onPress, disabled = false, style, testID }: CTAButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue:        0.97,
      duration:       120,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scale, {
      toValue:        1.0,
      duration:       120,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        testID={testID}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[styles.button, disabled && styles.disabled]}
      >
        <Text style={styles.label}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    height:           56,
    borderRadius:     radius.pill,
    backgroundColor:  colors.blue,
    alignItems:       'center',
    justifyContent:   'center',
    marginHorizontal: layout.screenPadding,
    // Blue glow — essential, non-negotiable
    ...shadows.ctaButton,
  },
  label: {
    fontSize:   fontSize.bodyLg,
    fontWeight: '800' as const,
    color:      colors.white,
    // Always sentence case — never pass uppercase strings to this component
  },
  disabled: {
    opacity: 0.5,
  },
});
