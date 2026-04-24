import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getUserTimezone, isInQuietHours, getStartOfDayUTC } from './timezone.ts';
import { NotifConfig } from './notifConfig.ts';

export type Channel = 'push' | 'email' | 'in_app';
export type Category = 'practice' | 'progress' | 'monetisation' | 'transactional';

export type GatePass = {
  ok: true;
  token?: string;   // push_tokens.onesignal_player_id
  email?: string;   // auth.users.email
};

export type GateFail = {
  ok: false;
  reason: string;
};

export type GateResult = GatePass | GateFail;

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

export async function gate(
  supabase: SupabaseClient,
  userId: string,
  channel: Channel,
  category: Category,
  eventKey?: string,
  config?: NotifConfig,
): Promise<GateResult> {
  // Welcome email dedup: suppress if already sent on this channel
  if (eventKey === 'notif.welcome_email') {
    const { data: prior } = await supabase
      .from('notification_events')
      .select('id')
      .eq('user_id', userId)
      .eq('event_key', 'notif.welcome_email')
      .eq('channel', channel)
      .in('status', ['sent', 'delivered'])
      .limit(1)
      .maybeSingle() as { data: Row | null };
    if (prior?.id) {
      return { ok: false, reason: 'already_sent_once' };
    }
  }

  // Step 1 — fetch prefs
  const { data: prefs, error: prefsErr } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single() as { data: Row | null; error: unknown };

  if (prefsErr || !prefs) {
    return { ok: false, reason: 'no_prefs' };
  }

  // Lazy timezone resolver — notification_preferences.timezone is authoritative;
  // falls back to user_streak_state → user_profiles → 'Europe/Berlin'.
  // Resolved at most once and shared between Steps 4 and 5.
  let _tz: string | undefined;
  async function resolveTimezone(): Promise<string> {
    if (_tz !== undefined) return _tz;
    if (prefs.timezone) { _tz = prefs.timezone; return _tz; }
    const [{ data: streakState }, { data: profile }] = await Promise.all([
      supabase.from('user_streak_state').select('timezone').eq('user_id', userId).maybeSingle(),
      supabase.from('user_profiles').select('timezone').eq('id', userId).maybeSingle(),
    ]);
    _tz = getUserTimezone(streakState as Row | null, profile as Row | null);
    return _tz;
  }

  // Step 2 — channel enabled
  const channelKey = `${channel}_enabled`;
  if (prefs[channelKey] === false) {
    return { ok: false, reason: 'channel_disabled' };
  }

  // Step 3 — category opted in (transactional always passes)
  if (category !== 'transactional') {
    const categoryKey = `category_${category}`;
    if (prefs[categoryKey] === false) {
      return { ok: false, reason: 'category_opted_out' };
    }
  }

  // Step 4 — quiet hours (in_app and transactional skip quiet hours)
  if (channel !== 'in_app' && category !== 'transactional' && prefs.quiet_hours_enabled) {
    const tz = await resolveTimezone();
    if (isInQuietHours(tz, prefs.quiet_hours_start, prefs.quiet_hours_end)) {
      return { ok: false, reason: 'quiet_hours' };
    }
  }

  // Step 5 — frequency cap
  if (channel === 'push') {
    const tz = await resolveTimezone();
    const startOfDay = getStartOfDayUTC(tz).toISOString();

    const { count } = await supabase
      .from('notification_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('channel', 'push')
      .in('status', ['sent', 'delivered', 'opened'])
      .gte('sent_at', startOfDay) as { count: number | null };

    const cap = prefs.max_push_per_day ?? config?.defaultMaxPushPerDay ?? 1;
    if ((count ?? 0) >= cap) {
      return { ok: false, reason: 'frequency_cap' };
    }
  }

  if (channel === 'email') {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { count } = await supabase
      .from('notification_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('channel', 'email')
      .in('status', ['sent', 'delivered', 'opened'])
      .gte('sent_at', sevenDaysAgo) as { count: number | null };

    const cap = prefs.max_email_per_week ?? config?.defaultMaxEmailPerWeek ?? 2;
    if ((count ?? 0) >= cap) {
      return { ok: false, reason: 'frequency_cap' };
    }
  }

  // Step 6 — contact check
  if (channel === 'push') {
    const { data: tokenRow } = await supabase
      .from('push_tokens')
      .select('onesignal_player_id')
      .eq('user_id', userId)
      .eq('platform', 'android')
      .order('last_seen_at', { ascending: false })
      .limit(1)
      .maybeSingle() as { data: Row | null };

    if (!tokenRow?.onesignal_player_id) {
      return { ok: false, reason: 'no_token' };
    }
    return { ok: true, token: tokenRow.onesignal_player_id };
  }

  if (channel === 'email') {
    const { data: authUser } = await supabase
      .from('auth_user_emails')
      // auth.users isn't directly queryable via the JS client — use a view or RPC.
      // Fallback: query via admin API using service role.
      .select('email')
      .eq('id', userId)
      .maybeSingle() as { data: Row | null };

    // auth.users email lookup via service role client
    const { data: userRecord } = await (supabase as unknown as {
      auth: { admin: { getUserById: (id: string) => Promise<{ data: { user: { email?: string } | null } }> } };
    }).auth.admin.getUserById(userId);

    const email = userRecord?.user?.email;
    if (!email) {
      return { ok: false, reason: 'no_email' };
    }
    return { ok: true, email };
  }

  // in_app — no contact check
  return { ok: true };
}
