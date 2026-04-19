/**
 * Onboarding Launch — Screen 02: Certification Selection
 * Source: Banani flow FtXTL2Xb5WF4 / screen p1VdkoULlAk1
 * Step 1 of 10
 */
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { onboardingStore } from './_store';
import { ArrowLeft } from 'lucide-react-native';
import { ScreenLayout } from '@/components/ScreenLayout';
import { GlowOrb } from '@/components/GlowOrb';
import { ConvictionAnswerCard } from '@/components/onboarding/ConvictionAnswerCard';
import { CERT_CONVICTIONS } from '@/components/onboarding/convictionLookup';

// ─── Data ─────────────────────────────────────────────────────────────────────

type CertId = 'goethe' | 'telc' | 'osd' | 'not_sure';

const CERTS: { id: CertId; emoji: string; title: string; subtitle: string }[] = [
  { id: 'goethe',   emoji: '🎓', title: 'Goethe-Institut', subtitle: 'The most widely recognised German certificate worldwide' },
  { id: 'telc',     emoji: '📋', title: 'TELC',            subtitle: 'Popular choice for visa, residency and work permits' },
  { id: 'osd',      emoji: '📝', title: 'ÖSD',             subtitle: 'Recognised across Austria, Germany and Switzerland' },
  { id: 'not_sure', emoji: '🤔', title: 'Not sure yet',    subtitle: "We'll help you figure out the right one" },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CertScreen() {
  const [selected, setSelected] = useState<CertId | null>(null);
  const [continueActive, setContinueActive] = useState(false);
  // Holds the cancel handle passed by the currently-flipped card via onFlipComplete.
  // Called in handleContinue to abort any pending flip-back timer (brief 5.4 point 3).
  const cancelFlipBackRef = useRef<(() => void) | null>(null);

  function handleContinue() {
    cancelFlipBackRef.current?.(); // abort flip-back if yellow face is still showing
    cancelFlipBackRef.current = null;
    if (!selected) return;
    onboardingStore.cert = selected;
    router.push('/onboarding_launch/level');
  }

  const ctaFooter = (
    <Pressable
      onPress={handleContinue}
      disabled={!continueActive}
      style={({ pressed }) => [
        styles.ctaButton,
        !continueActive && styles.ctaDisabled,
        pressed && continueActive && styles.ctaPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Continue"
    >
      <Text style={[styles.ctaText, !continueActive && styles.ctaTextDisabled]}>Continue →</Text>
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <GlowOrb top={-100} right={-100} />
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: '10%' }]} />
      </View>

      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* Nav row */}
        <View style={styles.navRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
            <ArrowLeft size={24} color="#374151" />
          </Pressable>
          <Text style={styles.stepLabel}>STEP 1 OF 10</Text>
          <View style={styles.navSpacer} />
        </View>

        <ScreenLayout footer={ctaFooter} contentContainerStyle={styles.scroll} backgroundColor="transparent">
          {/* Headline */}
          <Text style={styles.headline}>Which German certification are you going for?</Text>

          {/* Cards */}
          <View style={styles.cardList}>
            {CERTS.map((cert) => (
              <ConvictionAnswerCard
                key={cert.id}
                conviction={CERT_CONVICTIONS[cert.id]}
                isSelected={selected === cert.id}
                onPress={() => setSelected(cert.id)}
                onFlipComplete={(cancelFn) => {
                  setContinueActive(true);
                  cancelFlipBackRef.current = cancelFn;
                }}
                cardStyle={[styles.card, selected === cert.id && styles.cardSelected]}
                cardBorderRadius={12} /* intentional: cert screen uses 12px cards; all others 16px — original design, verified OB-10 */
                accessibilityLabel={cert.title}
              >
                <Text style={styles.emoji}>{cert.emoji}</Text>
                <View style={styles.cardText}>
                  <Text style={[styles.cardTitle, selected === cert.id && styles.cardTitleSelected]}>
                    {cert.title}
                  </Text>
                  <Text style={styles.cardSubtitle}>{cert.subtitle}</Text>
                </View>
              </ConvictionAnswerCard>
            ))}
          </View>
        </ScreenLayout>
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

  // Progress
  progressTrack: {
    height: 4,
    backgroundColor: '#EBF1FF',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2B70EF',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },

  // Layout
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: 24,
  },

  // Nav
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  stepLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 13,
    color: '#94A3B8',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  navSpacer: { width: 40 },

  // Headline
  headline: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 32,
    lineHeight: 38,
    color: '#374151',
    marginBottom: 32,
    letterSpacing: -0.5,
  },

  // Cards
  cardList: { gap: 12, marginBottom: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    gap: 16,
    shadowColor: '#374151',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardSelected: {
    borderColor: '#2B70EF',
    backgroundColor: '#ECF2FE', // brief §step-6: soft Primary Blue tint (was #F0F5FF in OB-01 scaffold)
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
  },
  emoji: {
    fontSize: 24,
    lineHeight: 30,
    paddingTop: 2,
  },
  cardText: { flex: 1 },
  cardTitle: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 18,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 4,
  },
  cardTitleSelected: { color: '#2B70EF' },
  cardSubtitle: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },

  // CTA
  ctaButton: {
    width: '100%',
    height: 64,
    backgroundColor: '#2B70EF',
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2B70EF',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 10,
  },
  ctaDisabled: {
    backgroundColor: '#E2E8F0',
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaPressed: { opacity: 0.88 },
  ctaText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  ctaTextDisabled: { color: '#94A3B8' },
});
