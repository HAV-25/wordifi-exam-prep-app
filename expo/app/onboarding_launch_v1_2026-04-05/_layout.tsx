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
