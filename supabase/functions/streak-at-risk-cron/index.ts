import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { dispatchChannel } from '../_shared/dispatch.ts';
import { getUserTimezone, getLocalHour, getCurrentDateInTz, getStartOfDayUTC } from '../_shared/timezone.ts';
import { isAuthorised } from '../_shared/cronAuth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FIRE_HOUR = 19; // 7 PM local

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

  // Fetch all users with an active streak
  const { data: streakUsers, error } = await supabase
    .from('user_streak_state')
    .select('user_id, current_streak_days, timezone')
    .gt('current_streak_days', 0) as { data: Row[] | null; error: unknown };

  if (error) {
    console.warn('[streak-at-risk-cron] query failed', error);
    return Response.json({ error: 'query_failed' }, { status: 500 });
  }

  const users = streakUsers ?? [];
  let checked = 0, dispatched = 0, skipped = 0;

  for (const u of users) {
    checked++;

    // Fetch profile timezone as fallback — user_streak_state.timezone may be
    // 'UTC' (default) if gamification hasn't synced from user_profiles yet.
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
    const localHour = getLocalHour(tz);

    if (localHour !== FIRE_HOUR) {
      skipped++;
      continue;
    }

    const todayDate = getCurrentDateInTz(tz);

    // Check if streak requirement already met today
    const { data: rollup } = await supabase
      .from('daily_activity_rollup')
      .select('streak_requirement_met, streak_requirement_for_day, total_questions_counted_for_streak')
      .eq('user_id', u.user_id)
      .eq('activity_date', todayDate)
      .maybeSingle() as { data: Row | null };

    if (rollup?.streak_requirement_met) {
      skipped++;
      continue;
    }

    const startOfDay = getStartOfDayUTC(tz).toISOString();

    // Check already sent today
    const { count: alreadySent } = await supabase
      .from('notification_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', u.user_id)
      .eq('event_key', 'notif.streak_at_risk')
      .in('status', ['sent', 'delivered'])
      .gte('sent_at', startOfDay) as { count: number | null };

    if ((alreadySent ?? 0) > 0) {
      skipped++;
      continue;
    }

    // Get badge name for active level
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('target_level')
      .eq('id', u.user_id)
      .maybeSingle() as { data: Row | null };

    const { data: badge } = await supabase
      .from('user_badges_per_level')
      .select('current_badge_rank')
      .eq('user_id', u.user_id)
      .eq('cefr_level', profile?.target_level ?? '')
      .maybeSingle() as { data: Row | null };

    const questionsAnswered = rollup?.total_questions_counted_for_streak ?? 0;
    const questionsRequired = rollup?.streak_requirement_for_day ?? 5;
    const questionsRemaining = Math.max(0, questionsRequired - questionsAnswered);

    await dispatchChannel(supabase, {
      userId: u.user_id,
      eventKey: 'notif.streak_at_risk',
      channel: 'push',
      category: 'practice',
      payload: {
        streak_days: u.current_streak_days,
        questions_remaining: questionsRemaining,
        badge_name: badge?.current_badge_rank ?? '',
      },
    });

    dispatched++;
  }

  return Response.json({ checked, dispatched, skipped });
});
