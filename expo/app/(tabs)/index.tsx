import { Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Award,
  Bell,
  ChevronRight,
  ClipboardList,
  Flame,
  Hash,
  Headphones,
  BookOpenText,
  Mic,
  PenLine,
  Star,
  Trophy,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PaywallModal } from '@/components/PaywallModal';
import { PreparednessBottomSheet } from '@/components/PreparednessBottomSheet';
import { formatXp, getBadgeTier } from '@/lib/badgeHelpers';
import { useHomeData, type RecentSession, type SectionHistoryItem } from '@/lib/useHomeData';
import { useAccess } from '@/providers/AccessProvider';
import { useAuth } from '@/providers/AuthProvider';
import {
  colors,
  componentSizes,
  fontFamily,
  fontSize,
  radius,
  shadows,
  spacing,
} from '@/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const TAB_BAR_HEIGHT = componentSizes.tabBarHeight;
const BOTTOM_CONTENT_BUFFER = componentSizes.contentBuffer;

const UPGRADEABLE_TIERS = new Set(['free', 'free_trial', 'pro']);

// ─── Readiness subtext ────────────────────────────────────────────────────────
function readinessSubtext(score: number): string {
  if (score <= 30) return "Keep going — you're just getting started";
  if (score <= 60) return 'Solid progress. Push through to the next level.';
  if (score <= 85) return "You're in great shape. Keep the streak alive.";
  return 'Exam ready. Stay sharp.';
}

// ─── Tier nudge config ────────────────────────────────────────────────────────
type TierConfig = {
  containerBg: string;
  pillBg: string;
  pillTextColor: string;
  pillLabel: string;
  nextTier: string | null;
};

function getTierConfig(percentile: number | null): TierConfig | null {
  if (percentile === null) return null;
  if (percentile <= 10) {
    return {
      containerBg: 'rgba(245,196,0,0.15)',
      pillBg: '#F5C400',
      pillTextColor: colors.darkNavy,
      pillLabel: 'Gold',
      nextTier: null,
    };
  }
  if (percentile <= 25) {
    return {
      containerBg: 'rgba(156,163,175,0.15)',
      pillBg: '#9CA3AF',
      pillTextColor: colors.darkNavy,
      pillLabel: 'Silver',
      nextTier: 'Gold',
    };
  }
  if (percentile <= 50) {
    return {
      containerBg: 'rgba(205,127,50,0.15)',
      pillBg: '#CD7F32',
      pillTextColor: colors.white,
      pillLabel: 'Bronze',
      nextTier: 'Silver',
    };
  }
  return {
    containerBg: 'rgba(205,127,50,0.15)',
    pillBg: '#CD7F32',
    pillTextColor: colors.white,
    pillLabel: 'Bronze',
    nextTier: 'Bronze',
  };
}

// ─── Section icon (lucide) ────────────────────────────────────────────────────
function SectionIcon({ section, size = 14 }: { section: string; size?: number }) {
  const c = colors.primaryBlue;
  if (section === 'Hören') return <Headphones color={c} size={size} />;
  if (section === 'Schreiben') return <PenLine color={c} size={size} />;
  if (section === 'Sprechen') return <Mic color={c} size={size} />;
  return <BookOpenText color={c} size={size} />;
}

// ─── Recent session row ───────────────────────────────────────────────────────
function formatSessionDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function sessionTypeLabel(t: string): string {
  if (t === 'stream') return 'Practice';
  if (t === 'sectional') return 'Sectional';
  if (t === 'mock') return 'Mock';
  return t;
}

function RecentSessionRow({ session }: { session: RecentSession }) {
  const score = Math.round(session.score_pct);
  const scoreColor = score >= 70 ? colors.green : score >= 40 ? colors.amber : colors.red;
  return (
    <View style={recentStyles.row}>
      <View style={recentStyles.iconWrap}>
        <SectionIcon section={session.section} size={13} />
      </View>
      <View style={recentStyles.info}>
        <Text style={recentStyles.label}>{sessionTypeLabel(session.session_type)} · {session.section}</Text>
        <Text style={recentStyles.date}>{formatSessionDate(session.completed_at)}</Text>
      </View>
      <View style={[recentStyles.scorePill, { backgroundColor: scoreColor + '22' }]}>
        <Text style={[recentStyles.scoreText, { color: scoreColor }]}>{score}%</Text>
      </View>
    </View>
  );
}

const recentStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  iconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#EEF4FF',
    alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  label: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.bodySm, color: colors.darkNavy },
  date: { fontFamily: fontFamily.bodyRegular, fontSize: fontSize.label, color: colors.mutedGray },
  scorePill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill },
  scoreText: { fontFamily: fontFamily.display, fontSize: fontSize.label },
});

// ─── Section history row ──────────────────────────────────────────────────────
function SectionHistoryRow({ item, onPress }: { item: SectionHistoryItem; onPress: () => void }) {
  const rightLabel = item.progressPct > 0 ? `${Math.round(item.progressPct)}%` : '—';
  return (
    <Pressable style={histStyles.row} onPress={onPress}>
      <View style={histStyles.iconWrap}>
        <SectionIcon section={item.section} size={14} />
      </View>
      <View style={histStyles.body}>
        <Text style={histStyles.name}>{item.section}</Text>
        <View style={histStyles.barTrack}>
          <View style={[histStyles.barFill, { width: `${Math.min(item.progressPct, 100)}%` as any }]} />
        </View>
      </View>
      <Text style={histStyles.count}>{rightLabel}</Text>
    </Pressable>
  );
}

const histStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 16, gap: 10,
  },
  iconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#EEF4FF',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  body: { flex: 1, gap: 4 },
  name: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.darkNavy },
  barTrack: {
    height: 4, borderRadius: 2,
    backgroundColor: colors.cardBorder, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 2, backgroundColor: colors.primaryBlue },
  count: {
    fontFamily: fontFamily.bodyRegular, fontSize: 10,
    color: colors.mutedGray, textAlign: 'right', flexShrink: 0, minWidth: 28,
  },
});

