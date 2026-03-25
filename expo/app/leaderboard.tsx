import { router } from 'expo-router';
import { ArrowLeft, Crown, Flame, Medal, Trophy } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import Colors from '@/constants/colors';
import { colors } from '@/theme';
import { fetchLeaderboard } from '@/lib/profileHelpers';
import { useAuth } from '@/providers/AuthProvider';

function getScoreColor(score: number): string {
  if (score >= 70) return colors.green;
  if (score >= 40) return colors.amber;
  return colors.red;
}

function getScoreBg(score: number): string {
  if (score >= 70) return '#E6F7F0';
  if (score >= 40) return '#FFF5E0';
  return '#FDE8E8';
}

function getRankDecoration(rank: number): { icon: React.ReactNode; bg: string } | null {
  if (rank === 1) return { icon: <Crown color="#D4A017" size={16} />, bg: '#FFF8E1' };
  if (rank === 2) return { icon: <Medal color="#9E9E9E" size={16} />, bg: '#F5F5F5' };
  if (rank === 3) return { icon: <Medal color="#CD7F32" size={16} />, bg: '#FFF3E0' };
  return null;
}

export default function LeaderboardScreen() {
  const { profile } = useAuth();
  const targetLevel = profile?.target_level ?? 'B1';

  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard', targetLevel],
    queryFn: () => fetchLeaderboard(targetLevel),
    refetchOnWindowFocus: true,
  });

  const entries = useMemo(() => {
    return leaderboardQuery.data ?? [];
  }, [leaderboardQuery.data]);

  const currentUserRank = useMemo(() => {
    return entries.find((e) => e.is_current_user);
  }, [entries]);

  const handleRefresh = useCallback(() => {
    void leaderboardQuery.refetch();
  }, [leaderboardQuery]);

  const hasNoName = !profile?.player_name;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          testID="leaderboard-back"
        >
          <ArrowLeft color={Colors.primary} size={22} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Trophy color={Colors.accent} size={20} />
          <Text style={styles.headerTitle}>Leaderboard</Text>
        </View>
        <View style={styles.levelPill}>
          <Text style={styles.levelPillText}>{targetLevel}</Text>
        </View>
      </View>

      {hasNoName ? (
        <View style={styles.noNameWrap}>
          <View style={styles.noNameCard}>
            <Trophy color={Colors.textMuted} size={40} />
            <Text style={styles.noNameTitle}>Set your learner name</Text>
            <Text style={styles.noNameBody}>
              You need a player name to appear on the leaderboard. Go to your profile to set one.
            </Text>
            <Pressable
              style={styles.noNameCta}
              onPress={() => router.back()}
              testID="go-set-name"
            >
              <Text style={styles.noNameCtaText}>Go to Profile</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          {currentUserRank ? (
            <View style={styles.myRankCard}>
              <View style={styles.myRankLeft}>
                <Text style={styles.myRankLabel}>Your Rank</Text>
                <Text style={styles.myRankNumber}>#{currentUserRank.rank}</Text>
              </View>
              <View style={styles.myRankRight}>
                <View style={[styles.scorePill, { backgroundColor: getScoreBg(currentUserRank.preparedness_score) }]}>
                  <Text style={[styles.scorePillText, { color: getScoreColor(currentUserRank.preparedness_score) }]}>
                    {Math.round(currentUserRank.preparedness_score)}%
                  </Text>
                </View>
                {currentUserRank.streak_count > 0 ? (
                  <View style={styles.streakPill}>
                    <Flame color={colors.amber} size={13} />
                    <Text style={styles.streakText}>{currentUserRank.streak_count}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {leaderboardQuery.isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={Colors.primary} size="large" />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={leaderboardQuery.isFetching && !leaderboardQuery.isLoading}
                  onRefresh={handleRefresh}
                  tintColor={Colors.primary}
                />
              }
            >
              {entries.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>No learners on the leaderboard yet.</Text>
                  <Text style={styles.emptySubtext}>Be the first to set a score!</Text>
                </View>
              ) : (
                entries.map((entry) => {
                  const isMe = entry.is_current_user;
                  const decoration = getRankDecoration(entry.rank);
                  return (
                    <View
                      key={`${entry.rank}-${entry.display_name}`}
                      style={[
                        styles.row,
                        isMe ? styles.rowHighlight : null,
                        decoration ? { backgroundColor: decoration.bg } : null,
                        isMe && !decoration ? styles.rowHighlight : null,
                      ]}
                      testID={`leaderboard-row-${entry.rank}`}
                    >
                      <View style={styles.rankWrap}>
                        {decoration ? (
                          <View style={styles.rankIcon}>{decoration.icon}</View>
                        ) : (
                          <Text style={styles.rankNumber}>{entry.rank}</Text>
                        )}
                      </View>

                      <View style={styles.nameWrap}>
                        <Text style={[styles.playerName, isMe ? styles.playerNameMe : null]} numberOfLines={1}>
                          {entry.display_name}
                        </Text>
                        {isMe ? <Text style={styles.youLabel}>You</Text> : null}
                      </View>

                      <View style={styles.rowRight}>
                        <View style={[styles.scorePill, { backgroundColor: getScoreBg(entry.preparedness_score) }]}>
                          <Text style={[styles.scorePillText, { color: getScoreColor(entry.preparedness_score) }]}>
                            {Math.round(entry.preparedness_score)}%
                          </Text>
                        </View>
                        {entry.streak_count > 0 ? (
                          <View style={styles.streakSmall}>
                            <Flame color={colors.amber} size={11} />
                            <Text style={styles.streakSmallText}>{entry.streak_count}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  levelPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Colors.primarySoft,
  },
  levelPillText: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  myRankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 18,
    borderRadius: 20,
    backgroundColor: Colors.primary,
  },
  myRankLeft: {
    gap: 2,
  },
  myRankLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.6)',
  },
  myRankNumber: {
    fontSize: 28,
    fontWeight: '900' as const,
    color: colors.white,
    letterSpacing: -0.5,
  },
  myRankRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    gap: 6,
    paddingBottom: 40,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 6,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: Colors.surface,
  },
  rowHighlight: {
    backgroundColor: Colors.accentSoft,
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  rankWrap: {
    width: 36,
    alignItems: 'center',
  },
  rankIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumber: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: Colors.textMuted,
  },
  nameWrap: {
    flex: 1,
    marginLeft: 10,
    gap: 1,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  playerNameMe: {
    fontWeight: '800' as const,
    color: Colors.accent,
  },
  youLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scorePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  scorePillText: {
    fontSize: 13,
    fontWeight: '800' as const,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  streakText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.white,
  },
  streakSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  streakSmallText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: colors.amber,
  },
  noNameWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noNameCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noNameTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  noNameBody: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 21,
  },
  noNameCta: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    marginTop: 4,
  },
  noNameCtaText: {
    color: colors.white,
    fontWeight: '700' as const,
    fontSize: 15,
  },
});
