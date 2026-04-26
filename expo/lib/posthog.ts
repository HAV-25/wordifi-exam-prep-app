import Constants from 'expo-constants';
import { PostHog } from 'posthog-react-native';

let _posthog: PostHog | null = null;

export function initPostHog(): PostHog {
  if (_posthog) return _posthog;

  _posthog = new PostHog(process.env.EXPO_PUBLIC_POSTHOG_KEY!, {
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    captureAppLifecycleEvents: true,
    flushAt: 20,
    flushInterval: 30000,
    preloadFeatureFlags: true,
  });

  // Register super-properties on every event — mirrors Sentry's environment config
  _posthog.register({
    environment: __DEV__ ? 'development' : 'production',
    app_version: Constants.expoConfig?.version ?? 'unknown',
  });

  return _posthog;
}

export function getPostHog(): PostHog {
  if (!_posthog) {
    throw new Error('PostHog not initialised — call initPostHog() in _layout.tsx first');
  }
  return _posthog;
}
