import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/colors';
import type { BadgeType } from '@/lib/streamHelpers';

type CelebrationOverlayProps = {
  badgeType: BadgeType;
  level: string;
  onDismiss: () => void;
};

const BADGE_CONFIG: Record<BadgeType, { emoji: string; label: string; color: string }> = {
  bronze: { emoji: '🥉', label: 'Bronze Badge', color: '#CD7F32' },
  silver: { emoji: '🥈', label: 'Silver Badge', color: '#C0C0C0' },
  gold: { emoji: '🥇', label: 'Gold Badge', color: '#FFD700' },
  platinum: { emoji: '💎', label: 'Platinum Badge', color: '#E5E4E2' },
};

export function CelebrationOverlay({ badgeType, level, onDismiss }: CelebrationOverlayProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;
  const config = BADGE_CONFIG[badgeType];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        onDismiss();
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [opacity, scale, onDismiss]);

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <Text style={styles.confetti}>🎊 🎉 🎊</Text>
        <Text style={styles.emoji}>{config.emoji}</Text>
        <Text style={[styles.title, { color: config.color }]}>{config.label}</Text>
        <Text style={styles.subtitle}>Unlocked for {level}!</Text>
        <View style={styles.sparkleRow}>
          <Text style={styles.sparkle}>✨</Text>
          <Text style={styles.sparkle}>✨</Text>
          <Text style={styles.sparkle}>✨</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 23, 40, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  card: {
    backgroundColor: Colors.primary,
    borderRadius: 32,
    padding: 36,
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 40,
  },
  confetti: {
    fontSize: 28,
    letterSpacing: 8,
  },
  emoji: {
    fontSize: 72,
  },
  title: {
    fontSize: 28,
    fontWeight: '800' as const,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600' as const,
  },
  sparkleRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  sparkle: {
    fontSize: 22,
  },
});
