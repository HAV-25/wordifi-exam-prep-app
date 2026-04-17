/**
 * Onboarding Launch — Screen 10: Notification Buy-In
 * Source: Banani flow FtXTL2Xb5WF4 / screen yyu-oL5xHH2h
 * Triggers real expo-notifications permission request on primary CTA tap
 */
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import { colors } from '@/theme';
import { ScreenLayout } from '@/components/ScreenLayout';
import { GlowOrb } from '@/components/GlowOrb';

const BENEFITS = [
  { title: 'One notification per day',               sub: 'Only when your streak is at risk' },
  { title: 'Sent at the time that works best for you', sub: 'Optimised for your study habits' },
  { title: 'Turn it off anytime',                    sub: 'Complete control over your experience' },
] as const;

export default function NotificationsScreen() {
  const [loading, setLoading] = useState(false);

  const handleYes = async () => {
    setLoading(true);
    try {
      const Notifications = await import('expo-notifications');
      await Notifications.requestPermissionsAsync();
    } catch {
      // expo-notifications not available in Expo Go — continue anyway
    } finally {
      setLoading(false);
      router.push('/onboarding_launch/plan-summary');
    }
  };

  const ctaFooter = (
    <>
      <Text style={styles.socialProof}>
        Learners who keep their streak active are{' '}
        <Text style={styles.socialProofHighlight}>3x more likely</Text>
        {' '}to pass their exam.
      </Text>

      <Pressable
        onPress={handleYes}
        disabled={loading}
        style={({ pressed }) => [styles.ctaPrimary, pressed && styles.ctaPressed]}
        accessibilityRole="button"
        accessibilityLabel="Yes, keep me on track"
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.ctaPrimaryText}>Yes — keep me on track 🔥</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => router.push('/onboarding_launch/plan-summary')}
        style={styles.ctaSecondary}
        accessibilityRole="button"
        accessibilityLabel="I will remember myself"
      >
        <Text style={styles.ctaSecondaryText}>I will remember myself</Text>
      </Pressable>
    </>
  );

  return (
    <View style={styles.root}>
      <GlowOrb top={-100} right={-100} />

      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScreenLayout
          scrollable={false}
          backgroundColor="transparent"
          footer={ctaFooter}
        >
          <View style={styles.contentWrap}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headline}>Your streak is your most powerful weapon.</Text>
              <Text style={styles.subCopy}>
                The learners who pass are not always the most talented. They are the most consistent.
              </Text>
            </View>

            {/* Notification preview card */}
            <View style={styles.notifCard}>
              <View style={styles.notifHeader}>
                <View style={styles.notifAppInfo}>
                  <View style={styles.notifDot} />
                  <Text style={styles.notifAppName}>Wordifi</Text>
                </View>
                <Text style={styles.notifTime}>now</Text>
              </View>
              <Text style={styles.notifBody}>
                "Your B1 streak is at 6 days. 5 quick questions to keep it alive. 🔥"
              </Text>
            </View>

            {/* Benefits list */}
            <View style={styles.benefitsList}>
              {BENEFITS.map(({ title, sub }) => (
                <View key={title} style={styles.benefitItem}>
                  <View style={styles.benefitIcon}>
                    <CheckCircle2 size={20} color="#22C55E" />
                  </View>
                  <Text style={styles.benefitText}>
                    <Text style={styles.benefitBold}>{title}</Text>
                    <Text style={styles.benefitMuted}>{` · ${sub}`}</Text>
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </ScreenLayout>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },

  safe:        { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  contentWrap: { flex: 1, zIndex: 2 },

  // Header
  header:   { marginBottom: 32 },
  headline: { fontFamily: 'Outfit_800ExtraBold', fontSize: 34, lineHeight: 37, color: '#374151', letterSpacing: -1, marginBottom: 12 },
  subCopy:  { fontFamily: 'NunitoSans_400Regular', fontSize: 16, lineHeight: 23, color: '#94A3B8', maxWidth: 310 },

  // Notification preview card
  notifCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    padding: 16,
    paddingHorizontal: 20,
    marginBottom: 40,
    shadowColor: '#374151',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 6,
  },
  notifHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  notifAppInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notifDot:     { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primary },
  notifAppName: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 13, color: '#94A3B8', letterSpacing: 0.2 },
  notifTime:    { fontFamily: 'NunitoSans_400Regular', fontSize: 12, color: '#94A3B8' },
  notifBody:    { fontFamily: 'NunitoSans_600SemiBold', fontSize: 15, lineHeight: 22, color: '#374151' },

  // Benefits
  benefitsList: { gap: 16 },
  benefitItem:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  benefitIcon:  { marginTop: 1 },
  benefitText:  { flex: 1, fontSize: 15, lineHeight: 22, fontFamily: 'NunitoSans_400Regular' },
  benefitBold:  { fontFamily: 'NunitoSans_700Bold', color: '#374151' },
  benefitMuted: { color: '#94A3B8' },

  // Footer
  socialProof:          { fontFamily: 'NunitoSans_400Regular', fontSize: 15, lineHeight: 22, color: '#374151', textAlign: 'center', marginBottom: 12, paddingHorizontal: 16 },
  socialProofHighlight: { fontFamily: 'NunitoSans_700Bold', color: colors.primary },

  ctaPrimary: {
    width: '100%',
    height: 60,
    backgroundColor: colors.primary,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 34,
    elevation: 10,
  },
  ctaPressed:      { opacity: 0.88 },
  ctaPrimaryText:  { fontFamily: 'Outfit_800ExtraBold', fontSize: 18, color: '#FFFFFF' },

  ctaSecondary:     { height: 44, alignItems: 'center', justifyContent: 'center' },
  ctaSecondaryText: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 14, color: '#94A3B8' },
});
