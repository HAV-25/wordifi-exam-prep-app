import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Monitor, CheckCircle, XCircle } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme';
import {
  pollDesktopSession,
  cancelDesktopSession,
  type DesktopSessionStatus,
} from '@/lib/desktopSessionHelpers';

type ActivePhase = 'running' | 'completed' | 'ended';

const SECTIONS_ORDER = ['Hören', 'Lesen', 'Schreiben', 'Sprechen'] as const;

export default function DesktopActiveScreen() {
  const params = useLocalSearchParams<{ sessionId?: string; level?: string }>();
  const sessionId = params.sessionId ?? '';
  const level = params.level ?? '';

  const [phase, setPhase] = useState<ActivePhase>('running');
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  const [sectionScores, setSectionScores] = useState<Record<string, number> | null>(null);
  const [_status, setStatus] = useState<DesktopSessionStatus>('active');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    pollRef.current = setInterval(async () => {
      try {
        const poll = await pollDesktopSession(sessionId);
        if (!poll) return;

        setStatus(poll.status);
        setCurrentSection(poll.current_section ?? null);
        setSectionScores(poll.section_scores ?? null);

        if (poll.status === 'completed') {
          setPhase('completed');
          cleanup();
        } else if (poll.status === 'expired' || poll.status === 'cancelled') {
          setPhase('ended');
          cleanup();
        }
      } catch (err) {
        console.log('[DesktopActive] Poll error:', err);
      }
    }, 2000);

    return cleanup;
  }, [sessionId, cleanup]);

  useEffect(() => {
    if (phase === 'running') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.5, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [phase, pulseAnim]);

  const handleEndSession = useCallback(() => {
    Alert.alert(
      'Session beenden?',
      'Der Test auf dem Computer wird abgebrochen.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Beenden',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelDesktopSession(sessionId);
            } catch {}
            cleanup();
            router.back();
          },
        },
      ]
    );
  }, [sessionId, cleanup]);

  const handleViewResults = useCallback(() => {
    cleanup();
    router.replace({
      pathname: '/mock-results' as any,
      params: {
        mockTestId: sessionId,
        level,
        desktopSession: '1',
      },
    });
  }, [sessionId, level, cleanup]);

  const handleBack = useCallback(() => {
    cleanup();
    router.back();
  }, [cleanup]);

  if (phase === 'completed') {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safe}>
          <View style={styles.completedBody}>
            <Text style={styles.completedEmoji}>🎉</Text>
            <Text style={styles.completedTitle}>Test abgeschlossen!</Text>
            <Text style={styles.completedSubtitle}>
              Ihre Ergebnisse sind gespeichert.{'\n'}Tippen Sie unten, um Ihr Ergebnis{'\n'}in der App anzuzeigen.
            </Text>

            {sectionScores ? (
              <View style={styles.scoresCard}>
                {Object.entries(sectionScores).map(([section, score]) => (
                  <View key={section} style={styles.scoreRow}>
                    <Text style={styles.scoreLabel}>{section}</Text>
                    <Text style={styles.scoreValue}>{Math.round(Number(score))}%</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Pressable
              onPress={handleViewResults}
              style={styles.viewResultsBtn}
              testID="desktop-active-view-results"
            >
              <Text style={styles.viewResultsBtnText}>Ergebnisse in der App ansehen</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (phase === 'ended') {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safe}>
          <View style={styles.completedBody}>
            <Text style={styles.completedEmoji}>⏹️</Text>
            <Text style={styles.completedTitle}>Session beendet</Text>
            <Text style={styles.completedSubtitle}>
              Die Desktop-Session wurde beendet.
            </Text>
            <Pressable
              onPress={handleBack}
              style={styles.backToMockBtn}
              testID="desktop-active-back"
            >
              <Text style={styles.backToMockBtnText}>Zurück</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <View style={styles.headerCenter}>
            <Monitor color="#fff" size={18} />
            <Text style={styles.headerTitle}>Test läuft auf dem Computer</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.runningBody}>
          <View style={styles.levelCard}>
            <Text style={styles.levelLabel}>{level} Mock-Test</Text>
          </View>

          <View style={styles.sectionsCard}>
            <Text style={styles.sectionsTitle}>Abschnitt</Text>
            <View style={styles.sectionsList}>
              {SECTIONS_ORDER.map((section) => {
                const isCurrent = currentSection === section;
                const score = sectionScores?.[section];
                const isDone = score !== undefined && score !== null;
                return (
                  <View key={section} style={styles.sectionRow}>
                    {isDone ? (
                      <CheckCircle color={colors.green} size={18} />
                    ) : isCurrent ? (
                      <Animated.View style={{ opacity: pulseAnim }}>
                        <View style={styles.activeDot} />
                      </Animated.View>
                    ) : (
                      <View style={styles.inactiveDot} />
                    )}
                    <Text
                      style={[
                        styles.sectionLabel,
                        isCurrent && styles.sectionLabelActive,
                        isDone && styles.sectionLabelDone,
                      ]}
                    >
                      {section}
                    </Text>
                    {isDone ? (
                      <Text style={styles.sectionScore}>{Math.round(Number(score))}%</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Fortschritt wird in Echtzeit aktualisiert
            </Text>
          </View>

          <View style={styles.warningCard}>
            <Text style={styles.warningText}>
              Schließen Sie diese Seite nicht.{'\n'}Die App muss geöffnet bleiben.
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable
            onPress={handleEndSession}
            style={styles.endSessionBtn}
            testID="desktop-active-end-session"
          >
            <XCircle color={colors.red} size={18} />
            <Text style={styles.endSessionBtnText}>Session beenden</Text>
          </Pressable>
        </View>
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
  },
  headerSpacer: {
    width: 40,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  runningBody: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 20,
    paddingTop: 20,
  },
  levelCard: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  levelLabel: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800' as const,
  },
  sectionsCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 22,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sectionsTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  sectionsList: {
    gap: 14,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activeDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.blue,
  },
  inactiveDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  sectionLabel: {
    flex: 1,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  sectionLabelActive: {
    color: '#fff',
    fontWeight: '700' as const,
  },
  sectionLabelDone: {
    color: colors.green,
  },
  sectionScore: {
    color: colors.green,
    fontSize: 14,
    fontWeight: '800' as const,
  },
  infoCard: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  infoText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  warningCard: {
    backgroundColor: 'rgba(244,185,66,0.1)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(244,185,66,0.2)',
  },
  warningText: {
    color: colors.amber,
    fontSize: 14,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  endSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: 'rgba(226,77,77,0.35)',
    backgroundColor: 'rgba(226,77,77,0.08)',
  },
  endSessionBtnText: {
    color: colors.red,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  completedBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  completedEmoji: {
    fontSize: 64,
  },
  completedTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900' as const,
  },
  completedSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
    lineHeight: 22,
  },
  scoresCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 16,
    gap: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  scoreValue: {
    color: colors.green,
    fontSize: 16,
    fontWeight: '800' as const,
  },
  viewResultsBtn: {
    width: '100%',
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  viewResultsBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800' as const,
  },
  backToMockBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    marginTop: 8,
  },
  backToMockBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '700' as const,
  },
});
