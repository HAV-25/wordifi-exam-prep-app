import { OneSignal } from 'react-native-onesignal';

let initialised = false;

export function initOneSignal() {
  if (initialised) return;

  const appId = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID;
  if (!appId) {
    console.warn('[OneSignal] App ID missing — skipping init');
    return;
  }

  try {
    OneSignal.initialize(appId);
    if (__DEV__) {
      OneSignal.Debug.setLogLevel(6);
    }
    initialised = true;
  } catch (e) {
    console.warn('[OneSignal] init failed', e);
  }
}

export function linkOneSignalIdentity(supabaseUserId: string) {
  try {
    OneSignal.login(supabaseUserId);
  } catch (e) {
    console.warn('[OneSignal] login failed', e);
  }
}

export function unlinkOneSignalIdentity() {
  try {
    OneSignal.logout();
  } catch (e) {
    console.warn('[OneSignal] logout failed', e);
  }
}

export function setOneSignalTags(tags: Record<string, string>) {
  try {
    OneSignal.User.addTags(tags);
  } catch (e) {
    console.warn('[OneSignal] addTags failed', e);
  }
}

export async function requestPushPermission(): Promise<boolean> {
  try {
    const granted = await OneSignal.Notifications.requestPermission(true);
    return granted;
  } catch (e) {
    console.warn('[OneSignal] requestPermission failed', e);
    return false;
  }
}

export async function getOneSignalSubscriptionId(): Promise<string | null> {
  try {
    return (await OneSignal.User.pushSubscription.getIdAsync()) ?? null;
  } catch {
    return null;
  }
}
