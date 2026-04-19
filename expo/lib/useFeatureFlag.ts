import { useEffect, useState } from 'react';
import { getPostHog } from './posthog';

export function useFeatureFlag(key: string, defaultValue = false): boolean {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    try {
      const flag = getPostHog().getFeatureFlag(key);
      setValue(flag === true || flag === 'true');
    } catch {
      setValue(defaultValue);
    }
  }, [key, defaultValue]);

  return value;
}
