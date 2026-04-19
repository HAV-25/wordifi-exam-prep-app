import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';

import { fetchLeaderboard } from '@/lib/profileHelpers';
import { fetchSectionAccuracy } from '@/lib/streamHelpers';
import { supabase } from '@/lib/supabaseClient';
import { useAccess } from '@/providers/AccessProvider';
import { useAuth } from '@/providers/AuthProvider';

export type RecentSession = {
  id: string;
  session_type: string;
  section: string;
  score_pct: number;
  questions_total: number;
  completed_at: string;
};

export type ActivityCounts = {
  streamAnswered: number;
  sectionalTests: number;
  mockTests: number;
  totalAnswered: number;
};

export type SectionHistoryItem = {
  section: 'Hören' | 'Lesen' | 'Schreiben' | 'Sprechen';
  questionCount: number;
  testCount: number;
  progressPct: number;
};

export type LeaderboardNeighbor = {
  rank: number;
  display_name: string;
  target_level: string;
  exam_type: string;
  readiness_score: number;
  streak: number;
  xp: number;
  avatar_color: string | null;
  is_current_user: boolean;
};

export type TrendDay = {
  day_date: string;
  daily_xp: number;
  daily_correct: number;
  daily_total: number;
  cumulative_accuracy: number | null;
};

export type HomeData = {
  readiness: number;
  streak: number;
  xp: number;
  targetLevel: string;
  examType: string;
  examDate: string | null;
  horenAccuracy: number;
  lesenAccuracy: number;
  sectionalCount: number;
  sectionalTotal: number;
  mockLastScore: number | null;
  recentSessions: RecentSession[];
  hasPracticedToday: boolean;
  daysToExam: number | null;
  trialHoursRemaining: number | null;
  activityCounts: ActivityCounts;
  sectionHistory: SectionHistoryItem[];
  campaignActive: boolean;
  leaderboardPercentile: number | null;
  subscriptionTier: string;
  isLoading: boolean;
  // New fields for redesign
  firstName: string | null;
  greeting: string;
  motivationalQuote: string | null;
  leaderboardNeighbors: LeaderboardNeighbor[];
  trendData: TrendDay[];
  trendPercentage: number | null;
  hasUnreadNotification: boolean;
};

