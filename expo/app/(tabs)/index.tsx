import React, { useMemo } from 'react';
import { useRouter } from 'expo-router';
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

import { PaywallModal } from '@/components/PaywallModal';
import { PreparednessBottomSheet } from '@/components/PreparednessBottomSheet';
import { ProgressRing } from '@/components/ProgressRing';
import { Sparkline } from '@/components/Sparkline';
import { formatXp } from '@/lib/badgeHelpers';
import { useHomeData, type LeaderboardNeighbor } from '@/lib/useHomeData';
import { useAccess } from '@/providers/AccessProvider';
import { useAuth } from '@/providers/AuthProvider';
import {
  colors,
  componentSizes,
  fontFamily,
  fontSize,
  radius,
  spacing,
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

// ─── Home screen ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { access } = useAccess();
  const { profile, user } = useAuth();
  const data = useHomeData();

  const [showBottomSheet, setShowBottomSheet] = React.useState(false);
  const [showPaywall, setShowPaywall] = React.useState(false);

  const formattedXp = useMemo(() => formatXp(data.xp), [data.xp]);
  const initial = (data.firstName ?? user?.email ?? '?').charAt(0).toUpperCase();
  const scoreInt = Math.round(data.preparedness);

  const isPaidUser = data.subscriptionTier === 'pro';
  const showUpgradeBanner = !isPaidUser;

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
              <Text style={s.avatarInitial}>{initial}</Text>
            </Pressable>
            <View style={s.brandWrap}>
              <Text style={s.wordmark}>wordifi</Text>
            </View>
            <View style={s.headerRight}>
              <View style={s.bellBtn}>
                <Bell color={BANANI.foreground} size={20} />
              </View>
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
            <Pressable style={s.upgradeCard} onPress={() => setShowPaywall(true)}>
              <View style={s.upgradeIcon}>
                <Sparkles color={BANANI.accentFg} size={14} />
              </View>
              <Text style={s.upgradeCopy}>Unlock all sections & levels</Text>
              <View style={s.upgradeArrow}>
                <ArrowRight color={BANANI.muted} size={16} />
              </View>
            </Pressable>
          </View>
        ) : (
          <View style={s.upgradeRow}>
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
          </View>
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

          {/* Top: label + countdown */}
          <View style={s.heroTop}>
            <View style={s.heroTitleWrap}>
              <Text style={s.heroLabel}>EXAM READINESS</Text>
            </View>
            {data.daysToExam !== null ? (
              <View style={s.heroCountdown}>
                <Clock color={BANANI.primaryFg} size={14} />
                <Text style={s.heroCountdownText}>{data.daysToExam} days left</Text>
              </View>
            ) : null}
          </View>

          {/* Score ring */}
          <View style={s.scoreZone}>
            <ProgressRing score={scoreInt} size={214} strokeWidth={10} />
            <Text style={s.scoreCaption}>{readinessCaption(scoreInt)}</Text>
          </View>

          {/* Streak card */}
          <View style={s.streakCard}>
            <View style={s.streakIconWrap}>
              <Flame color="#FDE68A" size={20} />
            </View>
            <View style={s.streakCopy}>
              <Text style={s.streakValue}>{data.streak}</Text>
              <Text style={s.streakLabel}>day streak</Text>
            </View>
          </View>

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
                    <View style={s.microBarBg}>
                      <View style={[s.microBarFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
                    </View>
                    <View style={[s.statusDot, { backgroundColor: barColor }]} />
                  </View>
                  <View style={s.secRight}>
                    <Text style={s.questionCount}>{item.questionCount}q</Text>
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
              <View style={s.rankingArrow}>
                <ArrowUpRight color={BANANI.primary} size={18} />
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

      <PreparednessBottomSheet
        visible={showBottomSheet}
        onClose={() => setShowBottomSheet(false)}
        level={data.targetLevel}
        overallScore={data.preparedness}
        horenPct={data.horenAccuracy}
        lesenPct={data.lesenAccuracy}
        schreibenSessions={data.sectionHistory.find((s) => s.section === 'Schreiben')?.testCount ?? 0}
        sprechenSessions={data.sectionHistory.find((s) => s.section === 'Sprechen')?.testCount ?? 0}
        streak={data.streak}
        lastActiveDate={profile?.last_active_date ?? null}
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
  const avatarBg = isYou
    ? `rgba(43,112,239,0.18)`
    : neighbor.avatar_color ?? AVATAR_COLORS[neighbor.rank % AVATAR_COLORS.length];
  const avatarText = isYou ? 'You' : neighbor.display_name.charAt(0).toUpperCase();
  const avatarTextColor = isYou ? BANANI.primary : '#7C2D12';

  return (
    <View style={[s.miniRow, isYou && s.miniRowYou]}>
      <Text style={s.rankNo}>#{neighbor.rank}</Text>
      <View style={[s.avatarSmall, { backgroundColor: avatarBg }]}>
        <Text style={[s.avatarSmallText, { color: avatarTextColor }]}>{avatarText}</Text>
      </View>
      <View style={s.person}>
        <Text style={s.personName} numberOfLines={1}>{neighbor.display_name}</Text>
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

  // ── Greeting ──
  greetingRow: {
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 2,
  },
  greetingText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: BANANI.muted,
    lineHeight: 15,
  },
  quoteText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: BANANI.muted,
    lineHeight: 15,
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
    gap: 4,
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
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 12,
    zIndex: 1,
  },
  streakIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakCopy: {
    gap: 0,
  },
  streakValue: {
    fontFamily: fontFamily.display,
    fontSize: 22,
    color: BANANI.primaryFg,
    lineHeight: 22,
    letterSpacing: -1,
  },
  streakLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  microBarBg: {
    flex: 1,
    height: 7,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  microBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  secRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-end',
  },
  questionCount: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
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
