/**
 * Onboarding Launch — Screen 15: Trial Transparency
 * Source: Stitch screen 7679de7dc16147a7870be015ef007612
 * Final screen before sign-up — explains the 72-hour free trial
 * Routes to /auth (sign in / sign up)
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowRight, Lock, Mail, Star } from 'lucide-react-native';
import { colors } from '@/theme';

// ─── Trial steps ──────────────────────────────────────────────────────────────

const STEPS = [
  {
    tag: 'RIGHT NOW',
    tagColor: colors.primary,
    emoji: '🎉',
    title: 'Full plan unlocks immediately.',
    body: 'Your full Wordifi plan unlocks immediately. You pay nothing today.',
  },
  {
    tag: 'NEXT 72 HOURS',
    tagColor: colors.tertiary,
    emoji: '🔥',
    title: 'Practice daily. Still completely free.',
    body: 'Practice every day. Watch your score climb. Still completely free.',
  },
  {
    tag: 'AFTER 72 HOURS',
    tagColor: colors.onSurfaceVariant,
    emoji: '📅',
    title: 'Only then will you be charged.',
    body: 'You will receive a reminder before your trial ends — so you are never caught off guard. Cancel anytime within 72 hours and you will never be charged.',
  },
] as const;

const TRUST_ITEMS = [
  { icon: <Lock size={16} color={colors.primary} />, text: 'Cancel anytime' },
  { icon: <Mail size={16} color={colors.primary} />, text: 'Reminder before trial ends' },
  { icon: <Star size={16} color={colors.tertiary} />, text: '4.8 stars — thousands trust Wordifi' },
] as const;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TrialTransparencyScreen() {
  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* Wordifi logo mark */}
        <View style={styles.logoWrap}>
          <LinearGradient
            colors={[colors.primary, colors.primaryContainer]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.logoMark}
          >
            <Text style={styles.logoLetter}>W</Text>
          </LinearGradient>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.headline}>Here is exactly what happens next.</Text>
          <Text style={styles.subhead}>No surprises. No hidden charges. Just complete transparency.</Text>

          {/* Timeline steps */}
          <View style={styles.timeline}>
            {STEPS.map(({ tag, tagColor, emoji, title, body }, i) => (
              <View key={tag} style={styles.stepWrap}>
                {/* Connector line */}
                {i < STEPS.length - 1 && <View style={styles.connector} />}

                <View style={styles.step}>
                  {/* Emoji circle */}
                  <View style={styles.stepCircle}>
                    <Text style={styles.stepEmoji}>{emoji}</Text>
                  </View>

                  <View style={styles.stepBody}>
                    <Text style={[styles.stepTag, { color: tagColor }]}>{tag}</Text>
                    <Text style={styles.stepTitle}>{title}</Text>
                    <Text style={styles.stepDesc}>{body}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Trust row */}
          <View style={styles.trustCard}>
            {TRUST_ITEMS.map(({ icon, text }) => (
              <View key={text} style={styles.trustRow}>
                {icon}
                <Text style={styles.trustText}>{text}</Text>
              </View>
            ))}
          </View>

          {/* Social proof */}
          <Text style={styles.socialProof}>
            We are confident that by the end of your trial you will not want to leave. But the choice is always yours.
          </Text>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Sticky CTA */}
        <View style={styles.footer}>
          <SafeAreaView edges={['bottom']}>
            <Pressable
              onPress={() => router.replace('/auth')}
              style={styles.ctaWrap}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryContainer]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                <Text style={styles.ctaText}>I understand — show me my plan</Text>
                <ArrowRight size={20} color={colors.onPrimary} />
              </LinearGradient>
            </Pressable>
          </SafeAreaView>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },

  logoWrap: { alignItems: 'center', paddingTop: 20 },
  logoMark: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { fontFamily: 'Outfit_800ExtraBold', fontSize: 22, color: colors.onPrimary },

  scroll: { paddingHorizontal: 24, paddingTop: 16 },
  headline: { fontFamily: 'Outfit_800ExtraBold', fontSize: 26, lineHeight: 34, color: colors.onPrimaryContainer, marginBottom: 8, letterSpacing: -0.3 },
  subhead: { fontFamily: 'NunitoSans_400Regular', fontSize: 14, lineHeight: 21, color: colors.onSurfaceVariant, marginBottom: 28 },

  // Timeline
  timeline: { marginBottom: 20 },
  stepWrap: { position: 'relative' },
  connector: { position: 'absolute', left: 21, top: 48, width: 2, height: 32, backgroundColor: `${colors.outlineVariant}40`, zIndex: 0 },
  step: { flexDirection: 'row', gap: 16, marginBottom: 24, zIndex: 1 },
  stepCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceContainerLow, alignItems: 'center', justifyContent: 'center', shadowColor: colors.onSurface, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  stepEmoji: { fontSize: 22 },
  stepBody: { flex: 1, paddingTop: 2 },
  stepTag: { fontFamily: 'NunitoSans_700Bold', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  stepTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 15, color: colors.onSurface, marginBottom: 4, lineHeight: 22 },
  stepDesc: { fontFamily: 'NunitoSans_400Regular', fontSize: 13, lineHeight: 19, color: colors.onSurfaceVariant },

  // Trust card
  trustCard: { backgroundColor: colors.surfaceContainerLow, borderRadius: 16, padding: 16, marginBottom: 20, gap: 12 },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trustText: { fontFamily: 'NunitoSans_400Regular', fontSize: 13, color: colors.onSurface },

  socialProof: { fontFamily: 'NunitoSans_400Regular', fontSize: 13, lineHeight: 20, color: colors.onSurfaceVariant, textAlign: 'center', fontStyle: 'italic', paddingHorizontal: 8 },

  // Footer
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 16, backgroundColor: `${colors.background}F5` },
  ctaWrap: { borderRadius: 24, overflow: 'hidden', shadowColor: colors.blueShadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 16, elevation: 8, marginBottom: 8 },
  cta: { paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 24 },
  ctaText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 15, color: colors.onPrimary, letterSpacing: 0.3 },
});
