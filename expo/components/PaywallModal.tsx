/**
 * PaywallModal — Triggers RevenueCat paywall when visible.
 *
 * Props interface is preserved for backward compatibility with all existing call sites.
 * The `variant` prop is kept for analytics but no longer drives UI copy
 * since RevenueCat handles the paywall rendering.
 */
import React, { useEffect, useRef } from 'react';

import { presentRevenueCatPaywall, syncSubscriptionAfterPurchase } from '@/lib/revenuecatPaywall';
import { useAccess } from '@/providers/AccessProvider';
import { useAuth } from '@/providers/AuthProvider';

type PaywallVariant = 'stream_limit' | 'schreiben' | 'sprechen' | 'sectional' | 'mock';

interface PaywallModalProps {
  visible: boolean;
  variant: PaywallVariant;
  onUpgrade: () => void;
  onDismiss: () => void;
}

export function PaywallModal({ visible, variant, onUpgrade, onDismiss }: PaywallModalProps) {
  const { user } = useAuth();
  const { refreshAccess } = useAccess();
  const presentingRef = useRef(false);

  useEffect(() => {
    if (!visible || presentingRef.current) return;
    presentingRef.current = true;

    async function show() {
      try {
        const result = await presentRevenueCatPaywall(async () => {
          // On purchase success: sync DB + refresh access
          if (user?.id) {
            await syncSubscriptionAfterPurchase(user.id);
            await refreshAccess();
          }
        });

        if (result.purchased || result.restored) {
          onUpgrade();
        } else {
          onDismiss();
        }
      } catch {
        onDismiss();
      } finally {
        presentingRef.current = false;
      }
    }

    void show();
  }, [visible, user?.id, refreshAccess, onUpgrade, onDismiss]);

  // RevenueCat presents its own native modal — no React Native UI needed here
  return null;
}
