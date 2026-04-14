/**
 * Stream Screen — simplified question flow
 * Questions fetched upfront into useState array.
 * No PanResponder, no swipe gestures, no ref-syncing.
 * Progression: answer → see explanation → tap Next → next question.
 */
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  BookOpenText,
  Flame,
  Headphones,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react-native';
import * as Sentry from '@sentry/react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { PaywallModal } from '@/components/PaywallModal';
import { PreparednessBottomSheet } from '@/components/PreparednessBottomSheet';
import { ReportModal } from '@/components/ReportModal';
import { StreamCard } from '@/components/StreamCard';
import { TrialBanner } from '@/components/TrialBanner';
import { fontFamily, fontSize, PAID_TIERS } from '@/theme';
import { TEIL_NAMES } from '@/theme/constants';
import { didCrossBadgeThreshold, formatXp, getBadgeTier } from '@/lib/badgeHelpers';
import {
  checkAndAwardBadges,
  fetchSectionAccuracy,
  updatePreparednessScore,
  updateXpAndStreak,
  type BadgeType,
} from '@/lib/streamHelpers';
import {
  advanceSession,
  fetchQuestionsByIds,
  getOrCreateStreamSession,
  saveStreamAnswer,
  type SessionResult,
} from '@/lib/streamSessionHelpers';
import { useAccess } from '@/providers/AccessProvider';
import { useAuth } from '@/providers/AuthProvider';
import type { AppQuestion } from '@/types/database';

// ─── Banani design tokens ────────────────────────────────────────────────────
const B = {
  background: '#F8FAFF',
  foreground: '#374151',
  border: '#E2E8F0',
  primary: '#2B70EF',
  primaryFg: '#FFFFFF',
  card: '#FFFFFF',
  muted: '#94A3B8',
  accent: '#F0C808',
  accentFg: '#374151',
  warning: '#F59E0B',
  questionColor: '#0F1F3D',
} as const;

