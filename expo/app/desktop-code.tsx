import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Copy, Check } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import { colors } from '@/theme';
import {
  createDesktopSession,
  approveDesktopSession,
  pollDesktopSession,
  cancelDesktopSession,
  formatDesktopCode,
  type CreateDesktopSessionResult,
} from '@/lib/desktopSessionHelpers';

type ScreenPhase = 'loading' | 'code' | 'confirmed' | 'expired' | 'error';

export default function DesktopCodeScreen() {
  const params = useLocalSearchParams<{ level?: string; examType?: string }>();
  const level = params.level ?? 'A1';
  const examType = params.examType ?? 'BOTH';

  const [phase, setPhase] = useState<ScreenPhase>('loading');
  const [sessionData, setSessionData] = useState<CreateDesktopSessionResult | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isDeclining, setIsDeclining] = useState<boolean>(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiresAtRef = useRef<number>(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const confirmSlideAnim = useRef(new Animated.Value(0)).current;

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startSession = useCallback(async () => {
    setPhase('loading');
    cleanup();

    try {
      const result = await createDesktopSession(level, examType);
      setSessionData(result);

      const expiresMs = new Date(result.expires_at).getTime();
      expiresAtRef.current = expiresMs;
      const nowMs = Date.now();
      const totalSecs = Math.max(0, Math.round((expiresMs - nowMs) / 1000));
      setRemainingSeconds(totalSecs);

      setPhase('code');

      timerRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.round((expiresAtRef.current - Date.now()) / 1000));
        setRemainingSeconds(remaining);
        if (remaining <= 0) {
          setPhase('expired');
          cleanup();
        }
      }, 1000);

      pollRef.current = setInterval(async () => {
        try {
          const poll = await pollDesktopSession(result.session_id);
          if (!poll) return;

          if (poll.status === 'confirmed') {
            setPhase('confirmed');
            Animated.timing(confirmSlideAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }).start();
            if (Platform.OS !== 'web') {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          } else if (poll.status === 'active' || poll.status === 'completed') {
            cleanup();
            router.replace({
              pathname: '/desktop-active' as any,
              params: { sessionId: result.session_id, level },
            });
          } else if (poll.status === 'expired') {
            setPhase('expired');
            cleanup();
          } else if (poll.status === 'cancelled') {
            cleanup();
            router.back();
          }
        } catch (err) {
          console.log('[DesktopCode] Poll error:', err);
        }
      }, 2000);
    } catch (err) {
      console.log('[DesktopCode] Create session error:', err);
      setPhase('error');
    }
  }, [level, examType, cleanup, confirmSlideAnim]);

  useEffect(() => {
    void startSession();
    return cleanup;
  }, [startSession, cleanup]);

  useEffect(() => {
    if (phase === 'code') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [phase, pulseAnim]);

  const handleCopyUrl = useCallback(async () => {
    try {
      await Clipboard.setStringAsync('https://wordifi-desktop-test.netlify.app');
      setCopied(true);
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.log('[DesktopCode] Copy error:', err);
    }
  }, []);

  const handleApprove = useCallback(async () => {
    if (!sessionData || isApproving) return;
    setIsApproving(true);
    try {
      await approveDesktopSession(sessionData.session_id);
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      cleanup();
      router.replace({
        pathname: '/desktop-active' as any,
        params: { sessionId: sessionData.session_id, level },
      });
    } catch (err) {
      console.log('[DesktopCode] Approve error:', err);
      setIsApproving(false);
    }
  }, [sessionData, isApproving, cleanup, level]);

  const handleDecline = useCallback(async () => {
    if (!sessionData || isDeclining) return;
    setIsDeclining(true);
    try {
      await cancelDesktopSession(sessionData.session_id);
    } catch {}
    cleanup();
    router.back();
  }, [sessionData, isDeclining, cleanup]);

  const handleCancel = useCallback(async () => {
    if (sessionData && (phase === 'code' || phase === 'confirmed')) {
      try {
        await cancelDesktopSession(sessionData.session_id);
      } catch {}
    }
    cleanup();
    router.back();
  }, [sessionData, phase, cleanup]);

  const totalDuration = useMemo(() => {
    if (!sessionData) return 180;
    const expiresMs = new Date(sessionData.expires_at).getTime();
    const createdApprox = expiresMs - 180 * 1000;
    return Math.max(60, Math.round((expiresMs - createdApprox) / 1000));
  }, [sessionData]);

  const progressFraction = totalDuration > 0 ? remainingSeconds / totalDuration : 0;

  const timerColor = remainingSeconds <= 30
    ? colors.red
    : remainingSeconds <= 60
    ? colors.amber
    : colors.blue;

  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const statusText = useMemo(() => {
    if (phase === 'confirmed') return '✓ Computer verbunden — bitte bestätigen';
    if (phase === 'code') return 'Warten auf Eingabe des Codes...';
    return '';
  }, [phase]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={handleCancel} style={styles.backBtn} testID="desktop-code-back">
            <ChevronLeft color="#fff" size={24} />
          </Pressable>
          <Text style={styles.headerTitle}>📺  Test auf dem Computer starten</Text>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.body}>
          {phase === 'loading' ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.blue} size="large" />
              <Text style={styles.loadingText}>Session wird erstellt...</Text>
            </View>
          ) : phase === 'error' ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.errorEmoji}>⚠️</Text>
              <Text style={styles.errorTitle}>Fehler beim Erstellen der Session</Text>
              <Pressable onPress={startSession} style={styles.retryBtn}>
                <Text style={styles.retryBtnText}>Erneut versuchen</Text>
              </Pressable>
            </View>
          ) : phase === 'expired' ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.errorEmoji}>⏰</Text>
              <Text style={styles.errorTitle}>Code abgelaufen</Text>
              <Pressable onPress={startSession} style={styles.retryBtn}>
                <Text style={styles.retryBtnText}>Neuen Code generieren</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.instructionLabel}>Öffnen Sie auf Ihrem Computer:</Text>

              <Pressable
                onPress={handleCopyUrl}
                style={styles.urlChip}
                testID="desktop-code-copy-url"
              >
                <Text style={styles.urlText}>wordifi-desktop-test.netlify.app</Text>
                {copied ? (
                  <Check color={colors.green} size={16} />
                ) : (
                  <Copy color={colors.muted} size={16} />
                )}
              </Pressable>

              <Text style={styles.instructionLabel}>Und geben Sie diesen Code ein:</Text>

              <View style={styles.codeWrap}>
                <Text style={styles.codeText}>
                  {sessionData ? formatDesktopCode(sessionData.code) : ''}
                </Text>
              </View>

              <View style={styles.timerSection}>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.round(progressFraction * 100)}%`,
                        backgroundColor: timerColor,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.timerLabel, { color: timerColor }]}>
                  Gültig: {formatTime(remainingSeconds)}
                </Text>
              </View>

              {phase === 'confirmed' ? (
                <Animated.View
                  style={[
                    styles.confirmPanel,
                    {
                      opacity: confirmSlideAnim,
                      transform: [
                        {
                          translateY: confirmSlideAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [20, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Text style={styles.confirmTitle}>
                    Ein Computer möchte Ihren{'\n'}{level} Mock-Test öffnen.
                  </Text>
                  <Text style={styles.confirmSubtitle}>Sind Sie das?</Text>
                  <View style={styles.confirmActions}>
                    <Pressable
                      onPress={handleApprove}
                      disabled={isApproving}
                      style={styles.approveBtn}
                      testID="desktop-code-approve"
                    >
                      {isApproving ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.approveBtnText}>Ja, Test starten</Text>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={handleDecline}
                      disabled={isDeclining}
                      style={styles.declineBtn}
                      testID="desktop-code-decline"
                    >
                      <Text style={styles.declineBtnText}>Nein, Ablehnen</Text>
                    </Pressable>
                  </View>
                </Animated.View>
              ) : (
                <Animated.View style={[styles.statusRow, { opacity: pulseAnim }]}>
                  <Text style={styles.statusText}>{statusText}</Text>
                </Animated.View>
              )}
            </>
          )}
        </View>

        {(phase === 'code' || phase === 'confirmed') ? (
          <View style={styles.footer}>
            <Pressable onPress={handleCancel} style={styles.cancelBtn} testID="desktop-code-cancel">
              <Text style={styles.cancelBtnText}>Abbrechen</Text>
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800' as const,
    color: '#fff',
    textAlign: 'center' as const,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 20,
  },
  loadingWrap: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  errorEmoji: {
    fontSize: 48,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
  },
  retryBtn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.blue,
    marginTop: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  instructionLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  },
  urlChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  urlText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontWeight: '700' as const,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  codeWrap: {
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  codeText: {
    fontSize: 32,
    fontWeight: '900' as const,
    color: '#fff',
    letterSpacing: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center' as const,
  },
  timerSection: {
    gap: 8,
    alignItems: 'center',
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  timerLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    fontVariant: ['tabular-nums'],
  },
  statusRow: {
    alignItems: 'center',
    paddingTop: 8,
  },
  statusText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  confirmPanel: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    padding: 24,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  confirmTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    lineHeight: 24,
  },
  confirmSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  approveBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800' as const,
  },
  declineBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(226,77,77,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(226,77,77,0.3)',
  },
  declineBtnText: {
    color: colors.red,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  cancelBtn: {
    minHeight: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '700' as const,
  },
});
