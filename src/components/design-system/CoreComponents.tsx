/**
 * WORDIFI — Core Design System Components
 * Source of truth: Design Language v1.0 · Section 1.7
 *
 * Components:
 *  - ProgressBar     — onboarding step progress, edge-to-edge, 3px
 *  - OptionCard      — answer option rows in question screens
 *  - CelebrationCard — post-answer reward card (blue, spring animation)
 *  - PreparednessGauge — coloured pill for Test Stream status bar
 */

import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import {
  colors, textStyles, spacing, radius, layout,
  touchTargets, duration, easing, springs, celebrationCard,
} from '@/theme';

// ─── ProgressBar ─────────────────────────────────────────────────────────────
interface ProgressBarProps {
  current: number;  // 1-based current step
  total:   number;  // total steps
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const progress = useSharedValue(0);
  const targetWidth = (current / total) * 100;

  useEffect(() => {
    progress.value = withTiming(targetWidth, {
      duration: duration.score,
      easing:   Easing.bezier(...easing.standard),
    });
  }, [current, total]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

  return (
    <View style={progressStyles.track}>
      <Animated.View style={[progressStyles.fill, fillStyle]} />
    </View>
  );
}

const progressStyles = StyleSheet.create({
  track: {
    height:           3,
    width:            '100%',
    // No border radius — edge-to-edge, no horizontal padding
    backgroundColor:  colors.progressTrack,
  },
  fill: {
    height:           3,
    backgroundColor:  colors.white,
  },
});

// ─── OptionCard ──────────────────────────────────────────────────────────────
interface OptionCardProps {
  optionKey:    string;  // 'A', 'B', 'C', 'Richtig', 'Falsch', etc.
  text:         string;
  state:        'default' | 'selected-correct' | 'selected-wrong' | 'correct-reveal' | 'disabled';
  onPress?:     () => void;
  isWide?:      boolean;  // true/false + ja/nein rendered as side-by-side squares
}

export function OptionCard({ optionKey, text, state, onPress, isWide = false }: OptionCardProps) {
  const bgColor =
    state === 'selected-correct' ? colors.green :
    state === 'selected-wrong'   ? colors.red :
    state === 'correct-reveal'   ? colors.green :
    colors.surface;

  const textColor =
    state === 'default' || state === 'disabled' ? colors.text : colors.white;

  const pillBg =
    state === 'default' || state === 'disabled' ? colors.border : 'rgba(255,255,255,0.25)';

  return (
    <Pressable
      onPress={state === 'default' ? onPress : undefined}
      style={[
        optionStyles.row,
        isWide && optionStyles.wideRow,
        { backgroundColor: bgColor },
        state === 'disabled' && optionStyles.disabled,
      ]}
    >
      <View style={[optionStyles.keyPill, { backgroundColor: pillBg }]}>
        <Text style={[optionStyles.keyText, { color: textColor }]}>
          {optionKey}
        </Text>
      </View>
      <Text style={[textStyles.optionText, { color: textColor, flex: 1 }]}>
        {text}
      </Text>
    </Pressable>
  );
}

const optionStyles = StyleSheet.create({
  row: {
    flexDirection:    'row',
    alignItems:       'center',
    minHeight:        touchTargets.option,
    paddingHorizontal: layout.optionPadding,
    paddingVertical:  spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    gap:              spacing.md,
  },
  wideRow: {
    flex:         1,
    justifyContent: 'center',
    borderRadius: radius.xl,
    marginHorizontal: spacing.sm,
    borderBottomWidth: 0,
  },
  keyPill: {
    width:          32,
    height:         28,
    borderRadius:   radius.xs,
    alignItems:     'center',
    justifyContent: 'center',
  },
  keyText: {
    ...textStyles.label,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
});

// ─── CelebrationCard ─────────────────────────────────────────────────────────
interface CelebrationCardProps {
  title:  string;
  body:   string;
  stat?:  string;  // e.g. "32% readiness"
}

export function CelebrationCard({ title, body, stat }: CelebrationCardProps) {
  const opacity    = useSharedValue(0);
  const scale      = useSharedValue(celebrationCard.from.scale);
  const translateY = useSharedValue(celebrationCard.from.translateY);

  useEffect(() => {
    opacity.value    = withSpring(1, springs.celebration);
    scale.value      = withSpring(celebrationCard.to.scale, springs.celebration);
    translateY.value = withSpring(celebrationCard.to.translateY, springs.celebration);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[celebrationStyles.card, animatedStyle]}>
      <Text style={[textStyles.screenTitle, { color: colors.white }]}>{title}</Text>
      <Text style={[textStyles.bodyText, { color: 'rgba(255,255,255,0.85)', marginTop: spacing.xs }]}>
        {body}
      </Text>
      {stat && (
        <Text style={[textStyles.label, { color: colors.teal, marginTop: spacing.sm }]}>
          {stat}
        </Text>
      )}
    </Animated.View>
  );
}

const celebrationStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.blue,
    borderRadius:    radius.lg,
    padding:         layout.cardPadding,
    marginHorizontal: layout.screenPadding,
    // Glass shine — top half gradient approximated with overlay
    overflow:        'hidden',
  },
});

// ─── PreparednessGauge ────────────────────────────────────────────────────────
interface PreparednessGaugeProps {
  level:        string;  // 'A1', 'A2', 'B1'
  score:        number;  // 0–100
  onPress?:     () => void;
}

export function PreparednessGauge({ level, score, onPress }: PreparednessGaugeProps) {
  const bgColor =
    score < 40 ? colors.gaugeRed :
    score < 70 ? colors.gaugeAmber :
    colors.gaugeGreen;

  return (
    <Pressable onPress={onPress} style={[gaugeStyles.pill, { backgroundColor: bgColor }]}>
      <Text style={gaugeStyles.label}>
        {level} · {score}%
      </Text>
    </Pressable>
  );
}

const gaugeStyles = StyleSheet.create({
  pill: {
    paddingHorizontal: layout.chipPaddingH,
    paddingVertical:   layout.chipPaddingV,
    borderRadius:      radius.pill,
    minWidth:          72,
    alignItems:        'center',
  },
  label: {
    ...textStyles.label,
    color:      colors.white,
    fontWeight: '600',
  },
});
