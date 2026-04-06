/**
 * Onboarding Launch — Screen 00: Pre Splash
 * Source: Banani flow FtXTL2Xb5WF4 / screen IN0ZHStMi0b1
 * Auto-advances to App Intro after 1.5 s.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

export default function PreSplash() {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      router.replace('/onboarding_launch/app-intro');
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.screen}>
      {/* Accent shapes */}
      <View style={styles.shape1} />
      <View style={styles.shape2} />
      <View style={styles.shape3} />

      <Animated.View style={[styles.contentWrapper, { opacity: fadeAnim }]}>
        {/* W logo with glow */}
        <View style={styles.iconContainer}>
          <View style={styles.iconGlow} />
          <Text style={styles.iconW}>W</Text>
        </View>

        {/* Punchline */}
        <View style={styles.punchline}>
          <Text style={styles.wordDark}>You </Text>
          <Text style={styles.wordBlue}>Actually </Text>
          <Text style={styles.wordDark}>Got This.</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  // Decorative accent shapes
  shape1: {
    position: 'absolute',
    top: '15%',
    left: '10%',
    width: 40,
    height: 6,
    backgroundColor: '#1A1A1A',
    borderRadius: 6,
  },
  shape2: {
    position: 'absolute',
    top: '48%',
    right: '12%',
    width: 12,
    height: 12,
    backgroundColor: '#DD0000',
    borderRadius: 6,
  },
  shape3: {
    position: 'absolute',
    bottom: '20%',
    left: '15%',
    width: 32,
    height: 8,
    backgroundColor: '#F0C808',
    borderRadius: 4,
  },

  // Content shifted slightly upward (≈ translateY(-8%))
  contentWrapper: {
    alignItems: 'center',
    marginTop: -65,
  },

  // Icon + glow
  iconContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 56,
  },
  iconGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    backgroundColor: '#2B70EF',
    borderRadius: 80,
    opacity: 0.12,
  },
  iconW: {
    fontSize: 72,
    fontFamily: 'Outfit_800ExtraBold',
    color: '#0F1F3D',
    lineHeight: 80,
    letterSpacing: -2,
    zIndex: 2,
  },

  // Punchline row
  punchline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  wordDark: {
    fontSize: 28,
    fontFamily: 'Outfit_800ExtraBold',
    color: '#0F1F3D',
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  wordBlue: {
    fontSize: 28,
    fontFamily: 'Outfit_800ExtraBold',
    color: '#2B70EF',
    lineHeight: 32,
    letterSpacing: -0.5,
  },
});
