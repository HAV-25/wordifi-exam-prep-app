import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { AlertTriangle, Award, Calendar, CalendarDays, ChevronRight, GraduationCap, Headphones, BookOpen, LogOut, Minus, Plus, Trophy, TrendingUp, User, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery } from '@tanstack/react-query';

import { EmptyState } from '@/components/EmptyState';
import { LevelBadge } from '@/components/LevelBadge';
import { ScoreRing } from '@/components/ScoreRing';
import { StreakBadge } from '@/components/StreakBadge';
import Colors from '@/constants/colors';
import { updateExamDate, updateStudyPlan, fetchUncompletedTeileCount, updatePlayerName } from '@/lib/profileHelpers';
import { useAuth } from '@/providers/AuthProvider';
import type { StudyPlanJson } from '@/types/database';

const DEFAULT_PLAN: StudyPlanJson = {
  weekly_goal_sessions: 3,
  focus_section: 'Both',
  mock_test_dates: [],
};

const FOCUS_OPTIONS: Array<{ key: StudyPlanJson['focus_section']; label: string }> = [
  { key: 'Hören', label: 'Hören' },
  { key: 'Lesen', label: 'Lesen' },
  { key: 'Both', label: 'Both' },
];

function getDaysUntilExam(examDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exam = new Date(examDate);
  exam.setHours(0, 0, 0, 0);
  return Math.ceil((exam.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ProfileScreen() {
  const { profile, user, signOut, isSigningOut, refreshProfile } = useAuth();


  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showMockDatePicker, setShowMockDatePicker] = useState<boolean>(false);
  const [localPlan, setLocalPlan] = useState<StudyPlanJson>(DEFAULT_PLAN);
  const [showNameModal, setShowNameModal] = useState<boolean>(false);
  const [nameInput, setNameInput] = useState<string>('');
  const [nameError, setNameError] = useState<string>('');
  const [isSavingName, setIsSavingName] = useState<boolean>(false);
  const nameModalFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (profile?.study_plan_json) {
      setLocalPlan(profile.study_plan_json);
    }
  }, [profile?.study_plan_json]);

  const examDateMutation = useMutation({
    mutationFn: async (date: string) => {
      if (!user) throw new Error('Not authenticated');
      return updateExamDate(user.id, date);
    },
    onSuccess: () => {
      void refreshProfile();
    },
  });

  const studyPlanMutation = useMutation({
    mutationFn: async (plan: StudyPlanJson) => {
      if (!user) throw new Error('Not authenticated');
      return updateStudyPlan(user.id, plan);
    },
    onSuccess: () => {
      void refreshProfile();
    },
  });

  const daysLeft = useMemo(() => {
    if (!profile?.exam_date) return null;
    return getDaysUntilExam(profile.exam_date);
  }, [profile?.exam_date]);

  const showPromptCard = daysLeft !== null && daysLeft > 0 && daysLeft < 30;

  const uncompletedTeileQuery = useQuery({
    queryKey: ['uncompleted-teile', user?.id, profile?.target_level],
    enabled: showPromptCard && Boolean(user?.id) && Boolean(profile?.target_level),
    queryFn: async () => {
      if (!user || !profile?.target_level) return 0;
      return fetchUncompletedTeileCount(user.id, profile.target_level);
    },
  });

  const handleExamDateChange = useCallback((_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      examDateMutation.mutate(dateStr);
      if (Platform.OS === 'ios') {
        setShowDatePicker(false);
      }
    }
  }, [examDateMutation]);

  const handleMockDateChange = useCallback((_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowMockDatePicker(false);
    }
    if (selectedDate) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const updated = {
        ...localPlan,
        mock_test_dates: [...localPlan.mock_test_dates, dateStr].sort(),
      };
      setLocalPlan(updated);
      studyPlanMutation.mutate(updated);
      if (Platform.OS === 'ios') {
        setShowMockDatePicker(false);
      }
    }
  }, [localPlan, studyPlanMutation]);

  const handleRemoveMockDate = useCallback((dateToRemove: string) => {
    const updated = {
      ...localPlan,
      mock_test_dates: localPlan.mock_test_dates.filter(d => d !== dateToRemove),
    };
    setLocalPlan(updated);
    studyPlanMutation.mutate(updated);
  }, [localPlan, studyPlanMutation]);

  const handleWeeklyGoalChange = useCallback((delta: number) => {
    const newVal = Math.max(1, Math.min(7, localPlan.weekly_goal_sessions + delta));
    const updated = { ...localPlan, weekly_goal_sessions: newVal };
    setLocalPlan(updated);
    studyPlanMutation.mutate(updated);
  }, [localPlan, studyPlanMutation]);

  const handleFocusSectionChange = useCallback((section: StudyPlanJson['focus_section']) => {
    const updated = { ...localPlan, focus_section: section };
    setLocalPlan(updated);
    studyPlanMutation.mutate(updated);
  }, [localPlan, studyPlanMutation]);

  const openNameModal = useCallback(() => {
    setNameInput('');
    setNameError('');
    setShowNameModal(true);
    Animated.timing(nameModalFade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [nameModalFade]);

  const closeNameModal = useCallback(() => {
    Animated.timing(nameModalFade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowNameModal(false);
    });
  }, [nameModalFade]);

  const handleSaveName = useCallback(async () => {
    if (!user) return;
    const trimmed = nameInput.trim().slice(0, 20);
    if (trimmed.length < 3) {
      setNameError('Name must be at least 3 characters');
      return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(trimmed)) {
      setNameError('Letters and numbers only');
      return;
    }
    setIsSavingName(true);
    try {
      await updatePlayerName(user.id, trimmed);
      await refreshProfile();
      closeNameModal();
    } catch (e) {
      console.log('Set player name error', e);
      setNameError('Could not save name. Try again.');
    } finally {
      setIsSavingName(false);
    }
  }, [user, nameInput, refreshProfile, closeNameModal]);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/auth');
    } catch (error) {
      console.log('ProfileScreen signOut error', error);
      Alert.alert('Wordifi', 'Something went wrong. Please check your connection.');
    }
  };

  if (!profile) {
    return (
      <SafeAreaView style={styles.emptyWrap}>
        <EmptyState title="Set up your profile to start practising." description="Complete setup to unlock tailored listening and reading sessions." actionLabel="Complete Setup" onActionPress={() => router.push('/onboarding')} testID="profile-empty-state" />
      </SafeAreaView>
    );
  }

  const progressToNextMilestone = Math.min(100, ((profile.xp_total % 50) / 50) * 100);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Pressable accessibilityLabel="Change level" onPress={() => router.push('/onboarding')} style={styles.inlineButton} testID="change-level-button">
            <Text style={styles.inlineButtonText}>Change Level</Text>
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            {profile.player_name ? (
              <View style={styles.playerNameRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitial}>{profile.player_name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.playerNameText}>{profile.player_name}</Text>
              </View>
            ) : null}
            <Text style={styles.email}>{user?.email ?? 'wordifi@user.com'}</Text>
            <LevelBadge level={profile.target_level ?? 'A1'} />
            <Text style={styles.meta}>Target exam: {profile.exam_type?.toUpperCase() ?? 'TELC'} {profile.target_level ?? 'A1'}{profile.exam_date ? ` · ${profile.exam_date}` : ''}</Text>
          </View>
          <ScoreRing label="Readiness" score={profile.preparedness_score ?? 0} size={92} />
        </View>

        <View style={styles.row}>
          <StreakBadge count={profile.streak_count ?? 0} />
          <View style={styles.xpBadge}><Text style={styles.xpText}>⭐ {profile.xp_total} XP</Text></View>
        </View>

        <View style={styles.insightCard}>
          <View style={styles.insightHeader}><TrendingUp color={Colors.primary} size={18} /><Text style={styles.insightTitle}>Progress insights</Text></View>
          <Text style={styles.insightBody}>You&apos;re {50 - (profile.xp_total % 50)} XP away from your next 50 XP milestone.</Text>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progressToNextMilestone}%` }]} /></View>
        </View>

        <View style={styles.listCard}>
          <View style={styles.infoRow}><Award color={Colors.primary} size={18} /><Text style={styles.infoText}>Preparedness score: {Math.round(profile.preparedness_score ?? 0)} / 100</Text></View>
          <View style={styles.infoRow}><GraduationCap color={Colors.primary} size={18} /><Text style={styles.infoText}>Target level: {profile.target_level ?? 'A1'}</Text></View>
          <View style={styles.infoRow}><CalendarDays color={Colors.primary} size={18} /><Text style={styles.infoText}>Exam date: {profile.exam_date ?? 'Not set yet'}</Text></View>
        </View>

        {/* My Plan Section */}
        <View style={styles.planSection}>
          <Text style={styles.planSectionTitle}>My Plan</Text>

          {/* Exam Date */}
          <View style={styles.planCard}>
            <View style={styles.planCardHeader}>
              <Calendar color={Colors.accent} size={20} />
              <Text style={styles.planCardTitle}>Exam Date</Text>
            </View>

            {profile.exam_date ? (
              <View style={styles.examDateSet}>
                <View style={styles.examCountdownWrap}>
                  <Text style={[
                    styles.examCountdownNumber,
                    daysLeft !== null && daysLeft <= 7 && daysLeft > 0 ? styles.examCountdownUrgent : null,
                    daysLeft !== null && daysLeft <= 0 ? styles.examCountdownPast : null,
                  ]}>
                    {daysLeft !== null && daysLeft > 0 ? `${daysLeft} days to your exam` : daysLeft === 0 ? 'Exam is today!' : 'Exam date has passed'}
                  </Text>
                  <Text style={styles.examDateMuted}>{formatDate(profile.exam_date)}</Text>
                </View>
                <Pressable
                  style={styles.changeDateButton}
                  onPress={() => setShowDatePicker(true)}
                  testID="change-exam-date"
                >
                  <Text style={styles.changeDateText}>Change</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={styles.setExamDateRow}
                onPress={() => setShowDatePicker(true)}
                testID="set-exam-date"
              >
                <Text style={styles.setExamDateText}>Set your exam date</Text>
                <ChevronRight color={Colors.textMuted} size={18} />
              </Pressable>
            )}

            {showDatePicker && (
              <View style={styles.datePickerWrap}>
                <DateTimePicker
                  value={profile.exam_date ? new Date(profile.exam_date) : new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  minimumDate={new Date()}
                  onChange={handleExamDateChange}
                  testID="exam-date-picker"
                />
                {Platform.OS === 'ios' && (
                  <Pressable style={styles.doneButton} onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.doneButtonText}>Done</Text>
                  </Pressable>
                )}
              </View>
            )}

            {examDateMutation.isPending && (
              <ActivityIndicator size="small" color={Colors.accent} style={styles.inlineLoader} />
            )}
          </View>

          {/* Study Plan */}
          <View style={styles.planCard}>
            <View style={styles.planCardHeader}>
              <GraduationCap color={Colors.accent} size={20} />
              <Text style={styles.planCardTitle}>Study Plan</Text>
            </View>

            {/* Weekly Goal Stepper */}
            <View style={styles.planRow}>
              <Text style={styles.planRowLabel}>Weekly sessions goal</Text>
              <View style={styles.stepper}>
                <Pressable
                  style={[styles.stepperBtn, localPlan.weekly_goal_sessions <= 1 && styles.stepperBtnDisabled]}
                  onPress={() => handleWeeklyGoalChange(-1)}
                  disabled={localPlan.weekly_goal_sessions <= 1}
                  testID="weekly-goal-minus"
                >
                  <Minus color={localPlan.weekly_goal_sessions <= 1 ? Colors.border : Colors.primary} size={16} />
                </Pressable>
                <Text style={styles.stepperValue}>{localPlan.weekly_goal_sessions}</Text>
                <Pressable
                  style={[styles.stepperBtn, localPlan.weekly_goal_sessions >= 7 && styles.stepperBtnDisabled]}
                  onPress={() => handleWeeklyGoalChange(1)}
                  disabled={localPlan.weekly_goal_sessions >= 7}
                  testID="weekly-goal-plus"
                >
                  <Plus color={localPlan.weekly_goal_sessions >= 7 ? Colors.border : Colors.primary} size={16} />
                </Pressable>
              </View>
            </View>

            {/* Focus Section */}
            <View style={styles.planRow}>
              <Text style={styles.planRowLabel}>Focus section</Text>
              <View style={styles.segmentedControl}>
                {FOCUS_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.key}
                    style={[
                      styles.segmentItem,
                      localPlan.focus_section === opt.key && styles.segmentItemActive,
                    ]}
                    onPress={() => handleFocusSectionChange(opt.key)}
                    testID={`focus-${opt.key}`}
                  >
                    {opt.key === 'Hören' && <Headphones color={localPlan.focus_section === opt.key ? Colors.surface : Colors.textMuted} size={13} />}
                    {opt.key === 'Lesen' && <BookOpen color={localPlan.focus_section === opt.key ? Colors.surface : Colors.textMuted} size={13} />}
                    <Text style={[
                      styles.segmentText,
                      localPlan.focus_section === opt.key && styles.segmentTextActive,
                    ]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Mock Test Dates */}
            <View style={styles.mockDatesSection}>
              <View style={styles.planRow}>
                <Text style={styles.planRowLabel}>Planned mock tests</Text>
                <Pressable
                  style={styles.addDateBtn}
                  onPress={() => setShowMockDatePicker(true)}
                  testID="add-mock-date"
                >
                  <Plus color={Colors.accent} size={14} />
                  <Text style={styles.addDateText}>Add</Text>
                </Pressable>
              </View>

              {localPlan.mock_test_dates.length > 0 ? (
                <View style={styles.chipRow}>
                  {localPlan.mock_test_dates.map((dateStr) => (
                    <View key={dateStr} style={styles.dateChip}>
                      <Text style={styles.dateChipText}>{formatDate(dateStr)}</Text>
                      <Pressable
                        onPress={() => handleRemoveMockDate(dateStr)}
                        hitSlop={8}
                        testID={`remove-mock-${dateStr}`}
                      >
                        <X color={Colors.textMuted} size={14} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noMockDates}>No mock tests planned yet</Text>
              )}

              {showMockDatePicker && (
                <View style={styles.datePickerWrap}>
                  <DateTimePicker
                    value={new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    minimumDate={new Date()}
                    onChange={handleMockDateChange}
                    testID="mock-date-picker"
                  />
                  {Platform.OS === 'ios' && (
                    <Pressable style={styles.doneButton} onPress={() => setShowMockDatePicker(false)}>
                      <Text style={styles.doneButtonText}>Done</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>

            {studyPlanMutation.isPending && (
              <ActivityIndicator size="small" color={Colors.accent} style={styles.inlineLoader} />
            )}
          </View>

          {/* Prompt Card */}
          {showPromptCard && (
            <View style={styles.promptCard}>
              <View style={styles.promptIconRow}>
                <AlertTriangle color="#D97706" size={20} />
                <Text style={styles.promptTitle}>Exam Approaching</Text>
              </View>
              <Text style={styles.promptBody}>
                You have <Text style={styles.promptBold}>{daysLeft} days</Text> left.{' '}
                {uncompletedTeileQuery.data != null && uncompletedTeileQuery.data > 0
                  ? `We recommend completing ${uncompletedTeileQuery.data} more sectional test${uncompletedTeileQuery.data === 1 ? '' : 's'} before your exam.`
                  : 'Keep practising to stay sharp!'}
              </Text>
              <Pressable
                style={styles.promptCta}
                onPress={() => router.push('/(tabs)/tests')}
                testID="prompt-sectional-cta"
              >
                <Text style={styles.promptCtaText}>Start a Sectional Test</Text>
              </Pressable>
            </View>
          )}
        </View>

        <Pressable
          style={styles.leaderboardCard}
          onPress={() => router.push('/leaderboard')}
          testID="open-leaderboard"
        >
          <View style={styles.leaderboardLeft}>
            <View style={styles.leaderboardIconWrap}>
              <Trophy color="#D4A017" size={20} />
            </View>
            <View style={styles.leaderboardTextWrap}>
              <Text style={styles.leaderboardTitle}>Leaderboard</Text>
              <Text style={styles.leaderboardSub}>See how you rank against other {profile.target_level ?? 'B1'} learners</Text>
            </View>
          </View>
          <ChevronRight color={Colors.textMuted} size={18} />
        </Pressable>

        {!profile.player_name ? (
          <View style={styles.setNameCard}>
            <User color={Colors.accent} size={20} />
            <View style={styles.setNameTextWrap}>
              <Text style={styles.setNameTitle}>Set your learner name</Text>
              <Text style={styles.setNameBody}>Choose a name to appear on the leaderboard</Text>
            </View>
            <Pressable
              style={styles.setNameCta}
              onPress={openNameModal}
              testID="set-player-name-cta"
            >
              <Text style={styles.setNameCtaText}>Set Name</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable accessibilityLabel="Sign out" disabled={isSigningOut} onPress={handleSignOut} style={styles.signOutButton} testID="sign-out-button">
          {isSigningOut ? <ActivityIndicator color={Colors.surface} /> : <><LogOut color={Colors.surface} size={18} /><Text style={styles.signOutText}>Sign Out</Text></>}
        </Pressable>
      </ScrollView>
      <Modal visible={showNameModal} transparent animationType="none" onRequestClose={closeNameModal}>
        <Animated.View style={[styles.nameModalOverlay, { opacity: nameModalFade }]}>
          <Pressable style={styles.nameModalBackdrop} onPress={closeNameModal} />
          <View style={styles.nameModalCard}>
            <Text style={styles.nameModalHeading}>Choose your learner name</Text>
            <Text style={styles.nameModalSub}>Max 20 characters, letters and numbers only</Text>
            <View style={styles.nameModalInputShell}>
              <TextInput
                style={styles.nameModalInput}
                placeholder="e.g. FlinkeFeder"
                placeholderTextColor={Colors.textMuted}
                value={nameInput}
                onChangeText={(t) => { setNameInput(t.slice(0, 20)); setNameError(''); }}
                maxLength={20}
                autoCapitalize="none"
                autoCorrect={false}
                testID="profile-name-input"
              />
              <Text style={styles.nameModalCharCount}>{nameInput.length}/20</Text>
            </View>
            {nameError ? <Text style={styles.nameModalError}>{nameError}</Text> : null}
            <View style={styles.nameModalActions}>
              <Pressable style={styles.nameModalCancel} onPress={closeNameModal}>
                <Text style={styles.nameModalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.nameModalSave, isSavingName ? styles.nameModalSaveDisabled : null]}
                onPress={handleSaveName}
                disabled={isSavingName}
                testID="profile-save-name"
              >
                {isSavingName ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.nameModalSaveText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  emptyWrap: { flex: 1, backgroundColor: Colors.background, padding: 20, justifyContent: 'center' },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 30, fontWeight: '800' as const, color: Colors.primary },
  inlineButton: { minHeight: 40, paddingHorizontal: 12, justifyContent: 'center' },
  inlineButtonText: { color: Colors.primary, fontWeight: '700' as const },
  heroCard: { backgroundColor: Colors.surface, borderRadius: 24, borderWidth: 1, borderColor: Colors.border, padding: 18, flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  heroLeft: { flex: 1, gap: 10 },
  email: { fontSize: 16, fontWeight: '700' as const, color: Colors.primary },
  meta: { fontSize: 14, color: Colors.textMuted },
  row: { flexDirection: 'row', gap: 10 },
  xpBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center' },
  xpText: { color: Colors.primary, fontWeight: '700' as const },
  insightCard: { backgroundColor: Colors.primary, borderRadius: 24, padding: 18, gap: 12 },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  insightTitle: { color: Colors.surface, fontWeight: '800' as const, fontSize: 17 },
  insightBody: { color: 'rgba(255,255,255,0.82)', lineHeight: 22 },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' as const },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: Colors.accent },
  listCard: { backgroundColor: Colors.surface, borderRadius: 24, borderWidth: 1, borderColor: Colors.border, padding: 18, gap: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { color: Colors.text, fontSize: 15, fontWeight: '600' as const },
  signOutButton: { minHeight: 52, borderRadius: 26, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  signOutText: { color: Colors.surface, fontWeight: '800' as const, fontSize: 16 },

  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' as const },
  playerNameText: { fontSize: 18, fontWeight: '800' as const, color: Colors.primary },

  leaderboardCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 16 },
  leaderboardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  leaderboardIconWrap: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#FFF8E1', alignItems: 'center', justifyContent: 'center' },
  leaderboardTextWrap: { flex: 1, gap: 2 },
  leaderboardTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.primary },
  leaderboardSub: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },

  setNameCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.accentSoft, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.accent },
  setNameTextWrap: { flex: 1, gap: 2 },
  setNameTitle: { fontSize: 14, fontWeight: '700' as const, color: Colors.primary },
  setNameBody: { fontSize: 12, color: Colors.textMuted },
  setNameCta: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.accent },
  setNameCtaText: { color: '#FFFFFF', fontWeight: '700' as const, fontSize: 13 },

  nameModalOverlay: { flex: 1, backgroundColor: 'rgba(9,23,40,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  nameModalBackdrop: { ...StyleSheet.absoluteFillObject },
  nameModalCard: { width: '100%', maxWidth: 360, backgroundColor: Colors.surface, borderRadius: 24, padding: 24, gap: 12, zIndex: 1 },
  nameModalHeading: { fontSize: 20, fontWeight: '800' as const, color: Colors.primary, textAlign: 'center' as const },
  nameModalSub: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' as const, marginTop: -4 },
  nameModalInputShell: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14 },
  nameModalInput: { flex: 1, fontSize: 16, fontWeight: '600' as const, color: Colors.primary, paddingVertical: 14 },
  nameModalCharCount: { fontSize: 12, color: Colors.textMuted },
  nameModalError: { fontSize: 13, color: Colors.danger, fontWeight: '600' as const },
  nameModalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  nameModalCancel: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  nameModalCancelText: { color: Colors.textMuted, fontWeight: '700' as const, fontSize: 15 },
  nameModalSave: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  nameModalSaveDisabled: { opacity: 0.5 },
  nameModalSaveText: { color: '#FFFFFF', fontWeight: '800' as const, fontSize: 15 },

  planSection: { gap: 12 },
  planSectionTitle: { fontSize: 22, fontWeight: '800' as const, color: Colors.primary, marginBottom: 2 },
  planCard: { backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 14 },
  planCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planCardTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.primary },

  examDateSet: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  examCountdownWrap: { flex: 1, gap: 2 },
  examCountdownNumber: { fontSize: 18, fontWeight: '800' as const, color: Colors.primary },
  examCountdownUrgent: { color: Colors.danger },
  examCountdownPast: { color: Colors.textMuted },
  examDateMuted: { fontSize: 13, color: Colors.textMuted },
  changeDateButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: Colors.primarySoft },
  changeDateText: { fontSize: 13, fontWeight: '700' as const, color: Colors.primary },

  setExamDateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  setExamDateText: { fontSize: 15, color: Colors.textMuted, fontWeight: '500' as const },

  datePickerWrap: { marginTop: 4, alignItems: 'center' },
  doneButton: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.accent },
  doneButtonText: { color: Colors.surface, fontWeight: '700' as const, fontSize: 14 },
  inlineLoader: { marginTop: 4 },

  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planRowLabel: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 0, backgroundColor: Colors.background, borderRadius: 12, overflow: 'hidden' as const, borderWidth: 1, borderColor: Colors.border },
  stepperBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepperBtnDisabled: { opacity: 0.4 },
  stepperValue: { width: 32, textAlign: 'center' as const, fontSize: 16, fontWeight: '800' as const, color: Colors.primary },

  segmentedControl: { flexDirection: 'row', backgroundColor: Colors.background, borderRadius: 10, overflow: 'hidden' as const, borderWidth: 1, borderColor: Colors.border },
  segmentItem: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8 },
  segmentItemActive: { backgroundColor: Colors.primary, borderRadius: 8 },
  segmentText: { fontSize: 13, fontWeight: '600' as const, color: Colors.textMuted },
  segmentTextActive: { color: Colors.surface },

  mockDatesSection: { gap: 10 },
  addDateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: Colors.accentSoft },
  addDateText: { fontSize: 13, fontWeight: '700' as const, color: Colors.accent },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dateChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  dateChipText: { fontSize: 13, fontWeight: '600' as const, color: Colors.text },
  noMockDates: { fontSize: 13, color: Colors.textMuted, fontStyle: 'italic' as const },

  promptCard: { backgroundColor: '#FFF7ED', borderRadius: 18, borderWidth: 1, borderColor: '#FBBF24', padding: 16, gap: 10 },
  promptIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  promptTitle: { fontSize: 15, fontWeight: '700' as const, color: '#92400E' },
  promptBody: { fontSize: 14, color: '#78350F', lineHeight: 21 },
  promptBold: { fontWeight: '800' as const },
  promptCta: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#D97706', marginTop: 2 },
  promptCtaText: { color: '#FFFFFF', fontWeight: '700' as const, fontSize: 14 },
});
