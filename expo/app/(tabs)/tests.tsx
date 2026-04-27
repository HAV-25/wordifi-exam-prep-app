import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  Headphones,
  Lock,
  Mic,
  PenLine,
  Play,
  Puzzle,
  Sparkles,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { PaywallBottomSheet, type PaywallTriggerContext } from '@/components/PaywallBottomSheet';
import { PaywallModal } from '@/components/PaywallModal';
import Colors from '@/constants/colors';
import { fetchSchreibenQuestions, fetchSchreibenTeile } from '@/lib/schreibenHelpers';
import {
  fetchSprechenTeile,
} from '@/lib/sprechenHelpers';
import {
  checkFreeHorenLesenAccess,
  checkRetestAvailability,
  checkTrialTeilAccess,
  fetchAvailableTeile,
  fetchPreviousSessionResult,
  fetchSectionalQuestions,
  fetchSprachbausteineQuestions,
  fetchTeileHistory,
  hasCompletedAnyMockTest,
  type PreviousSessionResult,
  type RetestInfo,
  type TeilHistory,
  type TeilInfo,
} from '@/lib/sectionalHelpers';
import { useAccess } from '@/providers/AccessProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useQuestionTypeMetaContext } from '@/lib/useQuestionTypeMeta';
import type { SprechenTeilInfo } from '@/lib/sprechenHelpers';

type SetupState = {
  visible: boolean;
  teilInfo: TeilInfo | null;
  isTimed: boolean;
  retestInfo: RetestInfo | null;
  isLoadingRetest: boolean;
  isStarting: boolean;
  isLoadingReview: boolean;
};

type SectionKey = 'Hören' | 'Lesen' | 'Sprachbausteine' | 'Schreiben' | 'Sprechen';

type SectionPalette = {
  fg: string;
  bg: string;
  iconColor: string;
};

// Wordifi v2 (Banani) section palette. Lesen uses success green by design;
// completion check badge intentionally shares the same green.
const SECTION_COLORS: Record<SectionKey, SectionPalette> = {
  'Hören':           { fg: '#2B70EF', bg: 'rgba(43, 112, 239, 0.12)', iconColor: '#2B70EF' },
  'Lesen':           { fg: '#22C55E', bg: 'rgba(34, 197, 94, 0.12)',  iconColor: '#22C55E' },
  'Sprachbausteine': { fg: '#A37A00', bg: 'rgba(240, 200, 8, 0.18)',  iconColor: '#374151' },
  'Schreiben':       { fg: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)', iconColor: '#8B5CF6' },
  'Sprechen':        { fg: '#F97316', bg: 'rgba(249, 115, 22, 0.12)', iconColor: '#F97316' },
};

const SUCCESS_GREEN = '#22C55E';

function formatRetestDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysAgoLabel(iso: string): string {
  const completed = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfCompleted = new Date(
    completed.getFullYear(),
    completed.getMonth(),
    completed.getDate()
  ).getTime();
  const diffDays = Math.round((startOfToday - startOfCompleted) / 86400000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  return `${diffDays} days ago`;
}

function deduplicateTeile(teile: TeilInfo[]): TeilInfo[] {
  const seen = new Set<number>();
  return teile.filter((t) => {
    if (seen.has(t.teil)) return false;
    seen.add(t.teil);
    return true;
  });
}

function sectionIcon(section: SectionKey, color: string): React.ReactNode {
  const size = 22;
  switch (section) {
    case 'Hören':           return <Headphones color={color} size={size} />;
    case 'Lesen':           return <BookOpen color={color} size={size} />;
    case 'Sprachbausteine': return <Puzzle color={color} size={size} />;
    case 'Schreiben':       return <PenLine color={color} size={size} />;
    case 'Sprechen':        return <Mic color={color} size={size} />;
  }
}

const PAID_TIERS = ['paid_early', 'monthly', 'quarterly', 'winback_monthly', 'winback_quarterly'];

export default function TestsScreen() {
  const { profile, user } = useAuth();
  const { access } = useAccess();
  const { metaMap } = useQuestionTypeMetaContext();
  const queryClient = useQueryClient();
  const userId = user?.id ?? '';
  const targetLevel = profile?.target_level ?? 'A1';
  const [showPaywall, setShowPaywall] = useState<boolean>(false);
  const [showPaywallSheet, setShowPaywallSheet] = useState<boolean>(false);
  const [paywallSheetTrigger, setPaywallSheetTrigger] = useState<PaywallTriggerContext>('schreiben_locked');
  const sectionalEnabled = access.sectional_tests_enabled;

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ['question-type-meta'] });
      void queryClient.invalidateQueries({ queryKey: ['sectional-teile', targetLevel] });
      void queryClient.invalidateQueries({ queryKey: ['sectional-history', userId, targetLevel] });
      void queryClient.invalidateQueries({ queryKey: ['mock-completed', userId] });
    }, [queryClient, targetLevel, userId])
  );

  const [setup, setSetup] = useState<SetupState>({
    visible: false,
    teilInfo: null,
    isTimed: false,
    retestInfo: null,
    isLoadingRetest: false,
    isStarting: false,
    isLoadingReview: false,
  });

  // Sections collapsed by default per Banani v2.
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [schreibenStarting, setSchreibenStarting] = useState<number | null>(null);
  const [sprechenStarting, setSprechenStarting] = useState<number | null>(null);

  const teileQuery = useQuery({
    queryKey: ['sectional-teile', targetLevel],
    enabled: Boolean(targetLevel),
    queryFn: () => fetchAvailableTeile(targetLevel),
  });
  const teile = useMemo(() => teileQuery.data ?? [], [teileQuery.data]);

  const horenTeile          = useMemo(() => deduplicateTeile(teile.filter((t) => t.section === 'Hören')), [teile]);
  const lesenTeile          = useMemo(() => deduplicateTeile(teile.filter((t) => t.section === 'Lesen')), [teile]);
  const sprachbausteineTeile = useMemo(() => deduplicateTeile(teile.filter((t) => t.section === 'Sprachbausteine')), [teile]);

  const schreibenQuery = useQuery({
    queryKey: ['schreiben-teile', targetLevel],
    enabled: Boolean(targetLevel),
    queryFn: () => fetchSchreibenTeile(targetLevel),
  });
  const schreibenTeile = useMemo(() => schreibenQuery.data ?? [], [schreibenQuery.data]);
  const schreibenEnabled = access.schreiben_enabled;
  const schreibenVisible = access.schreiben_visible;

  const sprechenQuery = useQuery({
    queryKey: ['sprechen-teile', targetLevel],
    enabled: Boolean(targetLevel),
    queryFn: () => fetchSprechenTeile(targetLevel),
  });
  const sprechenTeile = useMemo(() => sprechenQuery.data ?? [], [sprechenQuery.data]);
  const sprechenEnabled = access.sprechen_enabled;
  const sprechenVisible = access.sprechen_visible;

  const historyQuery = useQuery({
    queryKey: ['sectional-history', userId, targetLevel],
    enabled: Boolean(userId && targetLevel),
    queryFn: () => fetchTeileHistory(userId, targetLevel),
  });

  const historyMap = useMemo(() => {
    const map = new Map<string, TeilHistory>();
    for (const h of historyQuery.data ?? []) {
      map.set(`${h.section}__${h.teil}`, h);
    }
    return map;
  }, [historyQuery.data]);

  const isPaidUser = PAID_TIERS.includes(profile?.subscription_tier ?? '');

  const mockCompletedQuery = useQuery({
    queryKey: ['mock-completed', userId],
    enabled: Boolean(userId) && isPaidUser,
    queryFn: () => hasCompletedAnyMockTest(userId),
  });

  const handleStartSprechen = useCallback(async (teil: number) => {
    if (!sprechenEnabled) {
      // Trigger #7 — bottom sheet first
      setPaywallSheetTrigger('sprechen_locked');
      setShowPaywallSheet(true);
      return;
    }
    // Trial: each Sprechen teil once
    if (access.tier === 'free_trial') {
      const { canAccess } = await checkTrialTeilAccess(userId, targetLevel, 'Sprechen', teil);
      if (!canAccess) {
        setPaywallSheetTrigger('sectional_trial_limit');
        setShowPaywallSheet(true);
        return;
      }
    }
    setSprechenStarting(teil);
    router.push({ pathname: '/sprechen-realtime', params: { level: targetLevel, teil: String(teil) } });
  }, [targetLevel, sprechenEnabled, access.tier, userId]);

  const handleStartSchreiben = useCallback(async (teil: number) => {
    if (!schreibenEnabled) {
      // Trigger #6 — bottom sheet first
      setPaywallSheetTrigger('schreiben_locked');
      setShowPaywallSheet(true);
      return;
    }
    // Trial: each Schreiben teil once
    if (access.tier === 'free_trial') {
      const { canAccess } = await checkTrialTeilAccess(userId, targetLevel, 'Schreiben', teil);
      if (!canAccess) {
        setPaywallSheetTrigger('sectional_trial_limit');
        setShowPaywallSheet(true);
        return;
      }
    }
    setSchreibenStarting(teil);
    try {
      const questions = await fetchSchreibenQuestions(targetLevel, teil);
      if (questions.length === 0) {
        setSchreibenStarting(null);
        Alert.alert('No Questions', 'No Schreiben questions available for this level and Teil yet.');
        return;
      }
      setSchreibenStarting(null);
      router.push({
        pathname: '/schreiben-test',
        params: { level: targetLevel, teil: String(teil), questions: JSON.stringify(questions) },
      });
    } catch (err) {
      console.log('TestsScreen handleStartSchreiben error', err);
      setSchreibenStarting(null);
      Alert.alert('Error', 'Could not load Schreiben questions. Please try again.');
    }
  }, [targetLevel, schreibenEnabled]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const openSetup = useCallback(
    async (teilInfo: TeilInfo) => {
      const isHorenLesen = teilInfo.section === 'Hören' || teilInfo.section === 'Lesen';

      if (access.tier === 'free' && isHorenLesen) {
        // Free tier: 1 Hören teil + 1 Lesen teil lifetime. Check before opening setup.
        const { canAccess } = await checkFreeHorenLesenAccess(
          userId, targetLevel, teilInfo.section as 'Hören' | 'Lesen',
        );
        if (!canAccess) {
          setPaywallSheetTrigger('sectional_free_limit');
          setShowPaywallSheet(true);
          return;
        }
        // canAccess → fall through to setup modal
      } else if (!sectionalEnabled) {
        // Free tier on non-Hören/Lesen sections, or any other unlicensed case → hard paywall
        setShowPaywall(true);
        return;
      } else if (access.tier === 'free_trial') {
        // Trial: each (section × teil) once
        const { canAccess } = await checkTrialTeilAccess(
          userId, targetLevel, teilInfo.section, teilInfo.teil,
        );
        if (!canAccess) {
          setPaywallSheetTrigger('sectional_trial_limit');
          setShowPaywallSheet(true);
          return;
        }
      }

      setSetup({
        visible: true,
        teilInfo,
        isTimed: false,
        retestInfo: null,
        isLoadingRetest: true,
        isStarting: false,
        isLoadingReview: false,
      });
      try {
        const info = await checkRetestAvailability(userId, targetLevel, teilInfo.section, teilInfo.teil);
        setSetup((prev) => ({ ...prev, retestInfo: info, isLoadingRetest: false }));
      } catch {
        setSetup((prev) => ({ ...prev, isLoadingRetest: false }));
      }
    },
    [userId, targetLevel, sectionalEnabled, access.tier]
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
      if (setup.teilInfo.section === 'Sprachbausteine') {
        const { t1, t2 } = await fetchSprachbausteineQuestions(targetLevel);
        const teil = setup.teilInfo.teil;
        const question = teil === 1 ? t1 : t2;
        if (!question) {
          setSetup((prev) => ({ ...prev, isStarting: false, visible: false }));
          return;
        }
        setSetup((prev) => ({ ...prev, visible: false, isStarting: false }));
        router.push({
          pathname: '/sprachbausteine-test',
          params: {
            t1Question: teil === 1 ? JSON.stringify(question) : 'null',
            t2Question: teil === 2 ? JSON.stringify(question) : 'null',
            level: targetLevel,
            examType: profile?.exam_type ?? 'TELC',
            startPhase: teil === 1 ? 't1' : 't2',
          },
        });
        return;
      }

      const questions = await fetchSectionalQuestions(targetLevel, setup.teilInfo.section, setup.teilInfo.teil);
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

  const handleReviewPrevious = useCallback(async () => {
    if (!setup.teilInfo || setup.isLoadingReview) return;
    setSetup((prev) => ({ ...prev, isLoadingReview: true }));
    try {
      const result: PreviousSessionResult | null = await fetchPreviousSessionResult(
        userId, targetLevel, setup.teilInfo.section, setup.teilInfo.teil
      );
      if (!result) {
        setSetup((prev) => ({ ...prev, isLoadingReview: false }));
        return;
      }
      setSetup((prev) => ({ ...prev, visible: false, isLoadingReview: false }));
      router.push({
        pathname: '/sectional-results',
        params: {
          sessionId: result.sessionId,
          scorePct: String(result.scorePct),
          correctCount: String(result.correctCount),
          total: String(result.total),
          level: targetLevel,
          section: setup.teilInfo!.section,
          teil: String(setup.teilInfo!.teil),
          isTimed: result.isTimed ? '1' : '0',
          timeTaken: String(result.timeTaken),
          questions: JSON.stringify(result.questions),
          answers: JSON.stringify(result.answers),
        },
      });
    } catch (err) {
      console.log('TestsScreen handleReviewPrevious error', err);
      setSetup((prev) => ({ ...prev, isLoadingReview: false }));
    }
  }, [setup.teilInfo, setup.isLoadingReview, userId, targetLevel]);

  const isLocked = isPaidUser ? false : (setup.retestInfo?.is_locked ?? false);
  const setupMeta = setup.teilInfo ? metaMap[setup.teilInfo.structure_type] : null;

  // ─── Nudge selection ────────────────────────────────────────────
  const nudge = useMemo<{
    title: string;
    subtitle: string;
    onPress: () => void;
  } | null>(() => {
    if (!isPaidUser) {
      const hours = access.trial_hours_remaining;
      return {
        title: 'Unlock all sections & levels',
        subtitle: hours && hours > 0 ? `${hours} hours left on your trial` : 'Upgrade to Pro',
        onPress: () => setShowPaywall(true),
      };
    }
    if (mockCompletedQuery.data === false) {
      return {
        title: 'Try your first Mock Test',
        subtitle: 'See where you really stand',
        onPress: () => router.push('/(tabs)/mock'),
      };
    }
    const totalSectional =
      horenTeile.length + lesenTeile.length +
      (targetLevel === 'B1' ? sprachbausteineTeile.length : 0);
    const completedCount = (historyQuery.data ?? []).filter(
      (h) => h.section === 'Hören' || h.section === 'Lesen' || h.section === 'Sprachbausteine'
    ).length;
    const remaining = Math.max(0, totalSectional - completedCount);
    if (remaining > 0) {
      return {
        title: 'Complete more sectional Teile',
        subtitle: `${remaining} Teil${remaining === 1 ? '' : 'e'} left to try at ${targetLevel}`,
        onPress: () => {},
      };
    }
    return {
      title: 'Check the Leaderboard',
      subtitle: 'See where you rank this week',
      onPress: () => router.push('/leaderboard'),
    };
  }, [
    isPaidUser, access.trial_hours_remaining, mockCompletedQuery.data,
    horenTeile.length, lesenTeile.length, sprachbausteineTeile.length,
    targetLevel, historyQuery.data,
  ]);

  // ─── Renderers ──────────────────────────────────────────────────

  const renderTeilCard = useCallback(
    (
      info: TeilInfo,
      sectionKey: SectionKey,
      opts: { locked?: boolean; lockedLabel?: string; onPress: () => void; isStartingExternal?: boolean; estimatedMinOverride?: number; keyPrefix?: string }
    ) => {
      const m = metaMap[info.structure_type];
      const fallbackName = info.structure_type
        ? info.structure_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : `Teil ${info.teil}`;
      const nameEn = m?.name_en ?? fallbackName;
      const nameDe = m?.name_de ?? '';
      const palette = SECTION_COLORS[sectionKey];
      const history = historyMap.get(`${sectionKey}__${info.teil}`);
      const estimatedMin = opts.estimatedMinOverride ?? info.estimated_minutes;

      return (
        <Pressable
          key={`${opts.keyPrefix ?? sectionKey}-${info.teil}-${info.structure_type}`}
          accessibilityLabel={`${sectionKey} Teil ${info.teil}`}
          onPress={opts.onPress}
          style={[styles.teilCard, opts.locked && styles.teilCardLocked]}
          testID={`teil-card-${sectionKey}-${info.teil}`}
        >
          <View style={styles.teilLeft}>
            <Text style={styles.teilLabel}>TEIL</Text>
            <View style={styles.teilCircleWrap}>
              <View style={[styles.teilCircle, { backgroundColor: palette.bg }]}>
                <Text style={[styles.teilCircleText, { color: palette.fg }]}>{info.teil}</Text>
              </View>
              {history ? (
                <View style={styles.teilCheckBadge}>
                  <Check color="#fff" size={10} strokeWidth={3} />
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.teilCenter}>
            <Text style={styles.teilName} numberOfLines={2}>{nameEn}</Text>
            {nameDe ? <Text style={styles.teilGerman} numberOfLines={2}>{nameDe}</Text> : null}
            {history ? (
              <Text style={styles.teilLastAttempt}>
                Last: {Math.round(history.lastScorePct)}% · {daysAgoLabel(history.lastCompletedAt)}
              </Text>
            ) : null}
          </View>

          <View style={styles.teilRight}>
            {opts.locked ? (
              <View style={styles.teilLockedRow}>
                <Lock color={Colors.textMuted} size={13} />
                <Text style={styles.teilLockedText}>{opts.lockedLabel ?? 'Upgrade to unlock'}</Text>
              </View>
            ) : (
              <View style={styles.teilTimeRow}>
                <Clock color={Colors.textMuted} size={13} />
                <Text style={styles.teilTimeText}>~{estimatedMin} min</Text>
              </View>
            )}
            {opts.isStartingExternal ? (
              <ActivityIndicator color={palette.fg} size="small" />
            ) : (
              <ChevronRight color={Colors.textMuted} size={18} />
            )}
          </View>
        </Pressable>
      );
    },
    [metaMap, historyMap]
  );

  const renderSectionGroup = useCallback(
    (params: {
      section: SectionKey;
      total: number;
      children: React.ReactNode;
      emptyMessage?: string | null;
    }) => {
      const palette = SECTION_COLORS[params.section];
      const isExpanded = !!expandedSections[params.section];
      const completedCount = Array.from(historyMap.values()).filter(
        (h) => h.section === params.section
      ).length;
      const completed = Math.min(completedCount, params.total);

      return (
        <View style={styles.sectionGroup} key={params.section}>
          <Pressable
            accessibilityLabel={`Toggle ${params.section}`}
            onPress={() => toggleSection(params.section)}
            style={styles.sectionHeaderCard}
            testID={`toggle-${params.section}`}
          >
            <View style={[styles.shIconWrap, { backgroundColor: palette.bg }]}>
              {sectionIcon(params.section, palette.iconColor)}
            </View>
            <View style={styles.shContent}>
              <Text style={[styles.shTitle, { color: palette.fg }]}>{params.section}</Text>
              <Text style={styles.shProgressText}>
                {completed} of {params.total} Teile attempted
              </Text>
            </View>
            <View style={styles.shRight}>
              <Text style={[styles.shProgressPill, { color: palette.fg }]}>
                {completed}/{params.total}
              </Text>
              <View style={[styles.shChevron, isExpanded && styles.shChevronOpen]}>
                <ChevronDown color={Colors.textMuted} size={18} />
              </View>
            </View>
          </Pressable>

          {isExpanded ? (
            <View style={styles.teilList}>
              {params.total === 0 && params.emptyMessage ? (
                <Text style={styles.noContent}>{params.emptyMessage}</Text>
              ) : params.children}
            </View>
          ) : null}
        </View>
      );
    },
    [expandedSections, toggleSection, historyMap]
  );

  // ─── Render ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Brand header */}
      <AppHeader
        rightElement={
          <View style={styles.levelPill}>
            <Text style={styles.levelPillText}>{targetLevel}</Text>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Nudge */}
        {nudge ? (
          <Pressable
            accessibilityLabel={nudge.title}
            onPress={nudge.onPress}
            style={styles.nudgeCard}
            testID="nudge-card"
          >
            <Sparkles color={Colors.warning} size={22} />
            <View style={styles.nudgeContent}>
              <Text style={styles.nudgeTitle} numberOfLines={1}>{nudge.title}</Text>
              <Text style={styles.nudgeSubtitle} numberOfLines={1}>{nudge.subtitle}</Text>
            </View>
            <ArrowRight color={Colors.textMuted} size={18} />
          </Pressable>
        ) : null}

        {/* Body */}
        {teileQuery.isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.loadingText}>Loading available tests...</Text>
          </View>
        ) : teile.length === 0 && schreibenTeile.length === 0 && sprechenTeile.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              title="No tests available yet"
              description={`We're adding ${targetLevel} content soon. Check back later!`}
              testID="tests-empty-state"
            />
          </View>
        ) : (
          <View style={styles.sectionsContainer}>
            {renderSectionGroup({
              section: 'Hören',
              total: horenTeile.length,
              emptyMessage: `No Hören content available for ${targetLevel} yet.`,
              children: horenTeile.map((info) =>
                renderTeilCard(info, 'Hören', { onPress: () => openSetup(info) })
              ),
            })}

            {renderSectionGroup({
              section: 'Lesen',
              total: lesenTeile.length,
              emptyMessage: `No Lesen content available for ${targetLevel} yet.`,
              children: lesenTeile.map((info) =>
                renderTeilCard(info, 'Lesen', { onPress: () => openSetup(info) })
              ),
            })}

            {targetLevel === 'B1' && sprachbausteineTeile.length > 0
              ? renderSectionGroup({
                  section: 'Sprachbausteine',
                  total: sprachbausteineTeile.length,
                  children: sprachbausteineTeile.map((info) =>
                    renderTeilCard(info, 'Sprachbausteine', { onPress: () => openSetup(info) })
                  ),
                })
              : null}

            {schreibenVisible
              ? renderSectionGroup({
                  section: 'Schreiben',
                  total: schreibenTeile.length,
                  emptyMessage: `No Schreiben content available for ${targetLevel} yet.`,
                  children: schreibenTeile.map((info) => {
                    const estimatedMin = Math.max(1, info.q_count * 5);
                    const wrappedInfo: TeilInfo = {
                      section: 'Schreiben',
                      teil: info.teil,
                      question_type: info.source_structure_type,
                      structure_type: info.source_structure_type,
                      q_count: info.q_count,
                      estimated_minutes: estimatedMin,
                    };
                    return renderTeilCard(wrappedInfo, 'Schreiben', {
                      locked: !schreibenEnabled,
                      lockedLabel: 'Upgrade to unlock',
                      isStartingExternal: schreibenStarting === info.teil,
                      estimatedMinOverride: estimatedMin,
                      keyPrefix: 'schreiben',
                      onPress: () => handleStartSchreiben(info.teil),
                    });
                  }),
                })
              : null}

            {sprechenVisible
              ? renderSectionGroup({
                  section: 'Sprechen',
                  total: sprechenTeile.length,
                  emptyMessage: `No Sprechen content available for ${targetLevel} yet.`,
                  children: sprechenTeile.map((info: SprechenTeilInfo) => {
                    const estimatedMin = Math.max(1, Math.ceil((info.q_count * 60) / 60));
                    const wrappedInfo: TeilInfo = {
                      section: 'Sprechen',
                      teil: info.teil,
                      question_type: info.source_structure_type,
                      structure_type: info.source_structure_type,
                      q_count: info.q_count,
                      estimated_minutes: estimatedMin,
                    };
                    return renderTeilCard(wrappedInfo, 'Sprechen', {
                      locked: !sprechenEnabled,
                      lockedLabel: 'Upgrade to unlock',
                      isStartingExternal: sprechenStarting === info.teil,
                      estimatedMinOverride: estimatedMin,
                      keyPrefix: 'sprechen',
                      onPress: () => handleStartSprechen(info.teil),
                    });
                  }),
                })
              : null}
          </View>
        )}
      </ScrollView>

      {/* Setup Modal — unchanged from v1 */}
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
                    { backgroundColor: SECTION_COLORS[setup.teilInfo.section as SectionKey]?.bg ?? Colors.surfaceMuted },
                  ]}>
                    {sectionIcon(
                      setup.teilInfo.section as SectionKey,
                      SECTION_COLORS[setup.teilInfo.section as SectionKey]?.iconColor ?? Colors.primary
                    )}
                  </View>
                  <View style={styles.modalHeaderText}>
                    <View style={styles.modalTitleRow}>
                      <Text style={[
                        styles.modalTitle,
                        { color: SECTION_COLORS[setup.teilInfo.section as SectionKey]?.fg ?? Colors.text },
                      ]}>{setup.teilInfo.section}</Text>
                      <View style={styles.modalLevelPill}>
                        <Text style={styles.modalLevelPillText}>{targetLevel}</Text>
                      </View>
                    </View>
                    <Text style={styles.modalTeilLine}>Teil {setup.teilInfo.teil}</Text>
                    <View style={styles.modalBilingualRow}>
                      <Text style={styles.modalBilingualEn}>{setupMeta?.name_en ?? ''}</Text>
                      {setupMeta?.name_de ? (
                        <>
                          <Text style={styles.modalBilingualSep}> / </Text>
                          <Text style={styles.modalBilingualDe}>{setupMeta.name_de}</Text>
                        </>
                      ) : null}
                    </View>
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

                  {isLocked ? (
                    <Pressable
                      accessibilityLabel="Review previous answers"
                      disabled={setup.isLoadingReview}
                      onPress={handleReviewPrevious}
                      style={styles.reviewButton}
                      testID="review-previous-button"
                    >
                      {setup.isLoadingReview ? (
                        <ActivityIndicator color={Colors.accent} />
                      ) : (
                        <>
                          <Eye color={Colors.accent} size={16} />
                          <Text style={styles.reviewButtonText}>Review Previous Answers</Text>
                        </>
                      )}
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityLabel="Cancel"
                    onPress={closeSetup}
                    style={styles.cancelButton}
                    testID="cancel-setup-button"
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
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
      <PaywallBottomSheet
        visible={showPaywallSheet}
        triggerContext={paywallSheetTrigger}
        onUnlock={() => { setShowPaywallSheet(false); setShowPaywall(true); }}
        onDismiss={() => setShowPaywallSheet(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 40 },

  // ─── Header
  pageHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerTitles: { flex: 1, gap: 6 },
  pageTitle: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -0.9,
    lineHeight: 33,
  },
  pageSubtitle: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  levelPill: {
    minWidth: 58,
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(43, 112, 239, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelPillText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '700' as const,
  },

  // ─── Nudge
  nudgeCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#0F1F3D',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 1,
  },
  nudgeContent: { flex: 1, gap: 1 },
  nudgeTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  nudgeSubtitle: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: Colors.textMuted,
  },

  // ─── Sections
  sectionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 18,
  },
  sectionGroup: { gap: 12 },
  sectionHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    shadowColor: '#0F1F3D',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 1,
  },
  shIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shContent: { flex: 1, gap: 4 },
  shTitle: { fontSize: 18, fontWeight: '800' as const, lineHeight: 21 },
  shProgressText: { fontSize: 13, fontWeight: '600' as const, color: Colors.textMuted },
  shRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shProgressPill: { fontSize: 14, fontWeight: '700' as const },
  shChevron: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  shChevronOpen: { transform: [{ rotate: '180deg' }] },
  teilList: { gap: 12 },
  noContent: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '500' as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },

  // ─── Teil card
  teilCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor: '#0F1F3D',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  teilCardLocked: { opacity: 0.6 },
  teilLeft: {
    width: 52,
    alignItems: 'center',
    gap: 6,
  },
  teilLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 0.4,
  },
  teilCircleWrap: { position: 'relative', width: 40, height: 40 },
  teilCircle: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teilCircleText: { fontSize: 18, fontWeight: '800' as const },
  teilCheckBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: SUCCESS_GREEN,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teilCenter: { flex: 1, gap: 3, justifyContent: 'center' },
  teilName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 18,
  },
  teilGerman: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: Colors.textMuted,
    fontStyle: 'italic' as const,
    lineHeight: 16,
  },
  teilLastAttempt: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  teilRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },
  teilTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  teilTimeText: { fontSize: 13, fontWeight: '400' as const, color: Colors.textMuted },
  teilLockedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teilLockedText: { fontSize: 12, fontWeight: '400' as const, color: Colors.textMuted },

  // ─── Loading / empty
  loadingWrap: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  loadingText: { color: Colors.textMuted, fontSize: 15, fontWeight: '600' as const },
  emptyWrap: { padding: 20 },

  // ─── Modal sheet (preserved)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 20,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40, height: 5, borderRadius: 3, backgroundColor: Colors.border, alignSelf: 'center',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  modalSectionIcon: {
    width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  modalHeaderText: { flex: 1, gap: 2 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { fontSize: 18, fontWeight: '800' as const },
  modalLevelPill: {
    backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
  },
  modalLevelPillText: { color: '#fff', fontSize: 11, fontWeight: '600' as const },
  modalTeilLine: { fontSize: 14, fontWeight: '600' as const, color: Colors.textBody, marginTop: 2 },
  modalBilingualRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', marginTop: 2 },
  modalBilingualEn: { fontSize: 13, fontWeight: '600' as const, color: Colors.text },
  modalBilingualSep: { fontSize: 13, fontWeight: '400' as const, color: Colors.textMuted },
  modalBilingualDe: { fontSize: 13, fontWeight: '400' as const, color: Colors.textMuted, fontStyle: 'italic' as const },
  modalStats: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceMuted, borderRadius: 18, padding: 16,
  },
  modalStat: { flex: 1, alignItems: 'center', gap: 4 },
  modalStatValue: { fontSize: 24, fontWeight: '800' as const, color: Colors.primary },
  modalStatLabel: { fontSize: 13, fontWeight: '600' as const, color: Colors.textMuted },
  modalStatDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  timedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surfaceMuted, borderRadius: 16, padding: 14,
  },
  timedInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timedLabel: { fontSize: 15, fontWeight: '700' as const, color: Colors.primary },
  timedSub: { fontSize: 12, fontWeight: '500' as const, color: Colors.textMuted },
  toggleTrack: {
    width: 48, height: 28, borderRadius: 14,
    backgroundColor: Colors.border, justifyContent: 'center', paddingHorizontal: 3,
  },
  toggleTrackOn: { backgroundColor: Colors.accent },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  retestLoader: { paddingVertical: 8 },
  lockedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF8E1', borderRadius: 14, padding: 14,
  },
  lockedText: { color: '#F57F17', fontSize: 14, fontWeight: '700' as const },
  modalActions: { gap: 10 },
  startButton: {
    minHeight: 54, borderRadius: 27, backgroundColor: Colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  startButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' as const },
  buttonDisabled: { opacity: 0.4 },
  reviewButton: {
    minHeight: 48, borderRadius: 24, backgroundColor: Colors.accentSoft,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  reviewButtonText: { color: Colors.accent, fontSize: 15, fontWeight: '700' as const },
  cancelButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  cancelButtonText: { fontSize: 14, fontWeight: '400' as const, color: Colors.textBody },
});
