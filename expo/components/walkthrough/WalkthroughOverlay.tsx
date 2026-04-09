import { router } from 'expo-router';
import { Star, Trophy, Zap } from 'lucide-react-native';
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, componentSizes } from '@/theme';
import { SpotlightCutout } from './SpotlightCutout';
import { TooltipBubble } from './TooltipBubble';
import {
  TOTAL_STEPS,
  WALKTHROUGH_STEPS,
  WalkthroughContext,
  type TargetRect,
} from './WalkthroughProvider';

const { width: SW, height: SH } = Dimensions.get('window');

// Tab bar positions: 4 tabs equally distributed
const TAB_BAR_HEIGHT = componentSizes.tabBarHeight; // 64
const TABS = ['home', 'stream', 'sections', 'complete-test'];

function getTabRect(tabIndex: number, safeAreaBottom: number): TargetRect {
  const tabW = SW / 4;
  return {
    x: tabW * tabIndex,
    y: SH - TAB_BAR_HEIGHT - safeAreaBottom,
    width: tabW,
    height: TAB_BAR_HEIGHT,
  };
}

// Map step index → how to get its TargetRect
// Steps 0-2: home screen refs. Steps 3-5: tab bar calculations. Step 6: no spotlight.
const HOME_STEP_KEYS = ['profile-avatar', 'readiness-score', 'stats-chips'];

// ─── Main overlay ─────────────────────────────────────────────────────────────

