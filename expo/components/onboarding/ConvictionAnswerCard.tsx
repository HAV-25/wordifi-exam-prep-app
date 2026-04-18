import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ConfettiParticles } from './ConfettiParticles';

export type ConvictionEntry = { emoji: string; copy: string };

type Props = {
  conviction: ConvictionEntry;
  isSelected: boolean;
  onPress: () => void;
  onFlipComplete?: () => void;
  cardStyle?: StyleProp<ViewStyle>;
  cardBorderRadius?: number;
  accessibilityLabel?: string;
  children: React.ReactNode;
};

export function ConvictionAnswerCard({
  conviction,
  isSelected,
  onPress,
  onFlipComplete,
  cardStyle,
  cardBorderRadius = 12,
  accessibilityLabel,
  children,
}: Props) {
  const flipProgress = useSharedValue(0);
  const pressScale = useSharedValue(1);
  const [particlesActive, setParticlesActive] = useState(false);

  // Reduce-motion detection — read via ref so the flip useEffect deps stay [isSelected] only
  const reduceMotionRef = useRef(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      reduceMotionRef.current = enabled;
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => { reduceMotionRef.current = enabled; },
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (isSelected) {
      if (reduceMotionRef.current) {
        // Reduce Motion ON: instant surface change, no rotation (brief 5.5)
        flipProgress.value = 1;
        if (onFlipComplete) onFlipComplete();
        setParticlesActive(true);
        // OB-04: start 2500ms flip-back timer here — fires regardless of reduce-motion
      } else {
        flipProgress.value = withTiming(
          1,
          { duration: 300, easing: Easing.out(Easing.back(1.5)) },
          (finished) => {
            if (finished) {
              if (onFlipComplete) runOnJS(onFlipComplete)();
              runOnJS(setParticlesActive)(true);
              // OB-04: start 2500ms flip-back timer here — fires regardless of reduce-motion
            }
          },
        );
      }
    } else {
      // OB-04: also call setParticlesActive(false) here so particles reset
      // and replay fresh when this card is tapped again after a flip-back.
      if (reduceMotionRef.current) {
        flipProgress.value = 0;
      } else {
        flipProgress.value = withTiming(0, {
          duration: 300,
          easing: Easing.out(Easing.back(1.5)),
        });
      }
    }
  }, [isSelected]);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateY: `${interpolate(flipProgress.value, [0, 1], [0, 180])}deg` },
    ],
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateY: `${interpolate(flipProgress.value, [0, 1], [180, 360])}deg` },
    ],
  }));

  function handlePressIn() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pressScale.value = withTiming(0.97, { duration: 100 });
  }

  function handlePressOut() {
    pressScale.value = withTiming(1, { duration: 100 });
  }

  return (
    <Animated.View style={scaleStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={
          isSelected
            ? `${conviction.emoji} ${conviction.copy}`
            : accessibilityLabel
        }
      >
        {/* Front face — drives the card's height; cardStyle carries border/bg/padding */}
        <Animated.View
          style={[cardStyle, styles.front, frontStyle]}
          accessibilityElementsHidden={isSelected}
          importantForAccessibility={isSelected ? 'no-hide-descendants' : 'auto'}
        >
          {children}
        </Animated.View>

        {/* Back face — yellow conviction, absolutely covers the front face footprint */}
        <Animated.View
          style={[styles.back, { borderRadius: cardBorderRadius }, backStyle]}
          accessibilityElementsHidden={!isSelected}
          importantForAccessibility={!isSelected ? 'no-hide-descendants' : 'auto'}
        >
          <Text style={styles.backEmoji}>{conviction.emoji}</Text>
          <Text style={styles.backCopy}>{conviction.copy}</Text>
          {/* Confetti particles — absolutely positioned, zIndex 0 */}
          <ConfettiParticles active={particlesActive} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  front: {
    backfaceVisibility: 'hidden',
  },
  back: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backfaceVisibility: 'hidden',
    backgroundColor: '#F0C808',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  backEmoji: {
    fontSize: 30,
    marginRight: 12,
  },
  backCopy: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 16,
    color: '#374151',
    flex: 1,
    lineHeight: 22,
  },
});
