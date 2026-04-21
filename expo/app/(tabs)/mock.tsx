import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Headphones,
  Lock,
  Mic,
  PenLine,
  Play,
  Puzzle,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { PaywallBottomSheet, type PaywallTriggerContext } from '@/components/PaywallBottomSheet';
import { PaywallModal } from '@/components/PaywallModal';
import Colors from '@/constants/colors';
import {
  getBlueprint,
  getTotalMinutes,
  type ExamBlueprintSection,
} from '@/lib/examBlueprint';
import { MOCK_V2_ENABLED } from '@/lib/featureFlags';
import {
  checkMockRetestAvailability,
  fetchMockQuestions,
} from '@/lib/mockHelpers';
import {
  abandonMockV2,
  fetchActiveMockV2,
  fetchResumableMockV2,
} from '@/lib/mockV2Helpers';
import { useAccess } from '@/providers/AccessProvider';
import { useAuth } from '@/providers/AuthProvider';

// ─── Types ───────────────────────────────────────────────────────────────────

type SetupState = {
  visible: boolean;
  isTimed: boolean;
  isLocked: boolean;
  retestDate: string | null;
  isLoadingRetest: boolean;
  isStarting: boolean;
};

// ─── Section config ───────────────────────────────────────────────────────────

const SECTION_ICON_CONFIG: Record<
  string,
  { Icon: React.ComponentType<any>; iconColor: string; bgColor: string }
> = {
  Hören:           { Icon: Headphones, iconColor: '#2B70EF', bgColor: 'rgba(43,112,239,0.15)' },
  Lesen:           { Icon: BookOpen,   iconColor: '#22C55E', bgColor: 'rgba(34,197,94,0.15)' },
  Sprachbausteine: { Icon: Puzzle,     iconColor: '#374151', bgColor: '#F0C808' },
  Schreiben:       { Icon: PenLine,    iconColor: '#8B5CF6', bgColor: 'rgba(139,92,246,0.15)' },
  Sprechen:        { Icon: Mic,        iconColor: '#F97316', bgColor: 'rgba(249,115,22,0.15)' },
};

