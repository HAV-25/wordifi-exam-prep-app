/**
 * Onboarding Launch — Screen 01: App Intro
 * Opens with an animated Pacifico wordmark splash, then reveals the full intro.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { ScreenLayout } from '@/components/ScreenLayout';
import { GermanFlagBadge } from '@/components/GermanFlagBadge';

const LOGO_URI =
  'https://firebasestorage.googleapis.com/v0/b/banani-prod.appspot.com/o/reference-images%2F1cf9115c-bc87-4683-bfd4-0670f0875c39?alt=media&token=c560f38f-1cf6-46fa-9a2e-f86edac2a035';

const ILLUSTRATION_URI =
  'https://firebasestorage.googleapis.com/v0/b/banani-prod.appspot.com/o/reference-images%2Fd79bb9ce-5b3b-4aee-95d0-527f808ef61c?alt=media&token=940f047b-070d-4b40-866d-57af31f4a89c';

function ArrowIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12h14M12 5l7 7-7 7"
        stroke="white"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function AppIntroPolished() {
  const [splashDone, setSplashDone] = useState(false);

  // ── Splash animation values ─────────────────────────────────────────────
  const wScale = useRef(new Animated.Value(0.3)).current;
  const wOpacity = useRef(new Animated.Value(0)).current;
  const wTranslateX = useRef(new Animated.Value(0)).current;
  const ordifiOpacity = useRef(new Animated.Value(0)).current;
  const ordifiTranslateX = useRef(new Animated.Value(20)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const flagOpacity = useRef(new Animated.Value(0)).current;
  const splashFadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Phase 1: "w" grows from small to full size (center of screen)
    Animated.parallel([
      Animated.timing(wOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(wScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
    ]).start();

    // Phase 2: "w" slides left, "ordifi" flows in from right
    const phase2 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(wTranslateX, { toValue: -72, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(ordifiOpacity, { toValue: 1, duration: 400, delay: 150, useNativeDriver: true }),
        Animated.timing(ordifiTranslateX, { toValue: 0, duration: 500, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }, 600);

    // Phase 3: tagline + flag fade in
    const phase3 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(flagOpacity, { toValue: 1, duration: 400, delay: 100, useNativeDriver: true }),
      ]).start();
    }, 1400);

    // Phase 4: fade out splash, reveal intro
    const phase4 = setTimeout(() => {
      Animated.timing(splashFadeOut, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => setSplashDone(true));
    }, 2800);

    return () => {
      clearTimeout(phase2);
      clearTimeout(phase3);
      clearTimeout(phase4);
    };
  }, []);

  // ── Intro content (shown after splash) ──────────────────────────────────
  const ctaFooter = (
    <View style={styles.ctaContainer}>
      <Pressable
        onPress={() => router.push('/onboarding_launch/cert')}
        style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaPressed]}
        accessibilityRole="button"
        accessibilityLabel="Start my plan"
      >
        <Text style={styles.ctaText}>Start my plan</Text>
        <View style={styles.ctaIcon}>
          <ArrowIcon />
        </View>
      </Pressable>
      <Pressable
        onPress={() => { router.replace('/auth'); }}
        accessibilityRole="button"
        accessibilityLabel="Sign in"
        style={styles.signInLink}
      >
        <Text style={styles.signInText}>
          Already a Wordifi user?{' '}
          <Text style={styles.signInLinkText}>Jump straight in</Text>
        </Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.root}>
      {/* Splash overlay — animated wordmark */}
      {!splashDone ? (
        <Animated.View style={[styles.splashOverlay, { opacity: splashFadeOut }]}>
          <View style={styles.splashContent}>
            <View style={styles.splashWordmarkRow}>
              <Animated.Text
                style={[
                  styles.splashW,
                  { opacity: wOpacity, transform: [{ scale: wScale }, { translateX: wTranslateX }] },
                ]}
              >
                w
              </Animated.Text>
              <Animated.Text
                style={[
                  styles.splashOrdifi,
                  { opacity: ordifiOpacity, transform: [{ translateX: ordifiTranslateX }] },
                ]}
              >
                ordifi
              </Animated.Text>
            </View>
            <Animated.View style={[styles.splashTaglineRow, { opacity: taglineOpacity }]}>
              <Text style={styles.splashTagline}>Your exam, conquered.</Text>
            </Animated.View>
            <Animated.View style={{ opacity: flagOpacity }}>
              <GermanFlagBadge width={28} height={18} />
            </Animated.View>
          </View>
        </Animated.View>
      ) : null}

      {/* Main intro — always rendered (behind splash initially) */}
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenLayout footer={ctaFooter} contentContainerStyle={styles.screen} backgroundColor="#F8FAFF">
          <View style={styles.topNav}>
            <Image source={{ uri: LOGO_URI }} style={styles.logoImg} resizeMode="contain" />
          </View>
          <View style={styles.contentHeader}>
            <View style={styles.badgesRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>50,000+ Learners</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>A1 TO B</Text>
              </View>
            </View>
            <Text style={styles.mainHeading}>
              {'Goethe. TELC.\nÖSD.\nOne app.\nOne mission.\n'}
              <Text style={styles.headingBlue}>You pass.</Text>
            </Text>
            <Text style={styles.subHeading}>
              Real readiness — built exclusively for German certification.
            </Text>
          </View>
          <View style={styles.illustrationContainer}>
            <Image
              source={{ uri: ILLUSTRATION_URI }}
              style={styles.heroIllustration}
              resizeMode="contain"
            />
          </View>
        </ScreenLayout>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFF' },

  // ─── Splash overlay ────────────────────────────────────────────────────────
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F8FAFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  splashContent: { alignItems: 'center', gap: 16 },
  splashWordmarkRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  splashW: { fontFamily: 'Pacifico_400Regular', fontSize: 52, color: '#2B70EF', letterSpacing: -1 },
  splashOrdifi: { fontFamily: 'Pacifico_400Regular', fontSize: 52, color: '#2B70EF', letterSpacing: -1 },
  splashTaglineRow: { marginTop: 4 },
  splashTagline: { fontSize: 18, fontWeight: '600', color: '#94A3B8' },

  // ─── Main intro ────────────────────────────────────────────────────────────
  safeArea: { flex: 1, backgroundColor: '#F8FAFF' },
  screen: { flexGrow: 1, paddingHorizontal: 24, backgroundColor: '#F8FAFF' },
  topNav: { alignItems: 'center', paddingTop: 16, marginBottom: 32 },
  logoImg: { height: 44, width: 160 },
  contentHeader: { alignItems: 'flex-start' },
  badgesRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  badge: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(43,112,239,0.08)',
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#2B70EF', letterSpacing: 0.3, textTransform: 'uppercase' },
  mainHeading: { fontSize: 36, fontWeight: '800', color: '#0F1F3D', lineHeight: 40, letterSpacing: -0.5, marginBottom: 16 },
  headingBlue: { color: '#2B70EF' },
  subHeading: { fontSize: 17, fontWeight: '500', color: '#64748B', lineHeight: 24, marginBottom: 24 },
  illustrationContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 16 },
  heroIllustration: { width: '100%', height: 280, borderRadius: 20 },

  // ─── CTA ───────────────────────────────────────────────────────────────────
  ctaContainer: { paddingHorizontal: 24, paddingBottom: 12, gap: 16, alignItems: 'center' },
  ctaButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#2B70EF', borderRadius: 999, paddingVertical: 18,
    paddingHorizontal: 32, width: '100%', gap: 12,
  },
  ctaPressed: { opacity: 0.9 },
  ctaText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  ctaIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  signInLink: { paddingVertical: 8 },
  signInText: { fontSize: 14, fontWeight: '500', color: '#64748B', textAlign: 'center' },
  signInLinkText: { color: '#2B70EF', fontWeight: '700' },
});
