import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Flame,
  Gift,
  Info,
  LogOut,
  Pencil,
  Share2 as ShareIcon,
  Star,
  TrendingUp,
  Trophy,
} from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { colors, spacing, radius } from '@/theme';
import { presentAdaptyPaywall, syncSubscriptionAfterPurchase } from '@/lib/adaptyPaywall';
import { supabase } from '@/lib/supabaseClient';
import { useHomeData } from '@/lib/useHomeData';
import { useAccess } from '@/providers/AccessProvider';
import { useAuth } from '@/providers/AuthProvider';

// ─── Constants ───────────────────────────────────────────────────────────────
const PAID_TIERS = new Set([
  'monthly',
  'quarterly',
  'paid_early',
  'winback_monthly',
  'winback_quarterly',
]);
const FREE_TIERS = new Set(['free', 'free_trial']);

const TIER_DISPLAY_FALLBACK: Record<string, string> = {
  free:              'Free',
  free_trial:        'Free Trial',
  monthly:           'Pro Monthly',
  quarterly:         'Pro Quarterly',
  paid_early:        'Early Adopter',
  winback_monthly:   'Pro Monthly',
  winback_quarterly: 'Pro Quarterly',
};

const UPGRADE_SUBTITLE: Record<string, string> = {
  free:       'Unlock all sections, levels and mock tests',
  free_trial: 'Your trial is active — lock in Pro before it ends',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatLong(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function formatMonthYear(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  });
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
  return diff;
}

function extractPlanHighlights(json: unknown): string[] {
  if (!json || typeof json !== 'object') return [];
  const obj = json as Record<string, unknown>;
  const out: string[] = [];

  if (typeof obj.weekly_goal_sessions === 'number') {
    out.push(`Practice ${obj.weekly_goal_sessions} session${obj.weekly_goal_sessions !== 1 ? 's' : ''} per week`);
  }
  if (typeof obj.focus_section === 'string') {
    out.push(`Focus section: ${obj.focus_section}`);
  }
  if (Array.isArray(obj.mock_test_dates) && obj.mock_test_dates.length > 0) {
    out.push(`Mock test: ${formatShort(obj.mock_test_dates[0] as string)}`);
  }
  // Pick up any other top-level string values we haven't used
  for (const [k, v] of Object.entries(obj)) {
    if (out.length >= 3) break;
    if (typeof v === 'string' && v.trim() && !['focus_section'].includes(k)) {
      out.push(v.trim());
    }
  }
  return out.slice(0, 3);
}

