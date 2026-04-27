import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Calendar,
  Camera,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  FileText,
  Flame,
  Gift,
  Image as ImageIcon,
  Info,
  LogOut,
  Pencil,
  Star,
  Trash2,
  Trophy,
  X,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { AppHeader } from '@/components/AppHeader';
import { AvatarImage } from '@/components/AvatarImage';

import Colors from '@/constants/colors';
import { colors, spacing } from '@/theme';
import { presentRevenueCatPaywall, syncSubscriptionAfterPurchase } from '@/lib/revenuecatPaywall';
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
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  });
}

function formatMonthYear(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    month: 'short', year: 'numeric',
  });
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({
  label,
  children,
  showDivider = true,
  onPress,
}: {
  label: string;
  children: React.ReactNode;
  showDivider?: boolean;
  onPress?: () => void;
}) {
  const inner = (
    <View style={styles.infoRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValueGroup}>{children}</View>
    </View>
  );
  return (
    <>
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button">{inner}</Pressable>
      ) : inner}
      {showDivider && <View style={styles.rowDivider} />}
    </>
  );
}

function TierBadge({ tier, isPaid }: { tier: string; isPaid: boolean }) {
  const bg: string = isPaid ? 'rgba(34,197,94,0.15)' : tier === 'free_trial' ? '#FFF8E1' : Colors.background;
  const textColor: string = isPaid ? '#15803D' : tier === 'free_trial' ? '#F57F17' : Colors.textMuted;
  const label = isPaid ? 'Active' : tier === 'free_trial' ? 'Trial' : 'Free';
  return (
    <View style={[styles.statusPill, { backgroundColor: bg }]}>
      <Text style={[styles.statusPillText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, user, signOut, refreshProfile } = useAuth();
  const { refreshAccess } = useAccess();
  const { leaderboardPercentile } = useHomeData();

  // Avatar edit state
  const [avatarSheetVisible, setAvatarSheetVisible] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);

  // Player identity edit sheet state
  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editTag, setEditTag] = useState('');
  const [tagSaving, setTagSaving] = useState(false);

  // Tier config display names + descriptions
  const tierConfigQuery = useQuery({
    queryKey: ['tier-config'],
    queryFn: async (): Promise<Record<string, { display_name: string; tier_description: string }>> => {
      const { data, error } = await (supabase.from('tier_config' as never) as any)
        .select('tier_name, display_name, tier_description');
      if (error || !data) return {};
      return Object.fromEntries(
        (data as Array<{ tier_name: string; display_name: string; tier_description: string }>).map((r) => [
          r.tier_name, { display_name: r.display_name, tier_description: r.tier_description ?? '' },
        ])
      );
    },
    staleTime: Infinity,
  });

  const tierDisplayName = useCallback(
    (t: string) => tierConfigQuery.data?.[t]?.display_name ?? TIER_DISPLAY_FALLBACK[t] ?? t,
    [tierConfigQuery.data],
  );

  // Derived
  const tier = profile?.subscription_tier ?? 'free';
  const showUpgradeCard = FREE_TIERS.has(tier);
  const isPaid = PAID_TIERS.has(tier);

  const tierDescription = tierConfigQuery.data?.[tier]?.tier_description ?? '';

  // Tooltip state for tier description
  const [tierTooltipVisible, setTierTooltipVisible] = useState(false);
  const tooltipDismissTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTierTooltip = useCallback(() => {
    setTierTooltipVisible(true);
    if (tooltipDismissTimer.current) clearTimeout(tooltipDismissTimer.current);
    tooltipDismissTimer.current = setTimeout(() => setTierTooltipVisible(false), 3000);
  }, []);

  const hideTierTooltip = useCallback(() => {
    if (tooltipDismissTimer.current) clearTimeout(tooltipDismissTimer.current);
    setTierTooltipVisible(false);
  }, []);
  const trialExpiresAt = (profile as Record<string, unknown> | null)
    ?.trial_expires_at as string | null ?? null;
  const trialActive = profile?.trial_active ?? false;

  const displayName = profile?.player_name?.trim() || user?.email?.split('@')[0] || 'You';

  const avatarLetter = useMemo(() => {
    const name = profile?.player_name?.trim();
    if (name) return name[0]!.toUpperCase();
    return (user?.email?.[0] ?? '?').toUpperCase();
  }, [profile?.player_name, user?.email]);

  const examDays = daysUntil(profile?.exam_date);
  const certLabel = [profile?.exam_type?.toUpperCase(), profile?.target_level]
    .filter(Boolean)
    .join(' · ') || null;

  // ── Avatar helpers ───────────────────────────────────────────────────────

  const uploadAvatar = useCallback(async (imageUri: string) => {
    if (!user?.id) return;
    setAvatarUploading(true);
    try {
      // Strip query params before inspecting extension
      const rawExt = (imageUri.split('.').pop() ?? '').split('?')[0].toLowerCase();
      const ext = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt) ? rawExt : 'jpg';
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const filename = `${user.id}/avatar.${ext}`;

      // Read file as base64 via expo-file-system — works reliably on iOS + Android.
      // React Native's Blob polyfill can fail silently with Supabase storage.
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Decode base64 → Uint8Array so Supabase receives raw bytes
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filename, bytes, { contentType: mime, upsert: true });

      if (uploadError) {
        console.error('[Avatar] storage upload error', uploadError);
        throw uploadError;
      }

      // Build public URL with cache-buster so the new photo loads immediately
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filename);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Persist to user_profiles
      const { error: dbError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() } as never)
        .eq('id', user.id);

      if (dbError) {
        console.error('[Avatar] profile update error', dbError);
        throw dbError;
      }

      await refreshProfile();
    } catch (err) {
      console.error('[Avatar] upload failed', err);
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Upload failed', `Could not save your photo.\n\n${msg}`);
    } finally {
      setAvatarUploading(false);
      setAvatarSheetVisible(false);
    }
  }, [user?.id, refreshProfile]);

  const handlePickFromLibrary = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarSheetVisible(false);
      setPendingImageUri(result.assets[0].uri);
    }
  }, []);

  const handleTakePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarSheetVisible(false);
      setPendingImageUri(result.assets[0].uri);
    }
  }, []);

  const handleRemoveAvatar = useCallback(async () => {
    if (!user?.id) return;
    setAvatarUploading(true);
    try {
      await supabase
        .from('user_profiles')
        .update({ avatar_url: null, updated_at: new Date().toISOString() } as never)
        .eq('id', user.id);
      await refreshProfile();
    } catch {
      Alert.alert('Error', 'Could not remove your photo. Please try again.');
    } finally {
      setAvatarUploading(false);
      setAvatarSheetVisible(false);
    }
  }, [user?.id, refreshProfile]);

  // Open edit sheet and pre-fill
  const openEditSheet = useCallback(() => {
    const name = profile?.player_name?.trim() ?? '';
    // Attempt to split existing name into first/last; tag stays as-is
    const parts = name.split(' ');
    setEditFirstName(parts[0] ?? '');
    setEditLastName(parts.slice(1).join(' '));
    setEditTag(name); // current player_name is the tag
    setEditSheetVisible(true);
  }, [profile?.player_name]);

  const handleSaveTag = useCallback(async () => {
    const tag = editTag.trim();
    if (!tag || !user?.id) return;
    setTagSaving(true);
    try {
      await (supabase.from('profiles') as any)
        .update({ player_name: tag })
        .eq('id', user.id);
      await refreshProfile();
      setEditSheetVisible(false);
    } catch {
      Alert.alert('Error', 'Could not save your Wordifi Tag. Please try again.');
    } finally {
      setTagSaving(false);
    }
  }, [editTag, user?.id, refreshProfile]);

  const handleCopyEmail = useCallback(async () => {
    if (user?.email) await Clipboard.setStringAsync(user.email);
  }, [user?.email]);

  const handleReferFriend = useCallback(async () => {
    const { Share } = await import('react-native');
    const code = profile?.referral_code;
    if (!code) return;
    await Share.share({
      message: `Join me on Wordifi and use my referral code: ${code}\nDownload: wordifi.app`,
    });
  }, [profile?.referral_code]);

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  const navigateUpgrade = useCallback(async () => {
    try {
      await presentRevenueCatPaywall(async () => {
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
      {/* Brand header */}
      <AppHeader
        rightElement={
          <Pressable
            onPress={handleSignOut}
            style={styles.logoutBtn}
            accessibilityLabel="Sign out"
            hitSlop={8}
          >
            <LogOut size={22} color={Colors.textMuted} />
          </Pressable>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
      >

        {/* ── Identity block ─────────────────────────────────────────── */}
        <View style={styles.identityBlock}>
          <Pressable
            onPress={() => setAvatarSheetVisible(true)}
            accessibilityLabel="Edit profile photo"
            accessibilityRole="button"
            style={styles.avatarWrap}
          >
            <AvatarImage
              uri={profile?.avatar_url}
              initial={avatarLetter}
              size={88}
              bgColor={Colors.primary}
              textColor="#FFFFFF"
              fontSize={36}
            />
            {/* Camera badge */}
            <View style={styles.cameraBadge}>
              <Camera size={14} color="#FFFFFF" />
            </View>
          </Pressable>

          {/* Name + pen */}
          <Pressable
            style={styles.nameRow}
            onPress={openEditSheet}
            accessibilityLabel="Edit player identity"
            accessibilityRole="button"
          >
            <Text style={styles.userName}>{displayName}</Text>
            <Pencil size={16} color={Colors.textMuted} style={styles.namePen} />
          </Pressable>

          {/* Certification pill */}
          {certLabel && (
            <View style={styles.certPill}>
              <Text style={styles.certPillText}>{certLabel}</Text>
            </View>
          )}
        </View>

        {/* ── Countdown card ─────────────────────────────────────────── */}
        {examDays !== null && examDays > 0 && (
          <View style={styles.countdownCard}>
            <Text style={styles.countdownNumber}>{examDays}</Text>
            <Text style={styles.countdownLabel}>
              days to your {profile?.target_level} {profile?.exam_type?.toUpperCase()} exam
            </Text>
          </View>
        )}

        {/* ── Progress card ──────────────────────────────────────────── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Your Progress</Text>
          <View style={styles.progressGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statEmoji}>🔥</Text>
              <Text style={styles.statValue}>{profile?.streak_count ?? 0}</Text>
              <Text style={styles.statName}>days streak</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statEmoji}>⭐</Text>
              <Text style={styles.statValue}>{profile?.xp_total ?? 0}</Text>
              <Text style={styles.statName}>XP earned</Text>
            </View>
            <View style={styles.statItem}>
              <FileText size={20} color={Colors.primary} />
              <Text style={styles.statValue}>
                {(profile as any)?.total_questions_answered ?? '—'}
              </Text>
              <Text style={styles.statName}>questions</Text>
            </View>
            <View style={styles.statItem}>
              <Clock size={20} color={Colors.primary} />
              <Text style={styles.statValue}>
                {(profile as any)?.total_practice_minutes
                  ? `${Math.round((profile as any).total_practice_minutes / 60)}h`
                  : '—'}
              </Text>
              <Text style={styles.statName}>time practiced</Text>
            </View>
          </View>
        </View>

        {/* ── Profile details card ────────────────────────────────────── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Profile</Text>

          <InfoRow label="Email">
            <Text style={styles.rowValue} numberOfLines={1}>{user?.email ?? '—'}</Text>
            <Pressable onPress={handleCopyEmail} hitSlop={8} accessibilityLabel="Copy email">
              <Copy size={16} color={Colors.textMuted} />
            </Pressable>
          </InfoRow>

          <InfoRow
            label="Level"
            onPress={() => router.push('/profile-setup' as never)}
          >
            <View style={styles.levelPill}>
              <Text style={styles.levelPillText}>{profile?.target_level ?? '—'}</Text>
            </View>
            <Pencil size={14} color={Colors.textMuted} />
          </InfoRow>

          <InfoRow
            label="Target exam"
            onPress={() => router.push('/profile-setup' as never)}
          >
            <Text style={styles.rowValue}>{profile?.exam_type ?? '—'}</Text>
            <Pencil size={14} color={Colors.textMuted} />
          </InfoRow>

          <InfoRow
            label="Exam date"
            onPress={() => router.push('/profile-setup' as never)}
          >
            <Text style={styles.rowValue}>{formatLong(profile?.exam_date)}</Text>
            <Calendar size={14} color={Colors.textMuted} />
          </InfoRow>

          <InfoRow
            label="Notifications"
            showDivider={false}
            onPress={() => router.push('/notification-settings' as never)}
          >
            <Pencil size={14} color={Colors.textMuted} />
          </InfoRow>
        </View>

        {/* ── Upgrade card (conditional) ──────────────────────────────── */}
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
                  <Text style={styles.trialText}>Trial ends {formatShort(trialExpiresAt)}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.upgradeArrow}>
              <ChevronRight size={20} color={Colors.white} />
            </View>
          </Pressable>
        )}

        {/* ── Subscription card ───────────────────────────────────────── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Subscription</Text>

          <InfoRow label="Plan">
            <Text style={styles.rowValue}>{tierDisplayName(tier)}</Text>
            {tierDescription ? (
              <Pressable onPress={showTierTooltip} hitSlop={8} accessibilityLabel="About this plan">
                <Info size={16} color={colors.primaryBlue} />
              </Pressable>
            ) : null}
            <TierBadge tier={tier} isPaid={isPaid} />
          </InfoRow>

          {profile?.subscription_valid_until && (
            <InfoRow label="Renews">
              <Text style={styles.rowValue}>{formatLong(profile.subscription_valid_until)}</Text>
            </InfoRow>
          )}

          <InfoRow label="Member since" showDivider={false}>
            <Text style={styles.rowValue}>{formatMonthYear(profile?.created_at)}</Text>
          </InfoRow>

          {/* Action rows */}
          <View style={styles.actionDivider} />

          <Pressable
            style={styles.actionRow}
            onPress={navigateUpgrade}
            accessibilityRole="button"
          >
            <CreditCard size={20} color={Colors.primary} />
            <Text style={styles.actionLabel}>View subscription options</Text>
            <ChevronRight size={16} color={Colors.textMuted} />
          </Pressable>

          {profile?.referral_code && (
            <>
              <View style={styles.rowDivider} />
              <Pressable
                style={styles.actionRow}
                onPress={handleReferFriend}
                accessibilityRole="button"
              >
                <Gift size={20} color={Colors.accent} />
                <Text style={styles.actionLabel}>Refer a friend</Text>
                <View style={styles.refCodePill}>
                  <Text style={styles.refCodeText}>{profile.referral_code}</Text>
                </View>
                <ChevronRight size={16} color={Colors.textMuted} />
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      {/* ── Tier description tooltip ────────────────────────────────── */}
      <Modal
        visible={tierTooltipVisible}
        animationType="fade"
        transparent
        onRequestClose={hideTierTooltip}
      >
        <Pressable style={styles.tooltipBackdrop} onPress={hideTierTooltip}>
          <View style={styles.tooltipCard}>
            <Text style={styles.tooltipTitle}>{tierDisplayName(tier)}</Text>
            <Text style={styles.tooltipBody}>{tierDescription}</Text>
          </View>
        </Pressable>
      </Modal>

      {/* ── Avatar Edit Sheet ───────────────────────────────────────── */}
      <Modal
        visible={avatarSheetVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAvatarSheetVisible(false)}
      >
        <View style={styles.modalOuter}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setAvatarSheetVisible(false)}
          />
          <View style={[styles.avatarSheet, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Profile photo</Text>
            <Pressable
              onPress={() => setAvatarSheetVisible(false)}
              hitSlop={8}
              style={styles.sheetClose}
              accessibilityLabel="Close"
            >
              <X size={20} color={Colors.textMuted} />
            </Pressable>
          </View>

          <Pressable
            style={[styles.avatarOption, avatarUploading && { opacity: 0.5 }]}
            onPress={handleTakePhoto}
            disabled={avatarUploading}
            accessibilityRole="button"
          >
            <View style={styles.avatarOptionIcon}>
              <Camera size={20} color={Colors.primary} />
            </View>
            <Text style={styles.avatarOptionText}>Take a photo</Text>
          </Pressable>

          <View style={styles.rowDivider} />

          <Pressable
            style={[styles.avatarOption, avatarUploading && { opacity: 0.5 }]}
            onPress={handlePickFromLibrary}
            disabled={avatarUploading}
            accessibilityRole="button"
          >
            <View style={styles.avatarOptionIcon}>
              <ImageIcon size={20} color={Colors.primary} />
            </View>
            <Text style={styles.avatarOptionText}>Choose from library</Text>
          </Pressable>

          {profile?.avatar_url ? (
            <>
              <View style={styles.rowDivider} />
              <Pressable
                style={[styles.avatarOption, avatarUploading && { opacity: 0.5 }]}
                onPress={handleRemoveAvatar}
                disabled={avatarUploading}
                accessibilityRole="button"
              >
                <View style={styles.avatarOptionIcon}>
                  <Trash2 size={20} color="#EF4444" />
                </View>
                <Text style={[styles.avatarOptionText, { color: '#EF4444' }]}>
                  {avatarUploading ? 'Removing…' : 'Remove photo'}
                </Text>
              </Pressable>
            </>
          ) : null}
          </View>
        </View>
      </Modal>

      {/* ── Crop Preview Modal ─────────────────────────────────────── */}
      <Modal
        visible={!!pendingImageUri}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setPendingImageUri(null)}
      >
        <View style={[styles.cropScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          {/* Top bar */}
          <View style={styles.cropTopBar}>
            <Pressable
              onPress={() => setPendingImageUri(null)}
              style={styles.cropBackBtn}
              hitSlop={8}
              accessibilityLabel="Back"
            >
              <ArrowLeft size={22} color={Colors.textBody} />
            </Pressable>
            <Text style={styles.cropTitle}>
              Crop <Text style={styles.cropOptional}>(Optional)</Text>
            </Text>
            <Pressable
              onPress={async () => {
                if (pendingImageUri) {
                  setPendingImageUri(null);
                  await uploadAvatar(pendingImageUri);
                }
              }}
              style={styles.cropDoneBtn}
              disabled={avatarUploading}
              hitSlop={8}
              accessibilityLabel="Done"
            >
              <Text style={[styles.cropDoneText, avatarUploading && { opacity: 0.4 }]}>
                {avatarUploading ? 'Saving…' : 'Done'}
              </Text>
            </Pressable>
          </View>

          {/* Instruction */}
          <Text style={styles.cropHint}>
            Looking good? Tap Done to save, or go back to re-crop.
          </Text>

          {/* Image preview */}
          <View style={styles.cropImageWrap}>
            {pendingImageUri ? (
              <Image
                source={{ uri: pendingImageUri }}
                style={styles.cropImage}
                resizeMode="cover"
              />
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ── Player Identity Edit Sheet ──────────────────────────────── */}
      <Modal
        visible={editSheetVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditSheetVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOuter}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setEditSheetVisible(false)} />
          <View style={[styles.editSheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.sheetHandle} />

            {/* Sheet header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Player Identity</Text>
              <Pressable
                onPress={() => setEditSheetVisible(false)}
                hitSlop={8}
                style={styles.sheetClose}
                accessibilityLabel="Close"
              >
                <X size={20} color={Colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.sheetSubtitle}>
              Your real name is private. Your Wordifi Tag appears on the leaderboard.
            </Text>

            {/* Name fields */}
            <Text style={styles.fieldLabel}>Your name</Text>
            <View style={styles.nameFields}>
              <TextInput
                style={[styles.input, styles.inputHalf]}
                value={editFirstName}
                onChangeText={setEditFirstName}
                placeholder="First name"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
                returnKeyType="next"
              />
              <TextInput
                style={[styles.input, styles.inputHalf]}
                value={editLastName}
                onChangeText={setEditLastName}
                placeholder="Last name"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>

            {/* Wordifi Tag */}
            <Text style={styles.fieldLabel}>
              Wordifi Tag{' '}
              <Text style={styles.fieldLabelRequired}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={editTag}
              onChangeText={setEditTag}
              placeholder="e.g. GoetheSlayer99"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSaveTag}
            />
            <Text style={styles.fieldHint}>
              This is how rivals see you on the leaderboard. Make it legendary.
            </Text>

            {/* Save */}
            <Pressable
              style={[styles.saveBtn, (!editTag.trim() || tagSaving) && styles.saveBtnDisabled]}
              onPress={handleSaveTag}
              disabled={!editTag.trim() || tagSaving}
              accessibilityLabel="Save player identity"
            >
              <Text style={styles.saveBtnText}>
                {tagSaving ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_RADIUS = 20;
const CARD_PADDING_H = 20;
const CARD_PADDING_V = 24;
const CARD_MARGIN_H = 24;
const CARD_MARGIN_B = 24;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 32,
  },

  // Header actions
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: CARD_MARGIN_H,
    paddingTop: 16,
    paddingBottom: 0,
  },
  logoutBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Identity block
  identityBlock: {
    alignItems: 'center',
    paddingHorizontal: CARD_MARGIN_H,
    paddingBottom: 16,
  },
  avatarWrap: {
    width: 88,
    height: 88,
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 6,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  userName: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 26,
    color: Colors.textBody,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  namePen: {
    marginTop: 2,
  } as object,
  certPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  certPillText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 14,
    color: Colors.textMuted,
  },

  // Countdown card
  countdownCard: {
    marginHorizontal: CARD_MARGIN_H,
    marginBottom: CARD_MARGIN_B,
    backgroundColor: '#ECF2FE',
    borderRadius: CARD_RADIUS,
    paddingVertical: 24,
    paddingHorizontal: CARD_PADDING_H,
    alignItems: 'center',
  },
  countdownNumber: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 56,
    color: '#F59E0B',
    lineHeight: 60,
    letterSpacing: -1,
    marginBottom: 8,
  },
  countdownLabel: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    color: Colors.textMuted,
  },

  // Section card shell
  sectionCard: {
    marginHorizontal: CARD_MARGIN_H,
    marginBottom: CARD_MARGIN_B,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: CARD_PADDING_H,
    paddingVertical: CARD_PADDING_V,
    shadowColor: '#374151',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 20,
    elevation: 1,
  },
  sectionLabel: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 24,
  },

  // Progress grid
  progressGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 0,
  },
  statItem: {
    width: '50%',
    alignItems: 'center',
    paddingBottom: 28,
    gap: 8,
  },
  statEmoji: {
    fontSize: 22,
    lineHeight: 26,
  },
  statValue: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 32,
    color: Colors.primary,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  statName: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 14,
    color: Colors.textMuted,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  rowLabel: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    color: Colors.textMuted,
  },
  rowValueGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowValue: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 15,
    color: Colors.textBody,
    flexShrink: 1,
  },
  rowDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },

  // Level pill
  levelPill: {
    backgroundColor: '#ECF2FE',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  levelPillText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 14,
    color: Colors.primary,
    lineHeight: 18,
  },

  // Status pill (subscription)
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 12,
    lineHeight: 16,
  },

  // Action rows
  actionDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: 20,
    marginBottom: 0,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 20,
  },
  actionLabel: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 15,
    color: Colors.textBody,
    flex: 1,
  },

  // Referral code pill
  refCodePill: {
    backgroundColor: Colors.background,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  refCodeText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 12,
    color: Colors.primary,
  },

  // Upgrade card
  upgradeCard: {
    backgroundColor: Colors.primary,
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING_V,
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
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 18,
    color: Colors.white,
  },
  upgradeSubtitle: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
  },
  trialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  trialText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 12,
    color: colors.flagGold,
  },
  upgradeArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Avatar sheet
  avatarSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    shadowColor: '#374151',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 12,
  },
  avatarOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 20,
  },
  avatarOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECF2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOptionText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 16,
    color: Colors.textBody,
    flex: 1,
  },

  // Edit sheet modal
  modalOuter: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,31,61,0.4)',
  },
  editSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    shadowColor: '#374151',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
    alignSelf: 'center',
    marginBottom: 20,
    opacity: 0.35,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 22,
    color: Colors.textBody,
    lineHeight: 28,
  },
  sheetClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSubtitle: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 20,
    marginBottom: 24,
  },

  // Form fields
  fieldLabel: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 13,
    color: Colors.textBody,
    marginBottom: 8,
  },
  fieldLabelRequired: {
    color: Colors.primary,
  },
  nameFields: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 16,
    color: Colors.textBody,
    backgroundColor: '#FFFFFF',
    marginBottom: 0,
  },
  inputHalf: {
    flex: 1,
  },
  fieldHint: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 8,
    marginBottom: 28,
    lineHeight: 18,
  },

  // Save button
  saveBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 17,
    color: '#FFFFFF',
  },

  // Crop preview screen
  cropScreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  cropTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000',
  },
  cropBackBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 18,
    color: '#FFFFFF',
  },
  cropOptional: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
  },
  cropDoneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cropDoneText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 16,
    color: Colors.primary,
  },
  cropHint: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  cropImageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
  },
  cropImage: {
    width: '100%',
    height: '100%',
  },

  // Tier description tooltip
  tooltipBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  tooltipCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 8,
    maxWidth: 340,
    width: '100%',
    ...Platform.select({
      ios:     { shadowColor: '#0F1F3D', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 24 },
      android: { elevation: 8 },
    }),
  },
  tooltipTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 15,
    color: '#0A0E1A',
  },
  tooltipBody: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
});
