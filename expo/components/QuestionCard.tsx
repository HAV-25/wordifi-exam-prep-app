import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/colors';

type QuestionCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function QuestionCard({ title, subtitle, children }: QuestionCardProps) {
  return (
    <View style={styles.card} testID="question-card">
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 14,
  },
  subtitle: {
    color: Colors.textMuted,
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 0.4,
    fontWeight: '700',
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    color: Colors.primary,
  },
  body: {
    gap: 12,
  },
});
