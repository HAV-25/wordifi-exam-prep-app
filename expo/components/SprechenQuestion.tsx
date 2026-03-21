import { Audio } from 'expo-av';
import { ChevronRight, Mic, Pause, Play, Square, Star, Volume2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AudioPlayer } from '@/components/AudioPlayer';
import { CTAButton } from '@/components/CTAButton';
import { colors, fontSize, radius, shadows, spacing } from '@/theme';
import type { SprechenResponse } from '@/lib/sprechenHelpers';
import { isDialogueTask, isPresentationTask } from '@/lib/sprechenHelpers';
import type { AppQuestion } from '@/types/database';

type PartnerPrompt = {
  turn: number;
  audio_script: string;
  label: string;
};

type RubricCard = {
  fluency: string;
  vocabulary: string;
  grammar: string;
  pronunciation: string;
};

type SprechenQuestionProps = {
  question: AppQuestion;
  sessionId: string | null;
  existingResponse: SprechenResponse | null;
  onComplete: (recordingUrl: string, durationSec: number) => void;
  onSelfRate?: (rating: number) => void;
  isUploading?: boolean;
  uploadError?: string | null;
  onRetryUpload?: () => void;
};

type UIState = 'instruction' | 'recording' | 'review' | 'result';

const NUMBER_CIRCLES = ['①', '②', '③', '④', '⑤', '⑥'];

