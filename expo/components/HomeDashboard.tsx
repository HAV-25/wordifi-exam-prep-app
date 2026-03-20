import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  Calendar,
  ChevronRight,
  ClipboardList,
  Flame,
  PenLine,
  Play,
  Star,
  Trophy,
  Zap,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PreparednessBar } from '@/components/PreparednessBar';
import { PreparednessBottomSheet } from '@/components/PreparednessBottomSheet';
import Colors from '@/constants/colors';
import { colors, fontSize, radius, shadows, spacing } from '@/theme';
import { formatXp, getBadgeTier } from '@/lib/badgeHelpers';
import { fetchSectionAccuracy } from '@/lib/streamHelpers';
import { supabase } from '@/lib/supabaseClient';
import { useAccess } from '@/providers/AccessProvider';
import { useAuth } from '@/providers/AuthProvider';

const FIRST_SESSION_KEY = 'wordifi_first_session_shown';
const PROFILE_PROMPTED_KEY = 'wordifi_profile_prompted';

type HomeDashboardProps = {
  onStartPractice: () => void;
};

type CompletedTeile = {
  sectionalCount: number;
  sectionalTotal: number;
  mockLastScore: number | null;
  schreibenDone: number;
  schreibenTotal: number;
};

function getDaysUntilExam(examDate: string | null): number | null {
  if (!examDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exam = new Date(examDate);
  exam.setHours(0, 0, 0, 0);
  const diff = Math.ceil((exam.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : null;
}

function getMotivationalMessage(
  streak: number,
  daysToExam: number | null,
  preparedness: number,
): string {
  if (streak > 0 && streak >= 3) {
    return `${streak} day streak — keep it going`;
  }
  if (daysToExam !== null && daysToExam <= 30) {
    return `${daysToExam} days to your exam`;
  }
  if (preparedness < 40) {
    return 'Your readiness needs attention — practice today';
  }
  const tips = [
    'Consistency beats intensity. A little each day goes far.',
    'Focus on your weakest section for the biggest gains.',
    'Review wrong answers to learn from mistakes.',
    'Try a timed sectional test to simulate exam conditions.',
  ];
  return tips[Math.floor(Math.random() * tips.length)] ?? tips[0]!;
}

export function HomeDashboard({ onStartPractice }: HomeDashboardProps) {
  const { profile, user } = useAuth();
  useAccess();
  const router = useRouter();
  const userId = user?.id ?? '';
  const targetLevel = profile?.target_level ?? 'A1';
  const examType = profile?.exam_type ?? 'TELC';

  const [showBottomSheet, setShowBottomSheet] = useState<boolean>(false);
  const [showWelcome, setShowWelcome] = useState<boolean>(false);
  const [showProfileNudge, setShowProfileNudge] = useState<boolean>(false);
  const [horenPct, setHorenPct] = useState<number>(50);
  const [lesenPct, setLesenPct] = useState<number>(50);

  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  useEffect(() => {
    if (userId) {
      fetchSectionAccuracy(userId).then((acc) => {
        setHorenPct(Math.round(acc.horenAccuracy * 100));
        setLesenPct(Math.round(acc.lesenAccuracy * 100));
      }).catch(() => {});
    }
  }, [userId]);

  const firstTimeQuery = useQuery({
    queryKey: ['first-time-check', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { count } = await supabase
        .from('user_answers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      return (count ?? 0) === 0;
    },
    staleTime: 60_000,
  });

  const isFirstTimeUser = firstTimeQuery.data === true;

  useEffect(() => {
    if (!isFirstTimeUser) return;

    const checkFlags = async () => {
      const [sessionShown, profilePrompted] = await Promise.all([
        AsyncStorage.getItem(FIRST_SESSION_KEY),
        AsyncStorage.getItem(PROFILE_PROMPTED_KEY),
      ]);

      if (!profilePrompted && (!profile?.target_level || !profile?.exam_type)) {
        setShowProfileNudge(true);
        await AsyncStorage.setItem(PROFILE_PROMPTED_KEY, 'true');
      }

      if (!sessionShown) {
        setShowWelcome(true);
      }
    };

    void checkFlags();
  }, [isFirstTimeUser, profile?.target_level, profile?.exam_type]);

  const completedQuery = useQuery({
    queryKey: ['completed-teile', userId, targetLevel],
    enabled: Boolean(userId),
    queryFn: async (): Promise<CompletedTeile> => {
      const { data: sessions } = await supabase
        .from('test_sessions')
        .select('section, teil, session_type')
        .eq('user_id', userId)
        .eq('level', targetLevel)
        .not('completed_at', 'is', null);

      const completed = (sessions ?? []) as Array<{ section: string; teil: number; session_type: string }>;
      const sectionalDone = new Set(
        completed
          .filter((s) => s.session_type === 'sectional')
          .map((s) => `${s.section}-${s.teil}`)
      );
      const schreibenDone = new Set(
        completed
          .filter((s) => s.section === 'Schreiben')
          .map((s) => `${s.teil}`)
      );

      const { data: mockData } = await supabase
        .from('mock_tests')
        .select('overall_score_pct')
        .eq('user_id', userId)
        .eq('level', targetLevel)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(1);

      const mockRows = (mockData ?? []) as Array<{ overall_score_pct: number | null }>;
      const mockLastScore = mockRows[0]?.overall_score_pct ?? null;

      return {
        sectionalCount: sectionalDone.size,
        sectionalTotal: 8,
        mockLastScore,
        schreibenDone: schreibenDone.size,
        schreibenTotal: 3,
      };
    },
    staleTime: 30_000,
  });

  const stats = completedQuery.data;
  const preparedness = profile?.preparedness_score ?? 0;
  const streak = profile?.streak_count ?? 0;
  const xp = profile?.xp_total ?? 0;
  const badgeTier = useMemo(() => getBadgeTier(xp), [xp]);
  const formattedXp = useMemo(() => formatXp(xp), [xp]);
  const daysToExam = getDaysUntilExam(profile?.exam_date ?? null);

  const dailyStreamCount = (profile as Record<string, unknown> | null)?.daily_stream_count as number | undefined;
  const hasPracticedToday = (dailyStreamCount ?? 0) > 0;

  const ctaLabel = hasPracticedToday ? 'Resume practice' : 'Start today\'s practice';

  const motivationalMsg = useMemo(
    () => getMotivationalMessage(streak, daysToExam, preparedness),
    [streak, daysToExam, preparedness]
  );

  const gaugeColor = useMemo(() => {
    if (preparedness < 40) return colors.red;
    if (preparedness < 70) return colors.amber;
    return colors.green;
  }, [preparedness]);

  const handleStartFromWelcome = useCallback(async () => {
    setShowWelcome(false);
    await AsyncStorage.setItem(FIRST_SESSION_KEY, 'true');
    onStartPractice();
  }, [onStartPractice]);

  const handleDismissProfileNudge = useCallback(() => {
    setShowProfileNudge(false);
  }, []);

  const handleGoToProfile = useCallback(() => {
    setShowProfileNudge(false);
    router.push('/(tabs)/profile');
  }, [router]);

  if (showWelcome && isFirstTimeUser) {
    return (
      <Animated.View style={[styles.welcomeScreen, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.welcomeContent}>
          <View style={styles.welcomeIconWrap}>
            <Zap color={colors.white} size={32} />
          </View>
          <Text style={styles.welcomeTitle}>
            {profile?.target_level && profile?.exam_type
              ? `Ready to prepare for your ${profile.target_level} exam?`
              : 'Welcome to Wordifi'}
          </Text>
          <Text style={styles.welcomeSubtitle}>
            Practice daily with exam-style questions tailored to your level. Let's get started.
          </Text>

          <Pressable
            style={styles.welcomeCta}
            onPress={handleStartFromWelcome}
            testID="welcome-start-practice"
          >
            <Play color={colors.white} size={18} />
            <Text style={styles.welcomeCtaText}>Start your daily practice</Text>
          </Pressable>

          <Pressable
            style={styles.welcomeSecondary}
            onPress={handleGoToProfile}
            testID="welcome-go-profile"
          >
            <Text style={styles.welcomeSecondaryText}>Set up your profile first</Text>
          </Pressable>
        </View>

        <Modal
          visible={showProfileNudge}
          transparent
          animationType="slide"
          onRequestClose={handleDismissProfileNudge}
        >
          <Pressable style={styles.nudgeOverlay} onPress={handleDismissProfileNudge}>
            <View style={styles.nudgeSheet}>
              <View style={styles.nudgeHandle} />
              <Text style={styles.nudgeTitle}>Complete your profile</Text>
              <Text style={styles.nudgeDesc}>
                Set your target level and exam type so we can personalise your practice.
              </Text>
              <Pressable style={styles.nudgeCta} onPress={handleGoToProfile} testID="nudge-go-profile">
                <Text style={styles.nudgeCtaText}>Go to profile</Text>
              </Pressable>
              <Pressable onPress={handleDismissProfileNudge} testID="nudge-skip">
                <Text style={styles.nudgeSkipText}>Skip for now</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => setShowBottomSheet(true)}
          testID="progress-card"
        >
          <View style={[styles.progressCard, shadows.card]}>
            <View style={styles.progressHeader}>
              <View style={styles.levelRow}>
                <View style={[styles.levelPill, { backgroundColor: colors.blue }]}>
                  <Text style={styles.levelPillText}>{targetLevel}</Text>
                </View>
                <Text style={styles.examLabel}>{examType}</Text>
              </View>
              <View style={[styles.gaugePill, { backgroundColor: gaugeColor }]}>
                <Text style={styles.gaugeText}>{Math.round(preparedness)}%</Text>
              </View>
            </View>

            <PreparednessBar score={preparedness} />

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Flame color="#FF6B35" size={16} />
                <Text style={styles.statValue}>{streak}</Text>
                <Text style={styles.statLabel}>streak</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Star color="#FFD700" size={16} />
                <Text style={styles.statValue}>{formattedXp}</Text>
                <Text style={styles.statLabel}>XP</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <View style={[styles.badgeDot, { backgroundColor: badgeTier.color }]} />
                <Text style={styles.statValue}>{badgeTier.label}</Text>
                <Text style={styles.statLabel}>tier</Text>
              </View>
            </View>
          </View>
        </Pressable>

        <Pressable
          style={[styles.ctaCard, shadows.card]}
          onPress={onStartPractice}
          testID="start-practice-cta"
        >
          <View style={styles.ctaContent}>
            <View style={styles.ctaIconWrap}>
              <Zap color={colors.white} size={22} />
            </View>
            <View style={styles.ctaTextWrap}>
              <Text style={styles.ctaTitle}>{ctaLabel}</Text>
              <Text style={styles.ctaSub}>
                {hasPracticedToday
                  ? 'Pick up where you left off'
                  : 'Exam-style questions for your level'}
              </Text>
            </View>
          </View>
          <ChevronRight color={colors.white} size={20} />
        </Pressable>

        <View style={styles.quickAccessRow}>
          <Pressable
            style={[styles.quickCard, shadows.card]}
            onPress={() => router.push('/(tabs)/tests')}
            testID="quick-sectional"
          >
            <View style={[styles.quickIcon, { backgroundColor: '#E8F0FE' }]}>
              <ClipboardList color={colors.blue} size={18} />
            </View>
            <Text style={styles.quickTitle}>Sectional</Text>
            <Text style={styles.quickSub}>
              {stats ? `${stats.sectionalCount}/${stats.sectionalTotal} done` : '—'}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.quickCard, shadows.card]}
            onPress={() => router.push('/(tabs)/mock')}
            testID="quick-mock"
          >
            <View style={[styles.quickIcon, { backgroundColor: '#E8F8EE' }]}>
              <Trophy color={colors.green} size={18} />
            </View>
            <Text style={styles.quickTitle}>Mock</Text>
            <Text style={styles.quickSub}>
              {stats?.mockLastScore != null ? `${stats.mockLastScore}%` : 'Not started'}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.quickCard, shadows.card]}
            onPress={() => router.push('/(tabs)/tests')}
            testID="quick-schreiben"
          >
            <View style={[styles.quickIcon, { backgroundColor: '#FBE9E7' }]}>
              <PenLine color="#D84315" size={18} />
            </View>
            <Text style={styles.quickTitle}>Schreiben</Text>
            <Text style={styles.quickSub}>
              {stats ? `${stats.schreibenDone}/${stats.schreibenTotal} done` : '—'}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.motivationCard, shadows.card]}>
          <Text style={styles.motivationIcon}>
            {streak >= 3 ? '🔥' : daysToExam !== null && daysToExam <= 30 ? '📅' : preparedness < 40 ? '📊' : '💡'}
          </Text>
          <Text style={styles.motivationText}>{motivationalMsg}</Text>
        </View>

        {daysToExam !== null && daysToExam <= 30 ? (
          <View style={[styles.examCountdown, shadows.card]}>
            <Calendar color={colors.navy} size={18} />
            <View style={styles.examCountdownText}>
              <Text style={styles.examCountdownTitle}>{daysToExam} days until your exam</Text>
              <Text style={styles.examCountdownSub}>
                {daysToExam <= 7 ? 'Final stretch — practice every day!' : 'Stay consistent to build confidence.'}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <PreparednessBottomSheet
        visible={showBottomSheet}
        onClose={() => setShowBottomSheet(false)}
        level={targetLevel}
        overallScore={preparedness}
        horenPct={horenPct}
        lesenPct={lesenPct}
        streak={streak}
        lastActiveDate={profile?.last_active_date ?? null}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: spacing.xl,
    gap: spacing.lg,
    paddingBottom: spacing.huge,
  },
  progressCard: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  levelPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  levelPillText: {
    color: colors.white,
    fontSize: fontSize.label,
    fontWeight: '800' as const,
  },
  examLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: fontSize.label,
    fontWeight: '600' as const,
  },
  gaugePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  gaugeText: {
    color: colors.white,
    fontSize: fontSize.label,
    fontWeight: '800' as const,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: spacing.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statValue: {
    color: colors.white,
    fontSize: fontSize.bodyMd,
    fontWeight: '800' as const,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: fontSize.label,
    fontWeight: '600' as const,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  badgeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  ctaCard: {
    backgroundColor: colors.blue,
    borderRadius: radius.lg,
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ctaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    flex: 1,
  },
  ctaIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTextWrap: {
    flex: 1,
    gap: 2,
  },
  ctaTitle: {
    color: colors.white,
    fontSize: fontSize.bodyLg,
    fontWeight: '800' as const,
  },
  ctaSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.bodySm,
    fontWeight: '500' as const,
  },
  quickAccessRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTitle: {
    fontSize: fontSize.bodySm,
    fontWeight: '700' as const,
    color: colors.navy,
  },
  quickSub: {
    fontSize: fontSize.label,
    fontWeight: '600' as const,
    color: colors.muted,
  },
  motivationCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  motivationIcon: {
    fontSize: 22,
  },
  motivationText: {
    flex: 1,
    fontSize: fontSize.bodyMd,
    fontWeight: '600' as const,
    color: colors.text,
    lineHeight: 20,
  },
  examCountdown: {
    backgroundColor: '#FFF8E1',
    borderRadius: radius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  examCountdownText: {
    flex: 1,
    gap: 2,
  },
  examCountdownTitle: {
    fontSize: fontSize.bodyMd,
    fontWeight: '700' as const,
    color: colors.navy,
  },
  examCountdownSub: {
    fontSize: fontSize.bodySm,
    fontWeight: '500' as const,
    color: colors.muted,
  },
  welcomeScreen: {
    flex: 1,
    backgroundColor: colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeContent: {
    paddingHorizontal: spacing.xxxl,
    alignItems: 'center',
    gap: spacing.xl,
  },
  welcomeIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  welcomeTitle: {
    fontSize: fontSize.displayLg,
    fontWeight: '800' as const,
    color: colors.white,
    textAlign: 'center',
    lineHeight: 34,
  },
  welcomeSubtitle: {
    fontSize: fontSize.bodyLg,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 24,
  },
  welcomeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.blue,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
    marginTop: spacing.md,
  },
  welcomeCtaText: {
    color: colors.white,
    fontSize: fontSize.bodyLg,
    fontWeight: '800' as const,
  },
  welcomeSecondary: {
    paddingVertical: spacing.md,
  },
  welcomeSecondaryText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: fontSize.bodyMd,
    fontWeight: '600' as const,
  },
  nudgeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  nudgeSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xxl,
    paddingBottom: spacing.huge,
    alignItems: 'center',
    gap: spacing.lg,
  },
  nudgeHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  nudgeTitle: {
    fontSize: fontSize.displaySm,
    fontWeight: '800' as const,
    color: colors.navy,
  },
  nudgeDesc: {
    fontSize: fontSize.bodyMd,
    fontWeight: '500' as const,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  nudgeCta: {
    backgroundColor: colors.blue,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
    width: '100%',
    alignItems: 'center',
  },
  nudgeCtaText: {
    color: colors.white,
    fontSize: fontSize.bodyLg,
    fontWeight: '800' as const,
  },
  nudgeSkipText: {
    color: colors.muted,
    fontSize: fontSize.bodyMd,
    fontWeight: '600' as const,
    paddingVertical: spacing.sm,
  },
});