// ─── Home screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { access } = useAccess();
  const { profile, user } = useAuth();
  const data = useHomeData();

  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [marketingDismissed, setMarketingDismissed] = useState(false);

  const formattedXp = useMemo(() => formatXp(data.xp), [data.xp]);
  const initial = (user?.email ?? '?').charAt(0).toUpperCase();

  const showUpgradeBanner =
    UPGRADEABLE_TIERS.has(data.subscriptionTier) || access.trial_hours_remaining !== null;

  const tierConfig = getTierConfig(data.leaderboardPercentile);
  const rankLabel =
    data.leaderboardPercentile !== null ? `Top ${data.leaderboardPercentile}%` : '—';

  const scoreInt = Math.round(data.preparedness);
  const progressWidth = `${Math.min(scoreInt, 100)}%`;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>

      {/* FIX 2: Upgrade CTA alert bar */}
      {showUpgradeBanner ? (
        <Pressable style={styles.alertBar} onPress={() => setShowPaywall(true)}>
          <Text style={styles.alertBarText}>
            Upgrade to Pro — unlock all levels and sections →
          </Text>
        </Pressable>
      ) : null}

      {/* Exam countdown (only if no upgrade banner) */}
      {!showUpgradeBanner && data.daysToExam !== null && data.daysToExam <= 30 ? (
        <View style={styles.examBar}>
          <Text style={styles.examBarText}>
            📅 {data.daysToExam} days until your exam — stay consistent
          </Text>
        </View>
      ) : null}

      {/* Campaign marketing banner */}
      {data.campaignActive && !marketingDismissed ? (
        <View style={styles.marketingBanner}>
          <View style={styles.marketingBody}>
            <Text style={styles.marketingTitle}>Your exam is closer than you think</Text>
            <Text style={styles.marketingSub}>
              Practice daily — even 5 minutes builds lasting confidence.
            </Text>
          </View>
          <Pressable
            style={styles.marketingDismiss}
            onPress={() => setMarketingDismissed(true)}
            hitSlop={8}
          >
            <X color={colors.mutedGray} size={18} />
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + BOTTOM_CONTENT_BUFFER },
        ]}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable
            style={styles.avatar}
            onPress={() => router.push('/(tabs)/profile' as never)}
            testID="home-profile-avatar"
            hitSlop={8}
          >
            <Text style={styles.avatarInitial}>{initial}</Text>
          </Pressable>
          <Text style={styles.wordmark}>wordifi</Text>
          <View style={styles.bell}>
            <Bell color={colors.midGray} size={16} strokeWidth={1.8} />
          </View>
        </View>

        {/* ── HERO GAMIFICATION CARD ── */}
        <Pressable
          style={styles.heroCard}
          onPress={() => setShowBottomSheet(true)}
          testID="home-hero-card"
        >
          {/* Row 1: Level + exam type | Exam countdown */}
          <View style={styles.heroRow1}>
            <View style={styles.levelRow}>
              <View style={styles.levelPill}>
                <Text style={styles.levelText}>{data.targetLevel}</Text>
                <Text style={styles.examTypeText}>{data.examType}</Text>
              </View>
            </View>
            {data.daysToExam !== null ? (
              <View style={styles.examBadge}>
                <Text style={styles.examBadgeText}>{data.daysToExam} days to exam</Text>
              </View>
            ) : null}
          </View>

          {/* Row 2: Readiness number */}
          <Text style={styles.readinessLabel}>EXAM READINESS</Text>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreInt}>{scoreInt}</Text>
            <Text style={styles.scorePct}>%</Text>
          </View>
          <Text style={styles.scoreSub}>{readinessSubtext(scoreInt)}</Text>

          {/* Row 3: Progress bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: progressWidth as any }]} />
          </View>

          {/* Row 4: 4 stat chips */}
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Flame color={colors.accentTeal} size={14} />
              <Text style={styles.statVal}>{data.streak}</Text>
              <Text style={styles.statLbl}>Streak</Text>
            </View>
            <View style={styles.chipDivider} />
            <View style={styles.statChip}>
              <Star color={colors.accentTeal} size={14} />
              <Text style={styles.statVal}>{formattedXp}</Text>
              <Text style={styles.statLbl}>XP</Text>
            </View>
            <View style={styles.chipDivider} />
            <View style={styles.statChip}>
              <Award color={colors.accentTeal} size={14} />
              <Text style={styles.statVal}>{rankLabel}</Text>
              <Text style={styles.statLbl}>Rank</Text>
            </View>
            <View style={styles.chipDivider} />
            <View style={styles.statChip}>
              <TrendingUp color={colors.accentTeal} size={14} />
              <Text style={styles.statVal}>—</Text>
              <Text style={styles.statLbl}>7-day</Text>
            </View>
          </View>

          {/* Row 5: Tier nudge */}
          {data.isLoading && tierConfig === null ? (
            <View style={styles.tierSkeleton} />
          ) : tierConfig ? (
            <View style={[styles.tierRow, { backgroundColor: tierConfig.containerBg }]}>
              <View style={[styles.tierPill, { backgroundColor: tierConfig.pillBg }]}>
                <Text style={[styles.tierPillText, { color: tierConfig.pillTextColor }]}>
                  {tierConfig.pillLabel}
                </Text>
              </View>
              {tierConfig.nextTier ? (
                <Text style={styles.tierNudgeText}>
                  A few tests to reach{' '}
                  <Text style={styles.tierNextName}>{tierConfig.nextTier}</Text>
                </Text>
              ) : (
                <Text style={styles.tierNudgeText}>You're in the top tier</Text>
              )}
            </View>
          ) : null}
        </Pressable>

        {/* ── Activity grid ── */}
        <Text style={styles.sectionHead}>Activity</Text>
        <View style={styles.activityGrid}>
          <View style={styles.actCard}>
            <Zap color={colors.primaryBlue} size={20} />
            <Text style={styles.actNum}>{data.activityCounts.streamAnswered}</Text>
            <Text style={styles.actLbl}>Stream</Text>
          </View>

          <Pressable
            style={styles.actCard}
            onPress={() => router.push('/(tabs)/tests' as never)}
          >
            <ClipboardList color={colors.primaryBlue} size={20} />
            <Text style={styles.actNum}>{data.activityCounts.sectionalTests}</Text>
            <Text style={styles.actLbl}>Sectional</Text>
          </Pressable>

          <Pressable
            style={styles.actCard}
            onPress={() => router.push('/(tabs)/mock' as never)}
          >
            <Trophy color={colors.primaryBlue} size={20} />
            <Text style={styles.actNum}>{data.activityCounts.mockTests}</Text>
            <Text style={styles.actLbl}>Complete Test</Text>
          </Pressable>

          <View style={styles.actCard}>
            <Hash color={colors.primaryBlue} size={20} />
            <Text style={styles.actNum}>{data.activityCounts.totalAnswered}</Text>
            <Text style={styles.actLbl}>Total Questions</Text>
          </View>
        </View>

        {/* ── History by section ── */}
        <Text style={styles.sectionHead}>History by section</Text>
        <View style={styles.histContainer}>
          {data.sectionHistory.map((item, idx) => (
            <React.Fragment key={item.section}>
              <SectionHistoryRow
                item={item}
                onPress={() => router.push('/(tabs)/tests' as never)}
              />
              {idx < data.sectionHistory.length - 1 ? (
                <View style={styles.histDivider} />
              ) : null}
            </React.Fragment>
          ))}
        </View>

        {/* ── Recent sessions ── */}
        {data.recentSessions.length > 0 ? (
          <>
            <Text style={styles.sectionHead}>Recent sessions</Text>
            <View style={styles.recentContainer}>
              {data.recentSessions.map((session, idx) => (
                <React.Fragment key={session.id}>
                  <RecentSessionRow session={session} />
                  {idx < data.recentSessions.length - 1 ? (
                    <View style={styles.histDivider} />
                  ) : null}
                </React.Fragment>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      <PreparednessBottomSheet
        visible={showBottomSheet}
        onClose={() => setShowBottomSheet(false)}
        level={data.targetLevel}
        overallScore={data.preparedness}
        horenPct={data.horenAccuracy}
        lesenPct={data.lesenAccuracy}
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bodyBackground,
  },

  // Alert + exam bars
  alertBar: {
    backgroundColor: colors.primaryBlue,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  alertBarText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: colors.white,
    textAlign: 'center',
  },
  examBar: {
    backgroundColor: colors.surfaceContainerLow,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  examBarText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: colors.midGray,
    textAlign: 'center',
  },

  // Marketing banner
  marketingBanner: {
    backgroundColor: colors.darkNavy,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  marketingBody: { flex: 1, gap: 4 },
  marketingTitle: {
    fontFamily: fontFamily.display,
    fontSize: 18,
    color: colors.white,
  },
  marketingSub: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.mutedGray,
    lineHeight: 18,
  },
  marketingDismiss: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  // Scroll container
  scroll: {
    gap: 0,
    paddingTop: 0,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.bodyBackground,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fontFamily.display,
    fontSize: 13,
    color: colors.white,
  },
  wordmark: {
    fontFamily: fontFamily.display,
    fontSize: 20,
    color: colors.darkNavy,
    letterSpacing: -0.5,
  },
  bell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f3f8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Hero card ──
  heroCard: {
    backgroundColor: colors.darkNavy,
    marginHorizontal: 12,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 0,
  },

  // Row 1
  heroRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  levelPill: {
    backgroundColor: colors.primaryBlue,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  levelText: {
    fontFamily: fontFamily.display,
    fontSize: 11,
    color: colors.white,
  },
  examTypeText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
  },
  examBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  examBadgeText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.mutedGray,
  },

  // Row 2: readiness score
  readinessLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    color: colors.mutedGray,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    marginBottom: 4,
  },
  scoreInt: {
    fontFamily: fontFamily.display,
    fontSize: 64,
    color: colors.white,
    lineHeight: 64,
    letterSpacing: -2,
  },
  scorePct: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    color: colors.accentTeal,
    lineHeight: 40,
  },
  scoreSub: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.mutedGray,
    marginBottom: 14,
  },

  // Row 3: progress bar
  progressTrack: {
    height: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.primaryBlue,
  },

  // Row 4: 4 stat chips
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 12,
    marginBottom: 12,
  },
  statChip: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statVal: {
    fontFamily: fontFamily.display,
    fontSize: 16,
    color: colors.white,
  },
  statLbl: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
    color: colors.mutedGray,
  },
  chipDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },

  // Row 5: tier nudge
  tierSkeleton: {
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tierPill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tierPillText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
  },
  tierNudgeText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.mutedGray,
    flexShrink: 1,
  },
  tierNextName: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: colors.accentTeal,
  },

  // ── Section header ──
  sectionHead: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: colors.midGray,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },

  // ── Activity grid ──
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  actCard: {
    width: '47.5%',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 6,
  },
  actNum: {
    fontFamily: fontFamily.display,
    fontSize: 26,
    color: colors.darkNavy,
    lineHeight: 28,
  },
  actLbl: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.mutedGray,
  },

  // ── History by section ──
  histContainer: {
    backgroundColor: colors.white,
    marginHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  histDivider: {
    height: 0.5,
    backgroundColor: colors.cardBorder,
    marginLeft: 54, // indent past icon
  },

  // ── Recent sessions ──
  recentContainer: {
    backgroundColor: colors.white,
    marginHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
});
