import { useContext, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { WalkthroughContext } from '@/components/walkthrough/WalkthroughProvider';

/**
 * Registers a View as a named target for the walkthrough spotlight.
 * Returns a ref to attach to your View element.
 *
 * Usage:
 *   const ref = useWalkthroughTarget('profile-avatar');
 *   <View ref={ref} ... />
 */
export function useWalkthroughTarget(key: string): React.RefObject<View | null> {
  const ref = useRef<View | null>(null);
  const ctx = useContext(WalkthroughContext);

  useEffect(() => {
    if (!ctx) return;
    ctx.registerTarget(key, ref);
  // registerTarget is stable (useCallback with no deps)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return ref;
}
