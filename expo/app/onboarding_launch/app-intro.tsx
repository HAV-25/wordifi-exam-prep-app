/**
 * Onboarding Launch — Screen 01: App Intro
 * Brand intro with Goethe/TELC headline, feature pills, and "Start my plan" CTA.
 * The animated wordmark splash was replaced by the video in index.tsx.
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
import { ArrowRight, ChartColumn, Layers3, Target } from 'lucide-react-native';

import { GlowOrb } from '@/components/GlowOrb';

const LOGO_URI =
  'https://firebasestorage.googleapis.com/v0/b/banani-prod.appspot.com/o/reference-images%2F1cf9115c-bc87-4683-bfd4-0670f0875c39?alt=media&token=c560f38f-1cf6-46fa-9a2e-f86edac2a035';

// ─── Feature pill row ─────────────────────────────────────────────────────────

type FeatureRowProps = {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  desc: string;
};

function FeatureRow({ icon, iconBg, title, desc }: FeatureRowProps) {
  return (
    <View style={styles.featureRow}>
      <View style={[styles.featureIconBox, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <View style={styles.featureCopy}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{desc}</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AppIntroScreen() {
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.screen}>
          {/* Yellow glow — top-right, clipped by root overflow:hidden */}
          <GlowOrb size={460} top={-160} right={-170} />

          {/* Logo */}
          <View style={styles.logoWrap}>
            <Image source={{ uri: LOGO_URI }} style={styles.logo} resizeMode="contain" />
          </View>

          {/* Headline block */}
          <View style={styles.headlineBlock}>
            <Text style={styles.headline}>
              {'Goethe.\nTELC.\nOne app.\nOne mission.\n'}
              <Text style={styles.headlineAccent}>You pass.</Text>
            </Text>

            <Text style={styles.subline}>
              Real readiness — built for German certification.
            </Text>

            {/* Feature pills */}
            <View style={styles.featurePills}>
              <FeatureRow
                iconBg="#2B70EF"
                icon={<Target size={20} color="#fff" />}
                title="Exam-accurate practice"
                desc="Built precisely for Goethe & TELC"
              />
              <FeatureRow
                iconBg="#22C55E"
                icon={<Layers3 size={20} color="#fff" />}
                title="Master every section"
                desc="Hören, Lesen, Schreiben, Sprechen"
              />
              <FeatureRow
                iconBg="#F0C808"
                icon={<ChartColumn size={20} color="#374151" />}
                title="Know your readiness daily"
                desc="Live score updated after every session"
              />
            </View>
          </View>

          {/* CTA */}
          <View style={styles.ctaWrap}>
            <Pressable
              onPress={() => router.push('/onboarding_launch/cert')}
              style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaPressed]}
              accessibilityRole="button"
              accessibilityLabel="Start my plan"
            >
              <Text style={styles.ctaText}>Start my plan</Text>
              <ArrowRight size={22} color="#fff" strokeWidth={2.5} />
            </Pressable>

            <Pressable
              onPress={() => router.replace('/auth')}
              style={styles.signInLink}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              <Text style={styles.signInText}>
                Already a Wordifi user?{' '}
                <Text style={styles.signInBold}>Jump straight in</Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFF',
    overflow: 'hidden',
  },

  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFF',
  },
  screen: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    position: 'relative',
  },

  logoWrap: {
    alignItems: 'center',
    marginBottom: 32,
    zIndex: 1,
  },
  logo: {
    width: 82,
    height: 36,
  },

  headlineBlock: {
    zIndex: 1,
    gap: 16,
  },
  headline: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 56,
    lineHeight: 54,
    letterSpacing: -1.8,
    color: '#374151',
  },
  headlineAccent: {
    color: '#2B70EF',
  },
  subline: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    color: '#94A3B8',
  },

  featurePills: {
    gap: 10,
    marginTop: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 56,
  },
  featureIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureCopy: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 17,
    lineHeight: 20,
    color: '#374151',
  },
  featureDesc: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    lineHeight: 16,
    color: '#94A3B8',
  },

  ctaWrap: {
    marginTop: 24,
    gap: 16,
    zIndex: 1,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 64,
    borderRadius: 999,
    backgroundColor: '#2B70EF',
    shadowColor: '#2B70EF',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 32,
    elevation: 6,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 20,
    letterSpacing: -0.4,
    color: '#FFFFFF',
  },
  signInLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  signInText: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  signInBold: {
    fontFamily: 'NunitoSans_600SemiBold',
    color: '#2B70EF',
  },
});
