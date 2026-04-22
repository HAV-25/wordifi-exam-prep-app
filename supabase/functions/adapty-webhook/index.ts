import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { localTimeToUTC } from '../_shared/timezone.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ADAPTY_SECRET = Deno.env.get('ADAPTY_WEBHOOK_SECRET');

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === 'GET' && url.searchParams.get('health') === '1') {
    return Response.json({ status: 'ok' });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  }

  // Read body first — needed to detect validation pings before enforcing auth.
  const rawBody = await req.text();

  let event: Row | null = null;
  try {
    if (rawBody.trim().length > 0) {
      event = JSON.parse(rawBody);
    }
  } catch {
    // not valid JSON — treat as ping
  }

  const eventType: string = event?.event_type ?? event?.type ?? '';

  // Treat as a validation ping if there is no recognisable event payload.
  if (!eventType) {
    console.log('[adapty-webhook] validation ping received');
    return Response.json({ received: true, ping: true });
  }

  // Real event — enforce auth.
  const auth = req.headers.get('Authorization') ?? '';
  if (ADAPTY_SECRET) {
    if (auth !== `Bearer ${ADAPTY_SECRET}`) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }
  } else {
    console.warn('[adapty-webhook] ADAPTY_WEBHOOK_SECRET not set — skipping auth check');
  }

  // Diagnostics: log top-level shape so we can map the real Adapty payload.
  console.log('[adapty-webhook] event_type:', eventType);
  console.log('[adapty-webhook] top-level keys:', Object.keys(event ?? {}).join(', '));
  console.log('[adapty-webhook] event.profile:', JSON.stringify(event?.profile ?? null));
  console.log('[adapty-webhook] event.paid_access_level:', JSON.stringify(event?.paid_access_level ?? null));
  console.log('[adapty-webhook] event.access_level:', JSON.stringify(event?.access_level ?? null));
  console.log('[adapty-webhook] event.event_properties:', JSON.stringify(event?.event_properties ?? null));

  // user_id: Adapty sends profile.customer_user_id (must be the Supabase UUID).
  // Falls back to top-level user_id for manual test curls.
  const userId: string = event?.profile?.customer_user_id ?? event?.user_id ?? '';
  console.log('[adapty-webhook] resolved user_id:', userId || '(empty)');

  if (!userId) {
    console.warn('[adapty-webhook] no user_id — checked event.profile.customer_user_id and event.user_id');
    return Response.json({ received: true, processed: 0 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  let processed = 0;

  const snapshotUpdate: Row = { updated_at: new Date().toISOString() };

  switch (eventType) {
    case 'subscription_started':
      console.log('[adapty-webhook] branch: subscription_started');
      snapshotUpdate.subscription_status = 'active';
      break;

    case 'trial_started': {
      console.log('[adapty-webhook] branch: trial_started');
      snapshotUpdate.subscription_status = 'trial';

      // Check all known locations Adapty may place the expiry date.
      const trialEndsAt: string =
        event?.paid_access_level?.expires_at ??
        event?.access_level?.expires_at ??
        event?.trial_ends_at ??
        event?.event_properties?.expires_at ??
        event?.event_properties?.trial_expires_at ??
        '';

      console.log('[adapty-webhook] trial_ends_at resolved:', trialEndsAt || '(empty)');

      if (trialEndsAt) {
        snapshotUpdate.trial_ends_at = trialEndsAt;
        await scheduleTrialNotifications(supabase, userId, trialEndsAt);
        processed += 6;
      } else {
        console.warn('[adapty-webhook] trial_ends_at not found in any known field — snapshot updated but no notifications scheduled');
      }
      break;
    }

    case 'subscription_renewed':
      console.log('[adapty-webhook] branch: subscription_renewed');
      snapshotUpdate.subscription_status = 'active';
      break;

    case 'subscription_cancelled':
      console.log('[adapty-webhook] branch: subscription_cancelled');
      snapshotUpdate.subscription_status = 'cancelled';
      break;

    case 'subscription_expired':
      console.log('[adapty-webhook] branch: subscription_expired');
      snapshotUpdate.subscription_status = 'expired';
      break;

    default:
      console.warn('[adapty-webhook] unhandled event_type:', eventType);
      return Response.json({ received: true, processed: 0 });
  }

  console.log('[adapty-webhook] upserting snapshot:', snapshotUpdate);
  const { error: snapErr } = await supabase
    .from('user_activity_snapshot')
    .upsert({ user_id: userId, ...snapshotUpdate }, { onConflict: 'user_id' });

  if (snapErr) {
    console.warn('[adapty-webhook] snapshot upsert failed:', snapErr.message);
  } else {
    processed += 1;
    console.log('[adapty-webhook] snapshot ok, total processed:', processed);
  }

  return Response.json({ received: true, processed });
});

async function scheduleTrialNotifications(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  trialEndsAt: string,
) {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('timezone')
    .eq('id', userId)
    .maybeSingle() as { data: Row | null };
  const tz = profile?.timezone ?? 'Europe/Berlin';

  const trialEnd = new Date(trialEndsAt);

  const scheduled: Row[] = [
    { event_key: 'notif.trial_ending_t3', channel: 'push',  scheduled_at: localTimeToUTC(trialEnd, -3, 9, 0, tz).toISOString() },
    { event_key: 'notif.trial_ending_t3', channel: 'email', scheduled_at: localTimeToUTC(trialEnd, -3, 9, 0, tz).toISOString() },
    { event_key: 'notif.trial_ending_t1', channel: 'push',  scheduled_at: localTimeToUTC(trialEnd, -1, 9, 0, tz).toISOString() },
    { event_key: 'notif.trial_ending_t1', channel: 'email', scheduled_at: localTimeToUTC(trialEnd, -1, 9, 0, tz).toISOString() },
    { event_key: 'notif.trial_ending_t0', channel: 'push',  scheduled_at: new Date(trialEnd.getTime() - 4 * 3600 * 1000).toISOString() },
    { event_key: 'notif.trial_ending_t0', channel: 'email', scheduled_at: new Date(trialEnd.getTime() - 4 * 3600 * 1000).toISOString() },
  ];

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
