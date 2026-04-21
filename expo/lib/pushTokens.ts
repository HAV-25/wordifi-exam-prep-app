import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabaseClient';
import { getOneSignalSubscriptionId } from './onesignal';

export async function syncPushToken(userId: string) {
  try {
    // Give OneSignal a moment to assign a subscription ID after login()
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));

    const playerId = await getOneSignalSubscriptionId();
    if (!playerId) {
      console.warn('[PushTokens] No OneSignal subscription ID yet — skipping sync');
      return;
    }

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const appVersion = Constants.expoConfig?.version ?? 'unknown';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          onesignal_player_id: playerId,
          platform,
          app_version: appVersion,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,onesignal_player_id' }
      );
  } catch (e) {
    console.warn('[PushTokens] syncPushToken failed', e);
  }
}
