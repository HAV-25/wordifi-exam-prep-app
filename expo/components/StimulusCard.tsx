import { ChevronDown, ChevronUp } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/colors';

type StimulusCardProps = {
  text: string;
  type: string | null;
  collapsible?: boolean;
};

export function StimulusCard({ text, type, collapsible = false }: StimulusCardProps) {
  const [expanded, setExpanded] = useState<boolean>(!collapsible);
  const label = useMemo<string>(() => {
    const suffix = type ? type.toLowerCase() : 'text';
    return `Read the following ${suffix}:`;
  }, [type]);

  return (
    <View style={styles.card} testID="stimulus-card">
      <Text style={styles.label}>{label}</Text>
      {collapsible ? (
        <Pressable accessibilityLabel="Toggle passage" onPress={() => setExpanded((value) => !value)} style={styles.toggle} testID="toggle-passage-button">
          <Text style={styles.toggleText}>{expanded ? 'Hide passage' : 'Show passage'}</Text>
          {expanded ? <ChevronUp color={Colors.primary} size={18} /> : <ChevronDown color={Colors.primary} size={18} />}
        </Pressable>
      ) : null}
      {expanded ? (
        <ScrollView nestedScrollEnabled style={styles.scroll}>
          <Text style={[styles.text, type === 'advertisement' ? styles.adText : null]}>{text}</Text>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  toggle: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleText: {
    color: Colors.primary,
    fontWeight: '700',
  },
  scroll: {
    maxHeight: 220,
  },
  text: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.text,
  },
  adText: {
    fontWeight: '500',
  },
});
