import { Audio } from 'expo-av';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { AlertCircle, ChevronLeft, Mic, MicOff, PhoneOff, RefreshCw, Star, Timer } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CTA_BUTTON_HEIGHT = 56;
const BOTTOM_CONTENT_BUFFER = 24;
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

import { AppHeader } from '@/components/AppHeader';
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
            setTimeout(() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (sessionRef.current as any).sendEvent?.({ type: 'response.create' });
            }, 0);
          }
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

  useEffect(() => {
    if (finalCountdown === null) return;
    if (finalCountdown <= 0) {
      setFinalCountdown(null);
      void handleEndRef.current?.();
      return;
    }
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
      case 'ai_speaking': return 'Alex is speaking...';
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

  // ─── Helper: Alex avatar ──────────────────────────────────────────────────
  const renderAlexAvatar = () => (
    <View style={styles.alexSection}>
      <View style={styles.alexAvatar} />
      <Text style={styles.alexName}>Alex</Text>
      <Text style={styles.alexRole}>Your conversation partner - AI</Text>
      <Text style={styles.alexSubRole}>Always where you are</Text>
    </View>
  );

  // ─── Helper: Thema card ───────────────────────────────────────────────────
  const renderTaskCard = () => {
    if (!question) return null;

    const st = question.stimulus_text ?? '';
    let stimulusHeadline = '';
    let stimulusChips: string[] = [];

    if (st.startsWith('Thema:') || st.startsWith('Situation:')) {
      const colonIdx = st.indexOf(':');
      stimulusHeadline = st.slice(colonIdx + 1).trim();
      const opts = question.options as Array<{ key?: string; text: string }> | null;
      stimulusChips = (opts ?? []).map(o => o.text);
    } else if (st.includes(' · ')) {
      const parts = st.split(' · ');
      stimulusHeadline = parts[0] ?? '';
      stimulusChips = parts.slice(1);
    } else if (st) {
      stimulusHeadline = st;
    }

    return (
      <View style={[styles.themaCard, shadows.card]}>
        <Text style={styles.sectionLabel}>THEMA</Text>
        <Text style={styles.themaText}>{question.question_text}</Text>
        {stimulusHeadline ? (
          <Text style={styles.themaStimulus}>{stimulusHeadline}</Text>
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

  // ─── Helper: Gesprächspunkte card ─────────────────────────────────────────
  const renderOptions = () => {
    if (!question?.options || question.options.length === 0) return null;
    const opts = question.options as Array<{ key: string; text: string }>;
    return (
      <View style={[styles.gesprachCard, shadows.card]}>
        <Text style={styles.sectionLabel}>GESPRÄCHSPUNKTE</Text>
        {opts.map((opt, idx) => (
          <View key={opt.key ?? String(idx)} style={styles.optionRow}>
            <View style={styles.optionDot} />
            <Text style={styles.optionText}>{opt.text}</Text>
          </View>
        ))}
      </View>
    );
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (screenState === 'loading') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <AppHeader />
        <View style={styles.center}>
          <ActivityIndicator color={colors.blue} size="large" />
          <Text style={styles.loadingText}>Loading questions...</Text>
        </View>
      </View>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (screenState === 'error') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <AppHeader />
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

  // ─── Instruction ──────────────────────────────────────────────────────────
  if (screenState === 'instruction') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <AppHeader />

        {/* Sub-header: back arrow + breadcrumb */}
        <View style={styles.subHeader}>
          <Pressable onPress={() => router.back()} style={styles.subHeaderBack} testID="realtime-back-btn">
            <ChevronLeft color={colors.navy} size={22} />
          </Pressable>
          <Text style={styles.subHeaderTitle} numberOfLines={1}>
            {level} · Sprechen · Teil {teil}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Mode tabs */}
        <View style={styles.modeTabs}>
          <View style={styles.modeTabActive}>
            <Mic color={colors.white} size={12} />
            <Text style={styles.modeTabActiveText}>Live Conversation</Text>
          </View>
          <Text style={styles.modeTabInactive}>Voice Note</Text>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + CTA_BUTTON_HEIGHT + 80 }]}
          showsVerticalScrollIndicator={false}
        >
          {renderAlexAvatar()}
          {renderTaskCard()}
          {!optionsInTaskCard && renderOptions()}

          {moderatorAudioUrl ? (
            <View style={styles.moderatorWrap}>
              <Text style={styles.moderatorLabel}>Listen to task</Text>
              <AudioPlayer audioUrl={moderatorAudioUrl} onPlaybackComplete={() => setModeratorFinished(true)} />
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
              label="Start Conversation"
              onPress={handleStartConversation}
              disabled={moderatorAudioUrl != null && !moderatorFinished}
              testID="realtime-start"
            />
            <Text style={styles.footerTagline}>Speak naturally — this is practice, not a test.</Text>
          </View>
        ) : null}
      </View>
    );
  }

  // ─── Connecting ───────────────────────────────────────────────────────────
  if (screenState === 'connecting') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <AppHeader />
        <View style={styles.center}>
          <View style={styles.connectingAvatar}>
            <ActivityIndicator color={colors.white} size="large" />
          </View>
          <Text style={styles.loadingText}>Connecting AI partner...</Text>
        </View>
      </View>
    );
  }

  // ─── Conversation ─────────────────────────────────────────────────────────
  if (screenState === 'conversation') {
    const statusLabel = getStatusLabel();
    const statusColor = getStatusColor();
    const displaySeconds = isMonologue
      ? Math.max(0, recordingTimeLimitSec - elapsedSeconds)
      : elapsedSeconds;
    const timeRemaining = isMonologue ? displaySeconds : (MAX_DURATION - elapsedSeconds);
    const isTimeLow = timeRemaining <= 30;
    const progressPct = Math.min(100, (elapsedSeconds / (isMonologue ? recordingTimeLimitSec : MAX_DURATION)) * 100);

    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <AppHeader />

        {/* Compact header with timer */}
        <View style={styles.convHeader}>
          <Text style={styles.convTitle}>{level} · Sprechen · Teil {teil}</Text>
          <View style={[styles.timerBadge, isTimeLow && styles.timerBadgeRed]}>
            <Timer color={isTimeLow ? colors.white : colors.navy} size={12} />
            <Text style={[styles.timerText, isTimeLow && styles.timerTextWhite]}>
              {formatTime(displaySeconds)}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.timerProgressTrack}>
          <View style={[
            styles.timerProgressFill,
            {
              width: `${progressPct}%` as `${number}%`,
              backgroundColor: isTimeLow ? colors.red : colors.blue,
            },
          ]} />
        </View>

        {/* Avatar section */}
        <View style={styles.avatarSection}>
          <Animated.View style={[styles.avatarCircle, { opacity: pulseAnim }]} />
          <Text style={styles.avatarName}>Alex</Text>
          <Text style={[styles.avatarStatus, { color: statusColor }]}>{statusLabel}</Text>
        </View>

        {/* Transcript */}
        <ScrollView
          style={styles.transcriptScroll}
          contentContainerStyle={styles.transcriptContent}
          showsVerticalScrollIndicator={false}
        >
          {transcriptEntries.map((entry, idx) => (
            <View
              key={String(idx)}
              style={[
                styles.bubble,
                entry.role === 'assistant' ? styles.bubbleAi : styles.bubbleUser,
              ]}
            >
              <Text style={[styles.bubbleRole, entry.role === 'user' && styles.bubbleRoleUser]}>
                {entry.role === 'assistant' ? 'Partner' : 'Sie'}
              </Text>
              <Text style={[styles.bubbleText, entry.role === 'user' && styles.bubbleTextUser]}>
                {entry.text}
              </Text>
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
              style={[styles.recordBtn, isNativeRecording && styles.recordBtnActive]}
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

        {/* Final countdown overlay */}
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
              Ihre Sprechzeit endet gleich
            </Animated.Text>
            <Animated.Text style={[styles.finalCountdownMessageEn, { opacity: finalCountdownOpacityAnim }]}>
              Your speaking time is ending
            </Animated.Text>
          </View>
        ) : null}
      </View>
    );
  }

  // ─── Scoring ──────────────────────────────────────────────────────────────
  if (screenState === 'scoring') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <AppHeader />
        <View style={styles.center}>
          <View style={styles.connectingAvatar}>
            <ActivityIndicator color={colors.white} size="large" />
          </View>
          <Text style={styles.loadingText}>Your answer is being evaluated...</Text>
        </View>
      </View>
    );
  }

  // ─── Results ──────────────────────────────────────────────────────────────
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
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <AppHeader />
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + CTA_BUTTON_HEIGHT + BOTTOM_CONTENT_BUFFER }]} showsVerticalScrollIndicator={false}>

          {/* Results hero */}
          <View style={[styles.resultsHero, shadows.card]}>
            <View style={styles.resultsIconWrap}>
              <Mic color={colors.white} size={24} />
            </View>
            <Text style={styles.resultsTitle}>Sprechen · Teil {teil}</Text>
            <Text style={styles.resultsSubtitle}>{level} · {taskLabel}</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <Star
                  key={n}
                  color={n <= starCount ? '#FFD700' : 'rgba(255,255,255,0.3)'}
                  fill={n <= starCount ? '#FFD700' : 'transparent'}
                  size={28}
                />
              ))}
            </View>
            <Text style={styles.resultsScoreLabel}>{overallNum} / 5</Text>
          </View>

          {/* Detailed scores */}
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

          {/* Task completion badge */}
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

          {/* Feedback */}
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

  // ─── Fallback ─────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader />
      <View style={styles.center}>
        <RefreshCw color={colors.muted} size={32} />
        <Pressable onPress={handleRetry} style={styles.backLink}>
          <Text style={styles.backLinkText}>Neu laden</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Orange accent for live conversation + bullet dots ────────────────────
