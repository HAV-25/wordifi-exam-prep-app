/**
 * PaywallBottomSheet — Soft-nudge intermediary modal shown before the
 * full Adapty paywall for contextual upgrade prompts.
 *
 * "Unlock Unlimited" → calls onUnlock() (parent opens PaywallModal / Adapty)
 * "Maybe Tomorrow"   → calls onDismiss()
 *
 * Analytics emitted here: paywall_viewed, paywall_dismissed, paywall_cta_tapped
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Flame, Zap } from 'lucide-react-native';

import { track } from '@/lib/track';
import { useAuth } from '@/providers/AuthProvider';
import { useAccess } from '@/providers/AccessProvider';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PaywallTriggerContext =
  | 'stream_80_free'
  | 'stream_80_trial'
  | 'stream_limit_free'
  | 'schreiben_locked'
  | 'sprechen_locked'
  | 'mock_locked'
  | 'streak_req_exceeds_free';

export interface PaywallBottomSheetProps {
  visible: boolean;
  triggerContext: PaywallTriggerContext;
  /** stream_80_*: questions used so far today (e.g. 4) */
  streamUsed?: number;
  /** stream_80_free: access.stream_questions_per_day (daily cap, e.g. 5)
   *  stream_80_trial: 20
   *  streak_req_exceeds_free: today.requirement from gameState */
  streamTotal?: number;
  /** streak.current_days from gameState */
  streakDays?: number;
  /** today.requirement from gameState (for streak_req_exceeds_free) */
  streakRequirement?: number;
  /** getBadgeByStreak(streakDays, ladder)?.name — resolved by parent */
  badgeName?: string;
  onUnlock: () => void;
  onDismiss: () => void;
}

// ─── Copy ────────────────────────────────────────────────────────────────────

const PAYWALL_COPY: Record<
  PaywallTriggerContext,
  {
    headline: string | ((args: { n?: number }) => string);
    subline: string | ((args: { badge?: string; remaining?: number }) => string);
    indicator: 'stream_progress' | 'streak_progress' | 'none';
    show_badge: boolean;
  }
> = {
  stream_80_free: {
    headline: '1 question left today',
    subline: ({ badge = '' }) =>
      badge
        ? `Unlock unlimited practice and keep your ${badge} streak going.`
        : 'Unlock unlimited practice and keep your streak going.',
    indicator: 'stream_progress',
    show_badge: true,
  },
  stream_limit_free: {
    headline: "Don't stop now.",
    subline: () =>
      "You've used all your free questions for today. Upgrade to practise unlimited questions and keep your streak alive.",
    indicator: 'stream_progress',
    show_badge: true,
  },
  stream_80_trial: {
    headline: '4 questions left today',
    subline: () => "You're on fire. Keep unlimited practice after your trial ends.",
    indicator: 'stream_progress',
    show_badge: false,
  },
  schreiben_locked: {
    headline: 'Write to pass the exam',
    subline: () => 'Most candidates lose marks on Schreiben. Unlock full access.',
    indicator: 'none',
    show_badge: false,
  },
  sprechen_locked: {
    headline: 'Practice speaking aloud',
    subline: () => 'The exam section most candidates fear. Unlock full access.',
    indicator: 'none',
    show_badge: false,
  },
  mock_locked: {
    headline: 'Full mock tests mirror the real exam',
    subline: () => 'Unlimited mocks + detailed Readiness tracking.',
    indicator: 'none',
    show_badge: false,
  },
  streak_req_exceeds_free: {
    headline: ({ n = 0 }) => `Today's streak requirement: ${n} questions`,
    subline: ({ badge = '', remaining = 0 }) =>
      `You've used your 5 free. ${remaining} more to keep ${badge}.`,
    indicator: 'streak_progress',
    show_badge: true,
  },
};

// ─── Colors ──────────────────────────────────────────────────────────────────

const C = {
  overlay:   'rgba(17,24,39,0.45)',
  sheet:     '#FFFFFF',
  handle:    '#94A3B8',
  primary:   '#2B70EF',
  fg:        '#374151',
  muted:     '#94A3B8',
  streakBg:  '#FEFCE8',
  streakText:'#92400E',
  barFilled: '#2B70EF',
  barEmpty:  '#E2E8F0',
} as const;

// ─── Component ───────────────────────────────────────────────────────────────

