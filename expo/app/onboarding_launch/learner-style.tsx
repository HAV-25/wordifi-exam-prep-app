/**
 * Onboarding Launch — Screen 13: Learner Style
 * Source: Stitch screen 9b0f4d3465024a1e9144d18010409bf9
 * Step 9 of 10 — "Which style describes you best?"
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react-native';
import { onboardingStore, LearnerStyleId, LEARNER_STYLE_DISPLAY } from './_store';
import { colors } from '@/theme';

const OPTIONS: LearnerStyleId[] = ['sprinter', 'builder', 'sniper', 'explorer'];

export default function LearnerStyleScreen() {
  const [selected, setSelected] = useState<LearnerStyleId | null>(null);

  return (
    <View style={styles.root}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.navRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={colors.onSurfaceVariant} />
          </Pressable>
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: '90%' }]}>
                <View style={styles.progressDot} />
              </View>
            </View>
            <Text style={styles.stepLabel}>Step 9 of 10</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.headline}>Which style describes you best?</Text>
        <Text style={styles.subhead}>Pick the one that feels most like you.</Text>

        {OPTIONS.map((id) => {
          const { emoji, title, description } = LEARNER_STYLE_DISPLAY[id];
          const isSelected = selected === id;
          return (
            <Pressable
              key={id}
              onPress={() => setSelected(id)}
              style={({ pressed }) => [
                styles.card,
                isSelected && styles.cardSelected,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={[styles.iconWrap, isSelected && styles.iconWrapSelected]}>
                <Text style={styles.emoji}>{emoji}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
                  {title}
                </Text>
                <Text style={styles.cardSubtitle}>{description}</Text>
              </View>
              {isSelected && (
                <View style={styles.checkDot}><View style={styles.checkInner} /></View>
              )}
            </Pressable>
          );
        })}

        {/* Completion note */}
        {selected && (
          <View style={styles.completionNote}>
            <Sparkles size={16} color={colors.tertiary} />
            <View style={styles.completionBody}>
              <Text style={styles.completionTitle}>Last question done.</Text>
              <Text style={styles.completionSub}>Your plan is complete. Let's show you what's next.</Text>
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.footer}>
        <SafeAreaView edges={['bottom']}>
          <Pressable
            onPress={() => { if (selected) { onboardingStore.learnerStyle = selected; router.push('/onboarding_launch/leaderboard'); } }}
            disabled={!selected}
            style={[styles.ctaWrap, !selected && styles.ctaDisabled]}
          >
            <LinearGradient
              colors={selected ? [colors.primary, colors.primaryContainer] : [colors.surfaceContainerHigh, colors.surfaceContainerHigh]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              <Text style={[styles.ctaText, !selected && styles.ctaTextDisabled]}>Continue</Text>
              <ArrowRight size={20} color={selected ? colors.onPrimary : colors.outline} />
            </LinearGradient>
          </Pressable>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: { backgroundColor: `${colors.background}F5`, shadowColor: colors.onSurface, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  navRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12, gap: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceContainerLow, alignItems: 'center', justifyContent: 'center' },
  progressWrap: { flex: 1, gap: 6 },
  progressTrack: { height: 8, backgroundColor: colors.surfaceContainerHighest, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, position: 'relative' },
  progressDot: { position: 'absolute', right: 0, top: 0, height: '100%', width: 8, backgroundColor: colors.secondaryFixed, shadowColor: colors.secondaryFixed, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8 },
  stepLabel: { fontFamily: 'NunitoSans_700Bold', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.onSurfaceVariant },

  scroll: { paddingHorizontal: 24, paddingTop: 24 },
  headline: { fontFamily: 'Outfit_800ExtraBold', fontSize: 28, lineHeight: 36, color: colors.onPrimaryContainer, marginBottom: 10, letterSpacing: -0.3 },
  subhead: { fontFamily: 'NunitoSans_400Regular', fontSize: 14, lineHeight: 21, color: colors.onSurfaceVariant, marginBottom: 24 },

  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerLowest, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: `${colors.outlineVariant}1A`, shadowColor: colors.onSurface, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardSelected: { borderColor: `${colors.primary}33`, backgroundColor: colors.surfaceContainerLow, elevation: 4 },
  cardPressed: { transform: [{ scale: 0.98 }] },
  iconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  iconWrapSelected: { backgroundColor: `${colors.primary}1A` },
  emoji: { fontSize: 22 },
  cardBody: { flex: 1 },
  cardTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 15, color: colors.onSurface, marginBottom: 3 },
  cardTitleSelected: { color: colors.primary },
  cardSubtitle: { fontFamily: 'NunitoSans_400Regular', fontSize: 12, lineHeight: 17, color: colors.onSurfaceVariant },
  checkDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  checkInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.onPrimary },

  completionNote: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: `${colors.tertiary}10`, borderRadius: 14, padding: 14, marginTop: 6, gap: 10 },
  completionBody: { flex: 1 },
  completionTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 13, color: colors.tertiary, marginBottom: 2 },
  completionSub: { fontFamily: 'NunitoSans_400Regular', fontSize: 12, color: colors.onSurfaceVariant, lineHeight: 17 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 16, backgroundColor: `${colors.background}F5` },
  ctaWrap: { borderRadius: 24, overflow: 'hidden', shadowColor: colors.blueShadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 16, elevation: 8, marginBottom: 8 },
  ctaDisabled: { shadowOpacity: 0, elevation: 0 },
  cta: { paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 24 },
  ctaText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 16, color: colors.onPrimary, letterSpacing: 0.3 },
  ctaTextDisabled: { color: colors.outline },
});
