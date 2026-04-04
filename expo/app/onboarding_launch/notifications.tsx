/**
 * Onboarding Launch — Screen 12: Notification Buy-In
 * Source: Stitch screen 0dd7fe9dc2b64b2d98260639c29429dd
 * Triggers real expo-notifications permission request on "Yes" tap
 */
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { colors } from '@/theme';

const FEATURES = [
  { title: 'One notification per day', sub: 'Only when your streak is at risk' },
  { title: 'Sent at the time that works best for you', sub: 'Optimized for your study habits' },
  { title: 'Turn it off anytime', sub: 'Complete control over your experience' },
] as const;

export default function NotificationsScreen() {
  const [loading, setLoading] = useState(false);

  const handleYes = async () => {
    setLoading(true);
    try {
      const Notifications = await import('expo-notifications');
      await Notifications.requestPermissionsAsync();
    } catch {
      // expo-notifications native module not available (Expo Go) — continue anyway
    } finally {
      setLoading(false);
      router.push('/onboarding_launch/plan-summary');
    }
  };

  const handleSkip = () => {
    router.push('/onboarding_launch/plan-summary');
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        {/* Mock notification preview */}
        <View style={styles.notifCard}>
          <View style={styles.notifHeader}>
            <View style={styles.notifIconWrap}>
              <LinearGradient
                colors={[colors.primary, colors.primaryContainer]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.notifIcon}
              >
                <Text style={styles.notifIconLetter}>W</Text>
              </LinearGradient>
            </View>
            <Text style={styles.notifApp}>Wordifi</Text>
            <Text style={styles.notifTime}>now</Text>
          </View>
          <Text style={styles.notifBody}>
            Your streak is at 6 days. 5 quick questions to keep it alive 🔥
          </Text>
        </View>

        {/* Main content */}
        <View style={styles.content}>
          <Text style={styles.headline}>Your streak is your most powerful weapon.</Text>
          <Text style={styles.body}>
            The learners who pass are not always the most talented. They are the most consistent.
          </Text>

          {/* Feature list */}
          <View style={styles.features}>
            {FEATURES.map(({ title, sub }) => (
              <View key={title} style={styles.featureRow}>
                <View style={styles.featureDot} />
                <View style={styles.featureBody}>
                  <Text style={styles.featureTitle}>{title}</Text>
                  <Text style={styles.featureSub}>{sub}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Stat */}
          <View style={styles.statBox}>
            <Text style={styles.statText}>
              Learners who keep their streak active are{' '}
              <Text style={styles.statHighlight}>3x more likely</Text> to pass their exam.
            </Text>
          </View>
        </View>

        {/* CTAs */}
        <View style={styles.ctaArea}>
          <Pressable
            onPress={handleYes}
            disabled={loading}
            style={styles.ctaPrimary}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryContainer]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.ctaPrimaryInner}
            >
              {loading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.ctaPrimaryText}>Yes — keep me on track 🔥</Text>
              )}
            </LinearGradient>
          </Pressable>

          <Pressable onPress={handleSkip} style={styles.ctaSecondary}>
            <Text style={styles.ctaSecondaryText}>I will remember myself</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between', paddingTop: 24 },

  // Notification preview card
  notifCard: { backgroundColor: colors.surfaceContainerLow, borderRadius: 18, padding: 16, marginBottom: 28, shadowColor: colors.onSurface, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  notifHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  notifIconWrap: { borderRadius: 8, overflow: 'hidden' },
  notifIcon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  notifIconLetter: { fontFamily: 'Outfit_800ExtraBold', fontSize: 12, color: colors.onPrimary },
  notifApp: { fontFamily: 'NunitoSans_700Bold', fontSize: 13, color: colors.onSurface, flex: 1 },
  notifTime: { fontFamily: 'NunitoSans_400Regular', fontSize: 12, color: colors.outline },
  notifBody: { fontFamily: 'NunitoSans_400Regular', fontSize: 14, lineHeight: 20, color: colors.onSurface },

  // Content
  content: { flex: 1 },
  headline: { fontFamily: 'Outfit_800ExtraBold', fontSize: 24, lineHeight: 32, color: colors.onPrimaryContainer, marginBottom: 12, letterSpacing: -0.3 },
  body: { fontFamily: 'NunitoSans_400Regular', fontSize: 14, lineHeight: 21, color: colors.onSurfaceVariant, marginBottom: 24 },

  features: { gap: 14, marginBottom: 24 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  featureDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 5 },
  featureBody: { flex: 1 },
  featureTitle: { fontFamily: 'NunitoSans_700Bold', fontSize: 14, color: colors.onSurface, marginBottom: 1 },
  featureSub: { fontFamily: 'NunitoSans_400Regular', fontSize: 12, color: colors.onSurfaceVariant, lineHeight: 17 },

  statBox: { backgroundColor: `${colors.primary}0D`, borderRadius: 12, padding: 14 },
  statText: { fontFamily: 'NunitoSans_400Regular', fontSize: 13, lineHeight: 20, color: colors.onSurfaceVariant },
  statHighlight: { fontFamily: 'NunitoSans_700Bold', color: colors.primary },

  // CTAs
  ctaArea: { gap: 12, paddingBottom: 8 },
  ctaPrimary: { borderRadius: 24, overflow: 'hidden', shadowColor: colors.blueShadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 16, elevation: 8 },
  ctaPrimaryInner: { paddingVertical: 18, alignItems: 'center', borderRadius: 24 },
  ctaPrimaryText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 16, color: colors.onPrimary, letterSpacing: 0.3 },
  ctaSecondary: { paddingVertical: 14, alignItems: 'center' },
  ctaSecondaryText: { fontFamily: 'NunitoSans_400Regular', fontSize: 14, color: colors.onSurfaceVariant },
});
