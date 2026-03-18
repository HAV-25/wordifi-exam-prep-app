import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/colors';

type OptionButtonProps = {
  label: string;
  sublabel?: string;
  selected: boolean;
  onPress: () => void;
  leading?: string;
  testID?: string;
};

export function OptionButton({ label, sublabel, selected, onPress, leading, testID }: OptionButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.button, selected ? styles.buttonSelected : null]}
      testID={testID}
    >
      {leading ? (
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
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 16,
  },
  buttonSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  leadingBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceMuted,
  },
  leadingBadgeSelected: {
    backgroundColor: Colors.primary,
  },
  leadingText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  leadingTextSelected: {
    color: Colors.surface,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text,
    fontWeight: '600',
  },
  labelSelected: {
    color: Colors.primary,
  },
  sublabel: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