const SESSION_SIZE = 20;

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function TestStreamScreen() {
  const { profile, user, refreshProfile } = useAuth();
  const { access, isStreamLimited, decrementStreamRemaining, incrementDailyStreamCount } = useAccess();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = user?.id ?? '';
  const targetLevel = profile?.target_level ?? 'A1';
  const today = new Date().toISOString().slice(0, 10);

  // ── Core question state ────────────────────────────────────────────────────
  const [questions, setQuestions] = useState<AppQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [isRecycledBanner, setIsRecycledBanner] = useState<boolean>(false);
  const [audioUnlockedMap, setAudioUnlockedMap] = useState<Record<string, boolean>>({});

  // ── Gamification state ─────────────────────────────────────────────────────
  const [showPaywall, setShowPaywall] = useState<boolean>(false);
  const [localPreparedness, setLocalPreparedness] = useState<number>(profile?.preparedness_score ?? 0);
  const [localXp, setLocalXp] = useState<number>(profile?.xp_total ?? 0);
  const [localStreak, setLocalStreak] = useState<number>(profile?.streak_count ?? 0);
  const [celebrationBadge, setCelebrationBadge] = useState<BadgeType | null>(null);
  const [streakToast, setStreakToast] = useState<string | null>(null);
  const [showBottomSheet, setShowBottomSheet] = useState<boolean>(false);
  const [reportQuestionId, setReportQuestionId] = useState<string | null>(null);
  const [sessionAnsweredCount, setSessionAnsweredCount] = useState<number>(0);
  const [correctStreak, setCorrectStreak] = useState<number>(0);
  const [comboToast, setComboToast] = useState<string | null>(null);
  const [horenPct, setHorenPct] = useState<number>(0);
  const [lesenPct, setLesenPct] = useState<number>(0);
  const [xpBurstVisible, setXpBurstVisible] = useState<boolean>(false);
  const [xpBurstValue, setXpBurstValue] = useState<number>(0);

  const xpBurstOpacity = useRef(new Animated.Value(0)).current;
  const xpBurstTranslateY = useRef(new Animated.Value(0)).current;
  const xpBurstScale = useRef(new Animated.Value(0.8)).current;
  const streakToastAnim = useRef(new Animated.Value(-80)).current;
  const comboToastAnim = useRef(new Animated.Value(0)).current;

  const XP_PER_LEVEL: Record<string, number> = useMemo(() => ({ A1: 5, A2: 10, B1: 15 }), []);
  const streamSections = ['Hören', 'Lesen'];

  // ── Derived values ─────────────────────────────────────────────────────────
  const currentQuestion = questions[currentIndex] ?? null;
  const totalQuestions = questions.length;
  const badgeTier = useMemo(() => getBadgeTier(localXp), [localXp]);
  const formattedXp = useMemo(() => formatXp(localXp), [localXp]);

  const isPaidUser = PAID_TIERS.has(profile?.subscription_tier ?? 'free_trial');
  const trialHours = access.trial_hours_remaining;

  // ── Sync profile values ────────────────────────────────────────────────────
  useEffect(() => {
    if (profile) {
      setLocalPreparedness(profile.preparedness_score ?? 0);
      setLocalXp(profile.xp_total ?? 0);
      setLocalStreak(profile.streak_count ?? 0);
    }
  }, [profile]);

  useEffect(() => {
    if (userId) {
      fetchSectionAccuracy(userId).then((acc) => {
        setHorenPct(Math.round(acc.horenAccuracy * 100));
        setLesenPct(Math.round(acc.lesenAccuracy * 100));
      }).catch(() => {});
    }
  }, [userId]);

  // ── Session init ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !targetLevel) return;
    let cancelled = false;

    async function initSession() {
      setIsLoading(true);
      setInitError(null);
      try {
        const result: SessionResult = await getOrCreateStreamSession(userId, targetLevel, today, streamSections);
        if (cancelled) return;
        if (result.status === 'complete') {
          setIsComplete(true);
          setSessionId(result.session.id);
          setSessionAnsweredCount(result.session.completed_count);
          setIsLoading(false);
          return;
        }
        if (result.status === 'created' && 'isRecycled' in result && result.isRecycled) {
          setIsRecycledBanner(true);
        }
        const session = result.session;
        const questionData = await fetchQuestionsByIds(session.question_ids);
        if (cancelled) return;
        setSessionId(session.id);
        setQuestions(questionData);
        setCurrentIndex(session.current_index);
        setSessionAnsweredCount(session.completed_count);
        setIsComplete(session.is_complete);
      } catch (err) {
        console.error('[Stream] Init failed:', err);
        Sentry.captureException(err, { tags: { context: 'stream_init' } });
        if (!cancelled) setInitError('Failed to load questions. Please try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void initSession();
    return () => { cancelled = true; };
  }, [userId, targetLevel, today]);

  // ── Animation helpers ──────────────────────────────────────────────────────
  const triggerXpBurst = useCallback((level: string) => {
    const xpVal = XP_PER_LEVEL[level] ?? 5;
    setXpBurstValue(xpVal);
    setXpBurstVisible(true);
    xpBurstOpacity.setValue(0); xpBurstTranslateY.setValue(0); xpBurstScale.setValue(0.8);
    Animated.parallel([
      Animated.timing(xpBurstOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(xpBurstScale, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(xpBurstTranslateY, { toValue: -30, duration: 450, useNativeDriver: true }),
        Animated.timing(xpBurstOpacity, { toValue: 0, duration: 450, delay: 150, useNativeDriver: true }),
      ]).start(() => setXpBurstVisible(false));
    });
  }, [XP_PER_LEVEL, xpBurstOpacity, xpBurstTranslateY, xpBurstScale]);

  const showStreakToastBanner = useCallback((text: string) => {
    setStreakToast(text);
    Animated.sequence([
      Animated.timing(streakToastAnim, { toValue: 60, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(streakToastAnim, { toValue: -80, duration: 300, useNativeDriver: true }),
    ]).start(() => setStreakToast(null));
  }, [streakToastAnim]);

  const showComboToastBanner = useCallback((text: string) => {
    setComboToast(text);
    Animated.sequence([
      Animated.timing(comboToastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(comboToastAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setComboToast(null));
  }, [comboToastAnim]);

  // ── Handle answer ──────────────────────────────────────────────────────────
  const handleAnswer = useCallback(
    async (questionId: string, selectedKey: string, isCorrect: boolean) => {
      setSelectedAnswer(selectedKey);
      setIsAnswered(true);
      const newCount = sessionAnsweredCount + 1;
      setSessionAnsweredCount(newCount);
      decrementStreamRemaining();
      incrementDailyStreamCount().catch(() => {});

      if (isCorrect) {
        triggerXpBurst(targetLevel);
        const newStrk = correctStreak + 1;
        setCorrectStreak(newStrk);
        if (newStrk === 3) showComboToastBanner('3 in a row! 🔥');
        else if (newStrk === 5) showComboToastBanner('5 in a row! ⚡');
      } else {
        setCorrectStreak(0);
      }

      if (newCount === Math.ceil(SESSION_SIZE / 2)) showStreakToastBanner('Halfway there — you\'re doing great 🔥');
      if (newCount === 10) showComboToastBanner('10 questions done! 💪');
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      if (sessionId) {
        saveStreamAnswer({ sessionId, userId, questionId, selectedAnswer: selectedKey, isCorrect }).catch((err) => console.error('[Stream] Save answer error:', err));
      }
      updatePreparednessScore(userId, 1).then((newScore) => setLocalPreparedness(newScore)).catch(() => {});

      if (isCorrect && profile) {
        try {
          const oldXp = localXp;
          const { newXp, newStreak } = await updateXpAndStreak(userId, { ...profile, xp_total: localXp, streak_count: localStreak, last_active_date: profile.last_active_date });
          setLocalXp(newXp);
          const crossedBadge = didCrossBadgeThreshold(oldXp, newXp);
          if (crossedBadge) showStreakToastBanner(`🏅 You reached ${crossedBadge.label}!`);
          if (newStreak !== localStreak) setLocalStreak(newStreak);
        } catch {}
      }

      if (newCount % 5 === 0) {
        checkAndAwardBadges(userId, targetLevel, localXp).then((badge) => { if (badge) setCelebrationBadge(badge); }).catch(() => {});
        refreshProfile().catch(() => {});
      }
    },
    [sessionId, userId, profile, localXp, localStreak, targetLevel, sessionAnsweredCount,
     correctStreak, decrementStreamRemaining, incrementDailyStreamCount, triggerXpBurst,
     showStreakToastBanner, showComboToastBanner, refreshProfile]
  );

  // ── Handle Next ────────────────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    if (isStreamLimited) { setShowPaywall(true); return; }
    const newIndex = currentIndex + 1;
    const isNowComplete = newIndex >= totalQuestions;
    if (sessionId) advanceSession(sessionId, newIndex, totalQuestions).catch((err) => console.error('[Stream] Advance error:', err));
    if (isNowComplete) { setIsComplete(true); return; }
    setIsAnswered(false); setSelectedAnswer(null); setAudioUnlockedMap({}); setCurrentIndex(newIndex);
  }, [currentIndex, totalQuestions, sessionId, isStreamLimited]);

  const handleAudioPlayed = useCallback((questionId: string) => {
    setAudioUnlockedMap((prev) => ({ ...prev, [questionId]: true }));
  }, []);

  const handleReportPress = useCallback((qId: string) => { setReportQuestionId(qId); }, []);

  // ── Render: Loading ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.emptyWrap}>
          <ActivityIndicator color={B.primary} size="large" />
          <Text style={s.emptyDesc}>Loading questions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Init error ─────────────────────────────────────────────────────
  if (initError) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.emptyWrap}>
          <Text style={s.emptyEmoji}>⚠️</Text>
          <Text style={s.emptyTitle}>Couldn't load questions</Text>
          <Text style={s.emptyDesc}>{initError}</Text>
          <Pressable style={s.ctaPrimary} onPress={() => { setInitError(null); setIsLoading(true); }}>
            <Text style={s.ctaPrimaryText}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Session complete ───────────────────────────────────────────────
  if (isComplete) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.emptyWrap}>
          <Text style={s.emptyEmoji}>🎉</Text>
          <Text style={s.emptyTitle}>Today's stream complete!</Text>
          <Text style={s.emptyDesc}>You answered {sessionAnsweredCount} questions today.{'\n'}Come back tomorrow for your next stream.</Text>
          <Pressable style={s.ctaSecondary} onPress={() => router.push('/(tabs)/tests' as never)}>
            <Text style={s.ctaSecondaryText}>Try a Sectional Test</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Daily limit reached ────────────────────────────────────────────
  if (isStreamLimited && !isAnswered) {
    const dailyLimit = access.stream_questions_per_day ?? 0;
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.emptyWrap}>
          <Text style={s.emptyEmoji}>⏰</Text>
          <Text style={s.emptyTitle}>Daily limit reached</Text>
          <Text style={s.emptyDesc}>You've answered {dailyLimit} question{dailyLimit !== 1 ? 's' : ''} today — your daily allowance.{'\n'}Upgrade to practise unlimited questions every day.</Text>
          <View style={s.emptyCtas}>
            <Pressable style={s.ctaPrimary} onPress={() => setShowPaywall(true)}>
              <Text style={s.ctaPrimaryText}>Unlock Unlimited</Text>
            </Pressable>
            <Pressable style={s.ctaSecondary} onPress={() => router.push('/(tabs)/tests' as never)}>
              <Text style={s.ctaSecondaryText}>Try a Sectional Test</Text>
            </Pressable>
          </View>
        </View>
        <PaywallModal visible={showPaywall} variant="stream_limit" onUpgrade={() => setShowPaywall(false)} onDismiss={() => setShowPaywall(false)} />
      </SafeAreaView>
    );
  }

  // ── Render: No questions ───────────────────────────────────────────────────
  if (questions.length === 0) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.emptyWrap}>
          <Text style={s.emptyEmoji}>🏆</Text>
          <Text style={s.emptyTitle}>No questions available</Text>
          <Text style={s.emptyDesc}>Come back tomorrow or try a Sectional Test.</Text>
          <Pressable style={s.ctaPrimary} onPress={() => router.push('/(tabs)/tests' as never)}>
            <Text style={s.ctaPrimaryText}>Try Sectional Test</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Main stream ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safeArea}>
      {/* Upgrade nudge / trial banner */}
      {!isPaidUser ? (
        <Pressable style={s.nudgeCard} onPress={() => setShowPaywall(true)}>
          <View style={s.nudgeIcon}>
            <Sparkles color={B.accentFg} size={18} />
          </View>
          <View style={s.nudgeCopy}>
            <Text style={s.nudgeTitle}>Unlock all levels & sections</Text>
            {trialHours !== null ? (
              <Text style={s.nudgeSubtitle}>{Math.ceil(trialHours)} hours left on your trial</Text>
            ) : null}
          </View>
          <View style={s.nudgeArrow}>
            <ArrowRight color={B.muted} size={16} />
          </View>
        </Pressable>
      ) : null}

      {/* Stream header */}
      <View style={s.streamHeader}>
        <View style={s.headerContext}>
          {currentQuestion ? (
            <>
              <View style={s.headerIcon}>
                {currentQuestion.section === 'Hören'
                  ? <Headphones color={B.muted} size={18} />
                  : <BookOpenText color={B.muted} size={18} />}
              </View>
              <Text style={s.headerContextText}>
                {targetLevel} · {currentQuestion.section} · Teil {currentQuestion.teil}
              </Text>
            </>
          ) : null}
        </View>
        <View style={s.headerCounter}>
          <Text style={s.headerCounterText}>{currentIndex + 1}/{totalQuestions}</Text>
        </View>
      </View>

      {/* Recycled banner */}
      {isRecycledBanner ? (
        <View style={s.recycledBanner}>
          <Text style={s.recycledText}>You've seen all questions this month! 🏆 Starting a new cycle.</Text>
          <Pressable onPress={() => setIsRecycledBanner(false)} hitSlop={8}>
            <Text style={s.recycledClose}>✕</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Question card */}
      <View style={s.cardContainer}>
        {currentQuestion ? (
          <StreamCard
            question={currentQuestion}
            onAnswer={handleAnswer}
            isAnswered={isAnswered}
            selectedAnswer={selectedAnswer}
            audioUnlocked={audioUnlockedMap[currentQuestion.id] ?? false}
            onAudioPlayed={() => handleAudioPlayed(currentQuestion.id)}
            onReportPress={handleReportPress}
            reviewMode={false}
          />
        ) : (
          <View style={s.skipErrorWrap}>
            <Text style={s.emptyEmoji}>⚠️</Text>
            <Text style={s.emptyDesc}>Couldn't load this question</Text>
            <Pressable style={s.ctaPrimary} onPress={() => {
              if (currentIndex + 1 < totalQuestions) {
                setIsAnswered(false); setSelectedAnswer(null); setCurrentIndex(currentIndex + 1);
                if (sessionId) advanceSession(sessionId, currentIndex + 1, totalQuestions).catch(() => {});
              }
            }}>
              <Text style={s.ctaPrimaryText}>Skip to next</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Next button */}
      {isAnswered ? (
        <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={handleNext} style={s.nextBtn} testID="stream-next-btn">
            <Text style={s.nextBtnText}>
              {currentIndex + 1 >= totalQuestions ? 'Fertig' : 'Weiter →'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Motivational stats bar */}
      <View style={s.motivationalBar}>
        <View style={s.motItem}>
          <Flame color={B.warning} size={18} />
          <Text style={s.motItemText}>{localStreak}</Text>
        </View>
        <View style={s.motItem}>
          <Star color={B.accent} size={18} />
          <Text style={s.motItemText}>{formattedXp}</Text>
          <Text style={s.motItemText}>XP</Text>
        </View>
        <View style={s.motBadge}>
          <Text style={s.motBadgeText}>{badgeTier.label}</Text>
        </View>
      </View>

      {/* Toasts and overlays (unchanged logic) */}
      {comboToast ? (
        <Animated.View style={[s.comboPill, { opacity: comboToastAnim, transform: [{ scale: comboToastAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}>
          <Text style={s.comboPillText}>{comboToast}</Text>
        </Animated.View>
      ) : null}

      {xpBurstVisible ? (
        <Animated.View pointerEvents="none" style={[s.xpBurst, { opacity: xpBurstOpacity, transform: [{ translateY: xpBurstTranslateY }, { scale: xpBurstScale }] }]}>
          <Text style={s.xpBurstText}>+{xpBurstValue} XP</Text>
        </Animated.View>
      ) : null}

      {celebrationBadge ? (
        <CelebrationOverlay badgeType={celebrationBadge} level={targetLevel} onDismiss={() => setCelebrationBadge(null)} />
      ) : null}

      {streakToast ? (
        <Animated.View style={[s.toast, { transform: [{ translateY: streakToastAnim }] }]}>
          <Text style={s.toastText}>{streakToast}</Text>
        </Animated.View>
      ) : null}

      <PreparednessBottomSheet visible={showBottomSheet} onClose={() => setShowBottomSheet(false)} level={targetLevel} overallScore={localPreparedness} horenPct={horenPct} lesenPct={lesenPct} streak={localStreak} lastActiveDate={profile?.last_active_date ?? null} />
      <ReportModal visible={Boolean(reportQuestionId)} questionId={reportQuestionId ?? ''} userId={userId} onClose={() => setReportQuestionId(null)} />
      <PaywallModal visible={showPaywall} variant="stream_limit" onUpgrade={() => setShowPaywall(false)} onDismiss={() => setShowPaywall(false)} />
    </SafeAreaView>
  );
}

// ─── Styles (Banani faithful) ────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: B.background },

  // Upgrade nudge card
  nudgeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, marginTop: 12, marginBottom: 6,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: B.card, borderWidth: 1, borderColor: B.border, borderRadius: 16,
    ...Platform.select({
      ios: { shadowColor: '#0F1F3D', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.03, shadowRadius: 18 },
      android: { elevation: 2 },
    }),
  },
  nudgeIcon: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  nudgeCopy: { flex: 1, gap: 2 },
  nudgeTitle: { fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: B.foreground, lineHeight: 14 * 1.25 },
  nudgeSubtitle: { fontFamily: fontFamily.bodyRegular, fontSize: 12, color: B.muted, lineHeight: 12 * 1.25 },
  nudgeArrow: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },

  // Stream header
  streamHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20,
  },
  headerContext: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  headerContextText: { fontFamily: fontFamily.display, fontSize: 14, color: B.muted },
  headerCounter: {
    backgroundColor: 'rgba(43,112,239,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  headerCounterText: { fontFamily: fontFamily.display, fontSize: 14, color: B.primary },

  // Recycled banner
  recycledBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', paddingHorizontal: 16, paddingVertical: 10, gap: 10, marginHorizontal: 20, borderRadius: 12, marginBottom: 8 },
  recycledText: { flex: 1, fontFamily: fontFamily.bodySemiBold, color: '#E65100', fontSize: 13, lineHeight: 18 },
  recycledClose: { fontFamily: fontFamily.bodyBold, color: '#E65100', fontSize: 16 },

  // Card container
  cardContainer: { flex: 1, overflow: 'hidden' },
  skipErrorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },

  // Footer / Next button
  footer: { paddingHorizontal: 20, paddingTop: 8, backgroundColor: B.background },
  nextBtn: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, backgroundColor: B.primary,
  },
  nextBtnText: { fontFamily: fontFamily.bodyBold, color: B.primaryFg, fontSize: 16 },

  // Motivational stats bar
  motivationalBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 18, paddingHorizontal: 20, paddingVertical: 16,
  },
  motItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  motItemText: { fontFamily: fontFamily.display, fontSize: 16, color: B.questionColor },
  motBadge: {
    backgroundColor: B.accent, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
  },
  motBadgeText: { fontFamily: fontFamily.display, fontSize: 13, color: B.accentFg, letterSpacing: 0.5, textTransform: 'uppercase' },

  // Empty states
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontFamily: fontFamily.display, fontSize: 20, color: B.questionColor, textAlign: 'center' },
  emptyDesc: { fontFamily: fontFamily.bodyRegular, fontSize: 14, color: B.muted, textAlign: 'center', lineHeight: 22 },
  emptyCtas: { gap: 10, width: '100%', marginTop: 16 },
  ctaPrimary: { backgroundColor: B.primary, paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  ctaPrimaryText: { fontFamily: fontFamily.bodyBold, color: B.primaryFg, fontSize: 15 },
  ctaSecondary: { backgroundColor: 'rgba(15,31,61,0.04)', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  ctaSecondaryText: { fontFamily: fontFamily.bodySemiBold, color: B.foreground, fontSize: 15 },

  // Toasts & overlays
  comboPill: { position: 'absolute', top: 110, alignSelf: 'center', backgroundColor: B.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, zIndex: 200 },
  comboPillText: { fontFamily: fontFamily.display, color: B.accentFg, fontSize: 13 },
  toast: { position: 'absolute', top: 0, left: 16, right: 16, backgroundColor: B.primary, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', zIndex: 300 },
  toastText: { fontFamily: fontFamily.bodyBold, color: B.primaryFg, fontSize: 15 },
  xpBurst: { position: 'absolute', top: '45%' as unknown as number, alignSelf: 'center', zIndex: 250 },
  xpBurstText: { fontFamily: fontFamily.display, color: '#22C55E', fontSize: 18 },
});
