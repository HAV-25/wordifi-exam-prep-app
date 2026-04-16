import { Check, X } from 'lucide-react-native';
import React, { useCallback, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import {
  colors,
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  spacing,
  touchTargets,
} from '@/theme';

type OptionButtonProps = {
  label: string;
  sublabel?: string;
  selected: boolean;
  onPress: () => void;
  /** Letter badge displayed in MCQ mode (e.g. "a", "b", "c"). */
  leading?: string;
  /** Custom leading icon node — overrides letter badge. */
  leadingNode?: React.ReactNode;
  testID?: string;
  /** 'mcq' (default) renders row with letter badge. 'binary' renders centered column with icon. */
  variant?: 'mcq' | 'binary';
  /** When true, suppresses press and reduces opacity. */
  disabled?: boolean;
  /** For binary variant: is this the "positive" option (Richtig / Ja)? Controls icon + color. */
  binaryPositive?: boolean;
};

export function OptionButton({
  label,
  sublabel,
  selected,
  onPress,
  leading,
  leadingNode,
  testID,
  variant = 'mcq',
  disabled = false,
  binaryPositive,
}: OptionButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    Animated.timing(scaleAnim, {
      toValue: 0.96,
      duration: 60,
      useNativeDriver: true,
    }).start();
  }, [disabled, scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [disabled, onPress]);

  if (variant === 'binary') {
    const isPositive = binaryPositive ?? false;
    const iconBg = isPositive ? '#22C55E' : '#EF4444';
    return (
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
        <Pressable
          accessibilityLabel={label}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          style={[
            styles.binaryCard,
            selected && styles.binaryCardSelected,
            disabled && styles.disabledCard,
          ]}
          testID={testID}
        >
          <View style={[styles.binaryIcon, { backgroundColor: iconBg }]}>
            {isPositive
              ? <Check color="#fff" size={16} strokeWidth={3} />
              : <X color="#fff" size={16} strokeWidth={3} />}
          </View>
          <Text
            style={[styles.binaryText, selected && styles.binaryTextSelected]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </Pressable>
      </Animated.View>
    );
  }

  // ─── MCQ variant (default) — preserves v1 styling ─────────────────────────
  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        accessibilityLabel={label}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[
          styles.button,
          selected && styles.buttonSelected,
          disabled && styles.disabledCard,
        ]}
        testID={testID}
      >
        {leadingNode ? (
          leadingNode
        ) : leading ? (
          <View style={[styles.leadingBadge, selected && styles.leadingBadgeSelected]}>
            <Text style={[styles.leadingText, selected && styles.leadingTextSelected]}>
              {leading}
            </Text>
          </View>
        ) : null}
        <View style={styles.copy}>
          <Text
            style={[styles.label, selected && styles.labelSelected]}
            numberOfLines={3}
          >
            {label}
          </Text>
          {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // ─── MCQ card (v1 styling preserved) ───────────────────────────────────────
  button: {
    minHeight:       touchTargets.cta,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.md,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    padding:         spacing.lg,
  },
  buttonSelected: {
    borderColor:     colors.answerSelected,
    backgroundColor: colors.surfaceContainer,
  },
  disabledCard: {
    opacity: 0.5,
  },
  leadingBadge: {
    width:           28,
    height:          28,
    borderRadius:    14,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.surfaceContainerHigh,
  },
  leadingBadgeSelected: {
    backgroundColor: colors.primary,
  },
  leadingText: {
    color:      colors.onSurfaceVariant,
    fontFamily: fontFamily.display,
    fontSize:   fontSize.bodySm,
    fontWeight: fontWeight.display,
  },
  leadingTextSelected: {
    color: colors.surfaceContainerLowest,
  },
  copy: {
    flex: 1,
    gap:  spacing.xs,
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize:   fontSize.bodyLg,
    lineHeight: 22,
    color:      colors.onSurface,
    fontWeight: fontWeight.medium,
  },
  labelSelected: {
    color: colors.primary,
  },
  sublabel: {
    fontFamily: fontFamily.bodyRegular,
    fontSize:   fontSize.bodySm,
    lineHeight: 18,
    color:      colors.onSurfaceVariant,
  },

  // ─── Binary card (new — TF/YN horizontal layout) ──────────────────────────
  binaryCard: {
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: 18,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  binaryCardSelected: {
    borderColor:     colors.answerSelected,
    backgroundColor: colors.surfaceContainer,
  },
  binaryIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  binaryText: {
    fontFamily: fontFamily.display,
    fontSize:   18,
    color:      colors.onSurface,
  },
  binaryTextSelected: {
    color: colors.primary,
  },
});
