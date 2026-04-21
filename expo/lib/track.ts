import type { PostHogEventProperties } from '@posthog/core';
import { getPostHog } from './posthog';

export type EventKey =
  | 'user_signed_up'
  | 'user_signed_in'
  | 'onboarding_completed'
  | 'session_started'
  | 'section_completed'
  | 'question_answered'
  | 'streak_extended'
  | 'streak_broken'
  | 'paywall_viewed'
  | 'paywall_dismissed'
  | 'paywall_cta_tapped'
  | 'subscription_started'
  | 'trial_started'
  | 'subscription_renewed'
  | 'subscription_cancelled'
  | 'app_opened'
  | 'notification_preferences_updated'
  | 'push_permission_response';

export function track(event: EventKey, props?: PostHogEventProperties): void {
  try {
    getPostHog().capture(event, props);
  } catch {
    // analytics failure must never crash the app
  }
}
