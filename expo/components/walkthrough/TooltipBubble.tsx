import {
  ClipboardCheck,
  Flame,
  Grid2x2,
  TrendingUp,
  User,
  Zap,
} from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '@/theme';
import type { StepDef } from './WalkthroughProvider';

const { width: SW } = Dimensions.get('window');
const TOOLTIP_MAX_W = SW - 48;

type Props = {
  step: StepDef;
  stepIndex: number;
  totalSteps: number;
  /** Whether to place the tooltip above or below the spotlight */
  placement: 'above' | 'below';
  /** Distance from top of screen to place the tooltip */
  topOffset: number;
  opacity: Animated.Value;
  onNext: () => void;
  onSkip: () => void;
  reduceMotion: boolean;
};

function StepIcon({ type, color }: { type: string; color: string }) {
  const props = { size: 18, color };
  switch (type) {
    case 'user': return <User {...props} />;
    case 'trending-up': return <TrendingUp {...props} />;
    case 'flame': return <Flame {...props} />;
    case 'zap': return <Zap {...props} />;
    case 'grid': return <Grid2x2 {...props} />;
    case 'clipboard': return <ClipboardCheck {...props} />;
    default: return null;
  }
}

/**
 * The floating explanation card that appears alongside the spotlight.
 * Fades + scales in on each step change.
 */
export function TooltipBubble({
  step,
  stepIndex,
  totalSteps,
  placement,
  topOffset,
  opacity,
  onNext,
  onSkip,
  reduceMotion,
}: Props) {
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  // Animate scale in whenever this renders with new opacity (step change)
  useEffect(() => {
    if (reduceMotion) {
      scaleAnim.setValue(1);
      return;
    }
    scaleAnim.setValue(0.92);
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: true,
    }).start();
  }, [stepIndex, reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLastContentStep = stepIndex === totalSteps - 2; // step before final CTA

  return (
    <Animated.View
      style={[
        styles.bubble,
        { top: topOffset, opacity, transform: [{ scale: scaleAnim }] },
      ]}
      pointerEvents="box-none"
    >
      {/* Arrow pointer — points up if bubble is below spotlight */}
      {placement === 'below' && <View style={styles.arrowUp} />}

      {/* Left accent bar */}
      <View style={styles.accentBar} />

      {/* Content */}
      <View style={styles.content}>
        {/* Header row */}
        <View style={styles.header}>
          {step.iconType ? (
            <StepIcon type={step.iconType} color={step.iconColor} />
          ) : null}
          <Text style={styles.title}>{step.title}</Text>
        </View>

        {/* Body */}
        <Text style={styles.body}>{step.body}</Text>

        {/* Progress dots + navigation */}
        <View style={styles.footer}>
          {/* Dot indicators */}
          <View style={styles.dots}>
            {Array.from({ length: totalSteps - 1 }).map((_, i) => (
              <DotIndicator key={i} active={i === stepIndex} />
            ))}
          </View>

          {/* Navigation buttons */}
          <View style={styles.navButtons}>
            <Pressable onPress={onSkip} hitSlop={8} accessibilityLabel="Skip tour">
              <Text style={styles.skipBtn}>Skip</Text>
            </Pressable>
            <Pressable onPress={onNext} hitSlop={8} accessibilityLabel="Next step">
              <Text style={styles.nextBtn}>
                {isLastContentStep ? 'Last →' : 'Next →'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Arrow pointer — points down if bubble is above spotlight */}
      {placement === 'above' && <View style={styles.arrowDown} />}
    </Animated.View>
  );
}

// ─── Animated dot indicator ───────────────────────────────────────────────────

function DotIndicator({ active }: { active: boolean }) {
  const widthAnim = useRef(new Animated.Value(active ? 18 : 6)).current;

  useEffect(() => {
    Animated.spring(widthAnim, {
      toValue: active ? 18 : 6,
      damping: 16,
      stiffness: 200,
      useNativeDriver: false,
    }).start();
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: widthAnim,
          backgroundColor: active ? colors.primaryBlue : 'rgba(0,0,0,0.15)',
        },
      ]}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    left: 24,
    maxWidth: TOOLTIP_MAX_W,
    backgroundColor: colors.white,
    borderRadius: 16,
    flexDirection: 'column',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.accentTeal,
  },
  content: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 16,
    color: colors.darkNavy,
    flexShrink: 1,
  },
  body: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 14,
    color: colors.midGray,
    lineHeight: 22,
    marginTop: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  navButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  skipBtn: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    color: colors.mutedGray,
  },
  nextBtn: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 14,
    color: colors.primaryBlue,
  },
  arrowUp: {
    alignSelf: 'flex-start',
    marginLeft: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.white,
  },
  arrowDown: {
    alignSelf: 'flex-start',
    marginLeft: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.white,
  },
});
