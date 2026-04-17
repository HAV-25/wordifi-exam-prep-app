import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

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

  useEffect(() => {
    if (isSelected) {
      flipProgress.value = withTiming(
        1,
        { duration: 300, easing: Easing.out(Easing.back(1.5)) },
        (finished) => {
          if (finished && onFlipComplete) runOnJS(onFlipComplete)();
        },
      );
    } else {
      flipProgress.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.back(1.5)),
      });
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
        accessibilityLabel={accessibilityLabel}
      >
        {/* Front face — drives the card's height; cardStyle carries border/bg/padding */}
        <Animated.View style={[cardStyle, styles.front, frontStyle]}>
          {children}
        </Animated.View>

        {/* Back face — yellow conviction, absolutely covers the front face footprint */}
        <Animated.View
          style={[styles.back, { borderRadius: cardBorderRadius }, backStyle]}
        >
          <Text style={styles.backEmoji}>{conviction.emoji}</Text>
          <Text style={styles.backCopy}>{conviction.copy}</Text>
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