const ORANGE = '#F97316';

const styles = StyleSheet.create({
  // ── Structural ──────────────────────────────────────────────────────────
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
  scrollContent: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },

  // ── Loading / Error ──────────────────────────────────────────────────────
  loadingText: {
    fontSize: fontSize.bodyMd,
    color: colors.muted,
    fontWeight: '600' as const,
  },
  connectingAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239,68,68,0.1)',
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

  // ── Instruction — Sub-header ─────────────────────────────────────────────
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  subHeaderBack: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.bodyMd,
    fontWeight: '700' as const,
    color: colors.navy,
  },

  // ── Instruction — Mode tabs ───────────────────────────────────────────────
  modeTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  modeTabActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ORANGE,
    borderRadius: 99,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  modeTabActiveText: {
    color: colors.white,
    fontSize: fontSize.bodySm,
    fontWeight: '700' as const,
  },
  modeTabInactive: {
    color: colors.muted,
    fontSize: fontSize.bodySm,
    fontWeight: '600' as const,
  },

  // ── Instruction — Alex avatar ─────────────────────────────────────────────
  alexSection: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: 4,
  },
  alexAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.blue,
    marginBottom: spacing.sm,
  },
  alexName: {
    fontSize: fontSize.bodyLg,
    fontWeight: '800' as const,
    color: colors.navy,
  },
  alexRole: {
    fontSize: fontSize.bodySm,
    fontWeight: '500' as const,
    color: colors.muted,
  },
  alexSubRole: {
    fontSize: fontSize.bodySm,
    fontWeight: '400' as const,
    color: colors.muted,
  },

  // ── Instruction — Thema card ──────────────────────────────────────────────
  themaCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 6,
  },
  sectionLabel: {
    fontSize: fontSize.label,
    fontWeight: '700' as const,
    color: colors.muted,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  themaText: {
    fontSize: fontSize.bodyLg,
    fontWeight: '700' as const,
    color: colors.navy,
    lineHeight: 26,
  },
  themaStimulus: {
    fontSize: fontSize.bodyMd,
    fontWeight: '500' as const,
    color: colors.muted,
    lineHeight: 22,
  },
  stimulusChipsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: spacing.xs,
  },
  stimulusChip: {
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  stimulusChipText: {
    fontSize: fontSize.bodySm,
    fontWeight: '500' as const,
    color: colors.text,
  },

  // ── Instruction — Gesprächspunkte card ────────────────────────────────────
  gesprachCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  optionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: ORANGE,
    marginTop: 7,
  },
  optionText: {
    color: colors.bodyText,
    fontSize: fontSize.bodyMd,
    fontWeight: '500' as const,
    flex: 1,
    lineHeight: 22,
  },

  // ── Instruction — Footer tagline ──────────────────────────────────────────
  footerTagline: {
    textAlign: 'center',
    fontSize: fontSize.bodySm,
    fontWeight: '500' as const,
    color: colors.muted,
  },

  // ── Instruction — Moderator audio ─────────────────────────────────────────
  moderatorWrap: {
    gap: spacing.sm,
  },
  moderatorLabel: {
    color: colors.muted,
    fontSize: fontSize.label,
    fontWeight: '600' as const,
    paddingHorizontal: spacing.xs,
  },

  // ── Instruction — Countdown ───────────────────────────────────────────────
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

  // ── Conversation — Header ─────────────────────────────────────────────────
  convHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  convTitle: {
    fontSize: fontSize.bodyMd,
    fontWeight: '700' as const,
    color: colors.navy,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: colors.surfaceContainerLow,
  },
  timerBadgeRed: {
    backgroundColor: colors.red,
  },
  timerText: {
    color: colors.navy,
    fontSize: fontSize.bodySm,
    fontWeight: '800' as const,
    fontVariant: ['tabular-nums'],
  },
  timerTextWhite: {
    color: colors.white,
  },

  // ── Conversation — Progress bar ───────────────────────────────────────────
  timerProgressTrack: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  timerProgressFill: {
    height: 4,
  },

  // ── Conversation — Avatar ─────────────────────────────────────────────────
  avatarSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.blue,
    marginBottom: 4,
  },
  avatarName: {
    fontSize: fontSize.bodyLg,
    fontWeight: '800' as const,
    color: colors.navy,
  },
  avatarStatus: {
    fontSize: fontSize.bodySm,
    fontWeight: '600' as const,
  },

  // ── Conversation — Transcript ─────────────────────────────────────────────
  transcriptScroll: {
    flex: 1,
  },
  transcriptContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 120,
    gap: spacing.sm,
  },
  bubble: {
    borderRadius: radius.lg,
    padding: spacing.md,
    maxWidth: '82%',
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
  bubbleRoleUser: {
    color: 'rgba(255,255,255,0.7)',
  },
  bubbleText: {
    fontSize: fontSize.bodyMd,
    fontWeight: '500' as const,
    color: colors.bodyText,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: colors.white,
  },

  // ── Conversation — Silence nudge ──────────────────────────────────────────
  silenceNudge: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    backgroundColor: ORANGE,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  silenceNudgeText: {
    color: colors.white,
    fontSize: fontSize.bodySm,
    fontWeight: '700' as const,
  },

  // ── Conversation — Footer ─────────────────────────────────────────────────
  convFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
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

  // ── Final countdown overlay ───────────────────────────────────────────────
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

  // ── Results ───────────────────────────────────────────────────────────────
  resultsHero: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultsIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
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
    borderWidth: 1.5,
  },
  badgeEmoji: {
    fontSize: 22,
  },
  badgeText: {
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
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  feedbackText: {
    color: colors.bodyText,
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
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  tipText: {
    color: colors.bodyText,
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
