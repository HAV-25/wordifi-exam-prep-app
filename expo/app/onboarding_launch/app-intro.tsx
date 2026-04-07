/**
 * Onboarding Launch — Screen 01: App Intro Polished
 * Source: Banani flow FtXTL2Xb5WF4 / screen S_jwAIdTZqXL
 * CTA navigates to cert selection (first question screen).
 */
import React from 'react';
import {
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

      {/* Returning user link */}
      <Pressable
        onPress={() => { router.dismissAll(); router.replace('/auth'); }}
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenLayout footer={ctaFooter} contentContainerStyle={styles.screen} backgroundColor="#F8FAFF">
        {/* Top nav — centered logo */}
        <View style={styles.topNav}>
          <Image source={{ uri: LOGO_URI }} style={styles.logoImg} resizeMode="contain" />
        </View>

        {/* Content header */}
        <View style={styles.contentHeader}>
          {/* Badges */}
          <View style={styles.badgesRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>50,000+ Learners</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>A1 TO B</Text>
            </View>
          </View>

          {/* Main heading */}
          <Text style={styles.mainHeading}>
            {'Goethe. TELC.\nÖSD.\nOne app.\nOne mission.\n'}
            <Text style={styles.headingBlue}>You pass.</Text>
          </Text>

          {/* Sub-heading */}
          <Text style={styles.subHeading}>
            Real readiness — built exclusively for German certification.
          </Text>
        </View>

        {/* Illustration */}
        <View style={styles.illustrationContainer}>
          <Image
            source={{ uri: ILLUSTRATION_URI }}
            style={styles.heroIllustration}
            resizeMode="contain"
          />
        </View>
      </ScreenLayout>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFF',
  },
  screen: {
    flexGrow: 1,
    paddingHorizontal: 24,
    backgroundColor: '#F8FAFF',
  },

  // Top nav
  topNav: {
    alignItems: 'center',
    paddingTop: 16,
    marginBottom: 32,
  },
  logoImg: {
    height: 44,
    width: 160,
  },

  // Content header
  contentHeader: {
    alignItems: 'flex-start',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  badge: {
    backgroundColor: '#E8F0FE',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 100,
  },
  badgeText: {
    color: '#2B70EF',
    fontSize: 11,
    fontFamily: 'Outfit_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Heading
  mainHeading: {
    fontSize: 52,
    fontFamily: 'Outfit_800ExtraBold',
    lineHeight: 55,
    color: '#374151',
    marginBottom: 16,
    letterSpacing: -1.5,
  },
  headingBlue: {
    color: '#2B70EF',
  },
  subHeading: {
    fontSize: 18,
    fontFamily: 'NunitoSans_400Regular',
    lineHeight: 27,
    color: '#374151',
    opacity: 0.85,
    maxWidth: 300,
  },

  // Illustration
  illustrationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    marginBottom: 36,
    minHeight: 300,
  },
  heroIllustration: {
    width: '100%',
    maxWidth: 328,
    height: 300,
  },

  // CTA
  ctaContainer: {
    marginTop: 'auto',
    width: '100%',
  },
  ctaButton: {
    minHeight: 72,
    backgroundColor: '#2B70EF',
    borderRadius: 100,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 32,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#2B70EF',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 12,
  },
  ctaPressed: {
    opacity: 0.88,
  },
  ctaText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontFamily: 'Outfit_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    paddingRight: 16,
  },
  ctaIcon: {
    width: 56,
    height: 56,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sign in link
  signInLink: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  signInText: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 14,
    color: '#94A3B8',
  },
  signInLinkText: {
    fontFamily: 'NunitoSans_700Bold',
    color: '#2B70EF',
    textDecorationLine: 'underline',
  },
});
