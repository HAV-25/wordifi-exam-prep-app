import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ChevronUp, Headphones, BookOpenText } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { PreparednessBottomSheet } from '@/components/PreparednessBottomSheet';
import { ReportModal } from '@/components/ReportModal';
import { StreamCard } from '@/components/StreamCard';
import Colors from '@/constants/colors';
import { colors } from '@/theme';
import { didCrossBadgeThreshold, formatXp, getBadgeTier } from '@/lib/badgeHelpers';
import {
  checkAndAwardBadges,
  createStreamSession,
  fetchSectionAccuracy,
  fetchStreamQuestions,
  updatePreparednessScore,
  updateXpAndStreak,
  writeStreamAnswer,
  type BadgeType,
} from '@/lib/streamHelpers';
import { useAuth } from '@/providers/AuthProvider';
import type { AppQuestion } from '@/types/database';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SWIPE_THRESHOLD = SCREEN_HEIGHT * 0.15;
const SWIPE_VELOCITY = 800;
const SWIPE_HINT_KEY = 'wordifi_total_answered';

type AnswerRecord = {
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
};

export default function TestStreamScreen() {
  const { profile, user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const userId = user?.id ?? '';
  const targetLevel = profile?.target_level ?? 'A1';

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answeredMap, setAnsweredMap] = useState<Record<string, string>>({});
  const [audioUnlockedMap, setAudioUnlockedMap] = useState<Record<string, boolean>>({});
  const [localPreparedness, setLocalPreparedness] = useState<number>(profile?.preparedness_score ?? 0);
  const [localXp, setLocalXp] = useState<number>(profile?.xp_total ?? 0);
  const [localStreak, setLocalStreak] = useState<number>(profile?.streak_count ?? 0);
  const [isRecycledBanner, setIsRecycledBanner] = useState<boolean>(false);
  const [celebrationBadge, setCelebrationBadge] = useState<BadgeType | null>(null);
  const [streakToast, setStreakToast] = useState<string | null>(null);
  const [showBottomSheet, setShowBottomSheet] = useState<boolean>(false);
  const [reportQuestionId, setReportQuestionId] = useState<string | null>(null);
  const [totalAnswered, setTotalAnswered] = useState<number>(0);
  const [showSwipeHint, setShowSwipeHint] = useState<boolean>(false);
  const [horenPct, setHorenPct] = useState<number>(50);
  const [lesenPct, setLesenPct] = useState<number>(50);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);

  const blockAnswersRef = useRef<AnswerRecord[]>([]);
  const blockStartTimeRef = useRef<number>(Date.now());
  const sessionIdRef = useRef<string>('');
  const answeredCountRef = useRef<number>(0);
  const hasUpdatedStreakRef = useRef<boolean>(false);
  const isAnimatingRef = useRef<boolean>(false);

  const translateY = useRef(new Animated.Value(0)).current;
  const streakToastAnim = useRef(new Animated.Value(-80)).current;
  const swipeHintPulse = useRef(new Animated.Value(1)).current;
  const gaugeScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (profile) {
      setLocalPreparedness(profile.preparedness_score ?? 0);
      setLocalXp(profile.xp_total ?? 0);
      setLocalStreak(profile.streak_count ?? 0);
    }
  }, [profile]);

  useEffect(() => {
    AsyncStorage.getItem(SWIPE_HINT_KEY).then((val) => {
      const count = val ? parseInt(val, 10) : 0;
      setTotalAnswered(isNaN(count) ? 0 : count);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (userId) {
      fetchSectionAccuracy(userId).then((acc) => {
        setHorenPct(Math.round(acc.horenAccuracy * 100));
        setLesenPct(Math.round(acc.lesenAccuracy * 100));
      }).catch(() => {});
    }
  }, [userId]);

  const questionsQuery = useQuery({
    queryKey: ['stream-questions', targetLevel, userId],
    enabled: Boolean(userId) && Boolean(targetLevel),
    queryFn: async (): Promise<AppQuestion[]> => {
      console.log('TestStream fetching questions for', targetLevel);
      const result = await fetchStreamQuestions({ userId, targetLevel, limit: 20 });
      if (result.isRecycled) {
        setIsRecycledBanner(true);
      }
      return result.questions;
    },
    staleTime: 0,
  });

  const questions = useMemo(() => questionsQuery.data ?? [], [questionsQuery.data]);
  const currentQuestion = previousIndex !== null ? questions[previousIndex] ?? null : questions[currentIndex] ?? null;
  const isReviewMode = previousIndex !== null;

  const ensureSession = useCallback(async () => {
    if (!sessionIdRef.current || sessionIdRef.current === 'placeholder-session') {
      const id = await createStreamSession({
        userId,
        level: targetLevel,
        questionsTotal: 0,
        questionsCorrect: 0,
        timeTakenSeconds: 0,
      });
      sessionIdRef.current = id;
      blockStartTimeRef.current = Date.now();
    }
  }, [userId, targetLevel]);

  const fetchMoreQuestions = useCallback(async () => {
    console.log('TestStream prefetching more questions');
    try {
      const result = await fetchStreamQuestions({ userId, targetLevel, limit: 20 });
      if (result.isRecycled) {
        setIsRecycledBanner(true);
      }
      queryClient.setQueryData<AppQuestion[]>(
        ['stream-questions', targetLevel, userId],
        (old) => [...(old ?? []), ...result.questions]
      );
    } catch (err) {
      console.log('TestStream prefetch error', err);
    }
  }, [userId, targetLevel, queryClient]);

  const writeBlockSession = useCallback(async () => {
    const answers = blockAnswersRef.current;
    if (answers.length === 0) return;
    const correct = answers.filter((a) => a.isCorrect).length;
    const timeTaken = Math.round((Date.now() - blockStartTimeRef.current) / 1000);
    try {
      await createStreamSession({
        userId,
        level: targetLevel,
        questionsTotal: answers.length,
        questionsCorrect: correct,
        timeTakenSeconds: timeTaken,
      });
    } catch (err) {
      console.log('TestStream writeBlockSession error', err);
    }
    blockAnswersRef.current = [];
    blockStartTimeRef.current = Date.now();
  }, [userId, targetLevel]);

  const showStreakToastBanner = useCallback(
    (message: string) => {
      setStreakToast(message);
      Animated.sequence([
        Animated.timing(streakToastAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.delay(2500),
        Animated.timing(streakToastAnim, { toValue: -80, duration: 300, useNativeDriver: true }),
      ]).start(() => setStreakToast(null));
    },
    [streakToastAnim]
  );

  const checkMilestones = useCallback(
    (streak: number, xp: number) => {
      if ([7, 30, 60, 100].includes(streak)) {
        showStreakToastBanner(`🔥 ${streak}-day streak!`);
      } else if (xp > 0 && xp % 100 === 0) {
        showStreakToastBanner(`⭐ ${xp} XP total`);
      }
    },
    [showStreakToastBanner]
  );

  const animateGaugePulse = useCallback(() => {
    Animated.sequence([
      Animated.timing(gaugeScaleAnim, { toValue: 1.12, duration: 200, useNativeDriver: true }),
      Animated.timing(gaugeScaleAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [gaugeScaleAnim]);

  const handleAnswer = useCallback(
    async (questionId: string, selectedKey: string, isCorrect: boolean) => {
      setAnsweredMap((prev) => ({ ...prev, [questionId]: selectedKey }));
      answeredCountRef.current += 1;

      const newTotal = totalAnswered + 1;
      setTotalAnswered(newTotal);
      AsyncStorage.setItem(SWIPE_HINT_KEY, String(newTotal)).catch(() => {});

      if (newTotal <= 10) {
        setShowSwipeHint(true);
      }

      if (Platform.OS !== 'web') {
        if (isCorrect) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        }
      }

      await ensureSession();

      writeStreamAnswer({
        userId,
        sessionId: sessionIdRef.current,
        questionId,
        selectedAnswer: selectedKey,
        isCorrect,
      }).catch((err) => console.log('TestStream writeAnswer error', err));

      updatePreparednessScore(userId, 1).then((newScore) => {
        setLocalPreparedness(newScore);
      }).catch((err) => console.log('TestStream updatePreparedness error', err));
      animateGaugePulse();

      if (isCorrect && profile) {
        const oldXp = localXp;
        const { newXp, newStreak } = await updateXpAndStreak(userId, {
          ...profile,
          xp_total: localXp,
          streak_count: localStreak,
          last_active_date: profile.last_active_date,
        });
        setLocalXp(newXp);

        const crossedBadge = didCrossBadgeThreshold(oldXp, newXp);
        if (crossedBadge) {
          showStreakToastBanner(`🏅 You reached ${crossedBadge.label}!`);
        }

        if (newStreak !== localStreak) {
          setLocalStreak(newStreak);
          if (!hasUpdatedStreakRef.current) {
            hasUpdatedStreakRef.current = true;
            checkMilestones(newStreak, newXp);
          }
        }
      }

      blockAnswersRef.current.push({ questionId, selectedAnswer: selectedKey, isCorrect });

      if (answeredCountRef.current % 5 === 0) {
        writeBlockSession().catch(() => {});
        const badge = await checkAndAwardBadges(userId, targetLevel, localXp);
        if (badge) setCelebrationBadge(badge);
        refreshProfile().catch(() => {});
      }

      const remaining = questions.length - (currentIndex + 1);
      if (remaining <= 5) {
        fetchMoreQuestions().catch(() => {});
      }
    },
    [
      userId, localXp, localStreak, profile, totalAnswered,
      ensureSession, writeBlockSession, targetLevel, questions.length,
      currentIndex, fetchMoreQuestions, refreshProfile, checkMilestones, animateGaugePulse,
      showStreakToastBanner,
    ]
  );

  const handleAudioPlayed = useCallback((questionId: string) => {
    setAudioUnlockedMap((prev) => ({ ...prev, [questionId]: true }));
  }, []);

  const advanceToNext = useCallback(() => {
    if (isAnimatingRef.current) return;
    if (currentIndex >= questions.length - 1) return;

    isAnimatingRef.current = true;
    setPreviousIndex(null);
    setShowSwipeHint(false);

    Animated.timing(translateY, {
      toValue: -SCREEN_HEIGHT,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex((prev) => prev + 1);
      translateY.setValue(0);
      isAnimatingRef.current = false;
    });
  }, [currentIndex, questions.length, translateY]);

  const goToPrevious = useCallback(() => {
    if (isAnimatingRef.current) return;
    if (currentIndex <= 0) return;

    isAnimatingRef.current = true;
    setPreviousIndex(currentIndex - 1);

    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      translateY.setValue(0);
      isAnimatingRef.current = false;
    });
  }, [currentIndex, translateY]);

  const returnFromReview = useCallback(() => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    Animated.timing(translateY, {
      toValue: -SCREEN_HEIGHT,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setPreviousIndex(null);
      translateY.setValue(0);
      isAnimatingRef.current = false;
    });
  }, [translateY]);

  const bounceCard = useCallback(() => {
    Animated.sequence([
      Animated.timing(translateY, { toValue: -16, duration: 80, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, friction: 6, useNativeDriver: true }),
    ]).start();
  }, [translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => {
          return Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5;
        },
        onPanResponderMove: (_, g) => {
          if (isAnimatingRef.current) return;
          translateY.setValue(g.dy * 0.6);
        },
        onPanResponderRelease: (_, g) => {
          if (isAnimatingRef.current) return;
          const activeQ = isReviewMode
            ? questions[previousIndex ?? 0]
            : questions[currentIndex];
          const questionAnswered = activeQ ? Boolean(answeredMap[activeQ.id]) : false;

          if (g.dy < -SWIPE_THRESHOLD || g.vy < -SWIPE_VELOCITY / 1000) {
            if (isReviewMode) {
              returnFromReview();
            } else if (questionAnswered) {
              advanceToNext();
            } else {
              bounceCard();
            }
          } else if (g.dy > SWIPE_THRESHOLD || g.vy > SWIPE_VELOCITY / 1000) {
            if (isReviewMode) {
              Animated.spring(translateY, { toValue: 0, friction: 8, useNativeDriver: true }).start();
            } else if (currentIndex > 0 && !isReviewMode) {
              goToPrevious();
            } else {
              Animated.spring(translateY, { toValue: 0, friction: 8, useNativeDriver: true }).start();
            }
          } else {
            Animated.spring(translateY, { toValue: 0, friction: 8, useNativeDriver: true }).start();
          }
        },
      }),
    [translateY, currentIndex, answeredMap, questions, isReviewMode, previousIndex, advanceToNext, goToPrevious, returnFromReview, bounceCard]
  );

  useEffect(() => {
    if (showSwipeHint && totalAnswered <= 10) {
      const timeout = setTimeout(() => {
        Animated.sequence([
          Animated.timing(swipeHintPulse, { toValue: 0.5, duration: 400, useNativeDriver: true }),
          Animated.timing(swipeHintPulse, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]).start();
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [showSwipeHint, totalAnswered, swipeHintPulse]);

  const isCurrentAnswered = currentQuestion ? Boolean(answeredMap[currentQuestion.id]) : false;

  const gaugeColor = useMemo(() => {
    if (localPreparedness < 40) return colors.red;
    if (localPreparedness < 70) return colors.amber;
    return colors.green;
  }, [localPreparedness]);

  const badgeTier = useMemo(() => getBadgeTier(localXp), [localXp]);
  const formattedXp = useMemo(() => formatXp(localXp), [localXp]);

  const handleReportPress = useCallback((qId: string) => {
    setReportQuestionId(qId);
  }, []);

  const isFirstLaunch = useMemo(() => {
    return Object.keys(answeredMap).length === 0 && totalAnswered === 0 && questions.length > 0;
  }, [answeredMap, totalAnswered, questions.length]);

  if (questionsQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading questions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.statusBar}>
          <View style={styles.statusLeft}>
            <Text style={styles.statusIcon}>📊</Text>
            <Text style={styles.statusLabelText}>No questions</Text>
          </View>
          <Animated.View style={[styles.gaugePill, { backgroundColor: gaugeColor, transform: [{ scale: gaugeScaleAnim }] }]}>
            <Text style={styles.gaugeText}>{targetLevel} · {Math.round(localPreparedness)}%</Text>
          </Animated.View>
        </View>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>🏆</Text>
          <Text style={styles.emptyTitle}>You've completed all available questions!</Text>
          <Text style={styles.emptyDesc}>Come back tomorrow or try a Sectional Test for deeper practice.</Text>
          <View style={styles.emptyCtas}>
            <Pressable
              style={styles.ctaPrimary}
              onPress={() => router.push('/tests' as never)}
              testID="empty-sectional-cta"
            >
              <Text style={styles.ctaPrimaryText}>Try Sectional Test</Text>
            </Pressable>
            <Pressable style={styles.ctaSecondary} testID="empty-tomorrow-cta">
              <Text style={styles.ctaSecondaryText}>Come back tomorrow</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          {currentQuestion ? (
            <>
              {currentQuestion.section === 'Hören' ? (
                <Headphones color="rgba(255,255,255,0.8)" size={14} />
              ) : (
                <BookOpenText color="rgba(255,255,255,0.8)" size={14} />
              )}
              <Text style={styles.statusLabelText}>
                {currentQuestion.section} · Teil {currentQuestion.teil}
              </Text>
            </>
          ) : null}
        </View>
        <Pressable onPress={() => setShowBottomSheet(true)} testID="gauge-pill">
          <Animated.View style={[styles.gaugePill, { backgroundColor: gaugeColor, transform: [{ scale: gaugeScaleAnim }] }]}>
            <Text style={styles.gaugeText}>{targetLevel} · {Math.round(localPreparedness)}%</Text>
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

      {isFirstLaunch && currentQuestion ? (
        <View style={styles.welcomeBanner}>
          <Text style={styles.welcomeText}>
            Your first {targetLevel} question. Swipe up when you're ready.
          </Text>
        </View>
      ) : null}

      {isReviewMode ? (
        <View style={styles.reviewBanner}>
          <Text style={styles.reviewText}>← Review · Read only</Text>
        </View>
      ) : null}

      <View style={styles.cardContainer} {...panResponder.panHandlers}>
        {currentQuestion ? (
          <Animated.View style={[styles.animatedCard, { transform: [{ translateY }] }]}>
            <StreamCard
              question={currentQuestion}
              onAnswer={handleAnswer}
              isAnswered={Boolean(answeredMap[currentQuestion.id])}
              selectedAnswer={answeredMap[currentQuestion.id] ?? null}
              audioUnlocked={audioUnlockedMap[currentQuestion.id] ?? false}
              onAudioPlayed={() => handleAudioPlayed(currentQuestion.id)}
              onReportPress={handleReportPress}
              reviewMode={isReviewMode}
            />
          </Animated.View>
        ) : null}
      </View>

      {isCurrentAnswered && !isReviewMode && totalAnswered <= 10 ? (
        <Animated.View style={[styles.swipeHint, { opacity: swipeHintPulse }]}>
          <ChevronUp color={Colors.textMuted} size={18} />
          <Text style={styles.swipeHintText}>Swipe up</Text>
        </Animated.View>
      ) : null}

      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          {currentIndex + 1} / {questions.length}
        </Text>
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

      {celebrationBadge ? (
        <CelebrationOverlay
          badgeType={celebrationBadge}
          level={targetLevel}
          onDismiss={() => setCelebrationBadge(null)}
        />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  statusBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: Colors.primaryDeep,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusIcon: {
    fontSize: 14,
  },
  statusLabelText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.7)',
  },
  gaugePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
  },
  gaugeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700' as const,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyCtas: {
    gap: 10,
    width: '100%',
    marginTop: 16,
  },
  ctaPrimary: {
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  ctaPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  ctaSecondary: {
    backgroundColor: Colors.surfaceMuted,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  ctaSecondaryText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  recycledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  recycledText: {
    flex: 1,
    color: '#E65100',
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 18,
  },
  recycledClose: {
    color: '#E65100',
    fontWeight: '700' as const,
    fontSize: 16,
  },
  welcomeBanner: {
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  welcomeText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  reviewBanner: {
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  reviewText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  cardContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  animatedCard: {
    flex: 1,
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  swipeHintText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.background,
  },
  progressText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: colors.text,
  },
  toast: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    backgroundColor: Colors.primaryDeep,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    zIndex: 300,
  },
  toastText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700' as const,
  },
});
