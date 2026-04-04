/**
 * WORDIFI — CTAButton (Primary)
 * Master source: Wordifi Brand Brief · Section 07 — Component Language
 *
 * Spec: full-width · 56px height · 16px corner radius · Outfit 800 · white text
 * on flat Primary Blue (#2B70EF). NO GRADIENTS — ever.
 *
 * Uses React Native's built-in Animated API (not reanimated).
 * Press: scale 0.96 + slight darken. Release: spring back.
 */

import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, fontFamily, fontSize, fontWeight, layout, radius, shadows } from '@/theme';

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
      toValue:         0.96,
      duration:        120,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue:         1.0,
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
    borderRadius:     radius.lg,            // 16px — cards/buttons spec
    backgroundColor:  colors.primaryBlue,   // #2B70EF — flat, no gradient
    alignItems:       'center',
    justifyContent:   'center',
    marginHorizontal: layout.screenPadding, // 24px
    ...shadows.ctaButton,                   // Subtle blue glow
  },
  label: {
    fontFamily: fontFamily.display,         // Outfit 800
    fontSize:   fontSize.bodyLg,            // 16px
    fontWeight: fontWeight.display,         // '800'
    color:      colors.white,
    // Always sentence case — never pass uppercase strings to this component
  },
  disabled: {
    opacity: 0.5,
  },
});
