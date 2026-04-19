/**
 * Adapty Paywall Integration
 *
 * Shared utilities for presenting Adapty Paywall Builder paywalls
 * and syncing subscription state with Supabase.
 */
import { adapty, createPaywallView } from 'react-native-adapty';
import type { EventHandlers } from 'react-native-adapty';
import { track } from '@/lib/track';

import { supabase } from '@/lib/supabaseClient';
import { PAID_TIERS } from '@/theme/constants';

const PLACEMENT_ID = 'wordifi-onboarding';

type PresentResult = {
  purchased: boolean;
  restored: boolean;
};

/**
 * Present the Adapty Paywall Builder paywall as a modal.
 *
 * @param onPurchaseSuccess - called after a successful purchase (before view dismisses)
 * @returns PresentResult indicating what happened
 */
export async function presentAdaptyPaywall(
  onPurchaseSuccess?: () => void | Promise<void>,
): Promise<PresentResult> {
  const result: PresentResult = { purchased: false, restored: false };

  try {
    const paywall = await adapty.getPaywall(PLACEMENT_ID);
    const view = await createPaywallView(paywall);

    view.setEventHandlers({
      onPurchaseCompleted: (purchaseResult) => {
        if (purchaseResult.type === 'success') {
          result.purchased = true;
          track('subscription_started', { plan: 'adapty' });
          onPurchaseSuccess?.();
        }
        // Close paywall unless user cancelled
        return purchaseResult.type !== 'user_cancelled';
      },
      onRestoreCompleted: (_profile) => {
        result.restored = true;
        onPurchaseSuccess?.();
        return true; // close paywall
      },
      onCloseButtonPress: () => true,
      onAndroidSystemBack: () => true,
    });

    await view.present();
  } catch (err) {
    console.error('[Adapty] Failed to present paywall:', err);
  }

  return result;
}

/**
 * Sync Supabase subscription_tier after a successful purchase or restore.
 */
export async function syncSubscriptionAfterPurchase(userId: string): Promise<void> {
  try {
    const profile = await adapty.getProfile();
    const hasActiveSubscription = profile.accessLevels?.premium?.isActive === true;

    if (hasActiveSubscription) {
      const expiresAt = profile.accessLevels?.premium?.expiresAt;
      await supabase
        .from('user_profiles')
        .update({
          subscription_tier: 'pro',
          subscription_valid_until: expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          trial_active: false,
        } as never)
        .eq('id', userId);
      track('subscription_started', { plan: 'pro' });
      console.log('[Adapty] Subscription synced to pro for user', userId);
    }
  } catch (err) {
    console.error('[Adapty] Failed to sync subscription:', err);
  }
}

/**
 * Check Adapty subscription status and sync with Supabase.
 * Call on app launch to handle renewals/expirations between sessions.
 */
export async function syncSubscriptionOnLaunch(userId: string, currentTier: string): Promise<boolean> {
  try {
    const profile = await adapty.getProfile();
    const hasActive = profile.accessLevels?.premium?.isActive === true;

    if (hasActive && !PAID_TIERS.has(currentTier)) {
      // Adapty says active but DB says not paid → upgrade
      const expiresAt = profile.accessLevels?.premium?.expiresAt;
      await supabase
        .from('user_profiles')
        .update({
          subscription_tier: 'pro',
          subscription_valid_until: expiresAt ?? null,
          trial_active: false,
        } as never)
        .eq('id', userId);
      console.log('[Adapty] Launch sync: upgraded to pro');
      return true; // changed
    }

    if (!hasActive && currentTier === 'pro') {
      // Adapty says expired but DB says 'pro' (Adapty-managed tier) → downgrade
      // Note: only downgrade 'pro' — other paid tiers (paid_early, monthly, etc.)
      // may be manually assigned or managed outside Adapty
      await supabase
        .from('user_profiles')
        .update({
          subscription_tier: 'free',
          subscription_valid_until: null,
        } as never)
        .eq('id', userId);
      console.log('[Adapty] Launch sync: downgraded pro to free');
      return true; // changed
    }

    return false; // no change
  } catch (err) {
    console.error('[Adapty] Launch sync failed:', err);
    return false;
  }
}
