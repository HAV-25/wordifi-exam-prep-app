import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SECRET      = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

// ─────────────────────────────────────────────────────────────────────────────
// Tier mapping — conforms to app-side values in user_profiles.subscription_tier
// ─────────────────────────────────────────────────────────────────────────────
function toTier(productId: string): string {
  const p = productId.toLowerCase();
  if (p.includes('monthly'))                          return 'monthly';
  if (p.includes('quarterly') || p.includes('three')) return 'quarterly';
  if (p.includes('annual') || p.includes('yearly'))   return 'annual';
  return 'paid'; // safe fallback
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // Step 1 — health check
  if (req.method === 'GET' && new URL(req.url).searchParams.get('health') === '1') {
    return Response.json({ status: 'ok' });
  }

  // Step 2 — method guard
  if (req.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  }

  // Step 3 — read body before auth (idempotency check needs event_id)
  const rawBody = await req.text();

  // Step 4 — auth
  const auth = req.headers.get('Authorization') ?? '';
  if (!SECRET || auth !== `Bearer ${SECRET}`) {
    console.warn('[revenuecat-webhook] unauthorized — header:', auth ? 'present' : 'missing');
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Step 5 — parse JSON
  let parsed: Row;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    console.warn('[revenuecat-webhook] invalid JSON body');
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Step 6 — extract event envelope
  // RevenueCat wraps the payload in an "event" key
  const rc: Row = parsed.event ?? parsed;
  const eventId:   string = rc.id ?? '';
  const eventType: string = rc.type ?? rc.event_type ?? '';
  // app_user_id is the Supabase UUID set via Purchases.logIn(userId)
  const userId:    string = rc.app_user_id ?? rc.aliases?.[0] ?? '';

  console.log('[revenuecat-webhook] event_type:', eventType, 'event_id:', eventId, 'user_id:', userId || '(empty)');

  if (!eventId || !eventType) {
    console.warn('[revenuecat-webhook] missing event id or type');
    return Response.json({ error: 'missing_event_fields' }, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Step 7 — idempotency check
  const { data: existing } = await supabase
    .from('revenuecat_webhook_events')
    .select('id')
    .eq('event_id', eventId)
    .maybeSingle() as { data: Row | null };

  if (existing?.id) {
    console.log('[revenuecat-webhook] duplicate event_id — skipping:', eventId);
    return Response.json({ ok: true, duplicate: true, event_id: eventId });
  }

  // Step 8 — validate userId
  if (!userId) {
    console.warn('[revenuecat-webhook] no user_id in event — logging raw and returning');
    await supabase.from('revenuecat_webhook_events').insert({
      event_id:    eventId,
      event_type:  eventType,
      user_id:     null,
      raw_payload: parsed,
    }).then(({ error: e }) => { if (e) console.warn('[revenuecat-webhook] raw log insert failed:', e.message); });
    return Response.json({ ok: true, event_id: eventId, user_id: null });
  }

  // Step 9 — log raw event (idempotency anchor)
  const { error: logErr } = await supabase.from('revenuecat_webhook_events').insert({
    event_id:    eventId,
    event_type:  eventType,
    user_id:     userId,
    raw_payload: parsed,
  });
  if (logErr) {
    // If UNIQUE conflict it means a concurrent request beat us — treat as duplicate
    if (logErr.code === '23505') {
      console.log('[revenuecat-webhook] race duplicate on event_id:', eventId);
      return Response.json({ ok: true, duplicate: true, event_id: eventId });
    }
    console.warn('[revenuecat-webhook] raw log insert failed:', logErr.message);
    // Continue — best-effort logging should not block state updates
  }

  // Step 10 — read current profile state (old_tier, old_trial_active, target_level, timezone)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('subscription_tier, trial_active, target_level, timezone')
    .eq('id', userId)
    .maybeSingle() as { data: Row | null };

  const oldTrialActive: boolean = profile?.trial_active ?? false;
  const targetLevel:    string | null = profile?.target_level ?? null;
  const tz:             string = profile?.timezone ?? 'Europe/Berlin';

  const periodType: string  = rc.period_type ?? '';             // TRIAL | NORMAL | INTRO
  const productId:  string  = rc.product_id ?? rc.product_identifier ?? '';
  const store:      string  = rc.store ?? '';
  const expiresMs:  number | null = rc.expiration_at_ms ?? null;
  const purchasedMs: number | null = rc.purchased_at_ms ?? null;

  const expiresAt:   string | null = expiresMs   ? new Date(expiresMs).toISOString()   : null;
  const purchasedAt: string | null = purchasedMs ? new Date(purchasedMs).toISOString() : null;
  const now = new Date().toISOString();

  // Step 11 — route by event type → compute profilePatch + intentRow + subscriptionEventRow
  let profilePatch:   Row = {};
  let intentKey:      string | null = null;
  let intentContext:  Row = {};
  let subEventRow:    Row = {
    user_id:    userId,
    event_type: eventType,
    subscription_plan: productId || null,
    store:      store || null,
    raw_event_id: eventId,
  };

  switch (eventType) {
    case 'INITIAL_PURCHASE': {
      if (periodType === 'TRIAL') {
        // Trial start
        profilePatch = {
          subscription_tier:  'free_trial',
          trial_active:        true,
          trial_started_at:    now,
          trial_expires_at:    expiresAt,
          subscription_plan:   productId || null,
          subscription_store:  store || null,
          // Clear any stale end-states from a previous subscription
          expired_at:          null,
          cancelled_at:        null,
          billing_issue:       false,
          billing_issue_at:    null,
        };
        intentKey = 'trial_started';
        intentContext = {
          trial_expires_at: expiresAt,
          plan:             productId || null,
          store:            store || null,
          target_level:     targetLevel,
        };
        subEventRow = { ...subEventRow, trial_started_at: now, trial_ends_at: expiresAt };
      } else {
        // Direct paid purchase (no trial)
        const tier = toTier(productId);
        profilePatch = {
          subscription_tier:    tier,
          trial_active:          false,
          paid_since_at:         now,
          subscription_valid_until: expiresAt,
          subscription_plan:     productId || null,
          subscription_store:    store || null,
          expired_at:            null,
          cancelled_at:          null,
          billing_issue:         false,
          billing_issue_at:      null,
        };
        intentKey = 'subscription_started';
        intentContext = { plan: productId || null, store: store || null };
        subEventRow = { ...subEventRow, paid_since_at: now };
      }
      break;
    }

    case 'RENEWAL': {
      // Silent — no intent row
      profilePatch = {
        last_renewed_at:          now,
        subscription_valid_until: expiresAt,
        // Ensure tier reflects active paid state (in case of lapse/re-sub)
        subscription_tier:        toTier(productId),
        trial_active:              false,
        billing_issue:             false,
        billing_issue_at:          null,
      };
      subEventRow = { ...subEventRow, renewed_at: now };
      break;
    }

    case 'CANCELLATION': {
      // Do NOT clear tier/trial_active — subscription still valid until expiry
      profilePatch = { cancelled_at: now };
      intentKey = 'subscription_cancelled';
      intentContext = { expires_at: expiresAt, plan: productId || null };
      subEventRow = { ...subEventRow, cancelled_at: now };
      break;
    }

    case 'EXPIRATION': {
      profilePatch = {
        subscription_tier: 'free',
        trial_active:       false,
        expired_at:         now,
      };
      intentKey = 'subscription_expired';
      // was_trial captures the state BEFORE this event was applied
      intentContext = { plan: productId || null, was_trial: oldTrialActive };
      subEventRow = { ...subEventRow, expired_at: now };
      break;
    }

    case 'BILLING_ISSUE': {
      profilePatch = {
        billing_issue:    true,
        billing_issue_at: now,
      };
      intentKey = 'billing_issue';
      intentContext = { plan: productId || null };
      subEventRow = { ...subEventRow, billing_issue: true };
      break;
    }

    case 'PRODUCT_CHANGE': {
      // Silent — just track new plan
      profilePatch = { subscription_plan: productId || null };
      break;
    }

    default: {
      console.log('[revenuecat-webhook] unhandled event_type, logging only:', eventType);
      return Response.json({ ok: true, event_type: eventType, user_id: userId, intents_created: 0 });
    }
  }

  // Step 12 — write profile patch, subscription_events, and notification_intents
  // All three are best-effort: log failures but always return 200 to prevent RC retries

  // 12a — update user_profiles
  if (Object.keys(profilePatch).length > 0) {
    const { error: profileErr } = await supabase
      .from('user_profiles')
      .update(profilePatch)
      .eq('id', userId);
    if (profileErr) {
      console.warn('[revenuecat-webhook] user_profiles update failed:', profileErr.message);
    }
  }

  // 12b — insert subscription_events audit row
  const { error: subErr } = await supabase
    .from('subscription_events')
    .insert(subEventRow);
  if (subErr) {
    console.warn('[revenuecat-webhook] subscription_events insert failed:', subErr.message);
  }

  // 12c — insert notification_intents (if this event type warrants one)
  let intentsCreated = 0;
  if (intentKey) {
    // Idempotency: delete any existing unprocessed intent for this user+key before inserting
    await supabase
      .from('notification_intents')
      .delete()
      .eq('user_id', userId)
      .eq('intent_key', intentKey)
      .is('processed_at', null)
      .then(({ error: delErr }) => {
        if (delErr) console.warn('[revenuecat-webhook] intent dedup delete failed:', delErr.message);
      });

    const { error: intentErr } = await supabase
      .from('notification_intents')
      .insert({
        user_id:         userId,
        intent_key:      intentKey,
        effective_at:    purchasedAt ?? now,
        context:         intentContext,
        source:          'revenuecat_webhook',
        source_event_id: eventId,
      });

    if (intentErr) {
      console.warn('[revenuecat-webhook] notification_intents insert failed:', intentErr.message);
    } else {
      intentsCreated = 1;
      console.log('[revenuecat-webhook] intent created:', intentKey, 'for user:', userId);
    }
  }

  console.log('[revenuecat-webhook] done — event_type:', eventType, 'user_id:', userId, 'intents_created:', intentsCreated);
  return Response.json({ ok: true, event_type: eventType, user_id: userId, intents_created: intentsCreated });
});
