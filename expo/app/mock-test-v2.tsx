/**
 * Mock Test V2 — Digital Exam Lite
 *
 * Phase state machine driven by examBlueprint.ts.
 * Sections play sequentially with natural breaks (Continue / Pause & resume).
 * Save/resume via mock_tests.saved_state within 24h window.
 *
 * Gated behind MOCK_V2_ENABLED feature flag — if false, redirects to old /mock-test.
 */
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Pause, Trophy } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/colors';
import { B } from '@/theme/banani';
import {
  type ExamBlueprintSection,
  type ExamSectionKey,
  getBlueprint,
} from '@/lib/examBlueprint';
import { MOCK_V2_ENABLED } from '@/lib/featureFlags';
import { useAuth } from '@/providers/AuthProvider';

// ─── Phase state machine ──────────────────────────────────────────────────────
type Phase =
  | { type: 'loading' }
  | { type: 'section'; sectionIndex: number }
  | { type: 'transition'; fromSectionIndex: number }
  | { type: 'submitting' }
  | { type: 'completed' };

// Per-section results collected during the test run
type SectionResult = {
  section: ExamSectionKey;
  scorePct: number;  // 0-100, -1 = not yet scored (Schreiben/Sprechen aggregate inline)
  questionsCorrect?: number;
  questionsTotal?: number;
  timeTakenSeconds: number;
};

export default function MockTestV2Screen() {
  const params = useLocalSearchParams<{ level?: string; mockTestId?: string }>();
  const { profile } = useAuth();
  const level = params.level ?? profile?.target_level ?? 'B1';

  const blueprint = useMemo(() => getBlueprint(level), [level]);

  const [phase, setPhase] = useState<Phase>({ type: 'loading' });
  const [results, setResults] = useState<SectionResult[]>([]);
  const mockTestId = params.mockTestId ?? '';

  // ── Feature flag gate ────────────────────────────────────────────────────
  useEffect(() => {
    if (!MOCK_V2_ENABLED) {
      console.log('[MockV2] Flag OFF — redirecting to /mock-test');
      router.replace('/mock-test');
      return;
    }
    // Start with first section
    setPhase({ type: 'section', sectionIndex: 0 });
  }, []);

  // ── Android back button handler ──────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handlePauseAndExit();
      return true; // prevent default
    });
    return () => sub.remove();
  }, []);

  // ── Phase transitions ────────────────────────────────────────────────────
  const handleSectionComplete = useCallback((result: SectionResult) => {
    setResults((prev) => [...prev, result]);
    setPhase((prev) => {
      if (prev.type !== 'section') return prev;
      return { type: 'transition', fromSectionIndex: prev.sectionIndex };
    });
  }, []);

  const handleContinueToNext = useCallback(() => {
    setPhase((prev) => {
      if (prev.type !== 'transition') return prev;
      const nextIndex = prev.fromSectionIndex + 1;
      if (nextIndex >= blueprint.length) {
        return { type: 'submitting' };
      }
      return { type: 'section', sectionIndex: nextIndex };
    });
  }, [blueprint.length]);

  const handlePauseAndExit = useCallback(() => {
    Alert.alert(
      'Pause Mock Test?',
      'Your progress will be saved. You can resume from the Mock Test tab within 24 hours.',
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'Save & exit',
          style: 'destructive',
          onPress: () => {
            // TODO Phase 3: save state to mock_tests.saved_state
            console.log('[MockV2] Pause & exit — save state here');
            router.back();
          },
        },
      ]
    );
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────
  if (phase.type === 'loading') {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Mock Test', headerShown: true }} />
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Preparing your mock exam...</Text>
      </View>
    );
  }

  if (phase.type === 'section') {
    const section = blueprint[phase.sectionIndex]!;
    return (
      <SafeAreaView style={styles.screen}>
        <Stack.Screen options={{ title: '', headerShown: true, headerBackVisible: false }} />
        <SectionPlaceholder
          level={level}
          section={section}
          sectionIndex={phase.sectionIndex}
          totalSections={blueprint.length}
          onComplete={handleSectionComplete}
          onPause={handlePauseAndExit}
        />
      </SafeAreaView>
    );
  }

  if (phase.type === 'transition') {
    const completedSection = blueprint[phase.fromSectionIndex]!;
    const lastResult = results[results.length - 1];
    const nextSection = blueprint[phase.fromSectionIndex + 1];
    const isLastSection = phase.fromSectionIndex === blueprint.length - 1;

    return (
      <SafeAreaView style={styles.screen}>
        <Stack.Screen options={{ title: '', headerShown: true, headerBackVisible: false }} />
        <TransitionScreen
          completedSection={completedSection}
          lastResult={lastResult ?? null}
          nextSection={nextSection}
          isLastSection={isLastSection}
          onContinue={handleContinueToNext}
          onPause={handlePauseAndExit}
        />
      </SafeAreaView>
    );
  }

  if (phase.type === 'submitting') {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Scoring', headerShown: true, headerBackVisible: false }} />
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Calculating your results...</Text>
      </View>
    );
  }

  return null;
}

