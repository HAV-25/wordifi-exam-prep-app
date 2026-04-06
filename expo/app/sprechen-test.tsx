import { Audio } from 'expo-av';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { CheckCircle, Mic } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CTA_BUTTON_HEIGHT = 56;    // primary CTA / footer height
const BOTTOM_CONTENT_BUFFER = 24; // breathing room below last content item
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CTAButton } from '@/components/CTAButton';
import { EmptyState } from '@/components/EmptyState';
import { SprechenQuestion } from '@/components/SprechenQuestion';
import { colors, fontSize, radius, shadows, spacing } from '@/theme';
import {
  fetchSprechenQuestions,
  fetchSprechenResponse,
  saveSelfRating,
  saveSprechenResponse,
  uploadRecording,
  SPRECHEN_STRUCTURE_LABELS,
} from '@/lib/sprechenHelpers';
import type { SprechenResponse } from '@/lib/sprechenHelpers';
import { updatePreparednessScore } from '@/lib/streamHelpers';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/providers/AuthProvider';
import type { AppQuestion } from '@/types/database';

type QuestionState = {
  existingResponse: SprechenResponse | null;
  isUploading: boolean;
  uploadError: string | null;
  isLoadingCached: boolean;
};

export default function SprechenTestScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    level?: string;
    teil?: string;
  }>();

  const { user, profile, refreshProfile } = useAuth();
  const userId = user?.id ?? '';

  const level = params.level ?? profile?.target_level ?? 'A1';
  const teil = Number(params.teil ?? '1');

  const [questions, setQuestions] = useState<AppQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    const loadQuestions = async () => {
      setIsLoadingQuestions(true);
      try {
        console.log('SprechenTest fetching questions for', level, 'teil', teil);
        const fetched = await fetchSprechenQuestions(level, teil);
        if (!cancelled) {
          console.log('SprechenTest fetched', fetched.length, 'questions');
          if (fetched.length > 0) {
            const q0 = fetched[0] as Record<string, unknown>;
            console.log('SprechenTest q0 audio_url=', q0.audio_url);
            console.log('SprechenTest q0 model_answer_audio_url=', q0.model_answer_audio_url);
            console.log('SprechenTest q0 partner_prompts=', JSON.stringify(q0.partner_prompts));
            console.log('SprechenTest q0 keys=', Object.keys(q0).filter(k => k.includes('audio') || k.includes('url') || k.includes('model') || k.includes('partner') || k.includes('rubric') || k.includes('recording')));
          }
          setQuestions(fetched);
        }
      } catch (err) {
        console.log('SprechenTest fetchQuestions error', err);
        if (!cancelled) setQuestions([]);
      } finally {
        if (!cancelled) setIsLoadingQuestions(false);
      }
    };
    void loadQuestions();
    return () => { cancelled = true; };
  }, [level, teil]);

  const structureType = questions[0]?.source_structure_type ?? '';
  const taskLabel = SPRECHEN_STRUCTURE_LABELS[structureType] ?? 'Sprechen';

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [questionStates, setQuestionStates] = useState<Record<number, QuestionState>>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState<boolean>(false);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const sessionStartTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    const setup = async () => {
      console.log('SprechenTest requesting mic permission & setting audio mode');
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
        console.log('SprechenTest audio mode set (playback)');
        const { status } = await Audio.requestPermissionsAsync();
        console.log('SprechenTest mic permission status', status);
        setHasMicPermission(status === 'granted');
      } catch (err) {
        console.log('SprechenTest setup error', err);
        setHasMicPermission(false);
      }
    };
    void setup();
  }, []);

  useEffect(() => {
    if (questions.length === 0 || !userId) return;

    const createSession = async () => {
      try {
        const examType = profile?.exam_type ?? 'TELC';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from('test_sessions') as any)
          .insert({
            user_id: userId,
            session_type: 'sectional',
            level,
            section: 'Sprechen',
            teil,
            exam_type: examType,
            score_pct: 0,
            questions_total: questions.length,
            questions_correct: 0,
            time_taken_seconds: 0,
            is_timed: false,
            completed_at: null,
          })
          .select('id')
          .single();

        if (error) {
          console.log('SprechenTest createSession error', error);
          return;
        }
        console.log('SprechenTest session created', (data as { id: string }).id);
        setSessionId((data as { id: string }).id);
      } catch (err) {
        console.log('SprechenTest createSession unexpected error', err);
      }
    };

    void createSession();
  }, [userId, level, teil, questions.length, profile?.exam_type]);

  useEffect(() => {
    if (questions.length === 0) return;
    const target = ((currentIndex + 1) / questions.length) * 100;
    Animated.timing(progressAnim, {
      toValue: target,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentIndex, questions.length, progressAnim]);

  const checkedIndicesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (questions.length === 0 || !userId) return;
    if (checkedIndicesRef.current.has(currentIndex)) return;

    const question = questions[currentIndex];
    if (!question) return;

    checkedIndicesRef.current.add(currentIndex);

    setQuestionStates((prev) => ({
      ...prev,
      [currentIndex]: {
        existingResponse: prev[currentIndex]?.existingResponse ?? null,
        isUploading: false,
        uploadError: null,
        isLoadingCached: true,
      },
    }));

    const idx = currentIndex;
    fetchSprechenResponse(userId, question.id)
      .then((cached) => {
        if (cached) {
          console.log('SprechenTest found cached response for question', idx);
        }
        setQuestionStates((prev) => ({
          ...prev,
          [idx]: {
            existingResponse: cached ?? null,
            isUploading: false,
            uploadError: null,
            isLoadingCached: false,
          },
        }));
      })
      .catch((err) => {
        console.log('SprechenTest checkCachedResponse error', err);
        setQuestionStates((prev) => ({
          ...prev,
          [idx]: {
            existingResponse: null,
            isUploading: false,
            uploadError: null,
            isLoadingCached: false,
          },
        }));
      });
  }, [currentIndex, questions, userId]);

  const currentQuestion = questions[currentIndex] ?? null;
  const currentState = questionStates[currentIndex] ?? {
    existingResponse: null,
    isUploading: false,
    uploadError: null,
    isLoadingCached: false,
  };

  const handleComplete = useCallback(async (recordingUri: string, durationSec: number) => {
    if (!currentQuestion || !userId) return;

    setQuestionStates((prev) => ({
      ...prev,
      [currentIndex]: {
        ...prev[currentIndex],
        existingResponse: null,
        isUploading: true,
        uploadError: null,
        isLoadingCached: false,
      },
    }));

    const timeoutId = setTimeout(() => {
      setQuestionStates((prev) => {
        const state = prev[currentIndex];
        if (state?.isUploading) {
          return {
            ...prev,
            [currentIndex]: {
              ...state,
              isUploading: false,
              uploadError: 'Aufnahme konnte nicht gespeichert werden. Bitte versuche es später.',
            },
          };
        }
        return prev;
      });
    }, 15000);

    try {
      const publicUrl = await uploadRecording(recordingUri, userId, currentQuestion.id);
      console.log('SprechenTest recording uploaded', publicUrl);

      await saveSprechenResponse({
        userId,
        questionId: currentQuestion.id,
        sessionId,
        recordingUrl: publicUrl,
        recordingDurationSec: durationSec,
      });

      clearTimeout(timeoutId);

      const response: SprechenResponse = {
        id: currentQuestion.id,
        recording_url: publicUrl,
        recording_duration_sec: durationSec,
        self_rating: null,
        submitted_at: new Date().toISOString(),
      };

      setQuestionStates((prev) => ({
        ...prev,
        [currentIndex]: {
          existingResponse: response,
          isUploading: false,
          uploadError: null,
          isLoadingCached: false,
        },
      }));
    } catch (err) {
      clearTimeout(timeoutId);
      console.log('SprechenTest handleComplete error', err);
      const errorMsg = err instanceof Error ? err.message : 'Aufnahme konnte nicht gespeichert werden. Bitte versuche es später.';
      setQuestionStates((prev) => ({
        ...prev,
        [currentIndex]: {
          ...prev[currentIndex],
          existingResponse: null,
          isUploading: false,
          uploadError: errorMsg,
          isLoadingCached: false,
        },
      }));
    }
  }, [currentQuestion, currentIndex, userId, sessionId]);

  const handleRetryUpload = useCallback(() => {
    setQuestionStates((prev) => ({
      ...prev,
      [currentIndex]: {
        existingResponse: null,
        isUploading: false,
        uploadError: null,
        isLoadingCached: false,
      },
    }));
  }, [currentIndex]);

  const handleSelfRate = useCallback(async (rating: number) => {
    if (!currentQuestion || !userId) return;
    await saveSelfRating(userId, currentQuestion.id, rating);
  }, [currentQuestion, userId]);

  const finishTest = useCallback(async () => {
    if (!sessionId || !userId) {
      setShowSummary(true);
      return;
    }

    try {
      const timeTaken = Math.max(1, Math.round((Date.now() - sessionStartTimeRef.current) / 1000));
      const completedCount = Object.values(questionStates).filter((s) => s.existingResponse).length;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('test_sessions') as any)
        .update({
          score_pct: completedCount > 0 ? Math.round((completedCount / questions.length) * 100) : 0,
          questions_correct: completedCount,
          time_taken_seconds: timeTaken,
          completed_at: new Date().toISOString(),
          retest_available_at: getRetestDate(),
        })
        .eq('id', sessionId);

      const today = new Date().toISOString().split('T')[0] ?? '';
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0] ?? '';
      let newStreak = profile?.streak_count ?? 0;
      if (profile?.last_active_date === yesterday) {
        newStreak = (profile?.streak_count ?? 0) + 1;
      } else if (profile?.last_active_date !== today) {
        newStreak = 1;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('user_profiles') as any)
        .update({
          xp_total: (profile?.xp_total ?? 0) + completedCount,
          last_active_date: today,
          streak_count: newStreak,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      await updatePreparednessScore(userId, 5);
      await refreshProfile();
    } catch (err) {
      console.log('SprechenTest finishTest error', err);
    }

    setShowSummary(true);
  }, [sessionId, userId, questionStates, questions.length, profile, refreshProfile]);

  const handleNext = useCallback(() => {
    if (currentIndex === questions.length - 1) {
      void finishTest();
      return;
    }
    setCurrentIndex((v) => v + 1);
  }, [currentIndex, questions.length, finishTest]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((v) => v - 1);
    }
  }, [currentIndex]);

  const handleBack = useCallback(() => {
    const hasAnswered = Object.values(questionStates).some((s) => s.existingResponse);
    if (hasAnswered) {
      Alert.alert('Diesen Test verlassen?', 'Dein Fortschritt geht verloren.', [
        { text: 'Bleiben', style: 'cancel' },
        { text: 'Verlassen', style: 'destructive', onPress: () => router.back() },
      ]);
      return;
    }
    router.back();
  }, [questionStates]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  if (hasMicPermission === null) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Sprechen', headerShown: true }} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.blue} size="large" />
          <Text style={styles.loadingText}>Mikrofon wird überprüft...</Text>
        </View>
      </View>
    );
  }

  if (hasMicPermission === false) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Sprechen', headerShown: true }} />
        <View style={styles.permissionWrap}>
          <View style={styles.permissionIcon}>
            <Mic color={colors.red} size={40} />
          </View>
          <Text style={styles.permissionTitle}>Mikrofon erforderlich</Text>
          <Text style={styles.permissionText}>
            Für die Sprechen-Übung wird der Zugriff auf Ihr Mikrofon benötigt. Bitte aktivieren Sie die Berechtigung in den Einstellungen.
          </Text>
          <CTAButton
            label="Zurück"
            onPress={() => router.back()}
            testID="sprechen-permission-back"
          />
        </View>
      </View>
    );
  }

  if (isLoadingQuestions) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Sprechen', headerShown: true }} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.blue} size="large" />
          <Text style={styles.loadingText}>Fragen werden geladen...</Text>
        </View>
      </View>
    );
  }

  if (questions.length === 0) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Sprechen', headerShown: true }} />
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Keine Sprechen-Fragen verfügbar"
            description="Wir fügen bald neue Inhalte hinzu."
            actionLabel="Zurück"
            onActionPress={() => router.back()}
            testID="sprechen-empty-state"
          />
        </View>
      </View>
    );
  }

  if (showSummary) {
    const completedCount = Object.values(questionStates).filter((s) => s.existingResponse).length;

    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Ergebnis', headerBackVisible: false }} />
        <ScrollView contentContainerStyle={[styles.summaryContent, { paddingBottom: insets.bottom + CTA_BUTTON_HEIGHT + BOTTOM_CONTENT_BUFFER }]} showsVerticalScrollIndicator={false}>
          <View style={[styles.summaryHero, shadows.card]}>
            <View style={styles.summaryIconWrap}>
              <Mic color={colors.white} size={24} />
            </View>
            <Text style={styles.summaryTitle}>Sprechen · Teil {teil}</Text>
            <Text style={styles.summarySubtitle}>{level} · {taskLabel}</Text>
            <Text style={styles.summaryScore}>
              {completedCount} von {questions.length}
            </Text>
            <Text style={styles.summaryLabel}>Aufgaben abgeschlossen</Text>
          </View>

          {questions.map((q, idx) => {
            const state = questionStates[idx];
            const hasResponse = Boolean(state?.existingResponse);
            return (
              <View key={q.id} style={[styles.summaryItem, shadows.card]}>
                <View style={styles.summaryItemHeader}>
                  <CheckCircle
                    color={hasResponse ? colors.green : colors.muted}
                    size={20}
                    fill={hasResponse ? colors.green : 'transparent'}
                  />
                  <Text style={styles.summaryItemTitle}>Aufgabe {idx + 1}</Text>
                  <Text style={[styles.summaryItemStatus, hasResponse ? styles.greenText : styles.mutedText]}>
                    {hasResponse ? 'Abgeschlossen' : 'Nicht abgeschlossen'}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.footer, { bottom: insets.bottom }]}>
          <CTAButton
            label="Zur Übersicht"
            onPress={() => router.replace('/(tabs)/tests')}
            style={styles.footerBtn}
            testID="sprechen-back-to-tests"
          />
        </View>
      </View>
    );
  }

  const isLoadingCached = currentState.isLoadingCached;
  const hasExistingResponse = Boolean(currentState.existingResponse);
  const isCurrentUploading = currentState.isUploading;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      <Stack.Screen
        options={{
          title: '',
          headerLeft: () => (
            <Pressable
              accessibilityLabel="Zurück"
              onPress={currentIndex > 0 ? handlePrev : handleBack}
              style={styles.headerBtn}
              testID="sprechen-back-button"
            >
              <Text style={styles.headerBtnText}>
                {currentIndex > 0 ? '← Zurück' : 'Zurück'}
              </Text>
            </Pressable>
          ),
        }}
      />

      <View style={styles.headerCard}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
        <View style={styles.headerRow}>
          <Text style={styles.counter}>
            Aufgabe {Math.min(currentIndex + 1, questions.length)} von {questions.length}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.sectionPill}>
              <Mic color={colors.white} size={11} />
              <Text style={styles.sectionPillText}>Sprechen</Text>
            </View>
            <Text style={styles.meta}>Teil {teil} · {level}</Text>
          </View>
        </View>
      </View>

      {isLoadingCached ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.blue} size="large" />
          <Text style={styles.loadingText}>Wird geladen...</Text>
        </View>
      ) : currentQuestion ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + CTA_BUTTON_HEIGHT + BOTTOM_CONTENT_BUFFER }]} showsVerticalScrollIndicator={false}>
          <SprechenQuestion
            question={currentQuestion}
            sessionId={sessionId}
            existingResponse={currentState.existingResponse}
            onComplete={handleComplete}
            onSelfRate={handleSelfRate}
            isUploading={isCurrentUploading}
            uploadError={currentState.uploadError}
            onRetryUpload={handleRetryUpload}
          />
        </ScrollView>
      ) : null}

      {(hasExistingResponse && !isCurrentUploading) ? (
        <View style={[styles.footer, { bottom: insets.bottom }]}>
          <CTAButton
            label={currentIndex === questions.length - 1 ? 'Ergebnisse ansehen' : 'Nächste Aufgabe →'}
            onPress={handleNext}
            style={styles.footerBtn}
            testID="sprechen-next"
          />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function getRetestDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0] ?? '';
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  emptyWrap: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  permissionWrap: {
    flex: 1,
    padding: spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  permissionIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(226,77,77,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  permissionTitle: {
    color: colors.navy,
    fontSize: fontSize.displaySm,
    fontWeight: '800' as const,
    textAlign: 'center',
  },
  permissionText: {
    color: colors.muted,
    fontSize: fontSize.bodyMd,
    fontWeight: '500' as const,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.xl,
  },
  headerBtn: {
    minHeight: 40,
    justifyContent: 'center',
    paddingRight: spacing.md,
  },
  headerBtnText: {
    color: colors.navy,
    fontWeight: '700' as const,
    fontSize: fontSize.bodyMd,
  },
  headerCard: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.ringTrack,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.blue,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  counter: {
    color: colors.navy,
    fontWeight: '800' as const,
    fontSize: fontSize.bodyMd,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: '#00897B',
  },
  sectionPillText: {
    color: colors.white,
    fontSize: fontSize.micro,
    fontWeight: '700' as const,
  },
  meta: {
    color: colors.muted,
    fontWeight: '600' as const,
    fontSize: fontSize.bodySm,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
    paddingBottom: 140,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  footerBtn: {
    marginHorizontal: 0,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.bodyMd,
    color: colors.muted,
    fontWeight: '600' as const,
  },
  summaryContent: {
    padding: spacing.xl,
    gap: spacing.lg,
    paddingBottom: 140,
  },
  summaryHero: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#00897B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  summaryTitle: {
    fontSize: fontSize.displaySm,
    fontWeight: '800' as const,
    color: colors.white,
  },
  summarySubtitle: {
    fontSize: fontSize.bodyMd,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '600' as const,
  },
  summaryScore: {
    fontSize: 34,
    fontWeight: '800' as const,
    color: colors.white,
    marginTop: spacing.md,
  },
  summaryLabel: {
    fontSize: fontSize.bodyMd,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '600' as const,
  },
  summaryItem: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  summaryItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryItemTitle: {
    fontSize: fontSize.bodyMd,
    fontWeight: '700' as const,
    color: colors.navy,
    flex: 1,
  },
  summaryItemStatus: {
    fontSize: fontSize.bodySm,
    fontWeight: '700' as const,
  },
  greenText: {
    color: colors.green,
  },
  mutedText: {
    color: colors.muted,
  },
});
