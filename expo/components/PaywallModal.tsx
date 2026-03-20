import { Lock, Sparkles, X } from 'lucide-react-native';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { CTAButton } from '@/components/CTAButton';
import { colors, fontSize, radius, spacing, shadows } from '@/theme';

type PaywallVariant = 'stream_limit' | 'schreiben' | 'sprechen' | 'sectional' | 'mock';

interface PaywallModalProps {
  visible: boolean;
  variant: PaywallVariant;
  onUpgrade: () => void;
  onDismiss: () => void;
}

const COPY: Record<PaywallVariant, { title: string; body: string; dismiss: string }> = {
  stream_limit: {
    title: "You've used your free questions today",
    body: 'Upgrade for unlimited practice.',
    dismiss: 'Come back tomorrow',
  },
  schreiben: {
    title: 'Schreiben practice',
    body: 'Upgrade to access writing exercises.',
    dismiss: 'Maybe later',
  },
  sprechen: {
    title: 'Sprechen practice',
    body: 'Upgrade to access speaking exercises.',
    dismiss: 'Maybe later',
  },
  sectional: {
    title: 'Sectional tests',
    body: 'Upgrade to unlock full section tests.',
    dismiss: 'Maybe later',
  },
  mock: {
    title: 'Mock exams',
    body: 'Upgrade to access complete mock exams.',
    dismiss: 'Maybe later',
  },
};

export function PaywallModal({ visible, variant, onUpgrade, onDismiss }: PaywallModalProps) {
  const copy = COPY[variant];

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Pressable style={styles.closeBtn} onPress={onDismiss} hitSlop={12} testID="paywall-close">
            <X color={colors.muted} size={20} />
          </Pressable>

          <View style={styles.iconWrap}>
            {variant === 'stream_limit' ? (
              <Sparkles color={colors.blue} size={32} />
            ) : (
              <Lock color={colors.blue} size={32} />
            )}
          </View>

          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>

          <View style={styles.features}>
            {['Unlimited stream questions', 'All sectional tests', 'Full mock exams', 'Schreiben & Sprechen'].map((feat) => (
              <View key={feat} style={styles.featureRow}>
                <Sparkles color={colors.green} size={14} />
                <Text style={styles.featureText}>{feat}</Text>
              </View>
            ))}
          </View>

          <CTAButton
            label="Upgrade"
            onPress={onUpgrade}
            style={styles.cta}
            testID="paywall-upgrade-btn"
          />

          <Pressable onPress={onDismiss} style={styles.dismissBtn} testID="paywall-dismiss-btn">
            <Text style={styles.dismissText}>{copy.dismiss}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlayDark,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.pill,
    borderTopRightRadius: radius.pill,
    paddingTop: spacing.xxl,
    paddingBottom: 40,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    ...shadows.sheet,
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(43, 112, 239, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.displayMd,
    fontWeight: '800' as const,
    color: colors.navy,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: fontSize.bodyLg,
    fontWeight: '500' as const,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  features: {
    alignSelf: 'stretch',
    gap: spacing.md,
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    fontSize: fontSize.bodyMd,
    fontWeight: '600' as const,
    color: colors.text,
  },
  cta: {
    alignSelf: 'stretch',
    marginHorizontal: 0,
  },
  dismissBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  dismissText: {
    fontSize: fontSize.bodyMd,
    fontWeight: '600' as const,
    color: colors.muted,
  },
});
