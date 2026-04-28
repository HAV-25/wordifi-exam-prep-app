/**
 * RevenueCat Paywall Integration
 *
 * Presents the RevenueCat paywall UI and syncs subscription state with Supabase after purchase or restore.
 *
 * Tier mapping:
 *   $rc_monthly      → subscription_tier: 'monthly'
 *   $rc_three_month  → subscription_tier: 'quarterly'
 *   TRIAL periodType → subscription_tier: 'free_trial'
 */
import Purchases from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

import { track } from '@/lib/track';
import { supabase } from '@/lib/supabaseClient';
import { PAID_TIERS } from '@/theme/constants';

const ENTITLEMENT_ID = 'Wordifi Pro';

// Only tiers issued by RevenueCat — safe to downgrade on expiry.
// paid_early / winback_* are manually assigned and must never be auto-downgraded.
const RC_MANAGED_TIERS = new Set(['pro', 'monthly', 'quarterly']);

type PresentResult = {
  purchased: boolean;
  restored: boolean;
};

/** Map RC product identifier + trial flag → DB tier name */
function productToTier(productId: string | undefined, isTrialPeriod: boolean): string {
  if (isTrialPeriod) return 'free_trial';
  // activeSubscriptions returns the Google Play subscription ID (without base-plan suffix)
  const id = (productId ?? '').split(':')[0].toLowerCase();
  if (id === 'wordifi_premium_monthly') return 'monthly';
  if (id === 'wordifi_premium_quarterly') return 'quarterly';
  // Also handle RC package type identifiers as a fallback
  if (productId === '$rc_monthly') return 'monthly';
  if (productId === '$rc_three_month') return 'quarterly';
  return 'monthly'; // safe fallback for any unrecognised RC product
}

/**
 * Present the RevenueCat paywall as a native modal.
 *
 * @param onPurchaseSuccess - called after a successful purchase or restore (before dismissal)
 * @returns PresentResult indicating what happened
 */
export async function presentRevenueCatPaywall(
  onPurchaseSuccess?: () => void | Promise<void>,
): Promise<PresentResult> {
  const result: PresentResult = { purchased: false, restored: false };

  try {
    const paywallResult = await RevenueCatUI.presentPaywall();

    if (paywallResult === PAYWALL_RESULT.PURCHASED) {
      result.purchased = true;
      await onPurchaseSuccess?.();
    } else if (paywallResult === PAYWALL_RESULT.RESTORED) {
      result.restored = true;
      await onPurchaseSuccess?.();
    }
  } catch (err) {
    console.error('[RevenueCat] Failed to present paywall:', err);
  }

  return result;
}

/**
 * Sync Supabase subscription_tier after a successful purchase or restore.
 */
export async function syncSubscriptionAfterPurchase(userId: string): Promise<void> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];

    if (!entitlement?.isActive) return;

    const isTrialPeriod = entitlement.periodType === 'TRIAL';
    const productId = [...customerInfo.activeSubscriptions][0];
    const tier = productToTier(productId, isTrialPeriod);
    const expiresAt = entitlement.expirationDate;

    await supabase
      .from('user_profiles')
      .update({
        subscription_tier: tier,
        subscription_valid_until: expiresAt
          ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        trial_active: isTrialPeriod,
      } as never)
      .eq('id', userId);

    track('subscription_started', { plan: tier });
    console.log('[RevenueCat] Subscription synced:', tier, 'for user', userId);
  } catch (err) {
    console.error('[RevenueCat] Failed to sync subscription:', err);
  }
}

/**
 * Check RevenueCat subscription status on app launch and reconcile with Supabase.
 * Handles renewals and expirations that occurred between sessions.
 *
 * @returns true if the DB was updated, false otherwise
 */
export async function syncSubscriptionOnLaunch(userId: string, currentTier: string): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
    const hasActive = entitlement?.isActive === true;

    if (hasActive && !PAID_TIERS.has(currentTier)) {
      // RC says active but DB says not paid → upgrade
      const isTrialPeriod = entitlement.periodType === 'TRIAL';
      const productId = [...customerInfo.activeSubscriptions][0];
      const tier = productToTier(productId, isTrialPeriod);

      await supabase
        .from('user_profiles')
        .update({
          subscription_tier: tier,
          subscription_valid_until: entitlement.expirationDate ?? null,
          trial_active: isTrialPeriod,
        } as never)
        .eq('id', userId);

      console.log('[RevenueCat] Launch sync: upgraded to', tier);
      return true;
    }

    // Only downgrade RC-managed tiers — paid_early / winback_* are manually assigned
    if (!hasActive && RC_MANAGED_TIERS.has(currentTier)) {
      await supabase
        .from('user_profiles')
        .update({
          subscription_tier: 'free',
          subscription_valid_until: null,
        } as never)
        .eq('id', userId);

      console.log('[RevenueCat] Launch sync: downgraded to free');
      return true;
    }

    return false;
  } catch (err) {
    console.error('[RevenueCat] Launch sync failed:', err);
    return false;
  }
}
