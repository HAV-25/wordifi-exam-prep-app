import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { BookOpen, ChevronDown, ChevronRight, Clock, Headphones, Lock, Mic, PenLine, Play } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
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
import { colors } from '@/theme';
import { fetchSchreibenQuestions, fetchSchreibenTeile } from '@/lib/schreibenHelpers';
import {
  fetchSprechenTeile,
  SPRECHEN_STRUCTURE_LABELS,
} from '@/lib/sprechenHelpers';
import {
  checkRetestAvailability,
  createSessionLink,
  fetchAvailableTeile,
  fetchSectionalQuestions,
  type RetestInfo,
  type TeilInfo,
} from '@/lib/sectionalHelpers';
import { useAccess } from '@/providers/AccessProvider';
import { useAuth } from '@/providers/AuthProvider';
import { SCHREIBEN_TASK_TYPE, SCHREIBEN_TASK_LABELS } from '@/types/schreiben';
import type { SprechenTeilInfo } from '@/lib/sprechenHelpers';

type SetupState = {
  visible: boolean;
  teilInfo: TeilInfo | null;
  isTimed: boolean;
  retestInfo: RetestInfo | null;
  isLoadingRetest: boolean;
  isStarting: boolean;
  isSendingLink: boolean;
};

const QUESTION_TYPE_LABELS: Record<string, string> = {
  mcq: 'Multiple Choice',
  true_false: 'True / False',
  matching: 'Matching',
  opinion: 'Ja / Nein',
};

function formatRetestDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TestsScreen() {
  const { profile, user } = useAuth();
  const { access } = useAccess();
  const userId = user?.id ?? '';
  const targetLevel = profile?.target_level ?? 'A1';
  const [showPaywall, setShowPaywall] = useState<boolean>(false);
  const sectionalEnabled = access.sectional_tests_enabled;

  const [setup, setSetup] = useState<SetupState>({
    visible: false,
    teilInfo: null,
    isTimed: false,
    retestInfo: null,
    isLoadingRetest: false,
    isStarting: false,
    isSendingLink: false,
  });

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'Hören': true,
    'Lesen': true,
    'Schreiben': true,
    'Sprechen': true,
  });
  const [schreibenStarting, setSchreibenStarting] = useState<number | null>(null);
  const [sprechenStarting] = useState<number | null>(null);

  const teileQuery = useQuery({
    queryKey: ['sectional-teile', targetLevel],
    enabled: Boolean(targetLevel),
    queryFn: () => fetchAvailableTeile(targetLevel),
  });

  const teile = useMemo(() => teileQuery.data ?? [], [teileQuery.data]);

  const horenTeile = useMemo(() => teile.filter((t) => t.section === 'Hören'), [teile]);
  const lesenTeile = useMemo(() => teile.filter((t) => t.section === 'Lesen'), [teile]);

  const schreibenQuery = useQuery({
    queryKey: ['schreiben-teile', targetLevel],
    enabled: Boolean(targetLevel),
    queryFn: () => fetchSchreibenTeile(targetLevel),
  });

  const schreibenTeile = useMemo(() => schreibenQuery.data ?? [], [schreibenQuery.data]);

  const schreibenEnabled = access.schreiben_enabled;
  const schreibenVisible = access.schreiben_visible;

  const sprechenEnabled = access.sprechen_enabled;
  const sprechenVisible = access.sprechen_visible;

  const sprechenQuery = useQuery({
    queryKey: ['sprechen-teile', targetLevel],
    enabled: Boolean(targetLevel),
    queryFn: () => fetchSprechenTeile(targetLevel),
  });

  const sprechenTeile = useMemo(() => sprechenQuery.data ?? [], [sprechenQuery.data]);

  const handleStartSprechen = useCallback((teil: number) => {
    if (!sprechenEnabled) {
      setShowPaywall(true);
      return;
    }
    router.push({
      pathname: '/sprechen-test',
      params: {
        level: targetLevel,
        teil: String(teil),
      },
    });
  }, [targetLevel, sprechenEnabled]);

  const handleStartSchreiben = useCallback(async (teil: number) => {
    if (!schreibenEnabled) {
      setShowPaywall(true);
      return;
    }
    setSchreibenStarting(teil);
    try {
      const questions = await fetchSchreibenQuestions(targetLevel, teil);
      if (questions.length === 0) {
        setSchreibenStarting(null);
        return;
      }
      setSchreibenStarting(null);
      router.push({
        pathname: '/schreiben-test',
        params: {
          level: targetLevel,
          teil: String(teil),
          questions: JSON.stringify(questions),
        },
      });
    } catch (err) {
      console.log('TestsScreen handleStartSchreiben error', err);
      setSchreibenStarting(null);
    }
  }, [targetLevel, schreibenEnabled]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const openSetup = useCallback(
    async (teilInfo: TeilInfo) => {
      if (!sectionalEnabled) {
        setShowPaywall(true);
        return;
      }
      setSetup({
        visible: true,
        teilInfo,
        isTimed: false,
        retestInfo: null,
        isLoadingRetest: true,
        isStarting: false,
        isSendingLink: false,
      });

      try {
        const info = await checkRetestAvailability(userId, targetLevel, teilInfo.section, teilInfo.teil);
        setSetup((prev) => ({ ...prev, retestInfo: info, isLoadingRetest: false }));
      } catch {
        setSetup((prev) => ({ ...prev, isLoadingRetest: false }));
      }
    },
    [userId, targetLevel, sectionalEnabled]
  );

  const closeSetup = useCallback(() => {
    setSetup((prev) => ({ ...prev, visible: false }));
  }, []);

  const toggleTimed = useCallback(() => {
    setSetup((prev) => ({ ...prev, isTimed: !prev.isTimed }));
  }, []);

  const handleStartTest = useCallback(async () => {
    if (!setup.teilInfo || setup.isStarting) return;

    setSetup((prev) => ({ ...prev, isStarting: true }));

    try {
      const questions = await fetchSectionalQuestions(
        targetLevel,
        setup.teilInfo.section,
        setup.teilInfo.teil
      );

      if (questions.length === 0) {
        setSetup((prev) => ({ ...prev, isStarting: false, visible: false }));
        return;
      }

      const examType = profile?.exam_type ?? 'TELC';
      const timeLimitSeconds = setup.isTimed ? questions.length * 45 : 0;

      setSetup((prev) => ({ ...prev, visible: false, isStarting: false }));

      router.push({
        pathname: '/sectional-test',
        params: {
          level: targetLevel,
          section: setup.teilInfo!.section,
          teil: String(setup.teilInfo!.teil),
          examType,
          isTimed: setup.isTimed ? '1' : '0',
          timeLimitSeconds: String(timeLimitSeconds),
          questions: JSON.stringify(questions),
        },
      });
    } catch (err) {
      console.log('TestsScreen handleStartTest error', err);
      setSetup((prev) => ({ ...prev, isStarting: false }));
    }
  }, [setup.teilInfo, setup.isTimed, setup.isStarting, targetLevel, profile?.exam_type]);

  const handleSendLink = useCallback(async () => {
    if (!setup.teilInfo || setup.isSendingLink) return;

    setSetup((prev) => ({ ...prev, isSendingLink: true }));

    try {
      const questions = await fetchSectionalQuestions(
        targetLevel,
        setup.teilInfo.section,
        setup.teilInfo.teil
      );

      if (questions.length === 0) {
        setSetup((prev) => ({ ...prev, isSendingLink: false }));
        return;
      }

      const examType = profile?.exam_type ?? 'TELC';
      const questionIds = questions.map((q) => q.id);

      const token = await createSessionLink({
        userId,
        level: targetLevel,
        section: setup.teilInfo.section,
        teil: setup.teilInfo.teil,
        examType,
        isTimed: setup.isTimed,
        questionIds,
      });

      const userEmail = user?.email ?? '';
      const subject = encodeURIComponent('Your Wordifi Test — Continue on Desktop');
      const body = encodeURIComponent(
        'Tap the link below to continue your test in any browser.\n\n' +
          'Section: ' + setup.teilInfo.section + ' · Teil ' + setup.teilInfo.teil + ' · ' + targetLevel + '\n' +
          'Link expires in 48 hours.\n\n' +
          'https://wordifi.app/test?token=' + token + '\n\n' +
          'This link can only be used once.'
      );

      await Linking.openURL('mailto:' + userEmail + '?subject=' + subject + '&body=' + body);
      setSetup((prev) => ({ ...prev, isSendingLink: false }));
    } catch (err) {
      console.log('TestsScreen handleSendLink error', err);
      setSetup((prev) => ({ ...prev, isSendingLink: false }));
    }
  }, [setup.teilInfo, setup.isTimed, setup.isSendingLink, userId, targetLevel, user?.email, profile?.exam_type]);

  const isLocked = setup.retestInfo?.is_locked ?? false;

  const renderTeilCard = useCallback(
    (info: TeilInfo) => {
      const typeLabel = QUESTION_TYPE_LABELS[info.question_type] ?? info.question_type;
      return (
        <Pressable
          key={`${info.section}-${info.teil}-${info.question_type}`}
          accessibilityLabel={`${info.section} Teil ${info.teil}`}
          onPress={() => openSetup(info)}
          style={[styles.teilCard, !sectionalEnabled && styles.teilCardDisabled]}
          testID={`teil-card-${info.section}-${info.teil}`}
        >
          <View style={styles.teilCardLeft}>
            <View style={styles.teilNumberWrap}>
              <Text style={styles.teilNumber}>{info.teil}</Text>
            </View>
            <View style={styles.teilCardMeta}>
              <Text style={styles.teilTitle}>Teil {info.teil}</Text>
              <Text style={styles.teilType}>{typeLabel}</Text>
            </View>
          </View>
          <View style={styles.teilCardRight}>
            <Text style={styles.teilCount}>{info.q_count} questions</Text>
            <View style={styles.teilDuration}>
              <Clock color={Colors.textMuted} size={12} />
              <Text style={styles.teilDurationText}>~{info.estimated_minutes} min</Text>
            </View>
          </View>
          <ChevronRight color={Colors.textMuted} size={18} />
        </Pressable>
      );
    },
    [openSetup, sectionalEnabled]
  );

  const renderSectionGroup = useCallback(
    (section: string, items: TeilInfo[], icon: React.ReactNode) => {
      const isExpanded = expandedSections[section] ?? true;
      return (
        <View style={styles.sectionGroup} key={section}>
          <Pressable
            accessibilityLabel={`Toggle ${section}`}
            onPress={() => toggleSection(section)}
            style={styles.sectionHeader}
            testID={`toggle-${section}`}
          >
            <View style={styles.sectionHeaderLeft}>
              {icon}
              <Text style={styles.sectionTitle}>{section}</Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{items.length} Teil{items.length !== 1 ? 'e' : ''}</Text>
              </View>
            </View>
            {isExpanded ? (
              <ChevronDown color={Colors.textMuted} size={20} />
            ) : (
              <ChevronRight color={Colors.textMuted} size={20} />
            )}
          </Pressable>
          {isExpanded ? (
            <View style={styles.teilList}>
              {items.length === 0 ? (
                <Text style={styles.noContent}>No {section} content available for {targetLevel} yet.</Text>
              ) : (
                items.map(renderTeilCard)
              )}
            </View>
          ) : null}
        </View>
      );
    },
    [expandedSections, toggleSection, targetLevel, renderTeilCard]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerWrap}>
        <Text style={styles.headerTitle}>Sectional Tests</Text>
        <View style={styles.levelChip}>
          <Text style={styles.levelChipText}>{targetLevel}</Text>
        </View>
      </View>
      <Text style={styles.headerSub}>Full exam section practice with detailed results</Text>

      {teileQuery.isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading available tests...</Text>
        </View>
      ) : teile.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            title="No tests available yet"
            description={`We're adding ${targetLevel} content soon. Check back later!`}
            testID="tests-empty-state"
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {renderSectionGroup(
            'Hören',
            horenTeile,
            <View style={styles.sectionIconHoren}><Headphones color="#fff" size={16} /></View>
          )}
          {renderSectionGroup(
            'Lesen',
            lesenTeile,
            <View style={styles.sectionIconLesen}><BookOpen color="#fff" size={16} /></View>
          )}

          {schreibenVisible ? (
            <View style={styles.sectionGroup}>
              <Pressable
                accessibilityLabel="Toggle Schreiben"
                onPress={() => toggleSection('Schreiben')}
                style={styles.sectionHeader}
                testID="toggle-Schreiben"
              >
                <View style={styles.sectionHeaderLeft}>
                  <View style={styles.sectionIconSchreiben}><PenLine color="#fff" size={16} /></View>
                  <Text style={styles.sectionTitle}>Schreiben</Text>
                  <View style={styles.sectionBadge}>
                    <Text style={styles.sectionBadgeText}>{schreibenTeile.length} Teil{schreibenTeile.length !== 1 ? 'e' : ''}</Text>
                  </View>
                </View>
                {expandedSections['Schreiben'] ? (
                  <ChevronDown color={Colors.textMuted} size={20} />
                ) : (
                  <ChevronRight color={Colors.textMuted} size={20} />
                )}
              </Pressable>
              {expandedSections['Schreiben'] ? (
                <View style={styles.teilList}>
                  {schreibenTeile.length === 0 ? (
                    <Text style={styles.noContent}>No Schreiben content available for {targetLevel} yet.</Text>
                  ) : (
                    schreibenTeile.map((info) => {
                      const taskType = SCHREIBEN_TASK_TYPE[targetLevel]?.[info.teil] ?? 'form_fill';
                      const taskLabel = SCHREIBEN_TASK_LABELS[taskType] ?? taskType;
                      const estimatedMin = Math.max(1, info.q_count * 5);
                      const isStarting = schreibenStarting === info.teil;
                      return (
                        <Pressable
                          key={`schreiben-${info.teil}`}
                          accessibilityLabel={`Schreiben Teil ${info.teil}`}
                          onPress={() => handleStartSchreiben(info.teil)}
                          style={[styles.teilCard, !schreibenEnabled && styles.teilCardDisabled]}
                          testID={`teil-card-Schreiben-${info.teil}`}
                        >
                          <View style={styles.teilCardLeft}>
                            <View style={styles.teilNumberWrap}>
                              <Text style={styles.teilNumber}>{info.teil}</Text>
                            </View>
                            <View style={styles.teilCardMeta}>
                              <Text style={styles.teilTitle}>Teil {info.teil}</Text>
                              <Text style={styles.teilType}>{taskLabel}</Text>
                            </View>
                          </View>
                          <View style={styles.teilCardRight}>
                            {!schreibenEnabled ? (
                              <View style={styles.lockedRow}>
                                <Lock color={colors.muted} size={12} />
                                <Text style={styles.lockedLabel}>Upgrade erforderlich</Text>
                              </View>
                            ) : (
                              <>
                                <Text style={styles.teilCount}>{info.q_count} questions</Text>
                                <View style={styles.teilDuration}>
                                  <Clock color={Colors.textMuted} size={12} />
                                  <Text style={styles.teilDurationText}>~{estimatedMin} min</Text>
                                </View>
                              </>
                            )}
                          </View>
                          {isStarting ? (
                            <ActivityIndicator color={colors.blue} size="small" />
                          ) : (
                            <ChevronRight color={Colors.textMuted} size={18} />
                          )}
                        </Pressable>
                      );
                    })
                  )}
                </View>
              ) : null}
            </View>
          ) : null}

          {sprechenVisible ? (
            <View style={styles.sectionGroup}>
              <Pressable
                accessibilityLabel="Toggle Sprechen"
                onPress={() => toggleSection('Sprechen')}
                style={styles.sectionHeader}
                testID="toggle-Sprechen"
              >
                <View style={styles.sectionHeaderLeft}>
                  <View style={styles.sectionIconSprechen}><Mic color="#fff" size={16} /></View>
                  <Text style={styles.sectionTitle}>Sprechen</Text>
                  <View style={styles.sectionBadge}>
                    <Text style={styles.sectionBadgeText}>{sprechenTeile.length} Teil{sprechenTeile.length !== 1 ? 'e' : ''}</Text>
                  </View>
                </View>
                {expandedSections['Sprechen'] ? (
                  <ChevronDown color={Colors.textMuted} size={20} />
                ) : (
                  <ChevronRight color={Colors.textMuted} size={20} />
                )}
              </Pressable>
              {expandedSections['Sprechen'] ? (
                <View style={styles.teilList}>
                  {sprechenTeile.length === 0 ? (
                    <Text style={styles.noContent}>No Sprechen content available for {targetLevel} yet.</Text>
                  ) : (
                    sprechenTeile.map((info: SprechenTeilInfo) => {
                      const structLabel = SPRECHEN_STRUCTURE_LABELS[info.source_structure_type] ?? 'Sprechen';
                      const estimatedMin = Math.max(1, Math.ceil((info.q_count * 60) / 60));
                      const isStarting = sprechenStarting === info.teil;
                      return (
                        <Pressable
                          key={`sprechen-${info.teil}`}
                          accessibilityLabel={`Sprechen Teil ${info.teil}`}
                          onPress={() => handleStartSprechen(info.teil)}
                          style={[styles.teilCard, !sprechenEnabled && styles.teilCardDisabled]}
                          testID={`teil-card-Sprechen-${info.teil}`}
                        >
                          <View style={styles.teilCardLeft}>
                            <View style={styles.teilNumberWrap}>
                              <Text style={styles.teilNumber}>{info.teil}</Text>
                            </View>
                            <View style={styles.teilCardMeta}>
                              <Text style={styles.teilTitle}>Teil {info.teil}</Text>
                              <Text style={styles.teilType}>{structLabel}</Text>
                            </View>
                          </View>
                          <View style={styles.teilCardRight}>
                            {!sprechenEnabled ? (
                              <View style={styles.lockedRow}>
                                <Lock color={colors.muted} size={12} />
                                <Text style={styles.lockedLabel}>Upgrade erforderlich</Text>
                              </View>
                            ) : (
                              <>
                                <Text style={styles.teilCount}>{info.q_count} questions</Text>
                                <View style={styles.teilDuration}>
                                  <Clock color={Colors.textMuted} size={12} />
                                  <Text style={styles.teilDurationText}>~{estimatedMin} min</Text>
                                </View>
                              </>
                            )}
                          </View>
                          {isStarting ? (
                            <ActivityIndicator color={colors.blue} size="small" />
                          ) : (
                            <ChevronRight color={Colors.textMuted} size={18} />
                          )}
                        </Pressable>
                      );
                    })
                  )}
                </View>
              ) : null}
            </View>
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
            {setup.teilInfo ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={[
                    styles.modalSectionIcon,
                    setup.teilInfo.section === 'Hören' ? styles.sectionIconHoren : styles.sectionIconLesen,
                  ]}>
                    {setup.teilInfo.section === 'Hören' ? (
                      <Headphones color="#fff" size={18} />
                    ) : (
                      <BookOpen color="#fff" size={18} />
                    )}
                  </View>
                  <View style={styles.modalHeaderText}>
                    <Text style={styles.modalTitle}>
                      {setup.teilInfo.section} · Teil {setup.teilInfo.teil}
                    </Text>
                    <Text style={styles.modalSubtitle}>{targetLevel} · {QUESTION_TYPE_LABELS[setup.teilInfo.question_type] ?? setup.teilInfo.question_type}</Text>
                  </View>
                </View>

                <View style={styles.modalStats}>
                  <View style={styles.modalStat}>
                    <Text style={styles.modalStatValue}>{setup.teilInfo.q_count}</Text>
                    <Text style={styles.modalStatLabel}>Questions</Text>
                  </View>
                  <View style={styles.modalStatDivider} />
                  <View style={styles.modalStat}>
                    <Text style={styles.modalStatValue}>~{setup.teilInfo.estimated_minutes}</Text>
                    <Text style={styles.modalStatLabel}>Minutes</Text>
                  </View>
                </View>

                <Pressable
                  accessibilityLabel="Toggle timed mode"
                  onPress={toggleTimed}
                  style={styles.timedRow}
                  testID="timed-toggle"
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

                {setup.isLoadingRetest ? (
                  <ActivityIndicator color={Colors.primary} style={styles.retestLoader} />
                ) : isLocked && setup.retestInfo?.retest_available_at ? (
                  <View style={styles.lockedBanner}>
                    <Lock color={Colors.warning} size={16} />
                    <Text style={styles.lockedText}>
                      Available {formatRetestDate(setup.retestInfo.retest_available_at)}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.modalActions}>
                  <Pressable
                    accessibilityLabel="Start test"
                    disabled={isLocked || setup.isStarting}
                    onPress={handleStartTest}
                    style={[styles.startButton, isLocked ? styles.buttonDisabled : null]}
                    testID="start-test-button"
                  >
                    {setup.isStarting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Play color="#fff" size={18} />
                        <Text style={styles.startButtonText}>Start Test</Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    accessibilityLabel="Continue on desktop"
                    disabled={setup.isSendingLink}
                    onPress={handleSendLink}
                    style={styles.desktopButton}
                    testID="desktop-link-button"
                  >
                    {setup.isSendingLink ? (
                      <ActivityIndicator color={Colors.primary} />
                    ) : (
                      <Text style={styles.desktopButtonText}>📧 Continue on Desktop</Text>
                    )}
                  </Pressable>
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
      <PaywallModal
        visible={showPaywall}
        variant="sectional"
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
  emptyWrap: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 8,
    gap: 20,
    paddingBottom: 40,
  },
  sectionGroup: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIconHoren: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconLesen: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#6A1B9A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  sectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    backgroundColor: Colors.surfaceMuted,
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textMuted,
  },
  teilList: {
    gap: 8,
  },
  noContent: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '500' as const,
    paddingVertical: 12,
    paddingLeft: 42,
  },
  teilCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 12,
  },
  teilCardDisabled: {
    opacity: 0.45,
  },
  teilCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  teilNumberWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teilNumber: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  teilCardMeta: {
    gap: 2,
  },
  teilTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  teilType: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  teilCardRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  teilCount: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  teilDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  teilDurationText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
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
    padding: 24,
    gap: 20,
    paddingBottom: 40,
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
  modalSectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
  modalStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 18,
    padding: 16,
  },
  modalStat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  modalStatValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  modalStatLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  modalStatDivider: {
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
    alignSelf: 'flex-end',
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
    gap: 10,
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
  desktopButton: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  sectionIconSchreiben: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#D84315',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconSprechen: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#00897B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockedLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
});
