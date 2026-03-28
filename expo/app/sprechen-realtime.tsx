import { Audio } from 'expo-av';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { AlertCircle, Mic, MicOff, PhoneOff, RefreshCw, Star, Timer } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AudioPlayer } from '@/components/AudioPlayer';
import { CTAButton } from '@/components/CTAButton';
import { colors, fontSize, radius, shadows, spacing } from '@/theme';
import { fetchSprechenQuestions } from '@/lib/sprechenHelpers';
import { SPRECHEN_STRUCTURE_LABELS } from '@/lib/sprechenHelpers';
import {
  createSprechenSession,
  scoreSprechenConversation,
  createRealtimeSession,
  isWebRTCAvailable,
  NativeWSRealtimeSession,
} from '@/lib/realtimeSession';
import type {
  ConversationState,
  SprechenScores,
  TranscriptEntry,
  IRealtimeSession,
} from '@/lib/realtimeSession';
import { useAuth } from '@/providers/AuthProvider';
import type { AppQuestion } from '@/types/database';

type ScreenState =
  | 'loading'
  | 'instruction'
  | 'connecting'
  | 'conversation'
  | 'scoring'
  | 'results'
  | 'error';

export default function SprechenRealtimeScreen() {
  const params = useLocalSearchParams<{ level?: string; teil?: string }>();
  const { user, session, profile } = useAuth();
  const _userId = user?.id ?? '';
  const accessToken = session?.access_token ?? '';

  const level = params.level ?? profile?.target_level ?? 'B1';
  const teil = Number(params.teil ?? '1');

  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [question, setQuestion] = useState<AppQuestion | null>(null);
  const [convState, setConvState] = useState<ConversationState>('idle');
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [currentAiText, setCurrentAiText] = useState<string>('');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [scores, setScores] = useState<SprechenScores | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [moderatorFinished, setModeratorFinished] = useState<boolean>(false);
  const [isNativeRecording, setIsNativeRecording] = useState<boolean>(false);

  const sessionRef = useRef<IRealtimeSession | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const isWebRTC = isWebRTCAvailable();

  const MAX_DURATION = 240;

  const partnerPromptsMemo = React.useMemo(() => {
    const raw = (question as Record<string, unknown> | null);
    return (raw?.partner_prompts as Array<{ turn: number; audio_script: string; label: string; audio_url?: string }> | null) ?? [];
  }, [question]);

  const structureType = question?.source_structure_type ?? '';
  const taskLabel = SPRECHEN_STRUCTURE_LABELS[structureType] ?? 'Sprechen';
  const questionRaw = question as Record<string, unknown> | null;
  const rubricCard = (questionRaw?.rubric_card as Record<string, string> | null) ?? null;
  const moderatorAudioUrl = (questionRaw?.audio_url as string | null) ?? (questionRaw?.moderator_audio_url as string | null) ?? null;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        console.log('[SprechenRealtime] Fetching questions for', level, 'teil', teil);
        const fetched = await fetchSprechenQuestions(level, teil, 1);
        if (!cancelled && fetched.length > 0) {
          setQuestion(fetched[0]!);
          setScreenState('instruction');
          console.log('[SprechenRealtime] Question loaded:', fetched[0]!.id);
        } else if (!cancelled) {
          setErrorMsg('Keine Sprechen-Fragen verfügbar');
          setScreenState('error');
        }
      } catch (err) {
        console.log('[SprechenRealtime] Load error:', err);
        if (!cancelled) {
          setErrorMsg('Fragen konnten nicht geladen werden');
          setScreenState('error');
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [level, teil]);

  useEffect(() => {
    if (convState === 'ai_speaking' || convState === 'listening' || convState === 'connected') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    pulseAnim.setValue(1);
    return undefined;
  }, [convState, pulseAnim]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      sessionRef.current?.disconnect();
    };
  }, []);

  const handleEndRef = useRef<(() => Promise<void>) | null>(null);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSeconds(elapsed);
      if (elapsed >= MAX_DURATION) {
        void handleEndRef.current?.();
      }
    }, 1000);
  }, []);

  const handleStartConversation = useCallback(async () => {
    if (!question || !accessToken) return;

    setScreenState('connecting');
    setErrorMsg(null);

    try {
      if (Platform.OS !== 'web') {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Mikrofon-Berechtigung erforderlich');
          setScreenState('error');
          return;
        }
      }

      const turn1Text = partnerPromptsMemo.length > 0
        ? partnerPromptsMemo[0]?.audio_script ?? ''
        : '';

      const { client_secret, session_id } = await createSprechenSession({
        question_id: question.id,
        level: question.level,
        topic: question.question_text,
        turn1_text: turn1Text,
        partner_prompts: partnerPromptsMemo,
        rubric_card: rubricCard,
        accessToken,
      });

      sessionIdRef.current = session_id;

      const realtimeSession = createRealtimeSession({
        onStateChange: (state) => {
          console.log('[SprechenRealtime] Conv state:', state);
          setConvState(state);
        },
        onTranscript: (entry) => {
          console.log('[SprechenRealtime] Transcript:', entry.role, entry.text.slice(0, 50));
          setTranscriptEntries(prev => [...prev, entry]);
          setCurrentAiText('');
        },
        onAiSpeakingText: (delta) => {
          setCurrentAiText(prev => prev + delta);
        },
        onError: (msg) => {
          console.log('[SprechenRealtime] Error:', msg);
          setErrorMsg(msg);
        },
      });

      if (realtimeSession instanceof NativeWSRealtimeSession) {
        realtimeSession.onAiAudioReady = () => {
          console.log('[SprechenRealtime] AI audio finished, ready for user');
        };
        realtimeSession.onNeedUserAudio = () => {
          console.log('[SprechenRealtime] Server needs user audio');
        };
      }

      sessionRef.current = realtimeSession;
      await realtimeSession.connect(client_secret);

      setScreenState('conversation');
      startTimer();
    } catch (err) {
      console.log('[SprechenRealtime] Start error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Verbindung fehlgeschlagen');
      setScreenState('error');
    }
  }, [question, accessToken, partnerPromptsMemo, rubricCard, startTimer]);

  const handleEndConversation = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const transcript = sessionRef.current?.fullTranscript ?? '';
    sessionRef.current?.disconnect();
    sessionRef.current = null;

    if (!question || !accessToken) {
      setScreenState('instruction');
      return;
    }

    setScreenState('scoring');

    try {
      const result = await scoreSprechenConversation({
        question_id: question.id,
        level: question.level,
        source_structure_type: question.source_structure_type,
        transcript,
        rubric_card: rubricCard,
        duration_seconds: elapsedSeconds,
        accessToken,
      });

      setScores(result);
      setScreenState('results');
    } catch (err) {
      console.log('[SprechenRealtime] Scoring error:', err);
      setScores({
        overall: 0,
        fluency: 0,
        grammar: 0,
        vocabulary: 0,
        encouragement_note: 'Bewertung konnte nicht geladen werden.',
        improvement_tip: '',
        task_completion: false,
      });
      setScreenState('results');
    }
  }, [question, accessToken, rubricCard, elapsedSeconds]);

  useEffect(() => {
    handleEndRef.current = handleEndConversation;
  }, [handleEndConversation]);

  const handleNativeRecord = useCallback(async () => {
    const s = sessionRef.current;
    if (!(s instanceof NativeWSRealtimeSession)) return;

    if (s.isRecording) {
      setIsNativeRecording(false);
      await s.stopRecordingAndSend();
    } else {
      setIsNativeRecording(true);
      await s.startRecording();
    }
  }, []);

  const handleRetry = useCallback(() => {
    setErrorMsg(null);
    setTranscriptEntries([]);
    setCurrentAiText('');
    setElapsedSeconds(0);
    setScores(null);
    setConvState('idle');
    setModeratorFinished(false);
    setScreenState('instruction');
  }, []);

  const formatTime = useCallback((seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  const getStatusLabel = (): string => {
    switch (convState) {
      case 'connecting': return 'Verbinde...';
      case 'connected': return 'Verbunden';
      case 'ai_speaking': return 'Partner spricht...';
      case 'listening': return 'Zuhören...';
      default: return '';
    }
  };

  const getStatusColor = (): string => {
    switch (convState) {
      case 'connecting': return colors.muted;
      case 'connected': return colors.blue;
      case 'ai_speaking': return colors.green;
      case 'listening': return colors.blue;
      default: return colors.muted;
    }
  };

  const renderTaskCard = () => {
    if (!question) return null;
    return (
      <View style={[styles.taskCard, shadows.card]}>
        <Text style={styles.taskCardTitle}>Thema</Text>
        <Text style={styles.taskCardText}>{question.question_text}</Text>
        {question.stimulus_text ? (
          <Text style={styles.taskCardStimulus}>{question.stimulus_text}</Text>
        ) : null}
      </View>
    );
  };

  const renderOptions = () => {
    if (!question?.options || question.options.length === 0) return null;
    const opts = question.options as Array<{ key: string; text: string }>;
    return (
      <View style={[styles.optionsCard, shadows.card]}>
        <Text style={styles.optionsHeader}>Gesprächspunkte</Text>
        {opts.map((opt, idx) => (
          <View key={opt.key ?? String(idx)} style={styles.optionRow}>
            <View style={styles.optionDot} />
            <Text style={styles.optionText}>{opt.text}</Text>
          </View>
        ))}
      </View>
    );
  };

  if (screenState === 'loading') {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Sprechen', headerShown: true }} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.blue} size="large" />
          <Text style={styles.loadingText}>Fragen werden geladen...</Text>
        </View>
      </View>
    );
  }

  if (screenState === 'error') {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Sprechen', headerShown: true }} />
        <View style={styles.center}>
          <View style={styles.errorIcon}>
            <AlertCircle color={colors.red} size={40} />
          </View>
          <Text style={styles.errorTitle}>Fehler</Text>
          <Text style={styles.errorText}>{errorMsg ?? 'Unbekannter Fehler'}</Text>
          <View style={styles.errorActions}>
            <CTAButton label="Erneut versuchen" onPress={handleRetry} testID="realtime-retry" />
            <Pressable onPress={() => router.back()} style={styles.backLink} testID="realtime-back">
              <Text style={styles.backLinkText}>Zurück</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (screenState === 'instruction') {
    return (
      <View style={styles.screen}>
        <Stack.Screen
          options={{
            title: `${level} Sprechen · Teil ${teil}`,
            headerShown: true,
          }}
        />
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.instructionHeader}>
            <View style={styles.sectionPill}>
              <Mic color={colors.white} size={12} />
              <Text style={styles.sectionPillText}>Live-Gespräch</Text>
            </View>
            <Text style={styles.instructionSubtitle}>{taskLabel}</Text>
          </View>

          {renderTaskCard()}
          {renderOptions()}

          {moderatorAudioUrl ? (
            <View style={styles.moderatorWrap}>
              <Text style={styles.moderatorLabel}>Aufgabe anhören</Text>
              <AudioPlayer audioUrl={moderatorAudioUrl} onFirstPlay={() => setModeratorFinished(true)} />
            </View>
          ) : null}

          {!moderatorAudioUrl ? (
            <View style={styles.noModeratorNote}>
              <Text style={styles.noModeratorText}>
                Drücken Sie unten, um das Live-Gespräch mit dem KI-Partner zu beginnen.
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <CTAButton
            label="Gespräch beginnen"
            onPress={handleStartConversation}
            disabled={moderatorAudioUrl != null && !moderatorFinished}
            testID="realtime-start"
          />
        </View>
      </View>
    );
  }

  if (screenState === 'connecting') {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Verbinde...', headerShown: true }} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.blue} size="large" />
          <Text style={styles.loadingText}>KI-Partner wird verbunden...</Text>
        </View>
      </View>
    );
  }

  if (screenState === 'conversation') {
    const statusLabel = getStatusLabel();
    const statusColor = getStatusColor();
    const timeRemaining = MAX_DURATION - elapsedSeconds;
    const isTimeLow = timeRemaining <= 30;

    return (
      <View style={styles.screen}>
        <Stack.Screen
          options={{
            title: '',
            headerShown: true,
            headerLeft: () => null,
          }}
        />

        <View style={styles.convHeader}>
          <Text style={styles.convTitle}>{level} Sprechen · Teil {teil}</Text>
          <Text style={styles.convSubtitle}>{question?.question_text?.slice(0, 60) ?? ''}</Text>
        </View>

        <View style={styles.statusBar}>
          <View style={styles.statusLeft}>
            <Animated.View
              style={[
                styles.statusDot,
                { backgroundColor: statusColor, opacity: pulseAnim },
              ]}
            />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          <View style={styles.timerWrap}>
            <Timer color={isTimeLow ? colors.red : colors.navy} size={14} />
            <Text style={[styles.timerText, isTimeLow && styles.timerTextRed]}>
              {formatTime(elapsedSeconds)}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.transcriptScroll}
          contentContainerStyle={styles.transcriptContent}
          showsVerticalScrollIndicator={false}
        >
          {renderTaskCard()}

          {transcriptEntries.map((entry, idx) => (
            <View
              key={String(idx)}
              style={[
                styles.bubble,
                entry.role === 'assistant' ? styles.bubbleAi : styles.bubbleUser,
              ]}
            >
              <Text style={styles.bubbleRole}>
                {entry.role === 'assistant' ? 'Partner' : 'Sie'}
              </Text>
              <Text style={styles.bubbleText}>{entry.text}</Text>
            </View>
          ))}

          {currentAiText ? (
            <View style={[styles.bubble, styles.bubbleAi]}>
              <Text style={styles.bubbleRole}>Partner</Text>
              <Text style={styles.bubbleText}>{currentAiText}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.convFooter}>
          {!isWebRTC && (
            <Pressable
              onPress={handleNativeRecord}
              style={[
                styles.recordBtn,
                isNativeRecording && styles.recordBtnActive,
              ]}
              testID="realtime-native-record"
            >
              {isNativeRecording ? (
                <MicOff color={colors.white} size={20} />
              ) : (
                <Mic color={colors.white} size={20} />
              )}
              <Text style={styles.recordBtnText}>
                {isNativeRecording ? 'Senden' : 'Sprechen'}
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => {
              Alert.alert(
                'Gespräch beenden?',
                'Das Gespräch wird bewertet.',
                [
                  { text: 'Weiter', style: 'cancel' },
                  { text: 'Beenden', style: 'destructive', onPress: () => void handleEndConversation() },
                ]
              );
            }}
            style={styles.endBtn}
            testID="realtime-end"
          >
            <PhoneOff color={colors.red} size={16} />
            <Text style={styles.endBtnText}>Gespräch beenden</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (screenState === 'scoring') {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Bewertung', headerShown: true, headerBackVisible: false }} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.blue} size="large" />
          <Text style={styles.loadingText}>Ihre Antwort wird bewertet...</Text>
        </View>
      </View>
    );
  }

  if (screenState === 'results' && scores) {
    const starCount = Math.max(0, Math.min(5, Math.round(scores.overall)));

    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Ergebnis', headerShown: true, headerBackVisible: false }} />
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.resultsHero, shadows.card]}>
            <View style={styles.resultsIconWrap}>
              <Mic color={colors.white} size={24} />
            </View>
            <Text style={styles.resultsTitle}>Sprechen · Teil {teil}</Text>
            <Text style={styles.resultsSubtitle}>{level} · {taskLabel}</Text>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(s => (
                <Star
                  key={s}
                  color={s <= starCount ? '#FFD700' : 'rgba(255,255,255,0.3)'}
                  fill={s <= starCount ? '#FFD700' : 'transparent'}
                  size={28}
                />
              ))}
            </View>
            <Text style={styles.resultsScoreLabel}>{scores.overall} / 5</Text>
          </View>

          <View style={[styles.scoresCard, shadows.card]}>
            <Text style={styles.scoresHeader}>Detailbewertung</Text>
            {[
              { label: 'Flüssigkeit', value: scores.fluency },
              { label: 'Grammatik', value: scores.grammar },
              { label: 'Wortschatz', value: scores.vocabulary },
            ].map(item => (
              <View key={item.label} style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>{item.label}</Text>
                <View style={styles.scoreBarTrack}>
                  <View style={[styles.scoreBarFill, { width: `${(item.value / 5) * 100}%` }]} />
                </View>
                <Text style={styles.scoreValue}>{item.value}/5</Text>
              </View>
            ))}
          </View>

          {scores.task_completion ? (
            <View style={[styles.badgeCard, shadows.card]}>
              <Text style={styles.badgeEmoji}>✅</Text>
              <Text style={styles.badgeText}>Aufgabe erfüllt</Text>
            </View>
          ) : null}

          {scores.encouragement_note ? (
            <View style={[styles.feedbackCard, shadows.card]}>
              <Text style={styles.feedbackLabel}>Feedback</Text>
              <Text style={styles.feedbackText}>{scores.encouragement_note}</Text>
            </View>
          ) : null}

          {scores.improvement_tip ? (
            <View style={[styles.tipCard, shadows.card]}>
              <Text style={styles.tipLabel}>Verbesserungsvorschlag</Text>
              <Text style={styles.tipText}>{scores.improvement_tip}</Text>
            </View>
          ) : null}

          <Text style={styles.durationNote}>
            Gesprächsdauer: {formatTime(elapsedSeconds)}
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          <CTAButton
            label="Zur Übersicht"
            onPress={() => router.replace('/(tabs)/tests')}
            testID="realtime-back-to-tests"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Sprechen', headerShown: true }} />
      <View style={styles.center}>
        <RefreshCw color={colors.muted} size={32} />
        <Pressable onPress={handleRetry} style={styles.backLink}>
          <Text style={styles.backLinkText}>Neu laden</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xxl,
  },
  loadingText: {
    fontSize: fontSize.bodyMd,
    color: colors.muted,
    fontWeight: '600' as const,
  },
  scrollContent: {
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
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  instructionSubtitle: {
    color: colors.muted,
    fontSize: fontSize.bodySm,
    fontWeight: '600' as const,
  },
  taskCard: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  taskCardTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: fontSize.label,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  taskCardText: {
    color: colors.white,
    fontSize: fontSize.bodyLg,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  taskCardStimulus: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.bodyMd,
    fontWeight: '500' as const,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  optionsCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  optionsHeader: {
    color: colors.muted,
    fontSize: fontSize.label,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  optionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.blue,
    marginTop: 7,
  },
  optionText: {
    color: colors.text,
    fontSize: fontSize.bodyMd,
    fontWeight: '500' as const,
    flex: 1,
    lineHeight: 22,
  },
  moderatorWrap: {
    gap: spacing.sm,
  },
  moderatorLabel: {
    color: colors.muted,
    fontSize: fontSize.label,
    fontWeight: '600' as const,
    paddingHorizontal: spacing.xs,
  },
  noModeratorNote: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  noModeratorText: {
    color: colors.muted,
    fontSize: fontSize.bodyMd,
    fontWeight: '500' as const,
    lineHeight: 22,
    textAlign: 'center',
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(226,77,77,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    color: colors.navy,
    fontSize: fontSize.displaySm,
    fontWeight: '800' as const,
  },
  errorText: {
    color: colors.muted,
    fontSize: fontSize.bodyMd,
    fontWeight: '500' as const,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.xl,
  },
  errorActions: {
    gap: spacing.md,
    width: '100%',
    paddingTop: spacing.md,
  },
  backLink: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  backLinkText: {
    color: colors.blue,
    fontSize: fontSize.bodyMd,
    fontWeight: '700' as const,
  },
  convHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: 2,
  },
  convTitle: {
    color: colors.navy,
    fontSize: fontSize.bodyLg,
    fontWeight: '800' as const,
  },
  convSubtitle: {
    color: colors.muted,
    fontSize: fontSize.bodySm,
    fontWeight: '500' as const,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: fontSize.bodyMd,
    fontWeight: '600' as const,
  },
  timerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerText: {
    color: colors.navy,
    fontSize: fontSize.bodyMd,
    fontWeight: '800' as const,
    fontVariant: ['tabular-nums'],
  },
  timerTextRed: {
    color: colors.red,
  },
  transcriptScroll: {
    flex: 1,
  },
  transcriptContent: {
    padding: spacing.xl,
    gap: spacing.md,
    paddingBottom: 160,
  },
  bubble: {
    borderRadius: radius.lg,
    padding: spacing.md,
    maxWidth: '85%',
  },
  bubbleAi: {
    backgroundColor: colors.white,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: colors.blue,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleRole: {
    fontSize: fontSize.label,
    fontWeight: '700' as const,
    color: colors.muted,
    marginBottom: 2,
  },
  bubbleText: {
    fontSize: fontSize.bodyMd,
    fontWeight: '500' as const,
    color: colors.text,
    lineHeight: 22,
  },
  convFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.blue,
  },
  recordBtnActive: {
    backgroundColor: colors.red,
  },
  recordBtnText: {
    color: colors.white,
    fontSize: fontSize.bodyMd,
    fontWeight: '700' as const,
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.red,
  },
  endBtnText: {
    color: colors.red,
    fontSize: fontSize.bodyMd,
    fontWeight: '700' as const,
  },
  resultsHero: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultsIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#00897B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  resultsTitle: {
    fontSize: fontSize.displaySm,
    fontWeight: '800' as const,
    color: colors.white,
  },
  resultsSubtitle: {
    fontSize: fontSize.bodyMd,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '600' as const,
  },
  starsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  resultsScoreLabel: {
    fontSize: fontSize.bodyLg,
    fontWeight: '800' as const,
    color: colors.white,
    marginTop: spacing.xs,
  },
  scoresCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  scoresHeader: {
    color: colors.navy,
    fontSize: fontSize.bodyLg,
    fontWeight: '800' as const,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scoreLabel: {
    color: colors.muted,
    fontSize: fontSize.bodySm,
    fontWeight: '600' as const,
    width: 85,
  },
  scoreBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.ringTrack,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.blue,
  },
  scoreValue: {
    color: colors.navy,
    fontSize: fontSize.bodySm,
    fontWeight: '800' as const,
    width: 30,
    textAlign: 'right' as const,
  },
  badgeCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  badgeEmoji: {
    fontSize: 24,
  },
  badgeText: {
    color: colors.green,
    fontSize: fontSize.bodyMd,
    fontWeight: '700' as const,
  },
  feedbackCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  feedbackLabel: {
    color: colors.muted,
    fontSize: fontSize.label,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  feedbackText: {
    color: colors.text,
    fontSize: fontSize.bodyMd,
    fontWeight: '500' as const,
    lineHeight: 22,
  },
  tipCard: {
    backgroundColor: '#FFFDE7',
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  tipLabel: {
    color: colors.amber,
    fontSize: fontSize.label,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  tipText: {
    color: colors.text,
    fontSize: fontSize.bodyMd,
    fontWeight: '500' as const,
    lineHeight: 22,
  },
  durationNote: {
    color: colors.muted,
    fontSize: fontSize.bodySm,
    fontWeight: '500' as const,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
