import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/colors';
// DESIGN SYSTEM — import tokens
import { colors, shadows, fontSize } from '@/theme';

type QuestionCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function QuestionCard({ title, subtitle, children }: QuestionCardProps) {
  return (
    <View style={styles.card} testID="question-card">
      {/* FIX: sentence case — subtitle text passed in must be sentence case,
          textTransform uppercase removed */}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  // FIX: shadow replaces flat border — more premium, matches design spec
  card: {
    borderRadius: 24,
    backgroundColor: colors.white,
    ...shadows.card,
    padding: 18,
    gap: 14,
  },
  // FIX: removed textTransform uppercase — sentence case is non-negotiable
  // subtitle is NOT a category chip, so uppercase is prohibited here
  subtitle: {
    color: Colors.textMuted,
    fontSize: fontSize.label,
    letterSpacing: 0.4,
    fontWeight: '700' as const,
  },
  // FIX: color → colors.text (was Colors.primary)
  // FIX: fontSize → fontSize.displaySm (18px per type scale, was 20px)
  title: {
    fontSize: fontSize.displaySm,
    lineHeight: 28,
    fontWeight: '700' as const,
    color: colors.text,
  },
  body: {
    gap: 12,
  },
});
