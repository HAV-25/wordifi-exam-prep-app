import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { localTimeToUTC } from '../_shared/timezone.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ADAPTY_SECRET = Deno.env.get('ADAPTY_WEBHOOK_SECRET');

const TRIAL_EVENT_KEYS = [
  'notif.trial_ending_t3',
  'notif.trial_ending_t1',
  'notif.trial_ending_t0',
];

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === 'GET' && url.searchParams.get('health') === '1') {
    return Response.json({ status: 'ok' });
  }

  // Auth check
  const auth = req.headers.get('Authorization') ?? '';
  if (ADAPTY_SECRET) {
    if (auth !== `Bearer ${ADAPTY_SECRET}`) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }
  } else {
    console.warn('[adapty-webhook] ADAPTY_WEBHOOK_SECRET not set — skipping auth check (TODO: set this secret)');
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  }

  let event: Row;
  try {
    event = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const eventType: string = event?.event_type ?? event?.type ?? '';
  const userId: string = event?.profile?.customer_user_id ?? event?.user_id ?? '';

  if (!userId) {
    console.warn('[adapty-webhook] no user_id in event', eventType);
    return Response.json({ received: true, processed: 0 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  let processed = 0;

  const snapshotUpdate: Row = { updated_at: new Date().toISOString() };

  switch (eventType) {
    case 'subscription_started':
      snapshotUpdate.subscription_status = 'active';
      break;
    case 'trial_started': {
      snapshotUpdate.subscription_status = 'trial';
      const trialEndsAt: string =
        event?.paid_access_level?.expires_at ??
        event?.trial_ends_at ??
        event?.access_level?.expires_at ??
        '';
      if (trialEndsAt) {
        snapshotUpdate.trial_ends_at = trialEndsAt;
        await scheduleTrialNotifications(supabase, userId, trialEndsAt);
        processed += 6;
      }
      break;
    }
    case 'subscription_renewed':
      snapshotUpdate.subscription_status = 'active';
      break;
    case 'subscription_cancelled':
      snapshotUpdate.subscription_status = 'cancelled';
      break;
    case 'subscription_expired':
      snapshotUpdate.subscription_status = 'expired';
      break;
    default:
      // Ignore all other event types
      return Response.json({ received: true, processed: 0 });
  }

  // Update user_activity_snapshot
  const { error: snapErr } = await supabase
    .from('user_activity_snapshot')
    .upsert({ user_id: userId, ...snapshotUpdate }, { onConflict: 'user_id' });

  if (snapErr) {
    console.warn('[adapty-webhook] snapshot upsert failed', snapErr.message);
  } else {
    processed += 1;
  }

  return Response.json({ received: true, processed });
});

async function scheduleTrialNotifications(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  trialEndsAt: string,
) {
  // Resolve user timezone
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('timezone')
    .eq('id', userId)
    .maybeSingle() as { data: Row | null };
  const tz = profile?.timezone ?? 'Europe/Berlin';

  const trialEnd = new Date(trialEndsAt);

  const scheduled: Row[] = [
    // T-3: push + email at 09:00 local
    { event_key: 'notif.trial_ending_t3', channel: 'push',  scheduled_at: localTimeToUTC(trialEnd, -3, 9, 0, tz).toISOString() },
    { event_key: 'notif.trial_ending_t3', channel: 'email', scheduled_at: localTimeToUTC(trialEnd, -3, 9, 0, tz).toISOString() },
    // T-1: push + email at 09:00 local
    { event_key: 'notif.trial_ending_t1', channel: 'push',  scheduled_at: localTimeToUTC(trialEnd, -1, 9, 0, tz).toISOString() },
    { event_key: 'notif.trial_ending_t1', channel: 'email', scheduled_at: localTimeToUTC(trialEnd, -1, 9, 0, tz).toISOString() },
    // T-0: push + email at trial_end - 4h
    { event_key: 'notif.trial_ending_t0', channel: 'push',  scheduled_at: new Date(trialEnd.getTime() - 4 * 3600 * 1000).toISOString() },
    { event_key: 'notif.trial_ending_t0', channel: 'email', scheduled_at: new Date(trialEnd.getTime() - 4 * 3600 * 1000).toISOString() },
  ];

  // Idempotency: for each scheduled row, update scheduled_at if a queued row
  // already exists (trial date shifted), otherwise insert fresh. This avoids a
  // delete→insert gap where the processor could see missing rows mid-operation.
  for (const s of scheduled) {
    const { data: existing } = await supabase
      .from('notification_events')
      .select('id')
      .eq('user_id', userId)
      .eq('event_key', s.event_key)
      .eq('channel', s.channel)
      .eq('status', 'queued')
      .maybeSingle() as { data: Row | null };

    if (existing?.id) {
      await supabase
        .from('notification_events')
        .update({ scheduled_at: s.scheduled_at })
        .eq('id', existing.id);
    } else {
      await supabase.from('notification_events').insert({
        user_id: userId,
        event_key: s.event_key,
        channel: s.channel,
        category: 'monetisation',
        status: 'queued',
        payload: {},
        scheduled_at: s.scheduled_at,
      });
    }
  }
}
