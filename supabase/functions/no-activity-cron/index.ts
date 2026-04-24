import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { dispatchChannel } from '../_shared/dispatch.ts';
import { getUserTimezone, hoursSince } from '../_shared/timezone.ts';
import { isAuthorised } from '../_shared/cronAuth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MIN_HOURS = 48;
const MAX_HOURS = 72;
const RAMP_IN_DAYS = 30;

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === 'GET' && url.searchParams.get('health') === '1') {
    return Response.json({ status: 'ok' });
  }

  if (!isAuthorised(req)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: streakUsers, error } = await supabase
    .from('user_streak_state')
    .select('user_id, current_streak_days, last_qualifying_day, timezone')
    .not('last_qualifying_day', 'is', null) as { data: Row[] | null; error: unknown };

  if (error) {
    console.warn('[no-activity-cron] query failed', error);
    return Response.json({ error: 'query_failed' }, { status: 500 });
  }

  const users = streakUsers ?? [];
  let checked = 0, dispatched = 0, skipped = 0;

  for (const u of users) {
    checked++;

    // Skip users with active streaks — T1/T2 handle them
    if ((u.current_streak_days ?? 0) > 0) {
      skipped++;
      continue;
    }

    // Fetch profile timezone as fallback if streak state still shows 'UTC'
    let profileTz: { timezone?: string | null } | null = null;
    if (!u.timezone || u.timezone === 'UTC') {
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('timezone')
        .eq('id', u.user_id)
        .maybeSingle() as { data: Row | null };
      profileTz = prof;
    }

    const tz = getUserTimezone(u, profileTz);
    const hrs = hoursSince(u.last_qualifying_day, tz);

    if (hrs < MIN_HOURS || hrs >= MAX_HOURS) {
      skipped++;
      continue;
    }

    // Ramp-in: skip users who signed up less than RAMP_IN_DAYS ago
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('signup_day_zero_date')
      .eq('id', u.user_id)
      .maybeSingle() as { data: Row | null };

    if (profile?.signup_day_zero_date) {
      const daysSinceSignup = hoursSince(profile.signup_day_zero_date, tz) / 24;
      if (daysSinceSignup < RAMP_IN_DAYS) {
        skipped++;
        continue;
      }
    }

    // Check: no T4 sent in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { count: recentlySent } = await supabase
      .from('notification_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', u.user_id)
      .eq('event_key', 'notif.no_activity_48h')
      .in('status', ['sent', 'delivered'])
      .gte('sent_at', sevenDaysAgo) as { count: number | null };

    if ((recentlySent ?? 0) > 0) {
      skipped++;
      continue;
    }

    await dispatchChannel(supabase, {
      userId: u.user_id,
      eventKey: 'notif.no_activity_48h',
      channel: 'push',
      category: 'practice',
      payload: {},
    });

    dispatched++;
  }

  return Response.json({ checked, dispatched, skipped });
});
