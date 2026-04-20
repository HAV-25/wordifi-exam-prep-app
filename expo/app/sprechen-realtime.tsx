import { Audio } from 'expo-av';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { AlertCircle, Mic, MicOff, PhoneOff, RefreshCw, Star, Timer } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CTA_BUTTON_HEIGHT = 56;    // primary CTA / footer height
const BOTTOM_CONTENT_BUFFER = 24; // breathing room below last content item
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

const SUPABASE_URL = 'https://wwfiauhsbssjowaxmqyn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3ZmlhdWhzYnNzam93YXhtcXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MTQxMzUsImV4cCI6MjA4Njk5MDEzNX0.lSPPEQCtdigdXpwB2X5hUTrC2dThil6qleQtqcUEKAE';

type ScreenState =
  | 'loading'
  | 'instruction'
  | 'connecting'
  | 'conversation'
  | 'scoring'
  | 'results'
  | 'error';

export default function SprechenRealtimeScreen() {
  const insets = useSafeAreaInsets();
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
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [finalCountdown, setFinalCountdown] = useState<number | null>(null);
  const finalCountdownScaleAnim = useRef(new Animated.Value(0.5)).current;
  const finalCountdownOpacityAnim = useRef(new Animated.Value(0)).current;
  const finalCountdownTriggeredRef = useRef<boolean>(false);
  const [showSilenceNudge, setShowSilenceNudge] = useState<boolean>(false);
  const silenceNudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sessionRef = useRef<IRealtimeSession | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const recordingLimitRef = useRef<number>(240);
  const handleStartConversationRef = useRef<(() => Promise<void>) | null>(null);
  const countdownTriggeredRef = useRef<boolean>(false);
  const monologueTimerStartedRef = useRef<boolean>(false);
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
  const taskSubtype = (questionRaw?.task_subtype as string | null) ?? 'dialogue';
  const isMonologue = taskSubtype === 'monologue';
  const recordingTimeLimitSec = (questionRaw?.recording_time_limit_sec as number | null) ?? 240;
  const stimulusText = (question?.stimulus_text ?? '');
  const optionsInTaskCard = stimulusText.startsWith('Thema:') || stimulusText.startsWith('Situation:');

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
          setErrorMsg('No speaking questions available');
          setScreenState('error');
        }
      } catch (err) {
        console.log('[SprechenRealtime] Load error:', err);
        if (!cancelled) {
          setErrorMsg('Questions could not be loaded');
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
      isMountedRef.current = false;
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
      // Don't auto-end here — the grace countdown effect handles it
      // after the 5-second grace period expires.
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
          setErrorMsg('Microphone permission required');
          setScreenState('error');
          return;
        }
      }

      recordingLimitRef.current = recordingTimeLimitSec;

      const sessionRes = await fetch(`${SUPABASE_URL}/functions/v1/create-sprechen-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          question_id: question.id,
          level: question.level,
          teil: question.teil,
          topic: question.question_text,
          task_subtype: taskSubtype,
          turn1_text: partnerPromptsMemo[0]?.audio_script ?? '',
          partner_prompts: partnerPromptsMemo,
          rubric_card: rubricCard,
          recording_time_limit_sec: recordingTimeLimitSec,
        }),
      });

      if (!sessionRes.ok) {
        const errText = await sessionRes.text().catch(() => '');
        console.log('[SprechenRealtime] Create session error:', sessionRes.status, errText);
        throw new Error(`Session could not be created (${sessionRes.status})`);
      }

      const sessionData = await sessionRes.json() as Record<string, unknown>;
      const client_secret = typeof sessionData.client_secret === 'string'
        ? sessionData.client_secret
        : ((sessionData.client_secret as Record<string, unknown> | null)?.value as string | null) ?? '';
      const session_id = sessionData.session_id as string;

      sessionIdRef.current = session_id;

      const realtimeSession = createRealtimeSession({
        onStateChange: (state) => {
          console.log('[SprechenRealtime] Conv state:', state);
          if (isMountedRef.current) setConvState(state);
          if (state === 'connected') {
            // Trigger AI to speak first after session.update is queued by configureSession.
            // For dialogue: AI starts the conversation. For monologue: AI says "Bitte fahren Sie fort."
            setTimeout(() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (sessionRef.current as any).sendEvent?.({ type: 'response.create' });
            }, 0);
          }
          // For monologue: start timer only after AI finishes its opening ("Bitte fahren Sie fort").
          // The 'listening' state fires when the AI's response.done is processed.
          if (state === 'listening' && isMonologue && !monologueTimerStartedRef.current) {
            monologueTimerStartedRef.current = true;
            startTimer();
          }
        },
        onTranscript: (entry) => {
          console.log('[SprechenRealtime] Transcript:', entry.role, entry.text.slice(0, 50));
          if (!isMountedRef.current) return;
          setTranscriptEntries(prev => [...prev, entry]);
          setCurrentAiText('');
          if (entry.role === 'user') {
            setShowSilenceNudge(false);
            if (silenceNudgeTimerRef.current) clearTimeout(silenceNudgeTimerRef.current);
          }
        },
        onAiSpeakingText: (delta) => {
          if (isMountedRef.current) setCurrentAiText(prev => prev + delta);
        },
        onError: (msg) => {
          console.log('[SprechenRealtime] Error:', msg);
          if (isMountedRef.current) setErrorMsg(msg);
        },
      }, taskSubtype);

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
      // Dialogue: start timer immediately (AI is already speaking, user speaks after).
      // Monologue: timer starts only after AI finishes opening — handled in onStateChange above.
      if (!isMonologue) {
        startTimer();
      }
    } catch (err) {
      console.log('[SprechenRealtime] Start error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Connection failed');
      setScreenState('error');
    }
  }, [question, accessToken, partnerPromptsMemo, rubricCard, startTimer, taskSubtype, isMonologue, recordingTimeLimitSec]);

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
      const durationSeconds = startTimeRef.current > 0
        ? Math.floor((Date.now() - startTimeRef.current) / 1000)
        : 0;
      const result = await scoreSprechenConversation({
        question_id: question.id,
        level: question.level,
        source_structure_type: question.source_structure_type,
        transcript,
        rubric_card: rubricCard,
        duration_seconds: durationSeconds,
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
        encouragement_note: 'Assessment could not be loaded.',
        improvement_tip: '',
        task_completion: false,
      });
      setScreenState('results');
    }
  }, [question, accessToken, rubricCard]);

  useEffect(() => {
    handleEndRef.current = handleEndConversation;
  }, [handleEndConversation]);

  useEffect(() => {
    handleStartConversationRef.current = handleStartConversation;
  }, [handleStartConversation]);

  // Tick countdown down 3→2→1→0 then auto-start for monologue
  useEffect(() => {
    if (countdownValue === null) return;
    if (countdownValue <= 0) {
      setCountdownValue(null);
      void handleStartConversationRef.current?.();
      return;
    }
    const t = setTimeout(() => setCountdownValue((v) => (v !== null ? v - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [countdownValue]);

  // Trigger countdown automatically for monologue once moderator audio finishes.
  // DISABLED for monologue: the AI now says "Bitte fahren Sie fort" as the verbal cue,
  // so the 3-2-1 countdown is redundant. Keeping the effect for dialogue-with-countdown
  // flows if ever needed, but currently only monologue used this path.
  // useEffect(() => { ... }, [screenState, isMonologue, moderatorAudioUrl, moderatorFinished]);

  // ── Final 5-4-3-2-1 grace period AFTER time limit expires ─────────────────
  // When the main timer hits 0, instead of auto-ending, start 5s grace countdown.
  // Auto-end fires only when grace countdown reaches 0.
  useEffect(() => {
    if (screenState !== 'conversation') {
      finalCountdownTriggeredRef.current = false;
      setFinalCountdown(null);
      return;
    }
    const limit = isMonologue ? recordingTimeLimitSec : MAX_DURATION;
    const timeRemaining = limit - elapsedSeconds;

    if (timeRemaining <= 0 && !finalCountdownTriggeredRef.current) {
      finalCountdownTriggeredRef.current = true;
      setFinalCountdown(5);
    }
  }, [screenState, elapsedSeconds, isMonologue, recordingTimeLimitSec]);

  // Tick the grace countdown and animate each number
  useEffect(() => {
    if (finalCountdown === null) return;
    if (finalCountdown <= 0) {
      setFinalCountdown(null);
      // Grace period over — auto-end the conversation
      void handleEndRef.current?.();
      return;
    }
    // Animate: scale up from 0.5→1 + fade in per tick
    finalCountdownScaleAnim.setValue(0.5);
    finalCountdownOpacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(finalCountdownScaleAnim, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.timing(finalCountdownOpacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const t = setTimeout(() => setFinalCountdown((v) => (v !== null && v > 0 ? v - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [finalCountdown, finalCountdownScaleAnim, finalCountdownOpacityAnim]);

  // ── 7-second silence nudge ─────────────────────────────────────────────────
  // Show "Bitte sprechen Sie jetzt" if user hasn't spoken for 7s while it's their turn.
  useEffect(() => {
    if (convState === 'listening') {
      silenceNudgeTimerRef.current = setTimeout(() => setShowSilenceNudge(true), 7000);
    } else {
      setShowSilenceNudge(false);
      if (silenceNudgeTimerRef.current) {
        clearTimeout(silenceNudgeTimerRef.current);
        silenceNudgeTimerRef.current = null;
      }
    }
    return () => {
      if (silenceNudgeTimerRef.current) {
        clearTimeout(silenceNudgeTimerRef.current);
        silenceNudgeTimerRef.current = null;
      }
    };
  }, [convState]);

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
    setCountdownValue(null);
    countdownTriggeredRef.current = false;
    setFinalCountdown(null);
    finalCountdownTriggeredRef.current = false;
    monologueTimerStartedRef.current = false;
    setScreenState('instruction');
  }, []);

  const formatTime = useCallback((seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  const getStatusLabel = (): string => {
    switch (convState) {
      case 'connecting': return 'Connecting...';
      case 'connected': return 'Connected';
      case 'ai_speaking': return 'Partner speaking...';
      case 'listening': return isMonologue ? 'Recording in progress...' : 'Listening...';
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

    const stimulusText = question.stimulus_text ?? '';
    let stimulusHeadline = '';
    let stimulusChips: string[] = [];

    if (stimulusText.startsWith('Thema:') || stimulusText.startsWith('Situation:')) {
      const colonIdx = stimulusText.indexOf(':');
      stimulusHeadline = stimulusText.slice(colonIdx + 1).trim();
      const opts = question.options as Array<{ key?: string; text: string }> | null;
      stimulusChips = (opts ?? []).map(o => o.text);
    } else if (stimulusText.includes(' · ')) {
      const parts = stimulusText.split(' · ');
      stimulusHeadline = parts[0] ?? '';
      stimulusChips = parts.slice(1);
    } else if (stimulusText) {
      stimulusHeadline = stimulusText;
    }

    return (
      <View style={[styles.taskCard, shadows.card]}>
        <Text style={styles.taskCardTitle}>Thema</Text>
        <Text style={styles.taskCardText}>{question.question_text}</Text>
        {stimulusHeadline ? (
          <Text style={styles.taskCardStimulus}>{stimulusHeadline}</Text>
        ) : null}
        {stimulusChips.length > 0 ? (
          <View style={styles.stimulusChipsRow}>
            {stimulusChips.map((chip, idx) => (
              <View key={String(idx)} style={styles.stimulusChip}>
                <Text style={styles.stimulusChipText}>{chip}</Text>
              </View>
            ))}
          </View>
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
          <Text style={styles.loadingText}>Loading questions...</Text>
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
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{errorMsg ?? 'Unknown error'}</Text>
          <View style={styles.errorActions}>
            <CTAButton label="Try again" onPress={handleRetry} testID="realtime-retry" />
            <Pressable onPress={() => router.back()} style={styles.backLink} testID="realtime-back">
              <Text style={styles.backLinkText}>Back</Text>
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
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + CTA_BUTTON_HEIGHT + BOTTOM_CONTENT_BUFFER }]} showsVerticalScrollIndicator={false}>
          <View style={styles.instructionHeader}>
            <View style={styles.sectionPill}>
              <Mic color={colors.white} size={12} />
              <Text style={styles.sectionPillText}>Live Conversation</Text>
            </View>
            <Text style={styles.instructionSubtitle}>{taskLabel}</Text>
          </View>

          {renderTaskCard()}
          {!optionsInTaskCard && renderOptions()}

          {moderatorAudioUrl ? (
            <View style={styles.moderatorWrap}>
              <Text style={styles.moderatorLabel}>Listen to task</Text>
              <AudioPlayer audioUrl={moderatorAudioUrl} onPlaybackComplete={() => setModeratorFinished(true)} />
            </View>
          ) : null}

          {!isMonologue && !moderatorAudioUrl ? (
            <View style={styles.noModeratorNote}>
              <Text style={styles.noModeratorText}>
                Press below to start the live conversation with the AI partner.
              </Text>
            </View>
          ) : null}

          {isMonologue && countdownValue !== null ? (
            <View style={styles.countdownWrap}>
              <Text style={styles.countdownText}>{countdownValue}</Text>
              <Text style={styles.countdownLabel}>Recording starting...</Text>
            </View>
          ) : null}
        </ScrollView>

        {!isMonologue ? (
          <View style={[styles.footer, { bottom: insets.bottom }]}>
            <CTAButton
              label="Start conversation"
              onPress={handleStartConversation}
              disabled={moderatorAudioUrl != null && !moderatorFinished}
              testID="realtime-start"
            />
          </View>
        ) : null}
      </View>
    );
  }

  if (screenState === 'connecting') {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Verbinde...', headerShown: true }} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.blue} size="large" />
          <Text style={styles.loadingText}>Connecting AI partner...</Text>
        </View>
      </View>
    );
  }

  if (screenState === 'conversation') {
    const statusLabel = getStatusLabel();
    const statusColor = getStatusColor();
    const displaySeconds = isMonologue
      ? Math.max(0, recordingTimeLimitSec - elapsedSeconds)
      : elapsedSeconds;
    const timeRemaining = isMonologue ? displaySeconds : (MAX_DURATION - elapsedSeconds);
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
          <View style={styles.timerProgressTrack}>
            <View style={[
              styles.timerProgressFill,
              {
                width: `${Math.min(100, (elapsedSeconds / (isMonologue ? recordingTimeLimitSec : MAX_DURATION)) * 100)}%` as `${number}%`,
                backgroundColor: isTimeLow ? colors.red : colors.blue,
              },
            ]} />
          </View>
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
              {formatTime(displaySeconds)}
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
                {entry.role === 'assistant' ? 'Partner' : 'You'}
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

        {showSilenceNudge && (
          <View style={styles.silenceNudge} pointerEvents="none">
            <Text style={styles.silenceNudgeText}>🎙 Bitte sprechen Sie jetzt</Text>
          </View>
        )}

        <View style={[styles.convFooter, { paddingBottom: insets.bottom + spacing.lg }]}>
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
                isMonologue ? 'End recording?' : 'End conversation?',
                'The conversation will be evaluated.',
                [
                  { text: 'Continue', style: 'cancel' },
                  { text: 'End', style: 'destructive', onPress: () => void handleEndConversation() },
                ]
              );
            }}
            style={styles.endBtn}
            testID="realtime-end"
          >
            <PhoneOff color={colors.red} size={16} />
            <Text style={styles.endBtnText}>{isMonologue ? 'End recording' : 'End conversation'}</Text>
          </Pressable>
        </View>

        {/* Final countdown overlay — 5 4 3 2 1 */}
        {finalCountdown !== null && finalCountdown > 0 ? (
          <View style={styles.finalCountdownOverlay} pointerEvents="none">
            <Animated.View
              style={[
                styles.finalCountdownCircle,
                {
                  opacity: finalCountdownOpacityAnim,
                  transform: [{ scale: finalCountdownScaleAnim }],
                },
              ]}
            >
              <Text style={styles.finalCountdownNumber}>{finalCountdown}</Text>
            </Animated.View>
            <Animated.Text style={[styles.finalCountdownMessage, { opacity: finalCountdownOpacityAnim }]}>
              Your speaking time is ending soon
            </Animated.Text>
            <Animated.Text style={[styles.finalCountdownMessageEn, { opacity: finalCountdownOpacityAnim }]}>
              Your speaking time is ending
            </Animated.Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (screenState === 'scoring') {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Assessment', headerShown: true, headerBackVisible: false }} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.blue} size="large" />
          <Text style={styles.loadingText}>Your answer is being evaluated...</Text>
        </View>
      </View>
    );
  }

  if (screenState === 'results' && scores) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = scores as any;
    const overallNum = Number(s.overall_score ?? s.overall ?? 0);
    const fluencyNum = Number(s.fluency_score ?? s.fluency ?? 0);
    const grammarNum = Number(s.grammar_score ?? s.grammar ?? 0);
    const vocabularyNum = Number(s.vocabulary_score ?? s.vocabulary ?? 0);
    const taskCompletion: string = s.task_completion ?? '';
    const starCount = Math.max(0, Math.min(5, Math.round(overallNum)));
    const hasUserSpeech = transcriptEntries.some(e => e.role === 'user');
    const noSpeechDetected = !hasUserSpeech && overallNum <= 1;

    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Ergebnis', headerShown: true, headerBackVisible: false }} />
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + CTA_BUTTON_HEIGHT + BOTTOM_CONTENT_BUFFER }]} showsVerticalScrollIndicator={false}>
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
            <Text style={styles.resultsScoreLabel}>{overallNum} / 5</Text>
          </View>

          <View style={[styles.scoresCard, shadows.card]}>
            <Text style={styles.scoresHeader}>Detailed Assessment</Text>
            {[
              { label: 'Fluency', value: fluencyNum },
              { label: 'Grammar', value: grammarNum },
              { label: 'Vocabulary', value: vocabularyNum },
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

          {taskCompletion === 'full' ? (
            <View style={[styles.badgeCard, shadows.card, { borderColor: colors.green }]}>
              <Text style={styles.badgeEmoji}>✅</Text>
              <Text style={[styles.badgeText, { color: colors.green }]}>Task completed</Text>
            </View>
          ) : taskCompletion === 'partial' ? (
            <View style={[styles.badgeCard, shadows.card, { borderColor: colors.amber }]}>
              <Text style={styles.badgeEmoji}>⚠️</Text>
              <Text style={[styles.badgeText, { color: colors.amber }]}>Partially completed</Text>
            </View>
          ) : taskCompletion === 'minimal' ? (
            <View style={[styles.badgeCard, shadows.card, { borderColor: colors.red }]}>
              <Text style={styles.badgeEmoji}>❌</Text>
              <Text style={[styles.badgeText, { color: colors.red }]}>Not completed</Text>
            </View>
          ) : null}

          {noSpeechDetected ? (
            <View style={[styles.feedbackCard, shadows.card]}>
              <Text style={styles.feedbackLabel}>Hinweis</Text>
              <Text style={styles.feedbackText}>
                Es wurde keine Sprache erkannt. Bitte überprüfen Sie Ihr Mikrofon und versuchen Sie es erneut.
              </Text>
            </View>
          ) : (
            <>
              {scores.encouragement_note ? (
                <View style={[styles.feedbackCard, shadows.card]}>
                  <Text style={styles.feedbackLabel}>Feedback</Text>
                  <Text style={styles.feedbackText}>{scores.encouragement_note}</Text>
                </View>
              ) : null}

              {scores.improvement_tip ? (
                <View style={[styles.tipCard, shadows.card]}>
                  <Text style={styles.tipLabel}>Improvement tip</Text>
                  <Text style={styles.tipText}>{scores.improvement_tip}</Text>
                </View>
              ) : null}
            </>
          )}

          <Text style={styles.durationNote}>
            Conversation duration: {formatTime(elapsedSeconds)}
          </Text>
        </ScrollView>

        <View style={[styles.footer, { bottom: insets.bottom }]}>
          <CTAButton
            label="Back to overview"
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
  stimulusChipsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
    marginTop: spacing.sm,
  },
  stimulusChip: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 99,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  stimulusChipText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: fontSize.bodySm,
    fontWeight: '500' as const,
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
  countdownWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  countdownText: {
    fontSize: 72,
    fontWeight: '800' as const,
    color: colors.navy,
    lineHeight: 80,
  },
  countdownLabel: {
    fontSize: fontSize.bodyMd,
    fontWeight: '600' as const,
    color: colors.muted,
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

  // ─── Final countdown overlay ─────────────────────────────────────────────
  finalCountdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    gap: 16,
  },
  finalCountdownCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24 },
      android: { elevation: 12 },
    }),
  },
  finalCountdownNumber: {
    fontSize: 56,
    fontWeight: '800' as const,
    color: colors.red,
    lineHeight: 64,
  },
  finalCountdownMessage: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.white,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  finalCountdownMessageEn: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  timerProgressTrack: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  timerProgressFill: {
    height: 4,
    borderRadius: 2,
  },
  silenceNudge: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    backgroundColor: colors.blue,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  silenceNudgeText: {
    color: colors.white,
    fontSize: fontSize.bodySm,
    fontWeight: '600' as const,
  },
});
