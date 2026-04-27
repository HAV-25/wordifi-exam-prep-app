import React, { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Clock,
  Flame,
  Headphones,
  Lock,
  Mic,
  PenTool,
  Sparkles,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react-native';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarImage } from '@/components/AvatarImage';
import { AnimatedFlame } from '@/components/AnimatedFlame';
import { FlameStrip } from '@/components/FlameStrip';
import { GlowBorderCard } from '@/components/GlowBorderCard';
import { PaywallBottomSheet } from '@/components/PaywallBottomSheet';
import { PaywallModal } from '@/components/PaywallModal';
import { PracticeStatsCards } from '@/components/PracticeStatsCards';
import { ReadinessBottomSheet } from '@/components/ReadinessBottomSheet';
import { ReadinessRingV2 } from '@/components/ReadinessRingV2';
import { Sparkline } from '@/components/Sparkline';
import { StreakStatusIcon } from '@/components/StreakStatusIcon';
import { InfoTooltip } from '@/components/InfoTooltip';
import { WordifiLogo } from '@/components/WordifiLogo';
import { formatXp } from '@/lib/badgeHelpers';
import { getReadinessStub, getStreakStub, getDailyRollupStub } from '@/lib/gamificationStubs';
import { getBaseStreakRequirement } from '@/lib/gamificationHelpers';
import { useHomeData, type LeaderboardNeighbor } from '@/lib/useHomeData';
import { getBadgeByStreak, useBadgeLadder } from '@/hooks/useBadgeLadder';
import { useGameState } from '@/hooks/useGameState';
import { useAccess } from '@/providers/AccessProvider';
import { useAuth } from '@/providers/AuthProvider';
import {
  colors,
  componentSizes,
  fontFamily,
  fontSize,
  radius,
  spacing,
  PAID_TIERS,
} from '@/theme';

// ─── Banani design tokens (exact from design) ───────────────────────────────
const BANANI = {
  background: '#F8FAFF',
  foreground: '#374151',
  border: '#E2E8F0',
  primary: '#2B70EF',
  primaryFg: '#FFFFFF',
  muted: '#94A3B8',
  success: '#22C55E',
  warning: '#F59E0B',
  accent: '#F0C808',
  accentFg: '#374151',
  card: '#FFFFFF',
  destructive: '#EF4444',
} as const;

const AVATAR_COLORS = ['#FDE68A', '#DDD6FE', '#BAE6FD', '#BBF7D0', '#FECDD3', '#FED7AA'];

// ─── Readiness subtext ───────────────────────────────────────────────────────
function readinessCaption(score: number): string {
  if (score <= 30) return "Keep going — you're just getting started";
  if (score <= 60) return 'Solid progress — keep pushing';
  if (score <= 85) return "You're exam ready";
  return 'Exam ready — stay sharp';
}

// ─── Section icon ────────────────────────────────────────────────────────────
function SectionIcon({ section, size = 18, color = 'rgba(255,255,255,0.88)' }: { section: string; size?: number; color?: string }) {
  if (section === 'Hören') return <Headphones color={color} size={size} />;
  if (section === 'Schreiben') return <PenTool color={color} size={size} />;
  if (section === 'Sprechen') return <Mic color={color} size={size} />;
  return <BookOpen color={color} size={size} />;
}

// ─── Status dot color ────────────────────────────────────────────────────────
function statusColor(pct: number): string {
  if (pct >= 70) return BANANI.success;
  if (pct >= 40) return BANANI.warning;
  return '#FCA5A5';
}

function sectionAccentColor(section: string): string {
  const map: Record<string, string> = {
    'Hören':     '#2B70EF',
    'Lesen':     '#22C55E',
    'Schreiben': '#8B5CF6',
    'Sprechen':  '#F97316',
  };
  return map[section] ?? '#94A3B8';
}

// ─── Home screen ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { access } = useAccess();
  const { profile, user } = useAuth();
  const userId = user?.id ?? '';
  const targetLevel = profile?.target_level ?? 'A1';
  const data = useHomeData();

  // Refresh home stats whenever the tab gains focus (e.g. after completing a test)
  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ['home-stats', userId, targetLevel] });
      void queryClient.invalidateQueries({ queryKey: ['section-accuracy', userId] });
      void queryClient.invalidateQueries({ queryKey: ['7day-trend', userId] });
      void queryClient.invalidateQueries({ queryKey: ['leaderboard-neighbors', userId, targetLevel] });
      void queryClient.invalidateQueries({ queryKey: ['leaderboard-percentile', userId, targetLevel] });
    }, [queryClient, userId, targetLevel])
  );

  const [showBottomSheet, setShowBottomSheet] = React.useState(false);
  const [showPaywall, setShowPaywall] = React.useState(false);
  const [showStreakPaywallSheet, setShowStreakPaywallSheet] = React.useState(false);
  const [showUpgradePaywallSheet, setShowUpgradePaywallSheet] = React.useState(false);
  const [readinessTooltipVisible, setReadinessTooltipVisible] = React.useState(false);

  const isPaidUser = PAID_TIERS.has(data.subscriptionTier);
  const showUpgradeBanner = !isPaidUser;

  // Trigger #9 home variant — streak requirement exceeds free cap
  const { data: gameState } = useGameState(targetLevel, userId);
  const { data: ladder = [] } = useBadgeLadder();

  const isTrial = !isPaidUser && (
    (data.subscriptionTier as string) === 'free_trial' ||
    (data as any).trialHoursRemaining > 0
  );
  const todayRequirement = gameState?.today.requirement ?? 0;
  const requirementMet   = gameState?.today.requirement_met ?? false;
  const questionsRemaining = gameState?.today.questions_remaining ?? 1;
  const streakDays       = gameState?.streak.current_days ?? 0;
  const badgeName        = getBadgeByStreak(streakDays, ladder)?.name ?? '';

  // ── Streak status icon data ──────────────────────────────────────────────
  const currentBadgeRank = gameState?.badge.current_rank ?? 0;
  const missedDaysAtRank = gameState?.badge.missed_days_at_rank ?? 0;
  const currentBadge     = ladder.find((b) => b.rank === currentBadgeRank) ?? null;
  const nextBadge        = ladder.find((b) => b.rank === currentBadgeRank + 1) ?? null;

  // Show streak nudge card when: free user, streak req > 5 free cap, not yet met, no questions remaining
  const showStreakNudge =
    !isPaidUser &&
    !isTrial &&
    todayRequirement > 5 &&
    !requirementMet &&
    questionsRemaining === 0;

  const formattedXp = useMemo(() => formatXp(data.xp), [data.xp]);
  const initial = (data.firstName ?? user?.email ?? '?').charAt(0).toUpperCase();
  const scoreInt = Math.round(data.readiness);

  // ── Gamification v2.8 stub data (TODO: replace with RPC in next sprint) ──
  // Using 'paid30' scenario as the default visual state for development.
  const gamReadiness = getReadinessStub('paid30');
  const gamStreak    = getStreakStub('paid30');
  const gamRollup    = getDailyRollupStub('paid30');
  const gamBaseReq   = getBaseStreakRequirement(gamStreak.current_streak_days);
  const gamTodayReq  = gamBaseReq + gamStreak.daily_requirement_tier_adjustment;

  // Sparkline data arrays (7 values)
  const xpSparkData = useMemo(
    () => data.trendData.map((d) => d.daily_xp),
    [data.trendData],
  );
  const trendSparkData = useMemo(
    () => data.trendData.map((d) => (d.cumulative_accuracy ?? 0)),
    [data.trendData],
  );

  // Leaderboard: find current user's rank for percentile display
  const myRank = data.leaderboardNeighbors.find((n) => n.is_current_user);
  const totalRanked = data.leaderboardNeighbors.length > 0
    ? Math.max(...data.leaderboardNeighbors.map((n) => n.rank))
    : 0;
  const rankLabel = data.leaderboardPercentile !== null
    ? `Top ${data.leaderboardPercentile}%`
    : myRank ? `#${myRank.rank}` : '—';

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.scroll,
          { paddingBottom: insets.bottom + componentSizes.tabBarHeight + componentSizes.contentBuffer },
        ]}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerTop}>
            <Pressable
              style={s.avatar}
              onPress={() => router.push('/(tabs)/profile' as never)}
              testID="home-profile-avatar"
              hitSlop={8}
            >
              <AvatarImage
                uri={profile?.avatar_url}
                initial={initial}
                size={44}
                bgColor="rgba(43,112,239,0.12)"
                textColor={BANANI.primary}
                fontSize={16}
              />
            </Pressable>
            <View style={s.brandWrap}>
              <WordifiLogo variant="blue" height={28} />
            </View>
            <View style={s.headerRight}>
              <Pressable
                style={s.bellBtn}
                onPress={() => router.push('/notifications' as never)}
                hitSlop={8}
                testID="home-bell"
              >
                <Bell
                  color={data.hasUnreadNotification ? BANANI.warning : BANANI.foreground}
                  size={20}
                />
                {data.hasUnreadNotification && <View style={s.notifDot} />}
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Greeting ── */}
        <View style={s.greetingRow}>
          <Text style={s.greetingText}>
            {data.greeting}{data.firstName ? `, ${data.firstName}` : ''}
          </Text>
          {data.motivationalQuote ? (
            <Text style={s.quoteText}>{data.motivationalQuote}</Text>
          ) : null}
        </View>

        {/* ── Upgrade / Daily Stream Banner ── */}
        {showUpgradeBanner ? (
          <View style={s.upgradeRow}>
            <GlowBorderCard>
              <Pressable style={s.upgradeCard} onPress={() => setShowUpgradePaywallSheet(true)}>
                <View style={s.upgradeIcon}>
                  <Sparkles color={BANANI.accentFg} size={14} />
                </View>
                <Text style={s.upgradeCopy}>Unlock all sections & levels</Text>
                <View style={s.upgradeArrow}>
                  <ArrowRight color={BANANI.muted} size={16} />
                </View>
              </Pressable>
            </GlowBorderCard>
          </View>
        ) : (
          <View style={s.upgradeRow}>
            <GlowBorderCard>
              <Pressable style={s.upgradeCard} onPress={() => router.push('/(tabs)/stream' as never)}>
                <View style={[s.upgradeIcon, { backgroundColor: 'rgba(43,112,239,0.14)' }]}>
                  <Zap color={BANANI.primary} size={14} />
                </View>
                <Text style={s.upgradeCopy}>
                  {data.hasPracticedToday ? 'Continue your daily stream' : 'Start your daily stream'}
                </Text>
                <View style={s.upgradeArrow}>
                  <ArrowRight color={BANANI.muted} size={16} />
                </View>
              </Pressable>
            </GlowBorderCard>
          </View>
        )}

        {/* ── Streak exceeds free nudge (Trigger #9) ── */}
        {showStreakNudge && (
          <Pressable
            style={s.streakNudgeBanner}
            onPress={() => setShowStreakPaywallSheet(true)}
            testID="home-streak-nudge"
          >
            <Flame color="#92400E" size={20} />
            <View style={s.streakNudgeBannerText}>
              <Text style={s.streakNudgeBannerTitle}>
                Your streak needs {todayRequirement} questions today
              </Text>
              <Text style={s.streakNudgeBannerSub}>
                Unlock unlimited to keep{badgeName ? ` ${badgeName}` : ' your streak'} alive.
              </Text>
            </View>
          </Pressable>
        )}

        {/* ── Level Badge ── */}
        <View style={s.levelRow}>
          <View style={s.levelBadge}>
            <Text style={s.levelBadgeText}>{data.targetLevel}</Text>
            <View style={s.levelDot} />
            <Text style={s.levelBadgeText}>{data.examType}</Text>
          </View>
        </View>

        {/* ── HERO CARD ── */}
        <Pressable
          style={s.heroCard}
          onPress={() => setShowBottomSheet(true)}
          testID="home-hero-card"
        >
          {/* Decorative radial gradients (simplified as subtle overlays) */}
          <View style={s.heroGlow1} />
          <View style={s.heroGlow2} />

          {/* Top: label + ⓘ icon + countdown + arrow */}
          <View style={s.heroTop}>
            <View style={s.heroTitleWrap}>
              <Text style={s.heroLabel}>EXAM READINESS</Text>
              <Pressable
                onPress={() => setReadinessTooltipVisible(true)}
                hitSlop={8}
                accessibilityLabel="About Exam Readiness"
                accessibilityRole="button"
              >
                <View style={s.infoIcon}>
                  <Text style={s.infoIconText}>i</Text>
                </View>
              </Pressable>
            </View>
            <View style={s.heroTopRight}>
              {data.daysToExam !== null ? (
                <View style={s.heroCountdown}>
                  <Clock color={BANANI.primaryFg} size={14} />
                  <Text style={s.heroCountdownText}>{data.daysToExam} days left</Text>
                </View>
              ) : null}
              <View style={s.heroArrow}>
                <ArrowUpRight color="rgba(255,255,255,0.72)" size={16} />
              </View>
            </View>
          </View>

          {/* Readiness ring v2 — multi-colour progressive (display-only, no tap) */}
          <View style={s.scoreZone}>
            <ReadinessRingV2
              normalizedScore={gamReadiness.normalized_score}
              size={140}
            />
          </View>

          {/* Streak row — single inline row */}
          <View style={s.streakCard}>
            <View style={s.streakFlameWrap}>
              <AnimatedFlame size={16} animated />
            </View>
            <Text style={s.streakNum}>{gamStreak.current_streak_days}</Text>
            <Text style={s.streakWord}>day streak</Text>
            <View style={{ marginLeft: 8 }}>
              <StreakStatusIcon
                currentStreakDays={streakDays}
                missedDaysAtRank={missedDaysAtRank}
                todayRequirementMet={requirementMet}
                todayRequirement={todayRequirement}
                currentBadge={currentBadge}
                nextBadge={nextBadge}
              />
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <FlameStrip days={gamRollup} />
            </View>
          </View>
          {/* Today's requirement — below streak row, full width */}
          <Text style={s.streakReqLabel}>Today: {gamTodayReq} questions</Text>

          {/* Stats row: XP + 7-day trend */}
          <View style={s.statsRow}>
            <View style={s.statChip}>
              <View style={s.statTop}>
                <Text style={s.statLabel}>XP</Text>
                <Star color="#DDD6FE" size={17} />
              </View>
              <Text style={s.statValue}>{formattedXp}</Text>
              <Sparkline data={xpSparkData.length === 7 ? xpSparkData : [0,0,0,0,0,0,0]} color="#DDD6FE" height={24} />
            </View>
            <View style={s.statChip}>
              <View style={s.statTop}>
                <Text style={s.statLabel}>7-DAY TREND</Text>
                <TrendingUp color={BANANI.success} size={17} />
              </View>
              <Text style={s.statValue}>
                {data.trendPercentage !== null ? `${data.trendPercentage > 0 ? '+' : ''}${data.trendPercentage}%` : '—'}
              </Text>
              <Sparkline data={trendSparkData.length === 7 ? trendSparkData : [0,0,0,0,0,0,0]} color={BANANI.success} height={24} />
            </View>
          </View>

          {/* Practice stats: Total Practiced + Accuracy */}
          <View style={s.practiceStatsWrap}>
            <PracticeStatsCards rollup={gamRollup} />
          </View>

          {/* Divider */}
          <View style={s.heroDivider} />

          {/* Section breakdown */}
          <View style={s.sectionHead}>
            <Text style={s.sectionHeadLabel}>SECTION BREAKDOWN</Text>
            <Text style={s.sectionHeadSub}>Last 30 days</Text>
          </View>

          <View style={s.sectionsList}>
            {data.sectionHistory.map((item) => {
              const pct = Math.min(item.progressPct, 100);
              const barColor = statusColor(pct);
              const isLocked = (item.section === 'Schreiben' && !access.schreiben_enabled) ||
                               (item.section === 'Sprechen' && !access.sprechen_enabled);

              // Label: "X/Y Correct" for Hören/Lesen, "X% avg" for Schreiben/Sprechen
              let statLabel: string;
              if (item.section === 'Hören' || item.section === 'Lesen') {
                statLabel = item.totalCount > 0
                  ? `${item.correctCount}/${item.totalCount} Correct`
                  : '—';
              } else {
                statLabel = item.avgPct !== null ? `${item.avgPct}% avg` : '—';
              }

              return (
                <Pressable
                  key={item.section}
                  style={s.sectionRow}
                  onPress={() => router.push('/(tabs)/tests' as never)}
                >
                  <View style={s.secLeft}>
                    <View style={s.secIconWrap}>
                      <SectionIcon section={item.section} />
                    </View>
                    <Text style={s.secName}>{item.section}</Text>
                  </View>
                  <View style={s.secMid}>
                    {/* Single accuracy bar */}
                    <View style={s.microBarBg}>
                      <View style={[s.microBarFill, {
                        width: `${pct}%` as any,
                        backgroundColor: barColor,
                      }]} />
                    </View>
                  </View>
                  <View style={s.secRight}>
                    <Text style={s.accuracyPct}>{statLabel}</Text>
                    {isLocked ? (
                      <View style={s.lockWrap}>
                        <Lock color="rgba(255,255,255,0.62)" size={14} />
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Readiness info tooltip */}
          <InfoTooltip
            visible={readinessTooltipVisible}
            onDismiss={() => setReadinessTooltipVisible(false)}
            text="Your Readiness reflects how well you've performed since you joined Wordifi and how consistently you've practised in the last 2 weeks. Practise daily and answer accurately to climb."
          />
        </Pressable>

        {/* ── Ranking Card ── */}
        {data.leaderboardNeighbors.length > 0 ? (
          <Pressable
            style={s.rankingCard}
            onPress={() => setShowBottomSheet(true)}
            testID="home-ranking-card"
          >
            <View style={s.rankingTop}>
              <View>
                <Text style={s.rankingLabel}>GLOBAL RANKING</Text>
                <View style={s.rankingMain}>
                  <Text style={s.rankingNumber}>{rankLabel}</Text>
                  <Text style={s.rankingCopy}>
                    Among {data.targetLevel} {data.examType} learners
                  </Text>
                </View>
              </View>
            </View>

            <View style={s.miniBoard}>
              {data.leaderboardNeighbors.map((neighbor) => (
                <MiniLeaderboardRow key={`${neighbor.rank}-${neighbor.display_name}`} neighbor={neighbor} />
              ))}
            </View>
          </Pressable>
        ) : null}

      </ScrollView>

      <ReadinessBottomSheet
        visible={showBottomSheet}
        onClose={() => setShowBottomSheet(false)}
        level={data.targetLevel}
        overallScore={data.readiness}
        horenPct={data.horenAccuracy}
        lesenPct={data.lesenAccuracy}
        schreibenSessions={data.sectionHistory.find((s) => s.section === 'Schreiben')?.testCount ?? 0}
        sprechenSessions={data.sectionHistory.find((s) => s.section === 'Sprechen')?.testCount ?? 0}
        streak={data.streak}
        lastActiveDate={profile?.last_active_date ?? null}
      />

      {/* Trigger #9: streak requirement exceeds free cap */}
      <PaywallBottomSheet
        visible={showStreakPaywallSheet}
        triggerContext="streak_req_exceeds_free"
        streakDays={streakDays}
        streakRequirement={todayRequirement}
        badgeName={badgeName}
        onUnlock={() => { setShowStreakPaywallSheet(false); setShowPaywall(true); }}
        onDismiss={() => setShowStreakPaywallSheet(false)}
      />

      {/* Home upgrade banner soft nudge */}
      <PaywallBottomSheet
        visible={showUpgradePaywallSheet}
        triggerContext="mock_locked"
        onUnlock={() => { setShowUpgradePaywallSheet(false); setShowPaywall(true); }}
        onDismiss={() => setShowUpgradePaywallSheet(false)}
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

// ─── Mini leaderboard row ────────────────────────────────────────────────────
function MiniLeaderboardRow({ neighbor }: { neighbor: LeaderboardNeighbor }) {
  const isYou = neighbor.is_current_user;
  const { profile } = useAuth();

  // For current user: player_name → first_name+exam_type → first_name+*****
  const displayName = isYou
    ? (profile?.player_name
        ?? ((profile as any)?.first_name
            ? `${(profile as any).first_name} ${profile?.exam_type ?? '*****'}`
            : neighbor.display_name))
    : neighbor.display_name;

  const avatarBg = isYou
    ? `rgba(43,112,239,0.18)`
    : neighbor.avatar_color ?? AVATAR_COLORS[neighbor.rank % AVATAR_COLORS.length];
  const avatarText = isYou ? 'You' : displayName.charAt(0).toUpperCase();
  const avatarTextColor = isYou ? BANANI.primary : '#7C2D12';

  return (
    <View style={[s.miniRow, isYou && s.miniRowYou]}>
      <Text style={s.rankNo}>#{neighbor.rank}</Text>
      <View style={[s.avatarSmall, { backgroundColor: avatarBg }]}>
        <Text style={[s.avatarSmallText, { color: avatarTextColor }]}>{avatarText}</Text>
      </View>
      <View style={s.person}>
        <Text style={s.personName} numberOfLines={1}>{displayName}</Text>
        <Text style={s.personMeta} numberOfLines={1}>
          {neighbor.exam_type} {neighbor.target_level} · {neighbor.streak > 0 ? `${neighbor.streak} day streak` : 'Day 1'}
        </Text>
      </View>
      <Text style={[s.personScore, isYou && { color: BANANI.primary }]}>
        {neighbor.readiness_score}%
      </Text>
    </View>
  );
}

// ─── Styles (faithful to Banani design tokens) ──────────────────────────────
const s = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BANANI.background,
  },
  scroll: {
    paddingTop: 0,
  },

  // ── Header ──
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(43,112,239,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#0F1F3D', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 20 },
      android: { elevation: 3 },
    }),
  },
  avatarInitial: {
    fontFamily: fontFamily.display,
    fontSize: 16,
    color: BANANI.primary,
  },
  brandWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontFamily: fontFamily.display,
    fontSize: 22,
    color: '#0F1F3D',
    letterSpacing: -0.5,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: BANANI.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#0F1F3D', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 20 },
      android: { elevation: 3 },
    }),
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BANANI.warning,
    borderWidth: 1.5,
    borderColor: '#F8FAFC',
  },

  // ── Greeting ──
  greetingRow: {
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 2,
  },
  greetingText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    color: BANANI.muted,
    lineHeight: 18,
  },
  quoteText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: BANANI.muted,
    lineHeight: 16,
    opacity: 0.8,
  },

  // ── Upgrade / Daily Stream Banner ──
  upgradeRow: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  upgradeCard: {
    backgroundColor: BANANI.card,
    borderWidth: 1,
    borderColor: BANANI.border,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#0F1F3D', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.04, shadowRadius: 24 },
      android: { elevation: 2 },
    }),
  },
  upgradeIcon: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(240,200,8,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeCopy: {
    flex: 1,
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    color: BANANI.foreground,
  },
  upgradeArrow: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Streak exceeds free nudge banner ──
  streakNudgeBanner: {
    marginHorizontal: 20,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FEFCE8',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  streakNudgeBannerText: {
    flex: 1,
  },
  streakNudgeBannerTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  streakNudgeBannerSub: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
    marginTop: 2,
    opacity: 0.85,
  },

  // ── Level Badge ──
  levelRow: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
  },
  levelBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: BANANI.card,
    borderRadius: 999,
    ...Platform.select({
      ios: { shadowColor: '#0F1F3D', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 22 },
      android: { elevation: 2 },
    }),
  },
  levelBadgeText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 13,
    color: BANANI.foreground,
  },
  levelDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: BANANI.muted,
    opacity: 0.8,
  },

  // ── Hero Card ──
  heroCard: {
    marginHorizontal: 20,
    backgroundColor: BANANI.primary,
    borderRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: 'rgba(43,112,239,0.26)', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 1, shadowRadius: 44 },
      android: { elevation: 12 },
    }),
  },
  heroGlow1: {
    position: 'absolute',
    top: -56,
    right: -34,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroGlow2: {
    position: 'absolute',
    left: -40,
    bottom: -76,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  // Hero top
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
    zIndex: 1,
  },
  heroTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoIcon: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 9,
    color: '#FFFFFF',
    lineHeight: 13,
  },
  heroTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.8)',
  },
  heroCountdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroCountdownText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 13,
    color: BANANI.primaryFg,
  },

  // Score zone
  scoreZone: {
    alignItems: 'center',
    paddingVertical: 8,
    zIndex: 1,
  },
  scoreCaption: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.74)',
    textAlign: 'center',
    marginTop: 6,
  },

  // Streak
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 4,
    zIndex: 1,
  },
  streakFlameWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  streakNum: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 18,
  },
  streakWord: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 9,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 13,
  },
  streakReqLabel: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 12,
    zIndex: 1,
  },
  practiceStatsWrap: {
    marginBottom: 16,
    zIndex: 1,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    zIndex: 1,
  },
  statChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    padding: 14,
    gap: 12,
    minHeight: 92,
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 0.7,
    color: 'rgba(255,255,255,0.72)',
  },
  statValue: {
    fontFamily: fontFamily.display,
    fontSize: 24,
    color: BANANI.primaryFg,
    letterSpacing: -1,
    lineHeight: 24,
  },

  // Divider
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginTop: 6,
    marginBottom: 10,
    zIndex: 1,
  },

  // Section breakdown
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
    zIndex: 1,
  },
  sectionHeadLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    letterSpacing: 0.7,
    color: 'rgba(255,255,255,0.72)',
  },
  sectionHeadSub: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },

  sectionsList: {
    gap: 16,
    zIndex: 1,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    gap: 10,
  },
  secLeft: {
    width: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  secIconWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secName: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 14,
    color: BANANI.primaryFg,
  },
  secMid: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 4,
    marginHorizontal: 10,
  },
  microBarBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  microBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  secRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-end',
  },
  accuracyPct: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'right' as const,
  },
  lockWrap: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Ranking Card ──
  rankingCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: BANANI.card,
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: BANANI.border,
    ...Platform.select({
      ios: { shadowColor: '#0F1F3D', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.08, shadowRadius: 42 },
      android: { elevation: 4 },
    }),
  },
  rankingTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  rankingLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    color: BANANI.muted,
    letterSpacing: 1,
  },
  rankingMain: {
    marginTop: 6,
  },
  rankingNumber: {
    fontFamily: fontFamily.display,
    fontSize: 44,
    lineHeight: 44 * 0.95,
    letterSpacing: -2,
    color: BANANI.foreground,
  },
  rankingCopy: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 14,
    color: BANANI.muted,
    marginTop: 8,
  },
  rankingArrow: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Mini board
  miniBoard: {
    gap: 10,
  },
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(15,31,61,0.03)',
  },
  miniRowYou: {
    backgroundColor: 'rgba(43,112,239,0.1)',
  },
  rankNo: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    color: BANANI.muted,
    width: 22,
  },
  avatarSmall: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmallText: {
    fontFamily: fontFamily.display,
    fontSize: 12,
  },
  person: {
    flex: 1,
    gap: 2,
  },
  personName: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 14,
    color: BANANI.foreground,
  },
  personMeta: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: BANANI.muted,
  },
  personScore: {
    fontFamily: fontFamily.display,
    fontSize: 14,
    color: BANANI.foreground,
  },
});
