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

// 2500ms hold — matches the particle fade duration (OB-02) and the brief's flip-back delay (OB-04).
const HOLD_DURATION = 2500;

export type ConvictionEntry = { emoji: string; copy: string };

type Props = {
  conviction: ConvictionEntry;
  isSelected: boolean;
  onPress: () => void;
  /** Called when the forward flip animation completes (yellow face becomes visible).
   *  Receives a `cancelFlipBack` function — call it before navigating to cancel
   *  the pending auto flip-back timer (brief 5.4 point 3). */
  onFlipComplete?: (cancelFlipBack: () => void) => void;
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

  // ─── Reduce-motion ref (OB-03) — stable, not in any dep array ────────────────
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

  // ─── Flip-back timer ref (OB-04) ─────────────────────────────────────────────
  const flipBackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelFlipBack() {
    if (flipBackTimerRef.current !== null) {
      clearTimeout(flipBackTimerRef.current);
      flipBackTimerRef.current = null;
    }
  }

  /** Start the 2500ms timer. When it fires, flip back to 0 (selected-state front face)
   *  and reset particles so they replay fresh on any subsequent tap. */
  function startFlipBackTimer() {
    cancelFlipBack(); // safety — clear any existing timer before starting a new one
    flipBackTimerRef.current = setTimeout(() => {
      flipBackTimerRef.current = null;
      if (reduceMotionRef.current) {
        flipProgress.value = 0;
      } else {
        flipProgress.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.back(1.5)) });
      }
      setParticlesActive(false); // reset particles so they replay fresh on re-tap
    }, HOLD_DURATION);
  }

  /** Notify parent, passing the cancel handle so Continue can abort the flip-back. */
  function notifyFlipComplete() {
    onFlipComplete?.(cancelFlipBack);
  }

  // ─── Unmount cleanup — prevent timer firing on an unmounted component ─────────
  useEffect(() => {
    return () => { cancelFlipBack(); };
  }, []);

  // ─── Shared forward-flip trigger (used by isSelected effect + retap effect) ───
  function triggerForwardFlip() {
    if (reduceMotionRef.current) {
      flipProgress.value = 1;
      setParticlesActive(true);
      startFlipBackTimer();
      notifyFlipComplete();
    } else {
      flipProgress.value = withTiming(
        1,
        { duration: 300, easing: Easing.out(Easing.back(1.5)) },
        (finished) => {
          'worklet';
          if (finished) {
            runOnJS(setParticlesActive)(true);
            runOnJS(startFlipBackTimer)();
            runOnJS(notifyFlipComplete)();
          }
        },
      );
    }
  }

  // ─── isSelected effect ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isSelected) {
      cancelFlipBack(); // cancel any in-flight timer from a previous flip cycle
      triggerForwardFlip();
    } else {
      cancelFlipBack();
      setParticlesActive(false); // reset particles so they replay fresh if this card is tapped again
      if (reduceMotionRef.current) {
        flipProgress.value = 0;
      } else {
        flipProgress.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.back(1.5)) });
      }
    }
  }, [isSelected]);

  // ─── Re-tap effect (same card tapped while already in selected state) ─────────
  // `retapKey` increments each time the user taps the front face while isSelected=true.
  // Since isSelected doesn't change, the isSelected effect won't re-fire — this
  // effect handles the re-flip instead.
  const [retapKey, setRetapKey] = useState(0);
  useEffect(() => {
    if (retapKey === 0) return; // ignore initial mount
    cancelFlipBack();
    setParticlesActive(false);
    triggerForwardFlip();
  }, [retapKey]);

  // ─── Animated styles ──────────────────────────────────────────────────────────

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

  // ─── Press handlers ───────────────────────────────────────────────────────────

  function handlePressIn() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pressScale.value = withTiming(0.97, { duration: 100 });
  }

  function handlePressOut() {
    pressScale.value = withTiming(1, { duration: 100 });
  }

  function handlePress() {
    if (isSelected) {
      // Re-tap of the same card — increment key to trigger the retap effect
      setRetapKey((k) => k + 1);
    }
    onPress();
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <Animated.View style={scaleStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={
          // Yellow face is showing → read conviction copy.
          // Default or selected-state front face → read the answer label.
          // accessibilityState.selected handles the "selected" announcement
          // natively on both iOS (VoiceOver) and Android (TalkBack).
          particlesActive
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
