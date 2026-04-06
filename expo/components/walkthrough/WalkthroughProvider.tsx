import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';

import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/providers/AuthProvider';
import { WalkthroughOverlay } from './WalkthroughOverlay';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TargetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type StepIconType =
  | 'user'
  | 'trending-up'
  | 'flame'
  | 'zap'
  | 'grid'
  | 'clipboard';

export type StepDef = {
  targetKey: string | null;
  title: string;
  body: string;
  iconType: StepIconType | null;
  iconColor: string;
  padding: number;
};

export type WalkthroughContextValue = {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  registerTarget: (key: string, ref: React.RefObject<View>) => void;
  startWalkthrough: () => void;
  nextStep: () => void;
  skipWalkthrough: () => void;
  completeWalkthrough: () => Promise<void>;
  getTargetRef: (key: string) => React.RefObject<View> | undefined;
};

// ─── Step definitions ─────────────────────────────────────────────────────────

const TEAL = '#00E5B6';
const GOLD = '#F5C400';

export const WALKTHROUGH_STEPS: StepDef[] = [
  {
    targetKey: 'profile-avatar',
    title: 'Your profile',
    body: 'Tap here anytime to see your level, exam date, subscription and progress history.',
    iconType: 'user',
    iconColor: TEAL,
    padding: 12,
  },
  {
    targetKey: 'readiness-score',
    title: 'Your Exam Readiness score',
    body: 'This updates after every question you answer. It reflects how ready you are across all sections — Hören, Lesen, Schreiben and Sprechen.',
    iconType: 'trending-up',
    iconColor: TEAL,
    padding: 16,
  },
  {
    targetKey: 'stats-chips',
    title: 'XP and your streak',
    body: 'You earn XP for every correct answer. Your streak grows each day you practise. The leaderboard ranks you against all Wordifi learners.',
    iconType: 'flame',
    iconColor: GOLD,
    padding: 12,
  },
  {
    targetKey: 'tab-stream',
    title: 'Daily Stream',
    body: '20 mixed questions every day — Hören and Lesen, shuffled so you never know what\'s coming next. Swipe through at your own pace. Resumes where you left off.',
    iconType: 'zap',
    iconColor: TEAL,
    padding: 16,
  },
  {
    targetKey: 'tab-sections',
    title: 'Sectional Tests',
    body: 'Practice a full exam section — Hören, Lesen, Schreiben or Sprechen. Choose your Teil and go deep on one skill at a time. Results show exactly what to improve.',
    iconType: 'grid',
    iconColor: TEAL,
    padding: 16,
  },
  {
    targetKey: 'tab-complete-test',
    title: 'Full Mock Test',
    body: 'A complete exam simulation — all sections, real timing, real pressure. The closest experience to your actual Goethe or TELC exam. Take one when you feel ready.',
    iconType: 'clipboard',
    iconColor: TEAL,
    padding: 16,
  },
  {
    targetKey: null,
    title: "You're ready to start",
    body: 'Your first Stream question is waiting. Answer it and your Readiness score begins to move.',
    iconType: null,
    iconColor: TEAL,
    padding: 0,
  },
];

export const TOTAL_STEPS = WALKTHROUGH_STEPS.length;

// ─── Context ──────────────────────────────────────────────────────────────────

export const WalkthroughContext = createContext<WalkthroughContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WalkthroughProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const targetsRef = useRef<Map<string, React.RefObject<View>>>(new Map());
  const hasCheckedRef = useRef(false);

  const registerTarget = useCallback((key: string, ref: React.RefObject<View>) => {
    targetsRef.current.set(key, ref);
  }, []);

  const getTargetRef = useCallback(
    (key: string) => targetsRef.current.get(key),
    []
  );

  const completeWalkthrough = useCallback(async () => {
    setIsActive(false);
    setCurrentStep(0);
    if (!user?.id) return;

    await AsyncStorage.setItem(
      `wordifi_walkthrough_completed_${user.id}`,
      'true'
    ).catch((err) => console.log('[Walkthrough] AsyncStorage write error', err));

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        walkthrough_completed: true,
        walkthrough_completed_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[Walkthrough] Failed to mark walkthrough complete:', updateError.message);
    }
  }, [user?.id]);

  const startWalkthrough = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS - 1));
  }, []);

  const skipWalkthrough = useCallback(() => {
    // Jump to the final CTA step instead of dismissing immediately
    setCurrentStep(TOTAL_STEPS - 1);
  }, []);

  // Trigger logic — fires once when user is available
  useEffect(() => {
    if (!user?.id || hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    const currentUser = user;

    async function checkWalkthrough() {
      // Rule 0: never show if DB already marks walkthrough as completed (handles fresh installs)
      const { data: profileRow } = await supabase
        .from('user_profiles')
        .select('walkthrough_completed')
        .eq('id', currentUser.id)
        .maybeSingle();
      if (profileRow?.walkthrough_completed) return;

      // Rule 1: never show after 3 days
      const accountAgeDays =
        (Date.now() - new Date(currentUser.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (accountAgeDays > 3) return;

      // Rule 2: never show if user has any test session (fail safe: skip on error)
      const { data, error } = await supabase
        .from('test_sessions')
        .select('id')
        .eq('user_id', currentUser.id)
        .limit(1);

      if (error) {
        console.log('[Walkthrough] checkWalkthrough sessions query error', error);
        return;
      }
      if ((data ?? []).length > 0) return;

      setTimeout(() => startWalkthrough(), 600);
    }

    void checkWalkthrough();
  }, [user?.id, startWalkthrough]);

  const value = useMemo<WalkthroughContextValue>(
    () => ({
      isActive,
      currentStep,
      totalSteps: TOTAL_STEPS,
      registerTarget,
      startWalkthrough,
      nextStep,
      skipWalkthrough,
      completeWalkthrough,
      getTargetRef,
    }),
    [
      isActive,
      currentStep,
      registerTarget,
      startWalkthrough,
      nextStep,
      skipWalkthrough,
      completeWalkthrough,
      getTargetRef,
    ]
  );

  return (
    <WalkthroughContext.Provider value={value}>
      {children}
      <WalkthroughOverlay />
    </WalkthroughContext.Provider>
  );
}

// ─── Consumer hook ────────────────────────────────────────────────────────────

export function useWalkthrough(): WalkthroughContextValue {
  const ctx = React.useContext(WalkthroughContext);
  if (!ctx) throw new Error('useWalkthrough must be used inside WalkthroughProvider');
  return ctx;
}
