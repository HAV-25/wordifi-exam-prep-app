import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';

import Colors from '@/constants/colors';
import { colors } from '@/theme';
import { getTierColor, getTierEmoji } from '@/lib/badgeHelpers';

type CelebrationOverlayProps = {
  tierName: string;
  level: string;
  onDismiss: () => void;
};

const SPARKLE_POSITIONS = [
  { top: -18, left: '20%' },
  { top: -12, right: '15%' },
  { top: '30%', left: -14 },
  { top: '30%', right: -14 },
  { bottom: -16, left: '25%' },
  { bottom: -10, right: '20%' },
] as const;

export function CelebrationOverlay({ tierName, level, onDismiss }: CelebrationOverlayProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;
  const emojiScale = useRef(new Animated.Value(0)).current;
  const sparkleOpacity = useRef(new Animated.Value(0)).current;
  const color = getTierColor(tierName);
  const emoji = getTierEmoji(tierName);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
    ]).start(() => {
      Animated.sequence([
        Animated.spring(emojiScale, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true }),
        Animated.timing(sparkleOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    });

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.8, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => {
        onDismiss();
      });
    }, 2500);

    return () => clearTimeout(timer);
  }, [opacity, scale, emojiScale, sparkleOpacity, onDismiss]);

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        {SPARKLE_POSITIONS.map((pos, i) => (
          <Animated.Text
            key={i}
            style={[
              styles.sparkleAbsolute,
              { opacity: sparkleOpacity },
              pos as Record<string, string | number>,
            ]}
          >
            ✦
          </Animated.Text>
        ))}

        <Animated.Text style={[styles.emoji, { transform: [{ scale: emojiScale }] }]}>
          {emoji}
        </Animated.Text>
        <Text style={[styles.title, { color }]}>{tierName}</Text>
        <Text style={styles.subtitle}>Unlocked for {level}!</Text>
        <Text style={styles.encouragement}>You're making real progress</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlayDark,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  card: {
    backgroundColor: Colors.primary,
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 40,
  },
  emoji: {
    fontSize: 64,
  },
  title: {
    fontSize: 26,
    fontWeight: '800' as const,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600' as const,
  },
  encouragement: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500' as const,
    marginTop: 4,
  },
  sparkleAbsolute: {
    position: 'absolute',
    fontSize: 16,
    color: colors.amber,
  },
});
