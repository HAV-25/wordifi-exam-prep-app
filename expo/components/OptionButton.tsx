import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  leading?: string;
  leadingNode?: React.ReactNode;
  testID?: string;
};

export function OptionButton({ label, sublabel, selected, onPress, leading, leadingNode, testID }: OptionButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.button, selected ? styles.buttonSelected : null]}
      testID={testID}
    >
      {leadingNode ? (
        leadingNode
      ) : leading ? (
        <View style={[styles.leadingBadge, selected ? styles.leadingBadgeSelected : null]}>
          <Text style={[styles.leadingText, selected ? styles.leadingTextSelected : null]}>{leading}</Text>
        </View>
      ) : null}
      <View style={styles.copy}>
        <Text style={[styles.label, selected ? styles.labelSelected : null]}>{label}</Text>
        {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight:       touchTargets.cta,       // 56 — minimum touch target
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             spacing.md,             // 12
    borderRadius:    radius.xl,              // 20
    borderWidth:     1,
    // NOTE: 1px solid borders are flagged by the design system.
    // Default uses outlineVariant at reduced opacity to approach ghost-border spec.
    borderColor:     colors.outlineVariant,  // #C2C6D7 — use at ≤20% opacity via rgba in future pass
    backgroundColor: colors.surfaceContainerLowest, // #FFFFFF
    padding:         spacing.lg,             // 16
  },
  buttonSelected: {
    borderColor:     colors.answerSelected,  // #2B70EF — primary ghost border
    backgroundColor: colors.surfaceContainer, // #EAEDFF — soft primary tint
  },
  leadingBadge: {
    width:           28,
    height:          28,
    borderRadius:    14,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.surfaceContainerHigh, // #E5E7F9
  },
  leadingBadgeSelected: {
    backgroundColor: colors.primary, // #0057CD
  },
  leadingText: {
    color:      colors.onSurfaceVariant, // #424654
    fontFamily: fontFamily.display,      // Plus Jakarta Sans ExtraBold
    fontSize:   fontSize.bodySm,         // 13
    fontWeight: fontWeight.display,      // '800'
  },
  leadingTextSelected: {
    color: colors.surfaceContainerLowest, // #FFFFFF
  },
  copy: {
    flex: 1,
    gap:  spacing.xs, // 4
  },
  label: {
    fontFamily: fontFamily.bodyMedium,   // Be Vietnam Pro 500
    fontSize:   fontSize.bodyLg,         // 16
    lineHeight: 22,
    color:      colors.onSurface,        // #171B28
    fontWeight: fontWeight.medium,       // '500'
  },
  labelSelected: {
    color: colors.primary, // #0057CD
  },
  sublabel: {
    fontFamily: fontFamily.bodyRegular, // Be Vietnam Pro 400
    fontSize:   fontSize.bodySm,        // 13
    lineHeight: 18,
    color:      colors.onSurfaceVariant, // #424654
  },
});
