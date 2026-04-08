/**
 * Stream Screen — simplified question flow
 * Questions fetched upfront into useState array.
 * No PanResponder, no swipe gestures, no ref-syncing.
 * Progression: answer → see explanation → tap Next → next question.
 */
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Headphones, BookOpenText } from 'lucide-react-native';
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
import Colors from '@/constants/colors';
import { colors } from '@/theme';
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

const SESSION_SIZE = 20;

// ─── Progress bar (reused from before) ──────────────────────────────────────


// ─── Main screen ─────────────────────────────────────────────────────────────

export default function TestStreamScreen() {
  const { profile, user, refreshProfile } = useAuth();
  const { access, isStreamLimited, decrementStreamRemaining, incrementDailyStreamCount } = useAccess();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = user?.id ?? '';
  const targetLevel = profile?.target_level ?? 'A1';
  const today = new Date().toISOString().slice(0, 10);

  // ── Core question state (simple, no refs) ──────────────────────────────────
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
  const gaugeScaleAnim = useRef(new Animated.Value(1)).current;
  const comboToastAnim = useRef(new Animated.Value(0)).current;

  const XP_PER_LEVEL: Record<string, number> = useMemo(() => ({ A1: 5, A2: 10, B1: 15 }), []);
  const streamSections = ['Hören', 'Lesen'];

  // ── Derived values ─────────────────────────────────────────────────────────
  const currentQuestion = questions[currentIndex] ?? null;
  const totalQuestions = questions.length;
  const gaugeColor = useMemo(() => {
    if (localPreparedness < 40) return colors.red;
    if (localPreparedness < 70) return colors.amber;
    return colors.green;
  }, [localPreparedness]);
  const badgeTier = useMemo(() => getBadgeTier(localXp), [localXp]);
  const formattedXp = useMemo(() => formatXp(localXp), [localXp]);

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

  // ── Session init (2 DB calls total, then zero for questions) ───────────────
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
        // Fetch all questions upfront — single DB call
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
    xpBurstOpacity.setValue(0);
    xpBurstTranslateY.setValue(0);
    xpBurstScale.setValue(0.8);
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

  const animateGaugePulse = useCallback(() => {
    Animated.sequence([
      Animated.timing(gaugeScaleAnim, { toValue: 1.12, duration: 200, useNativeDriver: true }),
      Animated.timing(gaugeScaleAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [gaugeScaleAnim]);

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

      if (newCount === Math.ceil(SESSION_SIZE / 2)) {
        showStreakToastBanner('Halfway there — you\'re doing great 🔥');
      }
      if (newCount === 10) {
        showComboToastBanner('10 questions done! 💪');
      }

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      animateGaugePulse();

      // Save answer — non-blocking
      if (sessionId) {
        saveStreamAnswer({
          sessionId,
          userId,
          questionId,
          selectedAnswer: selectedKey,
          isCorrect,
        }).catch((err) => console.error('[Stream] Save answer error:', err));
      }

      // Update preparedness — non-blocking
      updatePreparednessScore(userId, 1).then((newScore) => {
        setLocalPreparedness(newScore);
      }).catch(() => {});

      // Update XP + streak — non-blocking
      if (isCorrect && profile) {
        try {
          const oldXp = localXp;
          const { newXp, newStreak } = await updateXpAndStreak(userId, {
            ...profile,
            xp_total: localXp,
            streak_count: localStreak,
            last_active_date: profile.last_active_date,
          });
          setLocalXp(newXp);
          const crossedBadge = didCrossBadgeThreshold(oldXp, newXp);
          if (crossedBadge) showStreakToastBanner(`🏅 You reached ${crossedBadge.label}!`);
          if (newStreak !== localStreak) setLocalStreak(newStreak);
        } catch { /* silent */ }
      }

      // Check badges every 5 answers
      if (newCount % 5 === 0) {
        checkAndAwardBadges(userId, targetLevel, localXp).then((badge) => {
          if (badge) setCelebrationBadge(badge);
        }).catch(() => {});
        refreshProfile().catch(() => {});
      }
    },
    [sessionId, userId, profile, localXp, localStreak, targetLevel, sessionAnsweredCount,
     correctStreak, decrementStreamRemaining, incrementDailyStreamCount, triggerXpBurst,
     animateGaugePulse, showStreakToastBanner, showComboToastBanner, refreshProfile]
  );

  // ── Handle Next (advance to next question) ─────────────────────────────────
  const handleNext = useCallback(() => {
    if (isStreamLimited) {
      setShowPaywall(true);
      return;
    }

    const newIndex = currentIndex + 1;
    const isNowComplete = newIndex >= totalQuestions;

    // Advance session in DB — non-blocking
    if (sessionId) {
      advanceSession(sessionId, newIndex, totalQuestions)
        .catch((err) => console.error('[Stream] Advance error:', err));
    }

    if (isNowComplete) {
      setIsComplete(true);
      return;
    }

    // Reset answer state and advance
    setIsAnswered(false);
    setSelectedAnswer(null);
    setAudioUnlockedMap({});
    setCurrentIndex(newIndex);
  }, [currentIndex, totalQuestions, sessionId, isStreamLimited]);

  const handleAudioPlayed = useCallback((questionId: string) => {
    setAudioUnlockedMap((prev) => ({ ...prev, [questionId]: true }));
  }, []);

  const handleReportPress = useCallback((qId: string) => {
    setReportQuestionId(qId);
  }, []);

  // ── Render: Loading ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading questions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Init error ─────────────────────────────────────────────────────
  if (initError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>⚠️</Text>
          <Text style={styles.emptyTitle}>Couldn't load questions</Text>
          <Text style={styles.emptyDesc}>{initError}</Text>
          <Pressable style={styles.ctaPrimary} onPress={() => { setInitError(null); setIsLoading(true); }}>
            <Text style={styles.ctaPrimaryText}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Session complete ───────────────────────────────────────────────
  if (isComplete) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>🎉</Text>
          <Text style={styles.emptyTitle}>Today's stream complete!</Text>
          <Text style={styles.emptyDesc}>
            You answered {sessionAnsweredCount} questions today.{'\n'}
            Come back tomorrow for your next stream.
          </Text>
          <Pressable style={styles.ctaSecondary} onPress={() => router.push('/(tabs)/tests' as never)}>
            <Text style={styles.ctaSecondaryText}>Try a Sectional Test</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Daily limit reached ────────────────────────────────────────────
  if (isStreamLimited && !isAnswered) {
    const dailyLimit = access.stream_questions_per_day ?? 0;
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>⏰</Text>
          <Text style={styles.emptyTitle}>Daily limit reached</Text>
          <Text style={styles.emptyDesc}>
            You've answered {dailyLimit} question{dailyLimit !== 1 ? 's' : ''} today — your daily allowance.{'\n'}
            Upgrade to practise unlimited questions every day.
          </Text>
          <View style={styles.emptyCtas}>
            <Pressable style={styles.ctaPrimary} onPress={() => setShowPaywall(true)}>
              <Text style={styles.ctaPrimaryText}>Unlock Unlimited</Text>
            </Pressable>
            <Pressable style={styles.ctaSecondary} onPress={() => router.push('/(tabs)/tests' as never)}>
              <Text style={styles.ctaSecondaryText}>Try a Sectional Test</Text>
            </Pressable>
          </View>
        </View>
        <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} />
      </SafeAreaView>
    );
  }

  // ── Render: No questions ───────────────────────────────────────────────────
  if (questions.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>🏆</Text>
          <Text style={styles.emptyTitle}>No questions available</Text>
          <Text style={styles.emptyDesc}>Come back tomorrow or try a Sectional Test.</Text>
          <Pressable style={styles.ctaPrimary} onPress={() => router.push('/(tabs)/tests' as never)}>
            <Text style={styles.ctaPrimaryText}>Try Sectional Test</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Main stream ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      {access.trial_hours_remaining !== null ? (
        <TrialBanner hoursRemaining={access.trial_hours_remaining} onUpgrade={() => setShowPaywall(true)} />
      ) : null}

      {/* Status bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          {currentQuestion ? (
            <>
              {currentQuestion.section === 'Hören' ? (
                <Headphones color="rgba(255,255,255,0.8)" size={14} />
              ) : (
                <BookOpenText color="rgba(255,255,255,0.8)" size={14} />
              )}
              <Text style={styles.statusLabelText} numberOfLines={1}>
                {targetLevel} · {currentQuestion.section} · Teil {currentQuestion.teil}
                {TEIL_NAMES[currentQuestion.section]?.[currentQuestion.teil]
                  ? ` · ${TEIL_NAMES[currentQuestion.section][currentQuestion.teil].de} / ${TEIL_NAMES[currentQuestion.section][currentQuestion.teil].en}`
                  : ''}
              </Text>
            </>
          ) : null}
        </View>
        <Pressable onPress={() => setShowBottomSheet(true)} testID="gauge-pill">
          <Animated.View style={[styles.gaugePill, { backgroundColor: gaugeColor, transform: [{ scale: gaugeScaleAnim }] }]}>
            <Text style={styles.gaugeText}>{currentIndex + 1}/{totalQuestions}</Text>
          </Animated.View>
        </Pressable>
      </View>

      {isRecycledBanner ? (
        <View style={styles.recycledBanner}>
          <Text style={styles.recycledText}>You've seen all questions this month! 🏆 Starting a new cycle.</Text>
          <Pressable onPress={() => setIsRecycledBanner(false)} hitSlop={8}>
            <Text style={styles.recycledClose}>✕</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Question card — uses ScrollView for long content */}
      <View style={styles.cardContainer}>
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
          <View style={styles.skipErrorWrap}>
            <Text style={styles.skipErrorEmoji}>⚠️</Text>
            <Text style={styles.skipErrorTitle}>Couldn't load this question</Text>
            <Pressable style={styles.ctaPrimary} onPress={() => {
              if (currentIndex + 1 < totalQuestions) {
                setIsAnswered(false);
                setSelectedAnswer(null);
                setCurrentIndex(currentIndex + 1);
                if (sessionId) advanceSession(sessionId, currentIndex + 1, totalQuestions).catch(() => {});
              }
            }}>
              <Text style={styles.ctaPrimaryText}>Skip to next</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Next button — shown after answering */}
      {isAnswered ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={handleNext} style={styles.nextBtn} testID="stream-next-btn">
            <Text style={styles.nextBtnText}>
              {currentIndex + 1 >= totalQuestions ? 'Fertig' : 'Weiter →'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Stats row */}
      <View style={styles.progressRow}>
        <View style={styles.statsRow}>
          <Text style={styles.statText}>🔥 {localStreak}</Text>
          <View style={styles.xpRow}>
            <Text style={styles.statText}>⭐ {formattedXp} XP</Text>
            <View style={[styles.badgePill, { backgroundColor: badgeTier.color }]}>
              <Text style={styles.badgePillText}>{badgeTier.label}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Toasts and overlays */}
      {comboToast ? (
        <Animated.View style={[styles.comboPill, { opacity: comboToastAnim, transform: [{ scale: comboToastAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}>
          <Text style={styles.comboPillText}>{comboToast}</Text>
        </Animated.View>
      ) : null}

      {xpBurstVisible ? (
        <Animated.View pointerEvents="none" style={[styles.xpBurst, { opacity: xpBurstOpacity, transform: [{ translateY: xpBurstTranslateY }, { scale: xpBurstScale }] }]}>
          <Text style={styles.xpBurstText}>+{xpBurstValue} XP</Text>
        </Animated.View>
      ) : null}

      {celebrationBadge ? (
        <CelebrationOverlay badgeType={celebrationBadge} level={targetLevel} onDismiss={() => setCelebrationBadge(null)} />
      ) : null}

      {streakToast ? (
        <Animated.View style={[styles.toast, { transform: [{ translateY: streakToastAnim }] }]}>
          <Text style={styles.toastText}>{streakToast}</Text>
        </Animated.View>
      ) : null}

      <PreparednessBottomSheet
        visible={showBottomSheet}
        onClose={() => setShowBottomSheet(false)}
        level={targetLevel}
        overallScore={localPreparedness}
        horenPct={horenPct}
        lesenPct={lesenPct}
        streak={localStreak}
        lastActiveDate={profile?.last_active_date ?? null}
      />

      <ReportModal
        visible={Boolean(reportQuestionId)}
        questionId={reportQuestionId ?? ''}
        userId={userId}
        onClose={() => setReportQuestionId(null)}
      />

      <PaywallModal
        visible={showPaywall}
        variant="stream_limit"
        onUpgrade={() => setShowPaywall(false)}
        onDismiss={() => setShowPaywall(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  statusBar: {
    height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, backgroundColor: Colors.primaryDeep,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  statusLabelText: { fontSize: 12, fontWeight: '600' as const, color: 'rgba(255,255,255,0.7)' },
  gaugePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },
  gaugeText: { color: '#fff', fontSize: 12, fontWeight: '700' as const },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: Colors.textMuted, fontSize: 15, fontWeight: '600' as const },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, textAlign: 'center' },
  emptyDesc: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
  emptyCtas: { gap: 10, width: '100%', marginTop: 16 },
  ctaPrimary: { backgroundColor: Colors.accent, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  ctaPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' as const },
  ctaSecondary: { backgroundColor: Colors.surfaceMuted, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  ctaSecondaryText: { color: Colors.text, fontSize: 15, fontWeight: '600' as const },
  recycledBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  recycledText: { flex: 1, color: '#E65100', fontSize: 13, fontWeight: '600' as const, lineHeight: 18 },
  recycledClose: { color: '#E65100', fontWeight: '700' as const, fontSize: 16 },
  cardContainer: { flex: 1, overflow: 'hidden' },
  skipErrorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  skipErrorEmoji: { fontSize: 40 },
  skipErrorTitle: { fontSize: 16, fontWeight: '600' as const, color: Colors.textMuted, textAlign: 'center' as const },
  footer: { paddingHorizontal: 24, paddingTop: 8, backgroundColor: Colors.background },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 16, backgroundColor: Colors.primary,
  },
  nextBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' as const, fontFamily: 'NunitoSans_700Bold' },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.background },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statText: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' as const },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badgePillText: { fontSize: 10, fontWeight: '800' as const, color: colors.text },
  comboPill: { position: 'absolute', top: 110, alignSelf: 'center', backgroundColor: colors.amber, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99, zIndex: 200 },
  comboPillText: { color: colors.navy, fontSize: 13, fontWeight: '800' as const },
  toast: { position: 'absolute', top: 0, left: 16, right: 16, backgroundColor: Colors.primaryDeep, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', zIndex: 300 },
  toastText: { color: '#fff', fontSize: 15, fontWeight: '700' as const },
  xpBurst: { position: 'absolute', top: '45%' as unknown as number, alignSelf: 'center', zIndex: 250 },
  xpBurstText: { color: colors.green, fontSize: 18, fontWeight: '800' as const },
});
