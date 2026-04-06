import { useQuery } from '@tanstack/react-query';

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

export type HomeData = {
  preparedness: number;
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

const SECTION_ORDER: SectionHistoryItem['section'][] = ['Hören', 'Lesen', 'Schreiben', 'Sprechen'];

export function useHomeData(): HomeData {
  const { profile, user } = useAuth();
  const { access } = useAccess();
  const userId = user?.id ?? '';
  const targetLevel = profile?.target_level ?? 'A1';

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

      // Per-section aggregation for Zone E
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
          .select('campaign_active')
          .maybeSingle();
        if (error) return false;
        return (data as Record<string, unknown> | null)?.campaign_active === true;
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

  const dailyStreamCount = (profile as Record<string, unknown> | null)?.daily_stream_count as number | undefined;

  return {
    preparedness: profile?.preparedness_score ?? 0,
    streak: profile?.streak_count ?? 0,
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
    hasPracticedToday: (dailyStreamCount ?? 0) > 0,
    daysToExam: calcDaysToExam(profile?.exam_date ?? null),
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
  };
}