function getSectionCount(s: ExamBlueprintSection): string {
  const q = s.questionsPerTeil?.reduce((a, b) => a + b, 0);
  return q != null ? `${q} Q` : `${s.teils.length} tasks`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRetestDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const LEVELS = ['A1', 'A2', 'B1'] as const;
type Level = (typeof LEVELS)[number];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MockScreen() {
  const { profile, user } = useAuth();
  const { access } = useAccess();
  const userId = user?.id ?? '';
  const targetLevel = (profile?.target_level ?? 'B1') as Level;
  const examType = profile?.exam_type ?? 'TELC';
  const mockEnabled = access.mock_tests_enabled;

  const [showPaywall, setShowPaywall] = useState(false);
  const [showPaywallSheet, setShowPaywallSheet] = useState(false);
  const [paywallSheetTrigger, setPaywallSheetTrigger] = useState<PaywallTriggerContext>('mock_locked');
  const [selectedLevel, setSelectedLevel] = useState<Level>(targetLevel);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [setup, setSetup] = useState<SetupState>({
    visible: false,
    isTimed: true,
    isLocked: false,
    retestDate: null,
    isLoadingRetest: false,
    isStarting: false,
  });

  const blueprint = getBlueprint(selectedLevel);
  const totalQ = blueprint.reduce(
    (sum, s) => sum + (s.questionsPerTeil?.reduce((a, b) => a + b, 0) ?? s.teils.length),
    0,
  );
  const totalMin = getTotalMinutes(selectedLevel);

  // Resumable V2 session
  const resumeQuery = useQuery({
    queryKey: ['mock-v2-resumable', userId],
    enabled: Boolean(userId) && MOCK_V2_ENABLED,
    queryFn: () => fetchResumableMockV2(userId),
    staleTime: 30_000,
  });
  const resumable = resumeQuery.data ?? null;

  // Opens setup modal — checks retest lock
  const openSetupInner = useCallback(async () => {
    setSetup({ visible: true, isTimed: true, isLocked: false, retestDate: null, isLoadingRetest: true, isStarting: false });
    try {
      const retest = await checkMockRetestAvailability(userId, selectedLevel);
      setSetup((prev) => ({ ...prev, isLocked: retest.isLocked, retestDate: retest.retestDate, isLoadingRetest: false }));
    } catch {
      setSetup((prev) => ({ ...prev, isLoadingRetest: false }));
    }
  }, [userId, selectedLevel]);

  // Outer gate: paywall + active-session check before opening setup modal
  const openSetup = useCallback(async () => {
    if (!mockEnabled) {
      // Trigger #8: mock_locked — show soft nudge bottom sheet first
      setPaywallSheetTrigger('mock_locked');
      setShowPaywallSheet(true);
      return;
    }
    if (MOCK_V2_ENABLED) {
      try {
        const active = await fetchActiveMockV2(userId);
        if (active) {
          Alert.alert(
            'Active Mock Test',
            `You have a ${active.level} mock test in progress. Resume it or discard to start a fresh one.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Discard & start new',
                style: 'destructive',
                onPress: async () => {
                  await abandonMockV2(active.id);
                  await resumeQuery.refetch();
                  await openSetupInner();
                },
              },
              {
                text: 'Resume',
                onPress: () => {
                  router.push({
                    pathname: '/mock-test-v2' as any,
                    params: {
                      level: active.level,
                      mockTestId: active.id,
                      resumeStateJson: JSON.stringify(active.savedState),
                    },
                  });
                },
              },
            ],
          );
          return;
        }
      } catch (err) {
        console.log('[Mock] fetchActiveMockV2 failed, proceeding to normal setup', err);
      }
    }
    await openSetupInner();
  }, [mockEnabled, userId, openSetupInner, resumeQuery]);

  const closeSetup = useCallback(() => {
    setSetup((prev) => ({ ...prev, visible: false }));
  }, []);

  const toggleTimed = useCallback(() => {
    setSetup((prev) => ({ ...prev, isTimed: !prev.isTimed }));
  }, []);

  const handleStart = useCallback(async () => {
    if (setup.isStarting || setup.isLocked) return;
    setSetup((prev) => ({ ...prev, isStarting: true }));

    if (MOCK_V2_ENABLED) {
      setSetup((prev) => ({ ...prev, visible: false, isStarting: false }));
      router.push({
        pathname: '/mock-test-v2' as any,
        params: { level: selectedLevel },
      });
      return;
    }

    try {
      const questions = await fetchMockQuestions(selectedLevel);
      if (questions.horen.length === 0 && questions.lesen.length === 0) {
        setSetup((prev) => ({ ...prev, isStarting: false, visible: false }));
        return;
      }
      setSetup((prev) => ({ ...prev, visible: false, isStarting: false }));
      router.push({
        pathname: '/mock-test',
        params: {
          level: selectedLevel,
          examType,
          isTimed: setup.isTimed ? '1' : '0',
          horenQuestions: JSON.stringify(questions.horen),
          lesenQuestions: JSON.stringify(questions.lesen),
          sprachbausteineT1Question: JSON.stringify(questions.sprachbausteineT1 ?? null),
          sprachbausteineT2Question: JSON.stringify(questions.sprachbausteineT2 ?? null),
        },
      });
    } catch (err) {
      console.log('[Mock] handleStart error', err);
      setSetup((prev) => ({ ...prev, isStarting: false }));
    }
  }, [setup.isStarting, setup.isLocked, setup.isTimed, selectedLevel, examType]);

  const handleResume = useCallback(() => {
    if (!resumable) return;
    router.push({
      pathname: '/mock-test-v2' as any,
      params: {
        level: resumable.level,
        mockTestId: resumable.id,
        resumeStateJson: JSON.stringify(resumable.savedState),
      },
    });
  }, [resumable]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Brand header with level dropdown in right slot */}
      <AppHeader
        rightElement={
          <View style={styles.levelWrap}>
            <Pressable
              style={styles.levelPill}
              onPress={() => setDropdownOpen((v) => !v)}
              hitSlop={8}
              accessibilityLabel={`Selected level: ${selectedLevel}. Tap to change.`}
            >
              <Text style={styles.levelPillText}>{selectedLevel}</Text>
              <ChevronDown size={14} color={Colors.primary} />
            </Pressable>

            {dropdownOpen && (
              <View style={styles.levelDropdown}>
                {LEVELS.map((level, i) => (
                  <Pressable
                    key={level}
                    style={[styles.levelOption, i > 0 && styles.levelOptionBorder, level === selectedLevel && styles.levelOptionActive]}
                    onPress={() => { setSelectedLevel(level); setDropdownOpen(false); }}
                    accessibilityLabel={`${level}${level === selectedLevel ? ', selected' : ''}`}
                  >
                    <Text style={[styles.levelOptionText, level === selectedLevel && styles.levelOptionTextActive]}>
                      {level}
                    </Text>
                    {level === selectedLevel && <Check size={16} color={Colors.primary} />}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        }
      />

      {/* Overlay to dismiss dropdown on outside tap */}
      {dropdownOpen && (
        <Pressable
          style={[StyleSheet.absoluteFillObject, styles.dropdownOverlay]}
          onPress={() => setDropdownOpen(false)}
        />
      )}

      {/* ── Scroll content ────────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Upgrade nudge */}
        {!mockEnabled && (
          <Pressable style={styles.nudge} onPress={() => { setPaywallSheetTrigger('mock_locked'); setShowPaywallSheet(true); }}>
            <Sparkles size={22} color="#F0C808" />
            <View style={styles.nudgeTextWrap}>
              <Text style={styles.nudgeTitle}>Unlock all sections & levels</Text>
              <Text style={styles.nudgeSub}>Upgrade to access the full mock test</Text>
            </View>
            <ChevronDown
              size={18}
              color={Colors.textMuted}
              style={styles.nudgeArrow}
            />
          </Pressable>
        )}

        {/* ── Hero card ──────────────────────────────────────────────────── */}
        <View style={styles.heroCard}>
          {/* Section list */}
          <View style={styles.sectionList}>
            {blueprint.map((section, i) => {
              const cfg = SECTION_ICON_CONFIG[section.section];
              if (!cfg) return null;
              const { Icon, iconColor, bgColor } = cfg;
              return (
                <View
                  key={section.section}
                  style={[styles.sectionRow, i > 0 && styles.sectionRowBorder]}
                >
                  <View style={[styles.sectionIcon, { backgroundColor: bgColor }]}>
                    <Icon size={18} color={iconColor} />
                  </View>
                  <Text style={styles.sectionName}>{section.section}</Text>
                  <View style={styles.sectionMeta}>
                    <Text style={styles.metaCount}>{getSectionCount(section)}</Text>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.metaTime}>{section.timeMinutes} min</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Summary stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalQ}</Text>
              <Text style={styles.statLabel}>Questions</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>~{totalMin}</Text>
              <Text style={styles.statLabel}>Minutes</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>60%</Text>
              <Text style={styles.statLabel}>Pass mark</Text>
            </View>
          </View>

          {/* Start CTA */}
          <Pressable
            style={styles.startBtn}
            onPress={openSetup}
            testID="mock-open-setup-btn"
            accessibilityLabel="Start mock test"
          >
            <Play size={20} color="#fff" fill="#fff" />
            <Text style={styles.startBtnText}>Start Mock Test</Text>
          </Pressable>

          {/* Resume — shown below Start when a V2 session is resumable */}
          {MOCK_V2_ENABLED && resumable && (
            <Pressable
              style={styles.resumeBtn}
              onPress={handleResume}
              testID="mock-resume-btn"
            >
              <Trophy size={18} color={Colors.accent} />
              <View style={styles.resumeBtnContent}>
                <Text style={styles.resumeBtnTitle}>Mock Test in Progress — Resume</Text>
                <Text style={styles.resumeBtnSub}>
                  {resumable.level} · Saved{' '}
                  {new Date(resumable.savedAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* ── Confirmation modal ────────────────────────────────────────────── */}
      <Modal
        animationType="slide"
        transparent
        visible={setup.visible}
        onRequestClose={closeSetup}
      >
        <Pressable style={styles.modalOverlay} onPress={closeSetup}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />

            {/* Modal header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIconWrap}>
                  <Trophy size={24} color={Colors.primary} />
                </View>
                <View style={styles.modalHeaderText}>
                  <Text style={styles.modalTitle}>Mock Exam · {selectedLevel}</Text>
                  <Text style={styles.modalSubtitle}>Complete exam simulation</Text>
                </View>
              </View>
              <Pressable
                onPress={closeSetup}
                hitSlop={8}
                style={styles.modalClose}
                testID="cancel-mock-button"
                accessibilityLabel="Cancel"
              >
                <X size={24} color={Colors.textMuted} />
              </Pressable>
            </View>

            {/* Summary stats pill */}
            <View style={styles.bsSummary}>
              <View style={styles.bsStat}>
                <Text style={styles.bsStatNum}>{totalQ} Q</Text>
                <Text style={styles.bsStatLabel}>Questions</Text>
              </View>
              <View style={styles.bsStat}>
                <Text style={styles.bsStatNum}>~{totalMin} min</Text>
                <Text style={styles.bsStatLabel}>Total time</Text>
              </View>
              <View style={styles.bsStat}>
                <Text style={styles.bsStatNum}>60%</Text>
                <Text style={styles.bsStatLabel}>Pass mark</Text>
              </View>
            </View>

            {/* Timed mode toggle */}
            <Pressable
              onPress={toggleTimed}
              style={styles.timedRow}
              testID="mock-timed-toggle"
              accessibilityLabel="Toggle timed mode"
            >
              <View style={styles.timedInfo}>
                <Clock size={24} color={Colors.primary} />
                <View>
                  <Text style={styles.timedLabel}>Timed Mode</Text>
                  <Text style={styles.timedSub}>Simulates real exam conditions</Text>
                </View>
              </View>
              <View style={[styles.toggleTrack, setup.isTimed ? styles.toggleTrackOn : null]}>
                <Animated.View
                  style={[styles.toggleThumb, setup.isTimed ? styles.toggleThumbOn : null]}
                />
              </View>
            </Pressable>
            <Text style={styles.toggleHint}>Turn off for untimed practice mode.</Text>

            {/* Warning */}
            <View style={styles.warningCard}>
              <AlertCircle size={16} color="#92400E" />
              <Text style={styles.warningText}>You can't go back between sections.</Text>
            </View>

            {/* Retest lock */}
            {setup.isLoadingRetest ? (
              <ActivityIndicator color={Colors.primary} style={styles.retestLoader} />
            ) : setup.isLocked && setup.retestDate ? (
              <View style={styles.lockedBanner}>
                <Lock size={16} color={Colors.warning} />
                <Text style={styles.lockedText}>
                  Retest available {formatRetestDate(setup.retestDate)}
                </Text>
              </View>
            ) : null}

            {/* Motivation */}
            <Text style={styles.motivation}>This is your moment. Go get it.</Text>

            {/* Start button */}
            <Pressable
              style={[styles.startButton, (setup.isLocked || setup.isStarting) && styles.buttonDisabled]}
              disabled={setup.isLocked || setup.isStarting}
              onPress={handleStart}
              testID="start-mock-button"
              accessibilityLabel="Start mock test"
            >
              {setup.isStarting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Play size={18} color="#fff" fill="#fff" />
                  <Text style={styles.startButtonText}>Start Mock Test</Text>
                </>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <PaywallBottomSheet
        visible={showPaywallSheet}
        triggerContext={paywallSheetTrigger}
        onUnlock={() => { setShowPaywallSheet(false); setShowPaywall(true); }}
        onDismiss={() => setShowPaywallSheet(false)}
      />

      <PaywallModal
        visible={showPaywall}
        variant="mock"
        onUpgrade={() => setShowPaywall(false)}
        onDismiss={() => setShowPaywall(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    zIndex: 20,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  pageTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 32,
    color: Colors.textBody,
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  pageSub: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 22,
  },

  // Level pill + dropdown
  levelWrap: {
    position: 'relative',
    flexShrink: 0,
    marginTop: 2,
    zIndex: 30,
  },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 14,
    borderRadius: 999,
    backgroundColor: '#ECF2FE',
  },
  levelPillText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 18,
    color: Colors.primary,
    lineHeight: 22,
  },
  levelDropdown: {
    position: 'absolute',
    top: 48,
    right: 0,
    width: 112,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#374151',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
    zIndex: 40,
  },
  levelOption: {
    minHeight: 48,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  levelOptionBorder: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  levelOptionActive: {
    backgroundColor: 'rgba(43,112,239,0.04)',
  },
  levelOptionText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 15,
    color: '#374151',
  },
  levelOptionTextActive: {
    color: Colors.primary,
  },
  dropdownOverlay: {
    zIndex: 10,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 16,
  },

  // Upgrade nudge
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#374151',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  nudgeTextWrap: {
    flex: 1,
  },
  nudgeTitle: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 15,
    color: '#374151',
  },
  nudgeSub: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  nudgeArrow: {
    transform: [{ rotate: '-90deg' }],
  },

  // Hero card
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 24,
    shadowColor: '#374151',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
    gap: 0,
  },

  // Section list
  sectionList: {
    marginBottom: 24,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  sectionRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sectionName: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  sectionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaCount: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 14,
    color: Colors.primary,
  },
  metaDot: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 14,
    color: Colors.textMuted,
  },
  metaTime: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 14,
    color: Colors.textMuted,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 24,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 32,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 26,
    color: Colors.primary,
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },

  // Start CTA
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 60,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  startBtnText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 18,
    color: '#FFFFFF',
  },

  // Resume button
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  resumeBtnContent: {
    flex: 1,
  },
  resumeBtnTitle: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 14,
    color: '#92400E',
  },
  resumeBtnSub: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
  },

  // Modal
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
    paddingBottom: 40,
    gap: 16,
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
    minWidth: 0,
  },
  modalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#ECF2FE',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  modalHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  modalTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 22,
    color: Colors.textBody,
    lineHeight: 26,
  },
  modalSubtitle: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
  },
  modalClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    flexShrink: 0,
  },

  // Summary stats pill
  bsSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#ECF2FE',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 20,
  },
  bsStat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  bsStatNum: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 20,
    color: Colors.primary,
    lineHeight: 24,
  },
  bsStatLabel: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  // Timed toggle
  timedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
  },
  timedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  timedLabel: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 16,
    color: Colors.textBody,
  },
  timedSub: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 3,
  },
  toggleHint: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 10,
    marginBottom: 18,
    marginLeft: 4,
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

  // Warning
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF9C3',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  warningText: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    color: '#92400E',
    flex: 1,
    lineHeight: 18,
  },

  // Motivation
  motivation: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 17,
    color: Colors.textBody,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 18,
  },

  // Retest lock
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
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 14,
    color: '#F57F17',
  },

  // Modal start button
  startButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startButtonText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 16,
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});
