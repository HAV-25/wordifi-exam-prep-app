import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { dispatchChannel } from '../_shared/dispatch.ts';
import { isAuthorised } from '../_shared/cronAuth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

  const { data: events, error } = await supabase
    .from('gamification_event_log')
    .select('*')
    .is('processed_at', null)
    .order('created_at', { ascending: true })
    .limit(50) as { data: Row[] | null; error: unknown };

  if (error) {
    console.warn('[gamification-event-worker] query failed', error);
    return Response.json({ error: 'query_failed' }, { status: 500 });
  }

  const batch = events ?? [];
  if (batch.length === 0) {
    return Response.json({ processed: 0, dispatched: 0, skipped: 0 });
  }

  // Claim rows immediately before dispatch to prevent double-processing by
  // concurrent invocations. Any row with processed_at set will be skipped by
  // future polls. If dispatch later fails, the row stays claimed (no retry) —
  // this is preferable to double-dispatch.
  const allIds = batch.map((e) => e.id);
  await supabase
    .from('gamification_event_log')
    .update({ processed_at: new Date().toISOString() })
    .in('id', allIds);

  const processedIds: string[] = [...allIds];
  let dispatched = 0, skipped = 0;

  // Build lookup map for merge rule: rank_downgraded events by user_id+date
  const downgradedMap = new Map<string, Row>();
  for (const ev of batch) {
    if (ev.event_type === 'rank_downgraded') {
      const key = `${ev.user_id}:${ev.evaluation_date}`;
      downgradedMap.set(key, ev);
    }
  }

  for (const ev of batch) {
    if (processedIds.includes(ev.id)) continue;

    const { event_type, user_id, evaluation_date, payload } = ev;

    if (event_type === 'streak_broke') {
      // Check merge rule: combine rank_downgraded into payload if same user+date
      const mergeKey = `${user_id}:${evaluation_date}`;
      const downgraded = downgradedMap.get(mergeKey);
      const mergedPayload = {
        ...payload,
        dropped_to_badge_name: downgraded?.payload?.new_badge_name ?? payload?.dropped_to_badge_name ?? '',
      };

      await Promise.allSettled([
        dispatchChannel(supabase, {
          userId: user_id,
          eventKey: 'notif.streak_broken',
          channel: 'push',
          category: 'practice',
          payload: mergedPayload,
        }),
        dispatchChannel(supabase, {
          userId: user_id,
          eventKey: 'notif.streak_broken',
          channel: 'email',
          category: 'practice',
          payload: mergedPayload,
        }),
      ]);

      processedIds.push(ev.id);
      if (downgraded) processedIds.push(downgraded.id);
      dispatched++;
    } else if (event_type === 'shield_applied') {
      await dispatchChannel(supabase, {
        userId: user_id,
        eventKey: 'notif.score_shield_used',
        channel: 'in_app',
        category: 'practice',
        payload,
      });
      processedIds.push(ev.id);
      dispatched++;
    } else if (event_type === 'rank_upgraded') {
      await Promise.allSettled([
        dispatchChannel(supabase, {
          userId: user_id,
          eventKey: 'notif.badge_rank_up',
          channel: 'in_app',
          category: 'progress',
          payload,
        }),
        dispatchChannel(supabase, {
          userId: user_id,
          eventKey: 'notif.badge_rank_up',
          channel: 'push',
          category: 'progress',
          payload,
        }),
      ]);
      processedIds.push(ev.id);
      dispatched++;
    } else {
      // rank_downgraded already consumed by merge rule, or other unhandled types
      processedIds.push(ev.id);
      skipped++;
    }
  }

  return Response.json({ processed: processedIds.length, dispatched, skipped });
});
