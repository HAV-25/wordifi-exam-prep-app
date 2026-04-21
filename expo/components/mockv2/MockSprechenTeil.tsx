/**
 * MockSprechenTeil — runs ONE Sprechen conversation for a Mock V2 teil.
 *
 * Self-contained replica of the sprechen-realtime conversation runtime,
 * tailored for mock context:
 *   - "Ready card" UX (user taps Start to begin)
 *   - Mic-permission denial → onSkipped (parent handles 0% scoring)
 *   - Conversation runs end-to-end: AI opens, user speaks, timer counts down,
 *     auto-end on time-up (with 5s grace), user can also tap End early
 *   - On completion, transcript is scored via scoreSprechenConversation,
 *     then onComplete fires with the score payload
 *   - SILENT MODE: no per-teil score reveal — the parent shows a
 *     neutral "✓ Teil saved" card and advances
 *
 * Sectional /sprechen-realtime is UNCHANGED — this is a parallel implementation
 * using the same realtimeSession.ts infrastructure.
 */
import { Audio } from 'expo-av';
import {
  AlertCircle,
  Mic,
  MicOff,
  PhoneOff,
  Play,
  Settings as SettingsIcon,
  Timer as TimerIcon,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const ORANGE = '#F97316';

import {
  createRealtimeSession,
  isWebRTCAvailable,
  NativeWSRealtimeSession,
  scoreSprechenConversation,
  type ConversationState,
  type IRealtimeSession,
  type SprechenScores,
  type TranscriptEntry,
} from '@/lib/realtimeSession';
import { B } from '@/theme/banani';
import type { AppQuestion } from '@/types/database';

const SUPABASE_URL = 'https://wwfiauhsbssjowaxmqyn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3ZmlhdWhzYnNzam93YXhtcXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MTQxMzUsImV4cCI6MjA4Njk5MDEzNX0.lSPPEQCtdigdXpwB2X5hUTrC2dThil6qleQtqcUEKAE';

export type MockSprechenTeilResult = {
  scores: SprechenScores;
  transcript: string;
  durationSeconds: number;
};

type Props = {
  question: AppQuestion;
  accessToken: string;
  /** Total Sprechen-section teils (for header "Teil X of Y"). */
  teilIndexLabel: string;
  onComplete: (result: MockSprechenTeilResult) => void;
  /** Fired when user denies mic or chooses to skip this teil. Parent should record 0%. */
  onSkipped: (reason: 'mic_denied' | 'user_skip') => void;
};

type Phase =
  | 'ready'        // A2: Ready card before conversation starts
  | 'mic_denied'   // B2: re-prompt or skip
  | 'connecting'
  | 'conversation'
  | 'scoring'
  | 'error';

export function MockSprechenTeil({
  question,
  accessToken,
  teilIndexLabel,
  onComplete,
  onSkipped,
}: Props) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [convState, setConvState] = useState<ConversationState>('idle');
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [currentAiText, setCurrentAiText] = useState<string>('');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isNativeRecording, setIsNativeRecording] = useState<boolean>(false);
  const [finalCountdown, setFinalCountdown] = useState<number | null>(null);

  const [showSilenceNudge, setShowSilenceNudge] = useState<boolean>(false);
  const silenceNudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sessionRef = useRef<IRealtimeSession | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const handleEndRef = useRef<(() => Promise<void>) | null>(null);
  const finalCountdownTriggeredRef = useRef<boolean>(false);
  const monologueTimerStartedRef = useRef<boolean>(false);
  const isWebRTC = isWebRTCAvailable();
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  const partnerPrompts = React.useMemo(() => {
    const raw = question as Record<string, unknown> | null;
    return (raw?.partner_prompts as Array<{ turn: number; audio_script: string; label: string; audio_url?: string }> | null) ?? [];
  }, [question]);

  const rubricCard = (question as Record<string, unknown>).rubric_card as Record<string, string> | null ?? null;
  const taskSubtype = ((question as Record<string, unknown>).task_subtype as string | null) ?? 'dialogue';
  const isMonologue = taskSubtype === 'monologue';
  const recordingTimeLimitSec = ((question as Record<string, unknown>).recording_time_limit_sec as number | null) ?? 240;

  // ── Cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      sessionRef.current?.disconnect();
      sessionRef.current = null;
    };
  }, []);

  // ── Timer ────────────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSeconds(elapsed);
      // Final 5s grace countdown when time expires
      const remaining = recordingTimeLimitSec - elapsed;
      if (remaining <= 0 && !finalCountdownTriggeredRef.current) {
        finalCountdownTriggeredRef.current = true;
        setFinalCountdown(5);
      }
    }, 1000);
  }, [recordingTimeLimitSec]);

  // Final countdown ticker
  useEffect(() => {
    if (finalCountdown === null) return;
    if (finalCountdown <= 0) {
      void handleEndRef.current?.();
      return;
    }
    const t = setTimeout(() => setFinalCountdown((v) => (v !== null ? v - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [finalCountdown]);

  // ── Start conversation ──────────────────────────────────────────────────
  const handleStartConversation = useCallback(async () => {
    if (!accessToken) {
      setErrorMsg('Authentication required');
      setPhase('error');
      return;
    }

    setPhase('connecting');
    setErrorMsg(null);

    try {
      // Mic permission (B2: per-teil prompt)
      if (Platform.OS !== 'web') {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          setPhase('mic_denied');
          return;
        }
      }

      // Create realtime session via edge function
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
          // For monologues the actual topic lives in stimulus_text; the AI
          // prompt needs the real topic, not just "give a presentation."
          topic: question.stimulus_text || question.question_text,
          task_subtype: taskSubtype,
          turn1_text: partnerPrompts[0]?.audio_script ?? '',
          partner_prompts: partnerPrompts,
          rubric_card: rubricCard,
          recording_time_limit_sec: recordingTimeLimitSec,
        }),
      });

      if (!sessionRes.ok) {
        throw new Error(`Session creation failed (${sessionRes.status})`);
      }

      const sessionData = await sessionRes.json() as Record<string, unknown>;
      const client_secret = typeof sessionData.client_secret === 'string'
        ? sessionData.client_secret
        : ((sessionData.client_secret as Record<string, unknown> | null)?.value as string | null) ?? '';

      // Build realtime session
      const realtimeSession = createRealtimeSession({
        onStateChange: (state) => {
          if (!isMountedRef.current) return;
          setConvState(state);
          if (state === 'connected') {
            // Trigger AI opening
            setTimeout(() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (sessionRef.current as any).sendEvent?.({ type: 'response.create' });
            }, 0);
          }
          // For monologue, start timer only after AI finishes opening
          if (state === 'listening' && isMonologue && !monologueTimerStartedRef.current) {
            monologueTimerStartedRef.current = true;
            startTimer();
          }
        },
        onTranscript: (entry) => {
          if (!isMountedRef.current) return;
          setTranscriptEntries((prev) => [...prev, entry]);
          setCurrentAiText('');
          if (entry.role === 'user') {
            setShowSilenceNudge(false);
            if (silenceNudgeTimerRef.current) clearTimeout(silenceNudgeTimerRef.current);
          }
        },
        onAiSpeakingText: (delta) => {
          if (isMountedRef.current) setCurrentAiText((prev) => prev + delta);
        },
        onError: (msg) => {
          if (isMountedRef.current) setErrorMsg(msg);
        },
      }, taskSubtype);

      sessionRef.current = realtimeSession;
      await realtimeSession.connect(client_secret);

      if (!isMountedRef.current) return;
      setPhase('conversation');
      // Dialogue: start timer immediately. Monologue: started in onStateChange('listening')
      if (!isMonologue) startTimer();
    } catch (err) {
      console.log('[MockSprechenTeil] start error', err);
      if (isMountedRef.current) {
        setErrorMsg(err instanceof Error ? err.message : 'Connection failed');
        setPhase('error');
      }
    }
  }, [accessToken, question, taskSubtype, partnerPrompts, rubricCard, recordingTimeLimitSec, isMonologue, startTimer]);

  // ── End conversation + score ────────────────────────────────────────────
  const handleEndConversation = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const transcript = sessionRef.current?.fullTranscript ?? '';
    sessionRef.current?.disconnect();
    sessionRef.current = null;

    setPhase('scoring');

    try {
      const durationSeconds = startTimeRef.current > 0
        ? Math.floor((Date.now() - startTimeRef.current) / 1000)
        : 0;

      const scores = await scoreSprechenConversation({
        question_id: question.id,
        level: question.level,
        source_structure_type: question.source_structure_type,
        transcript,
        rubric_card: rubricCard,
        duration_seconds: durationSeconds,
        accessToken,
      });

      if (!isMountedRef.current) return;
      onComplete({ scores, transcript, durationSeconds });
    } catch (err) {
      console.log('[MockSprechenTeil] scoring error', err);
      if (isMountedRef.current) {
        setErrorMsg(err instanceof Error ? err.message : 'Scoring failed');
        setPhase('error');
      }
    }
  }, [question, rubricCard, accessToken, onComplete]);

  useEffect(() => {
    handleEndRef.current = handleEndConversation;
  }, [handleEndConversation]);

  // ── 7-second silence nudge ───────────────────────────────────────────────
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

  // ── Pulse animation for avatar ──────────────────────────────────────────
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

  // ── Native push-to-talk (when WebRTC unavailable) ───────────────────────
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

  // ── Helpers ─────────────────────────────────────────────────────────────
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.max(0, secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleOpenSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────

  // PHASE: ready (A2 Ready card)
  if (phase === 'ready') {
    return (
      <View style={styles.center}>
        <View style={styles.readyCard}>
          <View style={styles.readyIconWrap}>
            <Mic color="#F97316" size={36} />
          </View>
          <Text style={styles.readyTitle}>{teilIndexLabel}</Text>
          {/* Show the instruction (question_text) as a small label */}
          <Text style={styles.readyTopic} numberOfLines={2}>{question.question_text}</Text>
          {/* For monologues + structured tasks, the actual TOPIC lives in
              stimulus_text (e.g. "Soziale Medien — Fluch oder Segen?
              Sprechen Sie über: Vorteile · Nachteile · ..."). Show it
              prominently or the user has nothing to talk about. */}
          {question.stimulus_text ? (
            <View style={styles.readyTopicCard}>
              <Text style={styles.readyTopicCardLabel}>Your topic</Text>
              <Text style={styles.readyTopicCardText}>{question.stimulus_text}</Text>
            </View>
          ) : null}
          <View style={styles.readyDivider} />
          <Text style={styles.readyHint}>
            Find a quiet space. You'll have a short conversation with the AI partner — speak naturally in German.
          </Text>
          <Text style={styles.readyMicNote}>🎤 Mic access required</Text>

          <Pressable style={styles.startBtn} onPress={handleStartConversation} testID="mock-sprechen-start">
            <Play color="#fff" size={18} />
            <Text style={styles.startBtnText}>Start Conversation</Text>
          </Pressable>
          <Pressable style={styles.skipLink} onPress={() => onSkipped('user_skip')} testID="mock-sprechen-skip">
            <Text style={styles.skipLinkText}>Skip this teil</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // PHASE: mic_denied (B2 retry / settings / skip)
  if (phase === 'mic_denied') {
    return (
      <View style={styles.center}>
        <View style={styles.readyCard}>
          <View style={[styles.readyIconWrap, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
            <MicOff color="#EF4444" size={36} />
          </View>
          <Text style={styles.readyTitle}>Mic access required</Text>
          <Text style={styles.readyHint}>
            Wordifi needs microphone access for the Sprechen section. Without it, this teil will be marked as 0%.
          </Text>
          {Platform.OS === 'ios' ? (
            <Pressable style={styles.startBtn} onPress={handleOpenSettings}>
              <SettingsIcon color="#fff" size={18} />
              <Text style={styles.startBtnText}>Open Settings</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.startBtn} onPress={handleStartConversation}>
              <Mic color="#fff" size={18} />
              <Text style={styles.startBtnText}>Try Again</Text>
            </Pressable>
          )}
          <Pressable style={styles.skipLink} onPress={() => onSkipped('mic_denied')}>
            <Text style={styles.skipLinkText}>Skip this teil (0%)</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // PHASE: connecting
  if (phase === 'connecting') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={B.primary} size="large" />
        <Text style={styles.statusText}>Connecting to AI partner...</Text>
      </View>
    );
  }

  // PHASE: scoring
  if (phase === 'scoring') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={B.primary} size="large" />
        <Text style={styles.statusText}>Saving your conversation...</Text>
      </View>
    );
  }

  // PHASE: error
  if (phase === 'error') {
    return (
      <View style={styles.center}>
        <View style={styles.readyCard}>
          <View style={[styles.readyIconWrap, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
            <AlertCircle color="#EF4444" size={36} />
          </View>
          <Text style={styles.readyTitle}>Something went wrong</Text>
          <Text style={styles.readyHint}>{errorMsg ?? 'Please try again or skip this teil.'}</Text>
          <Pressable style={styles.startBtn} onPress={handleStartConversation}>
            <Text style={styles.startBtnText}>Retry</Text>
          </Pressable>
          <Pressable style={styles.skipLink} onPress={() => onSkipped('user_skip')}>
            <Text style={styles.skipLinkText}>Skip this teil</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // PHASE: conversation
  const remainingSeconds = Math.max(0, recordingTimeLimitSec - elapsedSeconds);
  const isLowTime = remainingSeconds <= 30;
  const progressPct = Math.min(100, (elapsedSeconds / recordingTimeLimitSec) * 100);
  const statusLabel = (() => {
    switch (convState) {
      case 'connecting': return 'Connecting…';
      case 'connected':  return 'Connected';
      case 'ai_speaking': return 'Alex is speaking...';
      case 'listening':  return 'Listening...';
      case 'ended':      return 'Conversation ended';
      case 'error':      return 'Error';
      default:           return '...';
    }
  })();
  const statusColor = (() => {
    switch (convState) {
      case 'ai_speaking': return '#14B86A';
      case 'listening': return B.primary;
      case 'connected': return B.primary;
      default: return B.muted;
    }
  })();

  return (
    <View style={styles.convScreen}>
      {/* Compact header: breadcrumb + timer */}
      <View style={styles.convHeader}>
        <Text style={styles.convTitle}>{teilIndexLabel}</Text>
        <View style={[styles.timerBadge, isLowTime && styles.timerBadgeRed]}>
          <TimerIcon color={isLowTime ? '#fff' : B.muted} size={12} />
          <Text style={[styles.timerText, isLowTime && styles.timerTextUrgent]}>
            {formatTime(remainingSeconds)}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.timerProgressTrack}>
        <View style={[
          styles.timerProgressFill,
          {
            width: `${progressPct}%` as `${number}%`,
            backgroundColor: isLowTime ? '#EF4444' : B.primary,
          },
        ]} />
      </View>

      {/* Alex avatar (pulsing) */}
      <View style={styles.avatarSection}>
        <Animated.View style={[styles.avatarCircle, { opacity: pulseAnim }]} />
        <Text style={styles.avatarName}>Alex</Text>
        <Text style={[styles.avatarStatus, { color: statusColor }]}>{statusLabel}</Text>
      </View>

      {/* Transcript */}
      <ScrollView style={styles.transcriptScroll} contentContainerStyle={styles.transcriptContent}>
        {transcriptEntries.map((entry, i) => (
          <View key={i} style={[styles.bubble, entry.role === 'assistant' ? styles.bubbleAi : styles.bubbleUser]}>
            <Text style={[styles.bubbleRole, entry.role === 'user' && styles.bubbleRoleUser]}>
              {entry.role === 'assistant' ? 'Partner' : 'Sie'}
            </Text>
            <Text style={[styles.bubbleText, entry.role === 'user' && styles.bubbleTextUser]}>{entry.text}</Text>
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

      {/* Footer */}
      <View style={styles.convFooter}>
        {!isWebRTC && (
          <Pressable
            onPress={handleNativeRecord}
            style={[styles.recordBtn, isNativeRecording && styles.recordBtnActive]}
            testID="mock-sprechen-native-record"
          >
            {isNativeRecording ? <MicOff color="#fff" size={18} /> : <Mic color="#fff" size={18} />}
            <Text style={styles.recordBtnText}>{isNativeRecording ? 'Send' : 'Speak'}</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => {
            Alert.alert(
              'End Conversation?',
              "Your response will be saved. You won't see your score until the end of the mock.",
              [
                { text: 'Continue', style: 'cancel' },
                { text: 'End', style: 'destructive', onPress: () => void handleEndConversation() },
              ],
            );
          }}
          style={styles.endBtn}
          testID="mock-sprechen-end"
        >
          <PhoneOff color="#EF4444" size={16} />
          <Text style={styles.endBtnText}>End conversation</Text>
        </Pressable>
      </View>

      {/* Final 5-4-3-2-1 grace overlay */}
      {finalCountdown !== null && finalCountdown > 0 ? (
        <View style={styles.countdownOverlay} pointerEvents="none">
          <View style={styles.countdownCircle}>
            <Text style={styles.countdownNumber}>{finalCountdown}</Text>
          </View>
          <Text style={styles.countdownMessage}>Your speaking time is ending</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 14, backgroundColor: B.background },
  statusText: { fontSize: 14, color: B.muted, fontWeight: '600' as const },

  // Ready / mic_denied / error cards (shared)
  readyCard: {
    backgroundColor: B.card, borderRadius: 20, padding: 24,
    alignItems: 'center', gap: 12, width: '100%', maxWidth: 440,
    borderWidth: 1, borderColor: B.border,
  },
  readyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(249,115,22,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  readyTitle: { fontSize: 20, fontWeight: '800' as const, color: B.questionColor, textAlign: 'center' },
  readyTopic: { fontSize: 14, fontWeight: '600' as const, color: B.foreground, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
  readyTopicCard: {
    width: '100%',
    backgroundColor: 'rgba(249,115,22,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
    padding: 14,
    gap: 6,
    marginTop: 4,
  },
  readyTopicCardLabel: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: '#F97316',
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  readyTopicCardText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: B.questionColor,
    lineHeight: 22,
  },
  readyDivider: { width: '60%', height: 1, backgroundColor: B.border, marginVertical: 6 },
  readyHint: { fontSize: 13, color: B.muted, textAlign: 'center', lineHeight: 18, paddingHorizontal: 8 },
  readyMicNote: { fontSize: 12, color: B.muted, fontWeight: '600' as const },

  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: B.primary, borderRadius: 999,
    paddingVertical: 14, paddingHorizontal: 24, marginTop: 8, minWidth: 200,
  },
  startBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' as const },
  skipLink: { paddingVertical: 8, paddingHorizontal: 12 },
  skipLinkText: { color: B.muted, fontSize: 13, fontWeight: '600' as const },

  // ── Conversation screen ──────────────────────────────────────────────────
  convScreen: { flex: 1, backgroundColor: B.background },

  // Header: compact row with breadcrumb + timer badge
  convHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  convTitle: { fontSize: 14, fontWeight: '700' as const, color: B.questionColor },
  timerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, backgroundColor: '#F1F5F9',
  },
  timerBadgeRed: { backgroundColor: '#EF4444' },
  timerText: { fontSize: 12, fontWeight: '800' as const, color: B.muted, fontVariant: ['tabular-nums'] },
  timerTextUrgent: { color: '#fff' },

  // Progress bar (full-width, below header)
  timerProgressTrack: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  timerProgressFill: { height: 4 },

  // Avatar section (centered)
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: B.primary,
    marginBottom: 4,
  },
  avatarName: { fontSize: 16, fontWeight: '800' as const, color: B.questionColor },
  avatarStatus: { fontSize: 13, fontWeight: '600' as const },

  // Transcript
  transcriptScroll: { flex: 1 },
  transcriptContent: { paddingHorizontal: 16, paddingBottom: 100, gap: 8 },
  bubble: { borderRadius: 14, padding: 12, maxWidth: '85%' },
  bubbleAi: { backgroundColor: B.card, borderWidth: 1, borderColor: B.border, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: B.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleRole: { fontSize: 10, fontWeight: '800' as const, color: B.muted, letterSpacing: 0.4, marginBottom: 2, textTransform: 'uppercase' as const },
  bubbleRoleUser: { color: 'rgba(255,255,255,0.7)' },
  bubbleText: { fontSize: 14, fontWeight: '500' as const, color: B.questionColor, lineHeight: 20 },
  bubbleTextUser: { color: '#fff' },

  // Silence nudge
  silenceNudge: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: ORANGE,
    borderRadius: 12, paddingVertical: 8, paddingHorizontal: 16,
    alignItems: 'center',
  },
  silenceNudgeText: { color: '#fff', fontSize: 14, fontWeight: '700' as const },

  // Footer
  convFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: 16, backgroundColor: B.card,
    borderTopWidth: 1, borderTopColor: B.border,
  },
  recordBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 999, backgroundColor: B.primary,
  },
  recordBtnActive: { backgroundColor: '#EF4444' },
  recordBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' as const },
  endBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 999, borderWidth: 1.5, borderColor: '#EF4444',
  },
  endBtnText: { color: '#EF4444', fontSize: 14, fontWeight: '700' as const },

  // Final countdown overlay
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  countdownCircle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  countdownNumber: { fontSize: 56, fontWeight: '800' as const, color: '#EF4444' },
  countdownMessage: { fontSize: 16, fontWeight: '700' as const, color: '#fff', textAlign: 'center', paddingHorizontal: 32 },
});
