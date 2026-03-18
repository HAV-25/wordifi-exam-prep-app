import { router } from 'expo-router';
import { Award, CalendarDays, GraduationCap, LogOut, TrendingUp } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { LevelBadge } from '@/components/LevelBadge';
import { ScoreRing } from '@/components/ScoreRing';
import { StreakBadge } from '@/components/StreakBadge';
import Colors from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';

export default function ProfileScreen() {
  const { profile, user, signOut, isSigningOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/auth');
    } catch (error) {
      console.log('ProfileScreen signOut error', error);
      Alert.alert('Wordifi', 'Something went wrong. Please check your connection.');
    }
  };

  if (!profile) {
    return (
      <SafeAreaView style={styles.emptyWrap}>
        <EmptyState title="Set up your profile to start practising." description="Complete setup to unlock tailored listening and reading sessions." actionLabel="Complete Setup" onActionPress={() => router.push('/onboarding')} testID="profile-empty-state" />
      </SafeAreaView>
    );
  }

  const progressToNextMilestone = Math.min(100, ((profile.xp_total % 50) / 50) * 100);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Pressable accessibilityLabel="Change level" onPress={() => router.push('/onboarding')} style={styles.inlineButton} testID="change-level-button">
            <Text style={styles.inlineButtonText}>Change Level</Text>
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.email}>{user?.email ?? 'wordifi@user.com'}</Text>
            <LevelBadge level={profile.target_level ?? 'A1'} />
            <Text style={styles.meta}>Target exam: {profile.exam_type?.toUpperCase() ?? 'TELC'} {profile.target_level ?? 'A1'}{profile.exam_date ? ` · ${profile.exam_date}` : ''}</Text>
          </View>
          <ScoreRing label="Readiness" score={profile.preparedness_score ?? 0} size={92} />
        </View>

        <View style={styles.row}>
          <StreakBadge count={profile.streak_count ?? 0} />
          <View style={styles.xpBadge}><Text style={styles.xpText}>⭐ {profile.xp_total} XP</Text></View>
        </View>

        <View style={styles.insightCard}>
          <View style={styles.insightHeader}><TrendingUp color={Colors.primary} size={18} /><Text style={styles.insightTitle}>Progress insights</Text></View>
          <Text style={styles.insightBody}>You&apos;re {50 - (profile.xp_total % 50)} XP away from your next 50 XP milestone.</Text>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progressToNextMilestone}%` }]} /></View>
        </View>

        <View style={styles.listCard}>
          <View style={styles.infoRow}><Award color={Colors.primary} size={18} /><Text style={styles.infoText}>Preparedness score: {Math.round(profile.preparedness_score ?? 0)} / 100</Text></View>
          <View style={styles.infoRow}><GraduationCap color={Colors.primary} size={18} /><Text style={styles.infoText}>Target level: {profile.target_level ?? 'A1'}</Text></View>
          <View style={styles.infoRow}><CalendarDays color={Colors.primary} size={18} /><Text style={styles.infoText}>Exam date: {profile.exam_date ?? 'Not set yet'}</Text></View>
        </View>

        <Pressable accessibilityLabel="Sign out" disabled={isSigningOut} onPress={handleSignOut} style={styles.signOutButton} testID="sign-out-button">
          {isSigningOut ? <ActivityIndicator color={Colors.surface} /> : <><LogOut color={Colors.surface} size={18} /><Text style={styles.signOutText}>Sign Out</Text></>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  emptyWrap: { flex: 1, backgroundColor: Colors.background, padding: 20, justifyContent: 'center' },
  content: { padding: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 30, fontWeight: '800', color: Colors.primary },
  inlineButton: { minHeight: 40, paddingHorizontal: 12, justifyContent: 'center' },
  inlineButtonText: { color: Colors.primary, fontWeight: '700' },
  heroCard: { backgroundColor: Colors.surface, borderRadius: 24, borderWidth: 1, borderColor: Colors.border, padding: 18, flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  heroLeft: { flex: 1, gap: 10 },
  email: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  meta: { fontSize: 14, color: Colors.textMuted },
  row: { flexDirection: 'row', gap: 10 },
  xpBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center' },
  xpText: { color: Colors.primary, fontWeight: '700' },
  insightCard: { backgroundColor: Colors.primary, borderRadius: 24, padding: 18, gap: 12 },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  insightTitle: { color: Colors.surface, fontWeight: '800', fontSize: 17 },
  insightBody: { color: 'rgba(255,255,255,0.82)', lineHeight: 22 },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: Colors.accent },
  listCard: { backgroundColor: Colors.surface, borderRadius: 24, borderWidth: 1, borderColor: Colors.border, padding: 18, gap: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  signOutButton: { minHeight: 52, borderRadius: 26, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  signOutText: { color: Colors.surface, fontWeight: '800', fontSize: 16 },
});
