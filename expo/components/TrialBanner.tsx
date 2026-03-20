import { Clock } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/theme';

interface TrialBannerProps {
  hoursRemaining: number;
  onUpgrade: () => void;
}

export function TrialBanner({ hoursRemaining, onUpgrade }: TrialBannerProps) {
  const hours = Math.floor(hoursRemaining);

  const bannerColor = useMemo(() => {
    if (hours < 6) return colors.red;
    if (hours < 24) return colors.amber;
    return colors.blue;
  }, [hours]);

  const textColor = useMemo(() => {
    if (hours < 6) return colors.white;
    if (hours < 24) return colors.navy;
    return colors.white;
  }, [hours]);

  const timeLabel = hours <= 0 ? 'Trial expired' : `${hours}h left on trial`;

  return (
    <Pressable
      onPress={onUpgrade}
      style={[styles.banner, { backgroundColor: bannerColor }]}
      testID="trial-banner"
    >
      <View style={styles.left}>
        <Clock color={textColor} size={14} />
        <Text style={[styles.text, { color: textColor }]}>{timeLabel}</Text>
      </View>
      <View style={[styles.upgradeChip, { borderColor: textColor }]}>
        <Text style={[styles.upgradeText, { color: textColor }]}>Upgrade</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: radius.md,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  text: {
    fontSize: fontSize.bodySm,
    fontWeight: '700' as const,
  },
  upgradeChip: {
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  upgradeText: {
    fontSize: fontSize.label,
    fontWeight: '800' as const,
  },
});