// ─── Skeleton block ───────────────────────────────────────────────────────────
function SkeletonRow({ height = 18, width = '60%', marginBottom = 8 }: {
  height?: number; width?: number | `${number}%`; marginBottom?: number
}) {
  return (
    <View
      style={{
        height,
        width: width as number | `${number}%`,
        borderRadius: 6,
        backgroundColor: Colors.surfaceMuted,
        marginBottom,
      }}
    />
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function InfoRow({
  label,
  children,
  showDivider = true,
}: {
  label: string;
  children: React.ReactNode;
  showDivider?: boolean;
}) {
  return (
    <>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <View style={styles.infoRight}>{children}</View>
      </View>
      {showDivider && <View style={styles.rowDivider} />}
    </>
  );
}

function ActionRow({
  icon,
  label,
  right,
  onPress,
  showDivider = true,
}: {
  icon: React.ReactNode;
  label: string;
  right?: React.ReactNode;
  onPress?: () => void;
  showDivider?: boolean;
}) {
  return (
    <>
      <Pressable style={styles.actionRow} onPress={onPress} accessibilityRole="button">
        <View style={styles.actionIcon}>{icon}</View>
        <Text style={styles.actionLabel}>{label}</Text>
        <View style={styles.actionRight}>
          {right}
          <ChevronRight size={16} color={Colors.textMuted} />
        </View>
      </Pressable>
      {showDivider && <View style={styles.rowDivider} />}
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, user, signOut, refreshProfile, isLoading } = useAuth();
  const { refreshAccess } = useAccess();
  const { leaderboardPercentile } = useHomeData();

  // tier_config display names (graceful fallback if table missing / schema differs)
  const tierConfigQuery = useQuery({
    queryKey: ['tier-config'],
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await (supabase.from('tier_config' as never) as any)
        .select('tier_name, display_name');
      if (error || !data) return {};
      return Object.fromEntries(
        (data as Array<{ tier_name: string; display_name: string }>).map((r) => [
          r.tier_name,
          r.display_name,
        ])
      );
    },
    staleTime: Infinity,
  });

  const tierDisplayName = useCallback(
    (tier: string) =>
      tierConfigQuery.data?.[tier] ?? TIER_DISPLAY_FALLBACK[tier] ?? tier,
    [tierConfigQuery.data]
  );

  // Derived values
  const tier = profile?.subscription_tier ?? 'free';
  const showUpgradeCard = FREE_TIERS.has(tier);
  const isPaid = PAID_TIERS.has(tier);
  const trialExpiresAt = (profile as Record<string, unknown> | null)
    ?.trial_expires_at as string | null ?? null;
  const trialActive = profile?.trial_active ?? false;

  const avatarLetter = useMemo(() => {
    const name = profile?.player_name?.trim();
    if (name) return name[0]!.toUpperCase();
    const email = user?.email?.trim();
    if (email) return email[0]!.toUpperCase();
    return '?';
  }, [profile?.player_name, user?.email]);

  const examDays = daysUntil(profile?.exam_date);
  const planHighlights = useMemo(
    () => extractPlanHighlights(profile?.study_plan_json),
    [profile?.study_plan_json]
  );

  const leaderboardLabel = leaderboardPercentile != null
    ? `Top ${leaderboardPercentile}%`
    : '—';

  const handleCopyEmail = useCallback(async () => {
    if (user?.email) await Clipboard.setStringAsync(user.email);
  }, [user?.email]);

  const handleReferFriend = useCallback(async () => {
    const code = profile?.referral_code;
    if (!code) return;
    await Share.share({
      message: `Join me on Wordifi and use my referral code: ${code}\nDownload: wordifi.app`,
    });
  }, [profile?.referral_code]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace('/onboarding_launch');
  }, [signOut]);

  const navigateUpgrade = useCallback(async () => {
    try {
      const result = await presentAdaptyPaywall(async () => {
        if (user?.id) {
          await syncSubscriptionAfterPurchase(user.id);
          await refreshAccess();
          await refreshProfile();
        }
      });
    } catch {}
  }, [user?.id, refreshAccess, refreshProfile]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <View style={styles.header}>
          {/* Sign-out */}
          <Pressable
            onPress={handleSignOut}
            style={styles.signOutBtn}
            accessibilityLabel="Sign out"
          >
            <LogOut size={20} color={Colors.textMuted} />
          </Pressable>

          {/* Avatar */}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>

          {/* Name */}
          {isLoading ? (
            <SkeletonRow width={120} height={22} marginBottom={6} />
          ) : (
            <Text style={styles.playerName}>
              {profile?.player_name?.trim() || user?.email?.split('@')[0] || 'You'}
            </Text>
          )}

          {/* Exam type · Level */}
          {isLoading ? (
            <SkeletonRow width={80} height={14} marginBottom={0} />
          ) : (
            <Text style={styles.headerSub}>
              {[profile?.exam_type?.toUpperCase(), profile?.target_level]
                .filter(Boolean)
                .join(' · ') || '—'}
            </Text>
          )}
        </View>

        {/* ── Card 1 — General Profile Information ────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>PROFILE</Text>

          {isLoading ? (
            <>
              <SkeletonRow width="80%" />
              <SkeletonRow width="60%" />
              <SkeletonRow width="70%" />
            </>
          ) : (
            <>
              {/* Complete your profile banner */}
              {!profile?.target_level && (
                <Pressable
                  onPress={() => router.push('/profile-setup' as never)}
                  style={styles.profileBanner}
                  accessibilityRole="button"
                  accessibilityLabel="Complete your profile"
                >
                  <Info size={16} color={colors.primary} />
                  <Text style={styles.profileBannerText}>Complete your profile to get started</Text>
                  <ChevronRight size={16} color={colors.primary} />
                </Pressable>
              )}

              {/* Email row */}
              <InfoRow label="Email">
                <Text style={styles.infoValue} numberOfLines={1}>
                  {user?.email ?? '—'}
                </Text>
                <Pressable onPress={handleCopyEmail} style={styles.iconBtn} accessibilityLabel="Copy email">
                  <Copy size={16} color={Colors.textMuted} />
                </Pressable>
              </InfoRow>

              {/* Level row — tappable */}
              <Pressable
                onPress={() => router.push('/profile-setup' as never)}
                accessibilityRole="button"
                accessibilityLabel="Edit level"
              >
                <InfoRow label="Level">
                  <View style={styles.levelPill}>
                    <Text style={styles.levelPillText}>{profile?.target_level ?? '—'}</Text>
                  </View>
                  <Pencil size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
                </InfoRow>
              </Pressable>

              {/* Exam date row — tappable */}
              <Pressable
                onPress={() => router.push('/profile-setup' as never)}
                accessibilityRole="button"
                accessibilityLabel="Edit exam date"
              >
                <InfoRow label="Target exam" showDivider={false}>
                  <Text style={styles.infoValue}>{formatLong(profile?.exam_date)}</Text>
                  {examDays !== null && examDays > 0 ? (
                    <View style={styles.daysBadge}>
                      <Text style={styles.daysBadgeText}>{examDays} days</Text>
                    </View>
                  ) : examDays !== null && examDays <= 0 ? (
                    <Text style={[styles.infoValue, { color: Colors.accent }]}>Completed</Text>
                  ) : null}
                  <Pencil size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
                </InfoRow>
              </Pressable>
            </>
          )}

          {/* Divider before readiness */}
          <View style={styles.sectionDivider} />

          {/* Readiness score */}
          <Text style={styles.cardLabel}>EXAM READINESS</Text>
          {isLoading ? (
            <SkeletonRow width={100} height={40} />
          ) : (
            <>
              <View style={styles.readinessRow}>
                <Text style={styles.readinessNumber}>
                  {Math.round(profile?.readiness_score ?? 0)}
                </Text>
                <Text style={styles.readinessPct}>%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(profile?.readiness_score ?? 0, 100)}%` },
                  ]}
                />
              </View>
            </>
          )}

          {/* Gamification icons row */}
          <View style={styles.gamRow}>
            <View style={styles.gamItem}>
              <Flame size={20} color={colors.flagRed} />
              <Text style={styles.gamValue}>
                {isLoading ? '—' : (profile?.streak_count ?? 0)}
              </Text>
            </View>
            <View style={styles.gamItem}>
              <Star size={20} color={colors.flagGold} />
              <Text style={styles.gamValue}>
                {isLoading ? '—' : (profile?.xp_total ?? 0)}
              </Text>
            </View>
            <View style={styles.gamItem}>
              <Trophy size={20} color={Colors.primary} />
              <Text style={styles.gamValue}>{leaderboardLabel}</Text>
            </View>
            <View style={styles.gamItem}>
              <TrendingUp size={20} color={Colors.accent} />
              <Text style={styles.gamValue}>—</Text>
            </View>
          </View>
        </View>

        {/* ── Card 2 — Upgrade Alert (conditional) ────────────── */}
        {showUpgradeCard && (
          <Pressable style={styles.upgradeCard} onPress={navigateUpgrade} accessibilityRole="button">
            <View style={styles.upgradeLeft}>
              <Text style={styles.upgradeTitle}>Upgrade to Pro</Text>
              <Text style={styles.upgradeSubtitle}>
                {UPGRADE_SUBTITLE[tier] ?? UPGRADE_SUBTITLE.free}
              </Text>
              {trialActive && trialExpiresAt ? (
                <View style={styles.trialRow}>
                  <Clock size={12} color={colors.flagGold} />
                  <Text style={styles.trialText}>
                    Trial ends {formatShort(trialExpiresAt)}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.upgradeArrow}>
              <ChevronRight size={20} color={Colors.white} />
            </View>
          </Pressable>
        )}

        {/* ── Card 3 — Preparation Plan & Subscription ─────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>YOUR PLAN</Text>

          {/* Section A — Plan highlights */}
          {isLoading ? (
            <>
              <SkeletonRow width="75%" />
              <SkeletonRow width="65%" />
            </>
          ) : planHighlights.length > 0 ? (
            planHighlights.map((line, i) => (
              <View key={i} style={styles.planRow}>
                <CheckCircle2 size={16} color={Colors.accent} style={styles.planIcon} />
                <Text style={styles.planText}>{line}</Text>
              </View>
            ))
          ) : (
            <View style={styles.planRow}>
              <Info size={16} color={Colors.textMuted} style={styles.planIcon} />
              <Text style={[styles.planText, styles.planTextMuted]}>
                Complete onboarding to generate your plan
              </Text>
            </View>
          )}

          <View style={styles.sectionDivider} />

          {/* Section B — Subscription rows */}
          <Text style={styles.cardLabel}>SUBSCRIPTION</Text>

          {isLoading ? (
            <>
              <SkeletonRow width="60%" />
              <SkeletonRow width="50%" />
            </>
          ) : (
            <>
              {/* Plan row */}
              <InfoRow label="Plan">
                <Text style={styles.infoValue}>{tierDisplayName(tier)}</Text>
                <TierBadge tier={tier} isPaid={isPaid} />
              </InfoRow>

              {/* Renewal row */}
              {profile?.subscription_valid_until ? (
                <InfoRow label="Renews">
                  <Text style={styles.infoValue}>
                    {formatLong(profile.subscription_valid_until)}
                  </Text>
                </InfoRow>
              ) : null}

              {/* Member since */}
              <InfoRow label="Member since" showDivider={false}>
                <Text style={styles.infoValue}>{formatMonthYear(profile?.created_at)}</Text>
              </InfoRow>
            </>
          )}

          <View style={styles.sectionDivider} />

          {/* Section C — Actions */}
          <ActionRow
            icon={<CreditCard size={18} color={Colors.primary} />}
            label="View subscription options"
            onPress={navigateUpgrade}
          />
          <ActionRow
            icon={<Gift size={18} color={Colors.accent} />}
            label="Refer a friend"
            right={
              profile?.referral_code ? (
                <View style={styles.refCodePill}>
                  <Text style={styles.refCodeText}>{profile.referral_code}</Text>
                </View>
              ) : null
            }
            onPress={handleReferFriend}
            showDivider={false}
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Tier badge ───────────────────────────────────────────────────────────────
function TierBadge({ tier, isPaid }: { tier: string; isPaid: boolean }) {
  let bg: string = Colors.background;
  let textColor: string = Colors.textMuted;
  let label = 'Free';

  if (isPaid) {
    bg = '#E8F5E9';
    textColor = '#2E7D32';
    label = 'Active';
  } else if (tier === 'free_trial') {
    bg = '#FFF8E1';
    textColor = '#F57F17';
    label = 'Trial';
  }

  return (
    <View style={[styles.tierBadge, { backgroundColor: bg }]}>
      <Text style={[styles.tierBadgeText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const CARD_RADIUS = 24;
const CARD_PADDING = spacing.xxl;  // 24px
const CARD_MARGIN_H = spacing.xxl; // 24px
const CARD_MARGIN_B = spacing.lg;  // 16px

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingTop: 0,
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    paddingHorizontal: CARD_MARGIN_H,
    paddingTop: spacing.xxxl,  // 32px
    paddingBottom: spacing.lg, // 16px
  },
  signOutBtn: {
    position: 'absolute',
    top: spacing.xxxl,
    right: CARD_MARGIN_H,
    padding: spacing.sm,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.white,
    fontFamily: 'Outfit_800ExtraBold',
  },
  playerName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primaryDeep,
    fontFamily: 'Outfit_800ExtraBold',
    textAlign: 'center',
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textMuted,
    fontFamily: 'NunitoSans_400Regular',
    textAlign: 'center',
  },

  // ── Card shell ─────────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.white,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: CARD_PADDING,
    marginHorizontal: CARD_MARGIN_H,
    marginBottom: CARD_MARGIN_B,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    fontFamily: 'NunitoSans_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    fontFamily: 'NunitoSans_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  // ── Info rows ──────────────────────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textMuted,
    fontFamily: 'NunitoSans_400Regular',
    flex: 1,
  },
  infoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primaryDeep,
    fontFamily: 'NunitoSans_600SemiBold',
    textAlign: 'right',
    flexShrink: 1,
  },
  iconBtn: {
    padding: 2,
  },
  rowDivider: {
    height: 0.5,
    backgroundColor: Colors.border,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },

  // ── Level pill ─────────────────────────────────────────────────────────────
  levelPill: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  levelPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.white,
    fontFamily: 'Outfit_800ExtraBold',
  },

  // ── Days badge ─────────────────────────────────────────────────────────────
  daysBadge: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  daysBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    fontFamily: 'NunitoSans_600SemiBold',
  },

  // ── Profile incomplete banner ──────────────────────────────────────────────
  profileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${colors.primary}12`,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  profileBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'NunitoSans_600SemiBold',
    color: colors.primary,
  },

  // ── Readiness ──────────────────────────────────────────────────────────────
  readinessRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginBottom: 10,
  },
  readinessNumber: {
    fontSize: 40,
    fontWeight: '800',
    color: Colors.primaryDeep,
    fontFamily: 'Outfit_800ExtraBold',
    lineHeight: 46,
  },
  readinessPct: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.accent,
    fontFamily: 'Outfit_800ExtraBold',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },

  // ── Gamification row ───────────────────────────────────────────────────────
  gamRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  gamItem: {
    alignItems: 'center',
    gap: 4,
  },
  gamValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primaryDeep,
    fontFamily: 'NunitoSans_600SemiBold',
  },

  // ── Upgrade card ───────────────────────────────────────────────────────────
  upgradeCard: {
    backgroundColor: Colors.primary,
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
    marginHorizontal: CARD_MARGIN_H,
    marginBottom: CARD_MARGIN_B,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upgradeLeft: {
    flex: 1,
    gap: 4,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
    fontFamily: 'Outfit_800ExtraBold',
  },
  upgradeSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.75)',
    fontFamily: 'NunitoSans_400Regular',
  },
  trialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  trialText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.flagGold,
    fontFamily: 'NunitoSans_600SemiBold',
  },
  upgradeArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Plan highlights ────────────────────────────────────────────────────────
  planRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  planIcon: {
    marginTop: 1,
  } as object,
  planText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.primaryDeep,
    fontFamily: 'NunitoSans_400Regular',
    lineHeight: 20,
  },
  planTextMuted: {
    color: Colors.textMuted,
    fontStyle: 'italic',
  },

  // ── Tier badge ─────────────────────────────────────────────────────────────
  tierBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'NunitoSans_600SemiBold',
  },

  // ── Action rows ────────────────────────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  actionIcon: {
    width: 24,
    alignItems: 'center',
  },
  actionLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primaryDeep,
    fontFamily: 'NunitoSans_600SemiBold',
  },
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  // ── Referral code pill ─────────────────────────────────────────────────────
  refCodePill: {
    backgroundColor: Colors.background,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  refCodeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    fontFamily: 'NunitoSans_600SemiBold',
  },
});