function calcDaysToExam(examDate: string | null): number | null {
  if (!examDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exam = new Date(examDate);
  exam.setHours(0, 0, 0, 0);
  const diff = Math.ceil((exam.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : null;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function pickQuoteCategory(
  streak: number,
  daysToExam: number | null,
  hasPracticedToday: boolean,
  readiness: number,
): string {
  // Prioritize: exam close > streak > comeback > milestone > general
  if (daysToExam !== null && daysToExam <= 30) return 'exam_close';
  if (streak >= 3) return 'streak';
  if (streak === 0 && !hasPracticedToday) return 'comeback';
  if (readiness >= 60) return 'milestone';
  if (!hasPracticedToday) return 'low_activity';
  return 'general';
}

const SECTION_ORDER: SectionHistoryItem['section'][] = ['Hören', 'Lesen', 'Schreiben', 'Sprechen'];

export function useHomeData(): HomeData {
  const { profile, user } = useAuth();
  const { access } = useAccess();
  const userId = user?.id ?? '';
  const targetLevel = profile?.target_level ?? 'A1';
  const firstName = (profile as any)?.first_name ?? null;

  const sectionAccuracyQuery = useQuery({
    queryKey: ['section-accuracy', userId],
    enabled: Boolean(userId),
    queryFn: () => fetchSectionAccuracy(userId),
    staleTime: 60_000,
  });

  const statsQuery = useQuery({
    queryKey: ['home-stats', userId, targetLevel],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data: sessions } = await supabase
        .from('test_sessions')
        .select('section, teil, session_type, questions_total')
        .eq('user_id', userId)
        .eq('level', targetLevel)
        .not('completed_at', 'is', null);

      const completed = (sessions ?? []) as Array<{
        section: string;
        teil: number;
        session_type: string;
        questions_total: number;
      }>;

      const sectionalDone = new Set(
        completed
          .filter((s) => s.session_type === 'sectional')
          .map((s) => `${s.section}-${s.teil}`)
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

      const sectionMap: Record<string, { questionCount: number; testCount: number }> = {};
      for (const s of completed) {
        if (!sectionMap[s.section]) sectionMap[s.section] = { questionCount: 0, testCount: 0 };
        sectionMap[s.section]!.questionCount += s.questions_total ?? 0;
        sectionMap[s.section]!.testCount += 1;
      }

      return {
        sectionalCount: sectionalDone.size,
        mockLastScore: mockRows[0]?.overall_score_pct ?? null,
        sectionMap,
      };
    },
    staleTime: 30_000,
  });

  const recentSessionsQuery = useQuery({
    queryKey: ['recent-sessions', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data } = await supabase
        .from('test_sessions')
        .select('id, session_type, section, score_pct, questions_total, completed_at')
        .eq('user_id', userId)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(5);
      return (data ?? []) as RecentSession[];
    },
    staleTime: 30_000,
  });

  const activityCountsQuery = useQuery({
    queryKey: ['activity-counts', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [answersResult, streamResult, sectionalResult, mockResult] = await Promise.all([
        supabase
          .from('user_answers')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        supabase
          .from('test_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('session_type', 'stream'),
        supabase
          .from('test_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('session_type', 'sectional'),
        supabase
          .from('mock_tests')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .not('completed_at', 'is', null),
      ]);
      return {
        totalAnswered: answersResult.count ?? 0,
        streamSessions: streamResult.count ?? 0,
        sectionalSessions: sectionalResult.count ?? 0,
        mockTests: mockResult.count ?? 0,
      };
    },
    staleTime: 60_000,
  });

  const campaignQuery = useQuery({
    queryKey: ['campaign-active'],
    queryFn: async (): Promise<boolean> => {
      try {
        const { data, error } = await (supabase.from('app_config' as never) as any)
          .select('value')
          .eq('key', 'campaign_active')
          .maybeSingle();
        if (error) return false;
        return (data as { value: string } | null)?.value === 'true';
      } catch {
        return false;
      }
    },
    staleTime: 300_000,
  });

  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard-percentile', userId, targetLevel],
    enabled: Boolean(userId) && Boolean(targetLevel),
    queryFn: async (): Promise<number | null> => {
      try {
        const entries = await fetchLeaderboard(targetLevel);
        if (!entries || entries.length === 0) return null;
        const myEntry = entries.find((e: any) => e.is_current_user || (e as any).user_id === userId);
        if (!myEntry) return null;
        return Math.round((myEntry.rank / entries.length) * 100);
      } catch {
        return null;
      }
    },
    staleTime: 120_000,
  });

  // New: leaderboard neighbors for ranking card
  const neighborsQuery = useQuery({
    queryKey: ['leaderboard-neighbors', userId, targetLevel],
    enabled: Boolean(userId) && Boolean(targetLevel),
    queryFn: async (): Promise<LeaderboardNeighbor[]> => {
      try {
        const readiness = Math.round(profile?.readiness_score ?? 0);
        const { data, error } = await (supabase.rpc as any)('get_leaderboard_neighbors', {
          p_user_id: userId,
          p_target_level: targetLevel,
          p_user_readiness: readiness,
        });
        if (error) return [];
        return (data ?? []) as LeaderboardNeighbor[];
      } catch {
        return [];
      }
    },
    staleTime: 120_000,
  });

  // New: 7-day trend data
  const trendQuery = useQuery({
    queryKey: ['7day-trend', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<TrendDay[]> => {
      try {
        const { data, error } = await (supabase.rpc as any)('get_7day_trend', {
          p_user_id: userId,
        });
        if (error) return [];
        return (data ?? []) as TrendDay[];
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });

  // Unread notification count — drives the bell badge
  const notificationsQuery = useQuery({
    queryKey: ['home-notifications-unread', userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<boolean> => {
      try {
        const { count } = await supabase
          .from('user_notifications' as never)
          .select('id', { count: 'exact', head: true })
          .eq('user_id' as never, userId)
          .is('read_at' as never, null) as any;
        return (count ?? 0) > 0;
      } catch {
        return false;
      }
    },
  });

  // New: motivational quote (cached per session via staleTime)
  const streak = profile?.streak_count ?? 0;
  const readiness = profile?.readiness_score ?? 0;
  const dailyStreamCount = (profile as Record<string, unknown> | null)?.daily_stream_count as number | undefined;
  const hasPracticedToday = (dailyStreamCount ?? 0) > 0;
  const daysToExam = calcDaysToExam(profile?.exam_date ?? null);

  const categoryRef = useRef(
    pickQuoteCategory(streak, daysToExam, hasPracticedToday, readiness)
  );

  const quoteQuery = useQuery({
    queryKey: ['motivational-quote', userId, categoryRef.current],
    enabled: Boolean(userId),
    queryFn: async (): Promise<string | null> => {
      try {
        const category = categoryRef.current;
        let query = supabase
          .from('motivational_quotes' as never)
          .select('text')
          .eq('category', category as never) as any;

        if (category === 'streak' && streak > 0) {
          query = query.or(`min_streak.is.null,min_streak.lte.${streak}`);
        }
        if (category === 'exam_close' && daysToExam !== null) {
          query = query.or(`max_days_to_exam.is.null,max_days_to_exam.gte.${daysToExam}`);
        }

        const { data, error } = await query;
        if (error || !data || data.length === 0) {
          // Fallback to general
          const { data: fallback } = await (supabase.from('motivational_quotes' as never) as any)
            .select('text')
            .eq('category', 'general');
          const items = fallback ?? [];
          return items.length > 0 ? items[Math.floor(Math.random() * items.length)].text : null;
        }
        const items = data as Array<{ text: string }>;
        return items[Math.floor(Math.random() * items.length)].text;
      } catch {
        return null;
      }
    },
    staleTime: Infinity, // Don't refetch within this session
  });

  const horenAccuracy = sectionAccuracyQuery.data
    ? Math.round(sectionAccuracyQuery.data.horenAccuracy * 100)
    : 0;
  const lesenAccuracy = sectionAccuracyQuery.data
    ? Math.round(sectionAccuracyQuery.data.lesenAccuracy * 100)
    : 0;

  const sectionMap = statsQuery.data?.sectionMap ?? {};
  const sectionHistory: SectionHistoryItem[] = SECTION_ORDER.map((section) => {
    const entry = sectionMap[section] ?? { questionCount: 0, testCount: 0 };
    let progressPct: number;
    if (section === 'Hören') progressPct = horenAccuracy;
    else if (section === 'Lesen') progressPct = lesenAccuracy;
    else progressPct = Math.min(entry.testCount * 33, 100);
    return {
      section,
      questionCount: entry.questionCount,
      testCount: entry.testCount,
      progressPct,
    };
  });

  // Calculate trend percentage from 7-day data
  const trendData = trendQuery.data ?? [];
  let trendPercentage: number | null = null;
  if (trendData.length >= 7) {
    const firstHalf = trendData.slice(0, 3);
    const secondHalf = trendData.slice(4, 7);
    const avgFirst = firstHalf.reduce((s, d) => s + d.daily_xp, 0) / Math.max(firstHalf.length, 1);
    const avgSecond = secondHalf.reduce((s, d) => s + d.daily_xp, 0) / Math.max(secondHalf.length, 1);
    if (avgFirst > 0) {
      trendPercentage = Math.round(((avgSecond - avgFirst) / avgFirst) * 100);
    } else if (avgSecond > 0) {
      trendPercentage = 100;
    }
  }

  return {
    readiness,
    streak,
    xp: profile?.xp_total ?? 0,
    targetLevel,
    examType: profile?.exam_type ?? 'TELC',
    examDate: profile?.exam_date ?? null,
    horenAccuracy,
    lesenAccuracy,
    sectionalCount: statsQuery.data?.sectionalCount ?? 0,
    sectionalTotal: 8,
    mockLastScore: statsQuery.data?.mockLastScore ?? null,
    recentSessions: recentSessionsQuery.data ?? [],
    hasPracticedToday,
    daysToExam,
    trialHoursRemaining: access.trial_hours_remaining ?? null,
    activityCounts: {
      streamAnswered: activityCountsQuery.data?.streamSessions ?? 0,
      sectionalTests: activityCountsQuery.data?.sectionalSessions ?? 0,
      mockTests: activityCountsQuery.data?.mockTests ?? 0,
      totalAnswered: activityCountsQuery.data?.totalAnswered ?? 0,
    },
    sectionHistory,
    campaignActive: campaignQuery.data ?? false,
    leaderboardPercentile: leaderboardQuery.data ?? null,
    subscriptionTier: profile?.subscription_tier ?? 'free_trial',
    isLoading: sectionAccuracyQuery.isLoading || statsQuery.isLoading,
    // New fields
    firstName,
    greeting: getGreeting(),
    motivationalQuote: quoteQuery.data ?? null,
    leaderboardNeighbors: neighborsQuery.data ?? [],
    trendData,
    trendPercentage,
    hasUnreadNotification: notificationsQuery.data ?? false,
  };
}
