/**
 * Onboarding Launch — Screen 02: Certification Selection
 * Source: Stitch project 17418085725444489838 / screen 5bc897afcbfc4f23ab5f2545cf17fac9
 * Version: 1.0
 */
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { onboardingStore } from './_store';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  ClipboardList,
  FileText,
  HelpCircle,
} from 'lucide-react-native';
import { colors } from '@/theme';

// ─── Data ────────────────────────────────────────────────────────────────────

type CertId = 'goethe' | 'telc' | 'osd' | 'not_sure';

const CERTS: {
  id: CertId;
  title: string;
  subtitle: string;
  Icon: React.FC<{ size: number; color: string }>;
  iconBg: string;
  iconColor: string;
}[] = [
  {
    id: 'goethe',
    title: 'Goethe-Institut',
    subtitle: 'The most widely recognised German certificate worldwide',
    Icon: GraduationCap,
    iconBg: colors.surfaceContainer, // primary-fixed equivalent (#EAEDFF)
    iconColor: colors.primary,
  },
  {
    id: 'telc',
    title: 'TELC',
    subtitle: 'Popular choice for visa, residency and work permits',
    Icon: ClipboardList,
    iconBg: colors.surfaceContainerLow,
    iconColor: colors.onSurfaceVariant,
  },
  {
    id: 'osd',
    title: 'ÖSD',
    subtitle: 'Recognised across Austria, Germany and Switzerland',
    Icon: FileText,
    iconBg: colors.surfaceContainerLow,
    iconColor: colors.onSurfaceVariant,
  },
  {
    id: 'not_sure',
    title: 'Not sure yet',
    subtitle: "We'll help you figure out the right one",
    Icon: HelpCircle,
    iconBg: colors.surfaceContainerHighest,
    iconColor: colors.outline,
  },
];

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ progress }: { progress: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${progress}%` as any }]}>
        <View style={styles.progressDot} />
      </View>
    </View>
  );
}

// ─── Cert card ────────────────────────────────────────────────────────────────

function CertCard({
  cert,
  selected,
  onPress,
}: {
  cert: (typeof CERTS)[number];
  selected: boolean;
  onPress: () => void;
}) {
  const { Icon, iconBg, iconColor } = cert;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={cert.title}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: selected ? colors.surfaceContainer : iconBg },
        ]}
      >
        <Icon size={26} color={selected ? colors.primary : iconColor} />
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, selected && styles.cardTitleSelected]}>
          {cert.title}
        </Text>
        <Text style={styles.cardSubtitle}>{cert.subtitle}</Text>
      </View>
      {selected && (
        <View style={styles.checkDot}>
          <View style={styles.checkDotInner} />
        </View>
      )}
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CertScreen() {
  const [selected, setSelected] = useState<CertId | null>(null);

  function handleContinue() {
    if (!selected) return;
    onboardingStore.cert = selected;
    router.push('/onboarding_launch/level');
  }

  return (
    <View style={styles.root}>
      <ProgressBar progress={10} />

      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* Nav row */}
        <View style={styles.navRow}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={20} color={colors.onSurfaceVariant} />
          </Pressable>
          <Text style={styles.stepLabel}>Step 1 of 10</Text>
          <View style={styles.navSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Headline */}
          <Text style={styles.headline}>
            Which German certification are you going for?
          </Text>

          {/* Cards */}
          <View style={styles.cardList}>
            {CERTS.map((cert) => (
              <CertCard
                key={cert.id}
                cert={cert}
                selected={selected === cert.id}
                onPress={() => setSelected(cert.id)}
              />
            ))}
          </View>

          {/* CTA */}
          <Pressable
            onPress={handleContinue}
            disabled={!selected}
            style={({ pressed }) => [
              styles.ctaWrap,
              !selected && styles.ctaDisabled,
              pressed && selected && styles.ctaPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <LinearGradient
              colors={selected ? [colors.primary, colors.primaryContainer] : [colors.surfaceContainerHigh, colors.surfaceContainerHigh]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              <Text style={[styles.ctaText, !selected && styles.ctaTextDisabled]}>
                Continue
              </Text>
              <ArrowRight size={20} color={selected ? colors.onPrimary : colors.outline} />
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Progress bar
  progressTrack: {
    height: 4,
    backgroundColor: colors.surfaceContainerHighest,
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    position: 'relative',
    shadowColor: colors.secondaryFixed,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  progressDot: {
    position: 'absolute',
    right: -4,
    top: '50%',
    marginTop: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondaryFixed,
    shadowColor: colors.secondaryFixed,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },

  // Layout
  safe: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },

  // Nav
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.outline,
  },
  navSpacer: {
    width: 40,
  },

  // Headline
  headline: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 30,
    lineHeight: 38,
    color: colors.onPrimaryContainer,
    marginBottom: 28,
    letterSpacing: -0.3,
  },

  // Card list
  cardList: {
    gap: 12,
    marginBottom: 32,
  },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}1A`, // 10% opacity
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardSelected: {
    borderColor: `${colors.primary}33`, // 20% opacity
    backgroundColor: colors.surfaceContainerLow,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 16,
    color: colors.onSurface,
    marginBottom: 3,
  },
  cardTitleSelected: {
    color: colors.primary,
  },
  cardSubtitle: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: colors.onSurfaceVariant,
  },
  checkDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  checkDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.onPrimary,
  },

  // CTA
  ctaWrap: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: colors.blueShadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaPressed: {
    opacity: 0.88,
  },
  cta: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 24,
  },
  ctaText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 16,
    color: colors.onPrimary,
    letterSpacing: 0.3,
  },
  ctaTextDisabled: {
    color: colors.outline,
  },
});
