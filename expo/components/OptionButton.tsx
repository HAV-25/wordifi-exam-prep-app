import { Check, X } from 'lucide-react-native';
import React, { useCallback, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { B } from '@/theme/banani';
import { fontFamily, fontSize, fontWeight } from '@/theme';

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
    // Fire haptic before callback — matches Stream pattern
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [disabled, onPress]);

  if (variant === 'binary') {
    const isPositive = binaryPositive ?? false;
    const iconBg = isPositive ? B.success : B.destructive;
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
              ? <Check color={B.primaryFg} size={16} strokeWidth={3} />
              : <X color={B.primaryFg} size={16} strokeWidth={3} />}
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

  // ─── MCQ variant (default) ────────────────────────────────────────────────
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
  // ─── MCQ card ──────────────────────────────────────────────────────────────
  button: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: B.border,
    backgroundColor: B.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#0F1F3D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 12,
      },
      android: { elevation: 1 },
    }),
  },
  buttonSelected: {
    borderColor: B.primary,
    backgroundColor: 'rgba(43,112,239,0.06)',
  },
  disabledCard: {
    opacity: 0.5,
  },

  // Leading badge (MCQ)
  leadingBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(43,112,239,0.08)',
  },
  leadingBadgeSelected: {
    backgroundColor: B.primary,
  },
  leadingText: {
    color: B.primary,
    fontFamily: fontFamily.display,
    fontSize: 15,
    fontWeight: fontWeight.display,
  },
  leadingTextSelected: {
    color: B.primaryFg,
  },

  // Copy block
  copy: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.bodyLg,
    lineHeight: 22,
    color: B.questionColor,
    fontWeight: '600',
  },
  labelSelected: {
    color: B.primary,
  },
  sublabel: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: fontSize.bodySm,
    lineHeight: 18,
    color: B.muted,
  },

  // ─── Binary card ───────────────────────────────────────────────────────────
  binaryCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: B.border,
    backgroundColor: B.card,
    ...Platform.select({
      ios: {
        shadowColor: '#0F1F3D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 12,
      },
      android: { elevation: 1 },
    }),
  },
  binaryCardSelected: {
    borderColor: B.primary,
    backgroundColor: 'rgba(43,112,239,0.06)',
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
    fontSize: 18,
    color: B.questionColor,
  },
  binaryTextSelected: {
    color: B.primary,
  },
});