// ─── Section placeholder (Phase 2 will replace with real players) ───────────
function SectionPlaceholder({
  level,
  section,
  sectionIndex,
  totalSections,
  onComplete,
  onPause,
}: {
  level: string;
  section: ExamBlueprintSection;
  sectionIndex: number;
  totalSections: number;
  onComplete: (result: SectionResult) => void;
  onPause: () => void;
}) {
  return (
    <View style={styles.placeholderWrap}>
      <Text style={styles.placeholderLabel}>
        Section {sectionIndex + 1} of {totalSections}
      </Text>
      <Text style={styles.placeholderTitle}>{section.section}</Text>
      <Text style={styles.placeholderSub}>
        {level} · {section.timeMinutes} min · {section.teils.length} Teile
      </Text>
      <Text style={styles.placeholderNote}>
        Section player coming in Phase 2. Tap below to simulate completion.
      </Text>
      <Pressable
        style={styles.simulateBtn}
        onPress={() =>
          onComplete({
            section: section.section,
            scorePct: 75,
            questionsCorrect: 15,
            questionsTotal: 20,
            timeTakenSeconds: 120,
          })
        }
      >
        <Text style={styles.simulateBtnText}>Simulate: Complete with 75%</Text>
      </Pressable>
      <Pressable style={styles.pauseBtn} onPress={onPause}>
        <Pause color={B.muted} size={16} />
        <Text style={styles.pauseBtnText}>Pause & resume later</Text>
      </Pressable>
    </View>
  );
}

// ─── Transition screen between sections ─────────────────────────────────────
function TransitionScreen({
  completedSection,
  lastResult,
  nextSection,
  isLastSection,
  onContinue,
  onPause,
}: {
  completedSection: ExamBlueprintSection;
  lastResult: SectionResult | null;
  nextSection: ExamBlueprintSection | undefined;
  isLastSection: boolean;
  onContinue: () => void;
  onPause: () => void;
}) {
  const scoreText = lastResult
    ? lastResult.questionsCorrect != null
      ? `${lastResult.questionsCorrect}/${lastResult.questionsTotal} · ${Math.round(lastResult.scorePct)}%`
      : 'Submitted for AI evaluation'
    : '';

  return (
    <View style={styles.transitionWrap}>
      <View style={styles.transitionCheck}>
        <Trophy color={B.success} size={40} />
      </View>
      <Text style={styles.transitionTitle}>{completedSection.section} complete</Text>
      {scoreText ? <Text style={styles.transitionScore}>{scoreText}</Text> : null}

      <View style={styles.transitionDivider} />

      {isLastSection ? (
        <>
          <Text style={styles.transitionNextLabel}>All sections complete</Text>
          <Text style={styles.transitionNextName}>Tap below to see your results</Text>
          <Pressable style={styles.continueBtn} onPress={onContinue}>
            <Text style={styles.continueBtnText}>See my results</Text>
            <ArrowRight color="#fff" size={20} />
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.transitionNextLabel}>Next section</Text>
          <Text style={styles.transitionNextName}>{nextSection?.section}</Text>
          <Text style={styles.transitionNextMeta}>
            {nextSection?.timeMinutes} min · {nextSection?.teils.length} Teile
          </Text>

          <Pressable style={styles.continueBtn} onPress={onContinue}>
            <Text style={styles.continueBtnText}>Continue to {nextSection?.section}</Text>
            <ArrowRight color="#fff" size={20} />
          </Pressable>

          <Pressable style={styles.pauseLink} onPress={onPause}>
            <Pause color={B.muted} size={14} />
            <Text style={styles.pauseLinkText}>Pause & resume later</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: B.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: B.background },
  loadingText: { fontSize: 15, fontWeight: '600' as const, color: B.muted },

  // Placeholder (Phase 2 will replace)
  placeholderWrap: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 },
  placeholderLabel: { fontSize: 13, fontWeight: '700' as const, color: B.muted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  placeholderTitle: { fontSize: 28, fontWeight: '800' as const, color: B.questionColor },
  placeholderSub: { fontSize: 14, fontWeight: '600' as const, color: B.muted },
  placeholderNote: { fontSize: 13, color: B.muted, textAlign: 'center', marginTop: 12, paddingHorizontal: 24 },
  simulateBtn: {
    marginTop: 20,
    backgroundColor: B.primary,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  simulateBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' as const },
  pauseBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, marginTop: 8 },
  pauseBtnText: { fontSize: 13, fontWeight: '600' as const, color: B.muted },

  // Transition screen
  transitionWrap: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center', gap: 12 },
  transitionCheck: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  transitionTitle: { fontSize: 26, fontWeight: '800' as const, color: B.questionColor, textAlign: 'center' },
  transitionScore: { fontSize: 18, fontWeight: '700' as const, color: B.primary, marginTop: 4 },
  transitionDivider: { width: '60%', height: 1, backgroundColor: B.border, marginVertical: 20 },
  transitionNextLabel: { fontSize: 12, fontWeight: '700' as const, color: B.muted, textTransform: 'uppercase' as const, letterSpacing: 0.6 },
  transitionNextName: { fontSize: 22, fontWeight: '800' as const, color: B.primary, marginTop: 4 },
  transitionNextMeta: { fontSize: 14, fontWeight: '600' as const, color: B.muted, marginTop: 4, marginBottom: 24 },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    backgroundColor: B.primary,
    borderRadius: 999,
    paddingVertical: 18, paddingHorizontal: 32,
    minWidth: 240,
    shadowColor: B.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 4,
    marginTop: 8,
  },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' as const },
  pauseLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 16, marginTop: 4 },
  pauseLinkText: { fontSize: 14, fontWeight: '600' as const, color: B.muted },
});
