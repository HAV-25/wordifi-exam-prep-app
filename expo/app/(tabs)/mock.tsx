import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { BookOpen, Clock, Headphones, Lock, Monitor, Play, Shield, Trophy, X } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { PaywallModal } from '@/components/PaywallModal';
import Colors from '@/constants/colors';
import {
  checkMockRetestAvailability,
  fetchMockQuestions,
  fetchMockTestInfo,
  getMockTiming,
  type MockTestInfo,
} from '@/lib/mockHelpers';
import { useAccess } from '@/providers/AccessProvider';
import { useAuth } from '@/providers/AuthProvider';

type SetupState = {
  visible: boolean;
  info: MockTestInfo | null;
  isTimed: boolean;
  isLocked: boolean;
  retestDate: string | null;
  isLoadingRetest: boolean;
  isStarting: boolean;
};

function formatRetestDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MockScreen() {
  const { profile, user } = useAuth();
  const { access } = useAccess();
  const userId = user?.id ?? '';
  const targetLevel = profile?.target_level ?? 'A1';
  const examType = profile?.exam_type ?? 'TELC';
  const [showPaywall, setShowPaywall] = useState<boolean>(false);
  const mockEnabled = access.mock_tests_enabled;

  const [setup, setSetup] = useState<SetupState>({
    visible: false,
    info: null,
    isTimed: true,
    isLocked: false,
    retestDate: null,
    isLoadingRetest: false,
    isStarting: false,
  });

  const infoQuery = useQuery({
    queryKey: ['mock-test-info', targetLevel],
    enabled: Boolean(targetLevel),
    queryFn: () => fetchMockTestInfo(targetLevel),
  });

  const info = infoQuery.data ?? null;
  const timing = getMockTiming(targetLevel);

  const openSetup = useCallback(async () => {
    if (!info) return;
    if (!mockEnabled) {
      setShowPaywall(true);
      return;
    }
    setSetup({
      visible: true,
      info,
      isTimed: true,
      isLocked: false,
      retestDate: null,
      isLoadingRetest: true,
      isStarting: false,
    });

    try {
      const retest = await checkMockRetestAvailability(userId, targetLevel);
      setSetup((prev) => ({
        ...prev,
        isLocked: retest.isLocked,
        retestDate: retest.retestDate,
        isLoadingRetest: false,
      }));
    } catch {
      setSetup((prev) => ({ ...prev, isLoadingRetest: false }));
    }
  }, [info, userId, targetLevel, mockEnabled]);

  const closeSetup = useCallback(() => {
    setSetup((prev) => ({ ...prev, visible: false }));
  }, []);

  const toggleTimed = useCallback(() => {
    setSetup((prev) => ({ ...prev, isTimed: !prev.isTimed }));
  }, []);

  const handleStart = useCallback(async () => {
    if (setup.isStarting || setup.isLocked) return;
    setSetup((prev) => ({ ...prev, isStarting: true }));

    try {
      const questions = await fetchMockQuestions(targetLevel);
      if (questions.horen.length === 0 && questions.lesen.length === 0) {
        setSetup((prev) => ({ ...prev, isStarting: false, visible: false }));
        return;
      }

      setSetup((prev) => ({ ...prev, visible: false, isStarting: false }));

      router.push({
        pathname: '/mock-test',
        params: {
          level: targetLevel,
          examType,
          isTimed: setup.isTimed ? '1' : '0',
          horenQuestions: JSON.stringify(questions.horen),
          lesenQuestions: JSON.stringify(questions.lesen),
          sprachbausteineT1Question: JSON.stringify(questions.sprachbausteineT1 ?? null),
          sprachbausteineT2Question: JSON.stringify(questions.sprachbausteineT2 ?? null),
        },
      });
    } catch (err) {
      console.log('MockScreen handleStart error', err);
      setSetup((prev) => ({ ...prev, isStarting: false }));
    }
  }, [setup.isStarting, setup.isLocked, setup.isTimed, targetLevel, examType]);

  const allLevels = ['A1', 'A2', 'B1'] as const;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerWrap}>
        <Text style={styles.headerTitle}>Full Mock Test</Text>
        <View style={styles.levelChip}>
          <Text style={styles.levelChipText}>{targetLevel}</Text>
        </View>
      </View>
      <Text style={styles.headerSub}>Complete exam simulation — Hören + Lesen</Text>

      {infoQuery.isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading mock test info...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {allLevels.map((level) => {
            const isTarget = level === targetLevel;
            const levelInfo = isTarget ? info : null;

            return (
              <Pressable
                key={level}
                accessibilityLabel={`${level} mock test`}
                onPress={isTarget ? openSetup : undefined}
                style={[styles.mockCard, !isTarget ? styles.mockCardLocked : null, isTarget && !mockEnabled ? styles.mockCardGated : null]}
                testID={`mock-card-${level}`}
                disabled={!isTarget}
              >
                <View style={styles.mockCardHeader}>
                  <View style={[styles.levelBadge, isTarget ? styles.levelBadgeActive : null]}>
                    <Text style={[styles.levelBadgeText, isTarget ? styles.levelBadgeTextActive : null]}>{level}</Text>
                  </View>

                  {!isTarget ? (
                    <View style={styles.lockBadge}>
                      <Lock color={Colors.textMuted} size={14} />
                    </View>
                  ) : null}
                </View>

                <View style={styles.sectionsList}>
                  <View style={styles.sectionRow}>
                    <View style={styles.sectionIconHoren}>
                      <Headphones color="#fff" size={14} />
                    </View>
                    <Text style={[styles.sectionLabel, !isTarget ? styles.textLocked : null]}>
                      Hören
                    </Text>
                    {levelInfo ? (
                      <Text style={styles.sectionCount}>{levelInfo.horenCount} Q</Text>
                    ) : null}
                  </View>
                  <View style={styles.sectionRow}>
                    <View style={styles.sectionIconLesen}>
                      <BookOpen color="#fff" size={14} />
                    </View>
                    <Text style={[styles.sectionLabel, !isTarget ? styles.textLocked : null]}>
                      Lesen
                    </Text>
                    {levelInfo ? (
                      <Text style={styles.sectionCount}>{levelInfo.lesenCount} Q</Text>
                    ) : null}
                  </View>
                  <View style={styles.sectionRow}>
                    <Lock color={Colors.textMuted} size={14} />
                    <Text style={styles.sectionLabelLocked}>Schreiben</Text>
                    <View style={styles.comingSoonPillInline}><Text style={styles.comingSoonTextInline}>Coming Soon</Text></View>
                  </View>
                  <View style={styles.sectionRow}>
                    <Lock color={Colors.textMuted} size={14} />
                    <Text style={styles.sectionLabelLocked}>Sprechen</Text>
                    <View style={styles.comingSoonPillInline}><Text style={styles.comingSoonTextInline}>Coming Soon</Text></View>
                  </View>
                </View>

                <View style={styles.mockCardFooter}>
                  {levelInfo ? (
                    <>
                      <View style={styles.footerStat}>
                        <Text style={styles.footerStatValue}>{levelInfo.totalCount}</Text>
                        <Text style={styles.footerStatLabel}>Questions</Text>
                      </View>
                      <View style={styles.footerDivider} />
                      <View style={styles.footerStat}>
                        <Text style={styles.footerStatValue}>~{levelInfo.estimatedMinutes}</Text>
                        <Text style={styles.footerStatLabel}>Minutes</Text>
                      </View>
                      <View style={styles.footerDivider} />
                      <View style={styles.footerStat}>
                        <Text style={styles.footerStatValue}>60%</Text>
                        <Text style={styles.footerStatLabel}>Pass mark</Text>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.lockedLabel}>Set as target level to unlock</Text>
                  )}
                </View>

                {isTarget ? (
                  <View style={styles.startHint}>
                    <Shield color={Colors.accent} size={16} />
                    <Text style={styles.startHintText}>Tap to start your mock exam</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}

          {info && info.totalCount === 0 ? (
            <EmptyState
              title="No questions available yet"
              description={`We're adding ${targetLevel} content soon. Check back later!`}
              testID="mock-empty-state"
            />
          ) : null}
        </ScrollView>
      )}

      <Modal
        animationType="slide"
        transparent
        visible={setup.visible}
        onRequestClose={closeSetup}
      >
        <Pressable style={styles.modalOverlay} onPress={closeSetup}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

            <View style={styles.modalHeader}>
              <Trophy color={Colors.accent} size={28} />
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>Mock Exam — {targetLevel}</Text>
                <Text style={styles.modalSubtitle}>Hören + Lesen</Text>
              </View>
              <Pressable
                accessibilityLabel="Cancel"
                onPress={closeSetup}
                hitSlop={8}
                testID="cancel-mock-button"
              >
                <X color={Colors.textMuted} size={22} />
              </Pressable>
            </View>

            <View style={styles.timingCard}>
              <Text style={styles.timingTitle}>Section Timing</Text>
              <View style={styles.timingRow}>
                <View style={styles.timingItem}>
                  <Headphones color="#1565C0" size={16} />
                  <Text style={styles.timingLabel}>Hören</Text>
                  <Text style={styles.timingValue}>{timing.horenMinutes} min</Text>
                </View>
                <View style={styles.timingDivider} />
                <View style={styles.timingItem}>
                  <BookOpen color="#6A1B9A" size={16} />
                  <Text style={styles.timingLabel}>Lesen</Text>
                  <Text style={styles.timingValue}>{timing.lesenMinutes} min</Text>
                </View>
              </View>
            </View>

            <Pressable
              accessibilityLabel="Toggle timed mode"
              onPress={toggleTimed}
              style={styles.timedRow}
              testID="mock-timed-toggle"
            >
              <View style={styles.timedInfo}>
                <Clock color={Colors.primary} size={18} />
                <View>
                  <Text style={styles.timedLabel}>Timed Mode</Text>
                  <Text style={styles.timedSub}>Simulates real exam conditions</Text>
                </View>
              </View>
              <View style={[styles.toggleTrack, setup.isTimed ? styles.toggleTrackOn : null]}>
                <Animated.View style={[styles.toggleThumb, setup.isTimed ? styles.toggleThumbOn : null]} />
              </View>
            </Pressable>

            <View style={styles.warningCard}>
              <Text style={styles.warningText}>
                You cannot go back between sections once you move forward.
              </Text>
            </View>

            {setup.isLoadingRetest ? (
              <ActivityIndicator color={Colors.primary} style={styles.retestLoader} />
            ) : setup.isLocked && setup.retestDate ? (
              <View style={styles.lockedBanner}>
                <Lock color={Colors.warning} size={16} />
                <Text style={styles.lockedText}>
                  Retest available {formatRetestDate(setup.retestDate)}
                </Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                accessibilityLabel="Start mock test"
                disabled={setup.isLocked || setup.isStarting}
                onPress={handleStart}
                style={[styles.startButton, setup.isLocked ? styles.buttonDisabled : null]}
                testID="start-mock-button"
              >
                {setup.isStarting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Play color="#fff" size={18} />
                    <Text style={styles.startButtonText}>Start Mock Test</Text>
                  </>
                )}
              </Pressable>
              <View style={[styles.desktopButton, { opacity: 0.55 }]}>
                <Monitor color={Colors.textMuted} size={16} />
                <Text style={[styles.desktopButtonText, { color: Colors.textMuted }]}>Continue on Computer</Text>
                <View style={styles.comingSoonPill}>
                  <Text style={styles.comingSoonText}>Coming Soon</Text>
                </View>
              </View>
            </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <PaywallModal
        visible={showPaywall}
        variant="mock"
        onUpgrade={() => setShowPaywall(false)}
        onDismiss={() => setShowPaywall(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  headerSub: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500' as const,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  levelChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: Colors.accent,
  },
  levelChipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800' as const,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 8,
    gap: 16,
    paddingBottom: 40,
  },
  mockCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 20,
    gap: 16,
  },
  mockCardLocked: {
    opacity: 0.5,
  },
  mockCardGated: {
    opacity: 0.6,
  },
  mockCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  levelBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Colors.surfaceMuted,
  },
  levelBadgeActive: {
    backgroundColor: Colors.primary,
  },
  levelBadgeText: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.textMuted,
  },
  levelBadgeTextActive: {
    color: '#fff',
  },

  lockBadge: {
    marginLeft: 'auto',
  },
  sectionsList: {
    gap: 8,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 32,
  },
  sectionIconHoren: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#1565C0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconLesen: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#6A1B9A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  sectionLabelLocked: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  comingSoon: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    fontStyle: 'italic' as const,
  },
  comingSoonPillInline: {
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  comingSoonTextInline: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  textLocked: {
    color: Colors.textMuted,
  },
  mockCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 16,
    padding: 14,
  },
  footerStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  footerStatValue: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  footerStatLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  footerDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
  lockedLabel: {
    flex: 1,
    textAlign: 'center' as const,
    color: Colors.textMuted,
    fontWeight: '600' as const,
    fontSize: 14,
  },
  startHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  startHintText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 16,
    maxHeight: '88%',
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  modalHeaderText: {
    flex: 1,
    gap: 2,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  timingCard: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  timingTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  timingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timingItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  timingLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  timingValue: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  timingDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
  },
  timedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 16,
    padding: 14,
  },
  timedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timedLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  timedSub: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textMuted,
  },
  toggleTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleTrackOn: {
    backgroundColor: Colors.accent,
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
  },
  toggleThumbOn: {
    alignSelf: 'flex-end' as const,
  },
  warningCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 14,
    padding: 14,
  },
  warningText: {
    color: '#F57F17',
    fontSize: 13,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  },
  retestLoader: {
    paddingVertical: 8,
  },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF8E1',
    borderRadius: 14,
    padding: 14,
  },
  lockedText: {
    color: '#F57F17',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  modalActions: {
    gap: 14,
    paddingTop: 4,
  },
  startButton: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800' as const,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  cancelButton: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  desktopButton: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  desktopButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  comingSoonPill: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  comingSoonText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '700' as const,
  },
});
