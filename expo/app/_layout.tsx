import React from 'react';
import { vexo } from 'vexo-analytics';

// Initialize Vexo at the root level, outside of any component
if (__DEV__ === false) {
  vexo('8feee71c-2edd-4ef0-aed9-e5b5439759a8');
}

import { Stack } from 'expo-router';

/**
 * Onboarding Launch — v1.0
 * Stitch-designed onboarding flow (16 screens).
 * Each screen is a file in this folder; navigation is linear (no tabs).
 */
export default function OnboardingLaunchLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
  );
}
