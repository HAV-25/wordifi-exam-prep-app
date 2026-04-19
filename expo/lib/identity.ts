import type { PostHogEventProperties } from '@posthog/core';
import { getPostHog } from './posthog';

type UserTraits = {
  cefr_level?: 'A1' | 'A2' | 'B1';
  subscription_status?: 'free' | 'trial' | 'paid' | 'expired';
  weakest_section?: string;
};

export function identifyUser(userId: string, traits: UserTraits = {}): void {
  try {
    getPostHog().identify(userId, traits as PostHogEventProperties);
  } catch {
    // non-critical
  }
}

export function updateUserTraits(traits: UserTraits): void {
  try {
    void getPostHog().register(traits as PostHogEventProperties);
  } catch {
    // non-critical
  }
}

export function resetUser(): void {
  try {
    void getPostHog().reset();
  } catch {
    // non-critical
  }
}
