import { Lock } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CTAButton } from '@/components/CTAButton';
import { colors, fontSize, spacing } from '@/theme';

interface LockedOverlayProps {
  title: string;
  subtitle: string;
  onUpgrade: () => void;
}

export function LockedOverlay({ title, subtitle, onUpgrade }: LockedOverlayProps) {
  return (
    <View style={styles.container} testID="locked-overlay">
      <View style={styles.iconWrap}>
        <Lock color={colors.blue} size={28} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <CTAButton
        label="Upgrade"
        onPress={onUpgrade}
        style={styles.cta}
        testID="locked-overlay-upgrade"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(43, 112, 239, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.displaySm,
    fontWeight: '800' as const,
    color: colors.navy,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.bodyMd,
    fontWeight: '500' as const,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  cta: {
    alignSelf: 'stretch',
    marginTop: spacing.lg,
    marginHorizontal: 0,
  },
});