export function PaywallBottomSheet({
  visible,
  triggerContext,
  streamUsed,
  streamTotal,
  streakDays,
  streakRequirement,
  badgeName,
  onUnlock,
  onDismiss,
}: PaywallBottomSheetProps) {
  const { profile } = useAuth();
  const { access } = useAccess();
  const insets = useSafeAreaInsets();

  const [modalVisible, setModalVisible] = useState(false);
  const slideAnim  = useRef(new Animated.Value(600)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const analyticsFiredRef = useRef(false);

  // ── Open / close animation ─────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      analyticsFiredRef.current = false;
      setModalVisible(true);
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 1, duration: 250, useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0, tension: 60, friction: 12, useNativeDriver: true,
        }),
      ]).start(() => {
        if (!analyticsFiredRef.current) {
          analyticsFiredRef.current = true;
          track('paywall_viewed', {
            trigger_context: triggerContext,
            user_tier: access.tier,
            cefr_level: profile?.target_level,
            current_streak_days: streakDays ?? 0,
            current_badge_rank: profile?.xp_total ?? 0, // badge.current_rank not yet in profile type
          });
        }
      });
    } else {
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 0, duration: 180, useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 600, duration: 220, useNativeDriver: true,
        }),
      ]).start(() => setModalVisible(false));
    }
  }, [visible]);

  // ── Derived copy ──────────────────────────────────────────────────────────
  const copy = PAYWALL_COPY[triggerContext];

  const headline =
    typeof copy.headline === 'function'
      ? copy.headline({ n: streakRequirement ?? 0 })
      : copy.headline;

  const remaining =
    streakRequirement != null ? Math.max(0, streakRequirement - 5) : 0;

  const subline =
    typeof copy.subline === 'function'
      ? copy.subline({ badge: badgeName ?? '', remaining })
      : copy.subline;

  // ── Progress bars ─────────────────────────────────────────────────────────
  function renderBars() {
    if (copy.indicator === 'none') return null;

    let filled: number;
    let total: number;

    if (copy.indicator === 'stream_progress') {
      total  = streamTotal ?? 5;
      filled = streamUsed  ?? 0;
    } else {
      // streak_progress: show 5 filled out of streakRequirement
      total  = streakRequirement ?? 6;
      filled = Math.min(5, total);
    }

    return (
      <View style={s.barsWrap}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={[s.bar, { backgroundColor: i < filled ? C.barFilled : C.barEmpty }]}
          />
        ))}
      </View>
    );
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleUnlock() {
    track('paywall_cta_tapped', { trigger_context: triggerContext });
    onUnlock();
  }

  function handleDismiss() {
    track('paywall_dismissed', { trigger_context: triggerContext });
    onDismiss();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (!modalVisible) return null;

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      {/* Overlay */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss}>
        <Animated.View style={[StyleSheet.absoluteFill, s.overlay, { opacity: overlayAnim }]} />
      </Pressable>

      {/* Sheet */}
      <Animated.View
        style={[
          s.sheet,
          { transform: [{ translateY: slideAnim }], paddingBottom: Math.max(insets.bottom, 16) + 24 },
        ]}
        pointerEvents="box-none"
      >
        {/* Drag handle */}
        <View style={s.handle} />

        {/* Usage indicator label */}
        {copy.indicator !== 'none' && (
          <Text style={s.indicatorLabel}>
            {copy.indicator === 'stream_progress'
              ? `${streamUsed ?? 0}/${streamTotal ?? 5} questions used today`
              : `${Math.min(5, streakRequirement ?? 6)}/${streakRequirement ?? 6} streak questions done`}
          </Text>
        )}

        {/* Progress bars */}
        {renderBars()}

        {/* Headline */}
        <Text style={s.headline}>{headline}</Text>

        {/* Subline */}
        <Text style={s.subline}>{subline}</Text>

        {/* Streak nudge — shown for all show_badge contexts */}
        {copy.show_badge ? (
          <View style={s.streakNudge}>
            <Flame color={C.streakText} size={20} />
            <Text style={s.streakNudgeText}>
              {triggerContext === 'streak_req_exceeds_free'
                ? `Upgrade to keep your ${badgeName || 'streak'} alive.`
                : badgeName
                ? `Your streak is safe — upgrade before midnight to keep ${badgeName}.`
                : 'Your streak is safe — upgrade before midnight to keep it alive.'}
            </Text>
          </View>
        ) : null}

        {/* Primary CTA */}
        <Pressable
          style={({ pressed }) => [s.primaryCta, pressed && { opacity: 0.88 }]}
          onPress={handleUnlock}
        >
          <Zap color="#FFFFFF" size={20} />
          <Text style={s.primaryCtaText}>Unlock Unlimited</Text>
        </Pressable>

        {/* Secondary CTA */}
        <Pressable style={s.secondaryCta} onPress={handleDismiss}>
          <Text style={s.secondaryCtaText}>Maybe Tomorrow</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    backgroundColor: C.overlay,
  },

  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.sheet,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
      },
      android: { elevation: 12 },
    }),
  },

  handle: {
    width: 40,
    height: 4,
    backgroundColor: C.handle,
    borderRadius: 4,
    marginBottom: 24,
  },

  indicatorLabel: {
    fontFamily: 'NunitoSans_700Bold',
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    marginBottom: 10,
  },

  barsWrap: {
    flexDirection: 'row',
    gap: 6,
    width: '100%',
    marginBottom: 28,
  },

  bar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },

  headline: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 32,
    color: C.fg,
    textAlign: 'center',
    letterSpacing: -1,
    marginBottom: 10,
  },

  subline: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
    marginBottom: 24,
  },

  streakNudge: {
    width: '100%',
    backgroundColor: C.streakBg,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 28,
  },

  streakNudgeText: {
    flex: 1,
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 14,
    color: C.streakText,
    lineHeight: 21,
  },

  primaryCta: {
    width: '100%',
    backgroundColor: C.primary,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },

  primaryCtaText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },

  secondaryCta: {
    paddingVertical: 8,
  },

  secondaryCtaText: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    color: C.muted,
    textAlign: 'center',
  },
});