export function SprechenQuestion({
  question,
  sessionId: _sessionId,
  existingResponse,
  onComplete,
  onSelfRate,
  isUploading = false,
  uploadError = null,
  onRetryUpload,
}: SprechenQuestionProps) {
  const structureType = question.source_structure_type ?? '';
  const isDialogue = isDialogueTask(structureType);
  const isPresentation = isPresentationTask(structureType);
  const recordingTimeLimit = (question as Record<string, unknown>).recording_time_limit_sec as number | undefined ?? 60;
  const partnerPrompts = (question as Record<string, unknown>).partner_prompts as PartnerPrompt[] | null ?? null;
  const rubricCard = (question as Record<string, unknown>).rubric_card as RubricCard | null ?? null;
  const modelAnswerAudioUrl = (question as Record<string, unknown>).model_answer_audio_url as string | null ?? null;
  const modelAnswerScript = (question as Record<string, unknown>).model_answer_script as string | null ?? null;
  const moderatorAudioUrl = (question as Record<string, unknown>).moderator_audio_url as string | null ?? null;

  const [uiState, setUiState] = useState<UIState>(existingResponse ? 'result' : 'instruction');
  const [prepCountdown, setPrepCountdown] = useState<number>(isPresentation ? 15 : 0);
  const [isPrepSkipped, setIsPrepSkipped] = useState<boolean>(!isPresentation);
  const [recordingInstance, setRecordingInstance] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [playbackSound, setPlaybackSound] = useState<Audio.Sound | null>(null);
  const [isPlayingBack, setIsPlayingBack] = useState<boolean>(false);
  const [playbackPosition, setPlaybackPosition] = useState<number>(0);
  const [playbackDuration, setPlaybackDuration] = useState<number>(0);
  const [dialogueTurn, setDialogueTurn] = useState<number>(0);
  const [isPartnerTurn, setIsPartnerTurn] = useState<boolean>(false);
  const [selfRating, setSelfRating] = useState<number | null>(existingResponse?.self_rating ?? null);
  const [hasRated, setHasRated] = useState<boolean>(existingResponse?.self_rating != null);
  const [showModelScript, setShowModelScript] = useState<boolean>(false);
  const [tooShortWarning, setTooShortWarning] = useState<boolean>(false);

  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartRef = useRef<number>(0);

  useEffect(() => {
    if (existingResponse) {
      setUiState('result');
    } else {
      setUiState('instruction');
      setRecordingUri(null);
      setRecordingDuration(0);
      setPrepCountdown(isPresentation ? 15 : 0);
      setIsPrepSkipped(!isPresentation);
      setDialogueTurn(0);
      setIsPartnerTurn(false);
      setSelfRating(null);
      setHasRated(false);
      setShowModelScript(false);
      setTooShortWarning(false);
    }
  }, [question.id, existingResponse, isPresentation]);

  useEffect(() => {
    if (isRecording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  useEffect(() => {
    if (isPresentation && !isPrepSkipped && uiState === 'instruction') {
      prepTimerRef.current = setInterval(() => {
        setPrepCountdown((prev) => {
          if (prev <= 1) {
            if (prepTimerRef.current) clearInterval(prepTimerRef.current);
            setIsPrepSkipped(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (prepTimerRef.current) clearInterval(prepTimerRef.current);
      };
    }
  }, [isPresentation, isPrepSkipped, uiState]);

  const recordingInstanceRef = useRef<Audio.Recording | null>(null);
  const playbackSoundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    recordingInstanceRef.current = recordingInstance;
  }, [recordingInstance]);

  useEffect(() => {
    playbackSoundRef.current = playbackSound;
  }, [playbackSound]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (prepTimerRef.current) clearInterval(prepTimerRef.current);
      if (recordingInstanceRef.current) {
        void recordingInstanceRef.current.stopAndUnloadAsync().catch(() => {});
      }
      if (playbackSoundRef.current) {
        void playbackSoundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const options = useMemo(() => {
    if (!question.options) return [];
    return question.options as Array<{ key: string; text: string }>;
  }, [question.options]);

  const startRecording = useCallback(async () => {
    console.log('SprechenQuestion startRecording');
    setTooShortWarning(false);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecordingInstance(recording);
      setIsRecording(true);
      setRecordingDuration(0);
      recordingStartRef.current = Date.now();

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartRef.current) / 1000);
        setRecordingDuration(elapsed);

        if (elapsed >= recordingTimeLimit) {
          void stopRecordingRef.current?.();
        }
      }, 1000);

      setUiState('recording');
    } catch (err) {
      console.log('SprechenQuestion startRecording error', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingTimeLimit]);

  const stopRecording = useCallback(async () => {
    console.log('SprechenQuestion stopRecording');
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!recordingInstance) return;

    try {
      await recordingInstance.stopAndUnloadAsync();
      const uri = recordingInstance.getURI();
      const finalDuration = Math.floor((Date.now() - recordingStartRef.current) / 1000);
      setRecordingDuration(finalDuration);
      setIsRecording(false);

      if (finalDuration < 10) {
        setTooShortWarning(true);
        setRecordingInstance(null);
        setUiState('instruction');
        return;
      }

      if (uri) {
        setRecordingUri(uri);
        setUiState('review');
      }

      setRecordingInstance(null);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
    } catch (err) {
      console.log('SprechenQuestion stopRecording error', err);
      setIsRecording(false);
      setRecordingInstance(null);
    }
  }, [recordingInstance]);

  const stopRecordingRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  const handleDialogueStart = useCallback(async () => {
    if (isDialogue && partnerPrompts && partnerPrompts.length > 0) {
      setIsPartnerTurn(true);
      setDialogueTurn(1);
      setUiState('recording');
      setTimeout(() => {
        setIsPartnerTurn(false);
      }, 3000);
    } else {
      await startRecording();
    }
  }, [isDialogue, partnerPrompts, startRecording]);

  const handleDialogueUserDone = useCallback(async () => {
    await stopRecording();
    const totalTurns = partnerPrompts?.length ?? 0;
    if (dialogueTurn < totalTurns) {
      setDialogueTurn((prev) => prev + 1);
      setIsPartnerTurn(true);
      setTimeout(() => {
        setIsPartnerTurn(false);
      }, 3000);
    }
  }, [stopRecording, dialogueTurn, partnerPrompts]);

  const playRecording = useCallback(async () => {
    if (!recordingUri) return;

    try {
      if (playbackSound) {
        if (isPlayingBack) {
          await playbackSound.pauseAsync();
          setIsPlayingBack(false);
          return;
        }
        await playbackSound.playAsync();
        setIsPlayingBack(true);
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: recordingUri },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          setPlaybackPosition(status.positionMillis ?? 0);
          setPlaybackDuration(status.durationMillis ?? 0);
          setIsPlayingBack(status.isPlaying);
          if (status.didJustFinish) {
            setIsPlayingBack(false);
            setPlaybackPosition(0);
          }
        }
      );
      setPlaybackSound(sound);
      setIsPlayingBack(true);
    } catch (err) {
      console.log('SprechenQuestion playRecording error', err);
    }
  }, [recordingUri, playbackSound, isPlayingBack]);

  const handleReRecord = useCallback(async () => {
    if (playbackSound) {
      await playbackSound.unloadAsync();
      setPlaybackSound(null);
    }
    setRecordingUri(null);
    setRecordingDuration(0);
    setIsPlayingBack(false);
    setPlaybackPosition(0);
    setPlaybackDuration(0);
    setUiState('instruction');
  }, [playbackSound]);

  const handleSubmit = useCallback(() => {
    if (!recordingUri) return;
    onComplete(recordingUri, recordingDuration);
  }, [recordingUri, recordingDuration, onComplete]);

  const handleSelfRate = useCallback((rating: number) => {
    setSelfRating(rating);
    setHasRated(true);
    onSelfRate?.(rating);
  }, [onSelfRate]);

  const formatTime = useCallback((seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  const progressPct = recordingTimeLimit > 0
    ? Math.min(recordingDuration / recordingTimeLimit, 1)
    : 0;

  const renderTaskCard = () => (
    <View style={[styles.taskCard, shadows.card]}>
      <Text style={styles.taskCardText}>{question.question_text}</Text>
      {question.stimulus_text ? (
        <Text style={styles.taskCardStimulus}>{question.stimulus_text}</Text>
      ) : null}
    </View>
  );

  const renderRequiredPoints = () => {
    if (options.length === 0) return null;

    const isMindMap = structureType.includes('_monologue') && structureType.includes('a2');

    if (isMindMap) {
      return (
        <View style={[styles.pointsCard, shadows.card]}>
          <Text style={styles.pointsHeader}>Stichpunkte zum Thema:</Text>
          <View style={styles.mindMapGrid}>
            {options.map((opt, idx) => (
              <View key={opt.key ?? idx} style={styles.mindMapItem}>
                <Text style={styles.mindMapText}>{opt.text}</Text>
              </View>
            ))}
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.pointsCard, shadows.card]}>
        <Text style={styles.pointsHeader}>Sie müssen folgende Punkte ansprechen:</Text>
        {options.map((opt, idx) => (
          <View key={opt.key ?? idx} style={styles.pointRow}>
            <Text style={styles.pointNumber}>{NUMBER_CIRCLES[idx] ?? `${idx + 1}`}</Text>
            <Text style={styles.pointText}>{opt.text}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderDialogueInfo = () => {
    if (!isDialogue) return null;
    return (
      <View style={styles.dialogueBanner}>
        <Mic color={colors.muted} size={14} />
        <Text style={styles.dialogueBannerText}>
          Ihr Gesprächspartner spricht zuerst. Hören Sie zu, dann antworten Sie.
        </Text>
      </View>
    );
  };

  const renderPrepTimer = () => {
    if (!isPresentation || isPrepSkipped || uiState !== 'instruction') return null;
    const progress = prepCountdown / 15;
    return (
      <View style={styles.prepTimerWrap}>
        <Text style={styles.prepTimerLabel}>Vorbereitungszeit</Text>
        <View style={styles.prepTimerCircle}>
          <Text style={styles.prepTimerNumber}>{prepCountdown}</Text>
        </View>
        <View style={styles.prepTimerBar}>
          <View style={[styles.prepTimerFill, { width: `${progress * 100}%` }]} />
        </View>
        <Pressable onPress={() => { setIsPrepSkipped(true); setPrepCountdown(0); }} style={styles.skipBtn}>
          <Text style={styles.skipBtnText}>Überspringen</Text>
        </Pressable>
      </View>
    );
  };

  const renderModeratorReplay = () => {
    if (!moderatorAudioUrl || uiState !== 'instruction') return null;
    return (
      <Pressable style={styles.replayInstructionBtn}>
        <Volume2 color={colors.blue} size={16} />
        <Text style={styles.replayInstructionText}>Aufgabe nochmal hören</Text>
      </Pressable>
    );
  };

  if (uiState === 'instruction') {
    return (
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {renderTaskCard()}
        {renderRequiredPoints()}
        {renderDialogueInfo()}
        {renderPrepTimer()}
        {renderModeratorReplay()}

        {tooShortWarning ? (
          <Text style={styles.warningText}>Bitte sprechen Sie mehr.</Text>
        ) : null}

        <View style={styles.ctaWrap}>
          <CTAButton
            label={isDialogue ? 'Gespräch beginnen' : 'Aufnahme starten'}
            onPress={isDialogue ? handleDialogueStart : startRecording}
            disabled={isPresentation && !isPrepSkipped}
            testID="sprechen-start-recording"
          />
        </View>
      </ScrollView>
    );
  }

  if (uiState === 'recording') {
    return (
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {renderTaskCard()}
        {renderRequiredPoints()}

        {isDialogue && isPartnerTurn ? (
          <View style={[styles.partnerBubble, shadows.card]}>
            <View style={styles.partnerHeader}>
              <Text style={styles.partnerLabel}>
                Runde {dialogueTurn} von {partnerPrompts?.length ?? 0}
              </Text>
              <Text style={styles.partnerSpeaking}>Partner spricht...</Text>
            </View>
            {partnerPrompts && partnerPrompts[dialogueTurn - 1] ? (
              <View style={styles.speechBubble}>
                <Text style={styles.speechText}>
                  {partnerPrompts[dialogueTurn - 1]!.audio_script}
                </Text>
              </View>
            ) : null}
            <Text style={styles.partnerWait}>Jetzt sind Sie dran</Text>
            <CTAButton
              label="Antwort aufnehmen"
              onPress={startRecording}
              testID="sprechen-record-reply"
            />
          </View>
        ) : (
          <View style={styles.recordingControls}>
            <Animated.View style={[styles.recordingIndicator, { opacity: pulseAnim }]}>
              <Mic color={colors.white} size={28} />
            </Animated.View>
            <Text style={styles.recordingLabel}>Aufnahme läuft...</Text>
            <Text style={styles.recordingTimer}>{formatTime(recordingDuration)}</Text>

            <View style={styles.timeBar}>
              <View style={[styles.timeBarFill, { width: `${progressPct * 100}%` }]} />
            </View>
            <Text style={styles.timeLimitLabel}>
              {formatTime(recordingDuration)} / {formatTime(recordingTimeLimit)}
            </Text>

            <Pressable
              onPress={isDialogue ? handleDialogueUserDone : stopRecording}
              style={styles.stopBtn}
              testID="sprechen-stop-recording"
            >
              <Square color={colors.red} size={16} />
              <Text style={styles.stopBtnText}>
                {isDialogue ? 'Antwort beenden' : 'Aufnahme beenden'}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    );
  }

  if (uiState === 'review') {
    const playbackProgress = playbackDuration > 0 ? playbackPosition / playbackDuration : 0;
    return (
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {renderTaskCard()}

        <View style={[styles.playbackCard, shadows.card]}>
          <Text style={styles.playbackLabel}>Ihre Aufnahme</Text>
          <View style={styles.playbackRow}>
            <Pressable onPress={playRecording} style={styles.playbackBtn} testID="sprechen-play-recording">
              {isPlayingBack ? (
                <Pause color={colors.white} size={18} />
              ) : (
                <Play color={colors.white} size={18} />
              )}
            </Pressable>
            <View style={styles.playbackBarWrap}>
              <View style={styles.playbackTrack}>
                <View style={[styles.playbackFill, { width: `${playbackProgress * 100}%` }]} />
              </View>
              <Text style={styles.playbackTime}>
                {formatTime(Math.floor(playbackPosition / 1000))} / {formatTime(recordingDuration)}
              </Text>
            </View>
          </View>
        </View>

        {uploadError ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{uploadError}</Text>
            <Pressable onPress={onRetryUpload} style={styles.retryBtn} testID="sprechen-retry-upload">
              <Text style={styles.retryText}>Erneut versuchen</Text>
            </Pressable>
          </View>
        ) : null}

        {isUploading ? (
          <View style={styles.uploadingWrap}>
            <ActivityIndicator color={colors.blue} />
            <Text style={styles.uploadingText}>Wird gespeichert...</Text>
          </View>
        ) : (
          <View style={styles.reviewActions}>
            <Pressable onPress={handleReRecord} style={styles.secondaryBtn} testID="sprechen-re-record">
              <Text style={styles.secondaryBtnText}>Nochmal aufnehmen</Text>
            </Pressable>
            <CTAButton
              label="Abschicken"
              onPress={handleSubmit}
              testID="sprechen-submit"
            />
          </View>
        )}
      </ScrollView>
    );
  }

  const responseData = existingResponse;
  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {renderTaskCard()}

      {responseData?.recording_url ? (
        <View style={[styles.playbackCard, shadows.card]}>
          <Text style={styles.playbackLabel}>Ihre Aufnahme</Text>
          <AudioPlayer audioUrl={responseData.recording_url} />
        </View>
      ) : null}

      {modelAnswerAudioUrl ? (
        <View style={[styles.modelCard, shadows.card]}>
          <Text style={styles.modelHeader}>Musterantwort anhören</Text>
          <AudioPlayer audioUrl={modelAnswerAudioUrl} />
          {modelAnswerScript ? (
            <>
              <Pressable
                onPress={() => setShowModelScript((v) => !v)}
                style={styles.modelScriptToggle}
                testID="sprechen-toggle-model-script"
              >
                <Text style={styles.modelScriptToggleText}>
                  {showModelScript ? 'Musterantwort ausblenden' : 'Musterantwort lesen'}
                </Text>
                <ChevronRight
                  color={colors.blue}
                  size={16}
                  style={showModelScript ? styles.chevronDown : undefined}
                />
              </Pressable>
              {showModelScript ? (
                <Text style={styles.modelScriptText}>{modelAnswerScript}</Text>
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}

      {rubricCard ? (
        <View style={[styles.rubricCard, shadows.card]}>
          <Text style={styles.rubricHeader}>Bewertungskriterien</Text>
          <View style={styles.rubricRow}>
            <Text style={styles.rubricLabel}>Flüssigkeit</Text>
            <Text style={styles.rubricValue}>{rubricCard.fluency}</Text>
          </View>
          <View style={styles.rubricDivider} />
          <View style={styles.rubricRow}>
            <Text style={styles.rubricLabel}>Wortschatz</Text>
            <Text style={styles.rubricValue}>{rubricCard.vocabulary}</Text>
          </View>
          <View style={styles.rubricDivider} />
          <View style={styles.rubricRow}>
            <Text style={styles.rubricLabel}>Grammatik</Text>
            <Text style={styles.rubricValue}>{rubricCard.grammar}</Text>
          </View>
          <View style={styles.rubricDivider} />
          <View style={styles.rubricRow}>
            <Text style={styles.rubricLabel}>Aussprache</Text>
            <Text style={styles.rubricValue}>{rubricCard.pronunciation}</Text>
          </View>
          <Text style={styles.rubricFooter}>V2: KI-Bewertung kommt bald</Text>
        </View>
      ) : null}

      {!hasRated && responseData ? (
        <View style={[styles.ratingCard, shadows.card]}>
          <Text style={styles.ratingPrompt}>Wie war Ihre Antwort?</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => handleSelfRate(star)}
                testID={`sprechen-star-${star}`}
              >
                <Star
                  color={selfRating != null && star <= selfRating ? colors.amber : colors.border}
                  fill={selfRating != null && star <= selfRating ? colors.amber : 'transparent'}
                  size={32}
                />
              </Pressable>
            ))}
          </View>
        </View>
      ) : hasRated ? (
        <View style={[styles.ratingCard, shadows.card]}>
          <Text style={styles.ratingThanks}>Danke für Ihr Feedback!</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
    paddingBottom: 140,
  },
  taskCard: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: spacing.lg,
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
  pointsCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pointsHeader: {
    color: colors.muted,
    fontSize: fontSize.label,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pointNumber: {
    color: colors.blue,
    fontSize: fontSize.bodyMd,
    fontWeight: '700' as const,
    width: 24,
  },
  pointText: {
    color: colors.text,
    fontSize: fontSize.bodyMd,
    fontWeight: '500' as const,
    flex: 1,
    lineHeight: 22,
  },
  mindMapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  mindMapItem: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  mindMapText: {
    color: colors.text,
    fontSize: fontSize.bodyMd,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  dialogueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  dialogueBannerText: {
    color: colors.muted,
    fontSize: fontSize.label,
    fontWeight: '500' as const,
    flex: 1,
  },
  prepTimerWrap: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  prepTimerLabel: {
    color: colors.muted,
    fontSize: fontSize.label,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  prepTimerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prepTimerNumber: {
    color: colors.white,
    fontSize: 34,
    fontWeight: '800' as const,
  },
  prepTimerBar: {
    width: '80%',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  prepTimerFill: {
    height: '100%',
    backgroundColor: colors.blue,
    borderRadius: 3,
  },
  skipBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  skipBtnText: {
    color: colors.muted,
    fontSize: fontSize.bodyMd,
    fontWeight: '600' as const,
  },
  replayInstructionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  replayInstructionText: {
    color: colors.blue,
    fontSize: fontSize.bodyMd,
    fontWeight: '600' as const,
  },
  warningText: {
    color: colors.amber,
    fontSize: fontSize.bodyMd,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  ctaWrap: {
    paddingTop: spacing.md,
  },
  recordingControls: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  recordingIndicator: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingLabel: {
    color: colors.red,
    fontSize: fontSize.bodyMd,
    fontWeight: '600' as const,
  },
  recordingTimer: {
    color: colors.text,
    fontSize: fontSize.displaySm,
    fontWeight: '800' as const,
    fontVariant: ['tabular-nums'],
  },
  timeBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  timeBarFill: {
    height: '100%',
    backgroundColor: colors.red,
    borderRadius: 2,
  },
  timeLimitLabel: {
    color: colors.muted,
    fontSize: fontSize.label,
    fontWeight: '500' as const,
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.red,
    marginTop: spacing.md,
  },
  stopBtnText: {
    color: colors.red,
    fontSize: fontSize.bodyMd,
    fontWeight: '700' as const,
  },
  partnerBubble: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  partnerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  partnerLabel: {
    color: colors.text,
    fontSize: fontSize.bodyMd,
    fontWeight: '700' as const,
  },
  partnerSpeaking: {
    color: colors.muted,
    fontSize: fontSize.label,
    fontWeight: '600' as const,
  },
  speechBubble: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  speechText: {
    color: colors.text,
    fontSize: fontSize.bodyMd,
    fontWeight: '500' as const,
    lineHeight: 22,
  },
  partnerWait: {
    color: colors.blue,
    fontSize: fontSize.bodyMd,
    fontWeight: '700' as const,
    textAlign: 'center',
  },
  playbackCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  playbackLabel: {
    color: colors.muted,
    fontSize: fontSize.label,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  playbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  playbackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playbackBarWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  playbackTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  playbackFill: {
    height: '100%',
    backgroundColor: colors.blue,
    borderRadius: 3,
  },
  playbackTime: {
    color: colors.muted,
    fontSize: fontSize.label,
    fontWeight: '500' as const,
  },
  reviewActions: {
    gap: spacing.md,
  },
  secondaryBtn: {
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: colors.text,
    fontSize: fontSize.bodyMd,
    fontWeight: '700' as const,
  },
  errorWrap: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  errorText: {
    fontSize: fontSize.bodyMd,
    color: colors.red,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: {
    fontSize: fontSize.bodyMd,
    color: colors.navy,
    fontWeight: '700' as const,
  },
  uploadingWrap: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  uploadingText: {
    color: colors.muted,
    fontSize: fontSize.bodyMd,
    fontWeight: '600' as const,
  },
  modelCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modelHeader: {
    color: colors.muted,
    fontSize: fontSize.label,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  modelScriptToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  modelScriptToggleText: {
    color: colors.blue,
    fontSize: fontSize.bodyMd,
    fontWeight: '600' as const,
  },
  chevronDown: {
    transform: [{ rotate: '90deg' }],
  },
  modelScriptText: {
    color: colors.text,
    fontSize: fontSize.bodyMd,
    fontWeight: '500' as const,
    lineHeight: 22,
    paddingTop: spacing.sm,
  },
  rubricCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  rubricHeader: {
    color: colors.navy,
    fontSize: fontSize.bodyLg,
    fontWeight: '800' as const,
    marginBottom: spacing.sm,
  },
  rubricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
  },
  rubricLabel: {
    color: colors.muted,
    fontSize: fontSize.label,
    fontWeight: '600' as const,
    width: 100,
  },
  rubricValue: {
    color: colors.text,
    fontSize: fontSize.bodyMd,
    fontWeight: '500' as const,
    flex: 1,
    textAlign: 'right' as const,
  },
  rubricDivider: {
    height: 0.5,
    backgroundColor: colors.border,
  },
  rubricFooter: {
    color: colors.muted,
    fontSize: fontSize.label,
    fontWeight: '500' as const,
    fontStyle: 'italic' as const,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  ratingCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  ratingPrompt: {
    color: colors.muted,
    fontSize: fontSize.bodyMd,
    fontWeight: '600' as const,
  },
  starsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ratingThanks: {
    color: colors.green,
    fontSize: fontSize.bodyMd,
    fontWeight: '700' as const,
  },
});