export function WalkthroughOverlay() {
  const ctx = useContext(WalkthroughContext);
  const insets = useSafeAreaInsets();

  const [spotlightRect, setSpotlightRect] = useState<TargetRect | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const isTransitioningRef = useRef(false);

  const prevStepRef = useRef(-1);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
  }, []);

  // ── Get the TargetRect for a given step ──────────────────────────────────────
  const getRectForStep = useCallback(
    (step: number): Promise<TargetRect | null> => {
      if (!ctx) return Promise.resolve(null);
      if (step >= TOTAL_STEPS - 1) return Promise.resolve(null); // step 6: no spotlight

      // Tab bar steps (3-5)
      if (step >= 3 && step <= 5) {
        // Tab index: Stream=1, Sections=2, CompleteTest=3
        const tabIndex = step - 2;
        return Promise.resolve(getTabRect(tabIndex, insets.bottom));
      }

      // Home screen steps (0-2): measure via ref
      const key = HOME_STEP_KEYS[step];
      if (!key) return Promise.resolve(null);
      const ref = ctx.getTargetRef(key);
      if (!ref?.current) return Promise.resolve(null);

      return new Promise<TargetRect | null>((resolve) => {
        ref.current!.measureInWindow((x, y, width, height) => {
          if (width === 0 && height === 0) {
            resolve(null);
          } else {
            resolve({ x, y, width, height });
          }
        });
      });
    },
    [ctx, insets.bottom]
  );

  // ── Animate in when walkthrough first becomes active ─────────────────────────
  useEffect(() => {
    if (!ctx?.isActive) {
      // Reset when closed
      scrimOpacity.setValue(0);
      tooltipOpacity.setValue(0);
      prevStepRef.current = -1;
      setSpotlightRect(null);
      return;
    }
    // Fade in scrim
    Animated.timing(scrimOpacity, {
      toValue: 1,
      duration: reduceMotion ? 0 : 250,
      useNativeDriver: true,
    }).start();
  }, [ctx?.isActive, reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle step changes ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!ctx?.isActive) return;
    const step = ctx.currentStep;

    // Determine animation direction
    const isFirstStep = prevStepRef.current === -1;
    prevStepRef.current = step;

    const isFinalStep = step === TOTAL_STEPS - 1;

    if (isFirstStep) {
      // First step: measure and appear
      getRectForStep(step).then((rect) => {
        setSpotlightRect(rect);
        tooltipOpacity.setValue(0);
        Animated.timing(tooltipOpacity, {
          toValue: 1,
          duration: reduceMotion ? 0 : 200,
          useNativeDriver: true,
        }).start();
      });
      return;
    }

    if (isFinalStep) {
      // Final CTA: remove spotlight, fade tooltip
      setSpotlightRect(null);
      tooltipOpacity.setValue(0);
      Animated.timing(tooltipOpacity, {
        toValue: 1,
        duration: reduceMotion ? 0 : 200,
        useNativeDriver: true,
      }).start();
      return;
    }

    // Mid-tour: fade out tooltip → move spotlight → fade in tooltip
    Animated.timing(tooltipOpacity, {
      toValue: 0,
      duration: reduceMotion ? 0 : 150,
      useNativeDriver: true,
    }).start(() => {
      getRectForStep(step).then((rect) => {
        setSpotlightRect(rect);
        setTimeout(
          () => {
            Animated.timing(tooltipOpacity, {
              toValue: 1,
              duration: reduceMotion ? 0 : 150,
              useNativeDriver: true,
            }).start();
          },
          reduceMotion ? 0 : 200
        );
      });
    });
  }, [ctx?.currentStep, ctx?.isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Next step handler — fades out tooltip first ───────────────────────────────
  const handleNext = useCallback(() => {
    if (!ctx || isTransitioningRef.current) return;
    if (ctx.currentStep === TOTAL_STEPS - 2) {
      // Last content step → go to final CTA
      ctx.nextStep();
      return;
    }
    ctx.nextStep();
  }, [ctx]);

  const handleSkip = useCallback(() => {
    if (!ctx) return;
    ctx.skipWalkthrough();
  }, [ctx]);

  if (!ctx?.isActive) return null;

  const step = ctx.currentStep;
  const stepDef = WALKTHROUGH_STEPS[step]!;
  const isFinalStep = step === TOTAL_STEPS - 1;
  const showSpotlight = !isFinalStep && spotlightRect !== null;
  const showTooltip = !isFinalStep;

  // Auto-position tooltip above or below the spotlight
  let tooltipPlacement: 'above' | 'below' = 'below';
  let tooltipTopOffset = 0;

  if (spotlightRect) {
    const TOOLTIP_EST_HEIGHT = 160;
    const spotBottom = spotlightRect.y + spotlightRect.height + (WALKTHROUGH_STEPS[step]?.padding ?? 0);
    const spotTop = spotlightRect.y - (WALKTHROUGH_STEPS[step]?.padding ?? 0);

    const hasSpaceBelow = SH - spotBottom > TOOLTIP_EST_HEIGHT + 24;
    const hasSpaceAbove = spotTop > TOOLTIP_EST_HEIGHT + 24;

    if (hasSpaceBelow) {
      tooltipPlacement = 'below';
      tooltipTopOffset = spotBottom + 12;
    } else if (hasSpaceAbove) {
      tooltipPlacement = 'above';
      tooltipTopOffset = spotTop - TOOLTIP_EST_HEIGHT - 12;
    } else {
      // Fallback: centre on screen below midpoint
      tooltipPlacement = 'below';
      tooltipTopOffset = SH * 0.55;
    }

    // Tab bar steps always go above
    if (step >= 3 && step <= 5) {
      tooltipPlacement = 'above';
      tooltipTopOffset = spotlightRect.y - TOOLTIP_EST_HEIGHT - 16;
    }
  }

  return (
    <Modal
      visible={ctx.isActive}
      transparent
      animationType="none"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={handleSkip}
    >
      <Animated.View style={[styles.root, { opacity: scrimOpacity }]}>
        {/* ── Full dark scrim (no spotlight cutout — tooltip card is enough) ── */}
        {!isFinalStep ? (
          <View style={styles.fullScrim} pointerEvents="none" />
        ) : null}

        {/* ── Tooltip bubble (steps 0-5) ── */}
        {showTooltip && spotlightRect ? (
          <TooltipBubble
            step={stepDef}
            stepIndex={step}
            totalSteps={TOTAL_STEPS}
            placement={tooltipPlacement}
            topOffset={tooltipTopOffset}
            opacity={tooltipOpacity}
            onNext={handleNext}
            onSkip={handleSkip}
            reduceMotion={reduceMotion}
          />
        ) : null}

        {/* ── Skip button (top-right, steps 0-5) ── */}
        {!isFinalStep ? (
          <Pressable
            onPress={handleSkip}
            style={[styles.skipBtn, { top: insets.top + 12 }]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Skip tour"
          >
            <Text style={styles.skipBtnText}>Skip tour</Text>
          </Pressable>
        ) : null}

        {/* ── Final CTA card (step 6) ── */}
        {isFinalStep ? (
          <FinalCTACard
            opacity={tooltipOpacity}
            onStart={async () => {
              await ctx.completeWalkthrough();
              router.replace('/(tabs)/stream' as never);
            }}
            onDismiss={ctx.completeWalkthrough}
          />
        ) : null}
      </Animated.View>
    </Modal>
  );
}

// ─── Final CTA card ───────────────────────────────────────────────────────────

type FinalCTAProps = {
  opacity: Animated.Value;
  onStart: () => void;
  onDismiss: () => void;
};

function FinalCTACard({ opacity, onStart, onDismiss }: FinalCTAProps) {
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: 16,
        stiffness: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.fullScrim} pointerEvents="box-none">
      <Animated.View
        style={[styles.ctaCard, { opacity, transform: [{ scale: scaleAnim }] }]}
        pointerEvents="auto"
      >
        {/* Icon cluster */}
        <View style={styles.iconCluster}>
          <Star size={28} color={colors.accentTeal} />
          <Zap size={28} color={colors.accentTeal} />
          <Trophy size={28} color={colors.accentTeal} />
        </View>

        <Text style={styles.ctaTitle}>You're ready to start</Text>
        <Text style={styles.ctaBody}>
          Your first Stream question is waiting.{'\n'}
          Answer it and your Readiness score begins to move.
        </Text>

        {/* Primary CTA */}
        <Pressable
          onPress={onStart}
          style={styles.ctaPrimary}
          accessibilityRole="button"
          accessibilityLabel="Start my first question"
        >
          <Text style={styles.ctaPrimaryText}>Start my first question →</Text>
        </Pressable>

        {/* Secondary link */}
        <Pressable
          onPress={onDismiss}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Explore on my own"
        >
          <Text style={styles.ctaSecondaryText}>Explore on my own</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  fullScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 14, 26, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipBtn: {
    position: 'absolute',
    right: 24,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  skipBtnText: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  // Final CTA card
  ctaCard: {
    marginHorizontal: 24,
    backgroundColor: colors.darkNavy,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: SW - 48,
  },
  iconCluster: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  ctaTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 26,
    color: colors.white,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  ctaBody: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'center',
    lineHeight: 23,
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 32,
  },
  ctaPrimary: {
    width: '100%',
    height: 56,
    backgroundColor: colors.primaryBlue,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  ctaPrimaryText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 17,
    color: colors.white,
    letterSpacing: 0.2,
  },
  ctaSecondaryText: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
});
