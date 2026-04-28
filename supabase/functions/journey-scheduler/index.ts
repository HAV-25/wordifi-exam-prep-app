import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { localTimeToUTC, getUserTimezone } from '../_shared/timezone.ts';
import { isAuthorised } from '../_shared/cronAuth.ts';

// DEFAULT_TZ is not exported from timezone.ts — mirror the same value here.
const DEFAULT_TZ = 'Europe/Berlin';

// Stale-message cutoff: if the computed scheduled_at is more than 5 min in the
// past, the message window has been missed. Skip rather than fire late.
const STALE_CUTOFF_MS = 5 * 60 * 1000;

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
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

  // ─── Fetch pending intents ─────────────────────────────────────────────────
  const { data: intents, error: intentsErr } = await supabase
    .from('notification_intents')
    .select('*')
    .is('processed_at', null)
    .lte('effective_at', new Date().toISOString())
    .lt('attempt_count', 3)
    .order('effective_at', { ascending: true })
    .limit(50) as { data: Row[] | null; error: unknown };

  if (intentsErr) {
    console.warn('[journey-scheduler] failed to query notification_intents:', intentsErr);
    return Response.json({ error: 'query_failed' }, { status: 500 });
  }

  const pending = intents ?? [];
  console.log('[journey-scheduler] pending intents:', pending.length);

  if (pending.length === 0) {
    return Response.json({ processed: 0, skipped: 0, failed: 0, intents: [] });
  }

  const summary: Row[] = [];
  let totalProcessed = 0, totalSkipped = 0, totalFailed = 0;

  for (const intent of pending) {
    console.log(`[journey-scheduler] INTENT ${intent.id} | key=${intent.intent_key} | user=${intent.user_id} | effective_at=${intent.effective_at}`);

    let eventsInserted = 0;
    let journeysSkipped = 0;

    try {
      // Step 1 — resolve user timezone
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('timezone')
        .eq('id', intent.user_id)
        .maybeSingle() as { data: Row | null };

      const userTimezone: string = getUserTimezone(null, profile) || DEFAULT_TZ;
      console.log(`[journey-scheduler] intent ${intent.id} | resolved tz=${userTimezone}`);

      // Step 2 — load active journeys for this intent_key
      const { data: journeys, error: journeysErr } = await supabase
        .from('notification_journeys')
        .select('*')
        .eq('intent_key', intent.intent_key)
        .eq('active', true) as { data: Row[] | null; error: unknown };

      if (journeysErr) {
        throw new Error(`notification_journeys query failed: ${JSON.stringify(journeysErr)}`);
      }

      const matched = journeys ?? [];
      console.log(`[journey-scheduler] intent ${intent.id} | matched ${matched.length} active journeys`);
      for (const j of matched) {
        console.log(`[journey-scheduler]   journey: message_key=${j.message_key} trigger_type=${j.trigger_type} trigger_spec=${JSON.stringify(j.trigger_spec)} channels=${JSON.stringify(j.channels)}`);
      }

      // Step 3 — fan out per journey × channel
      for (const journey of matched) {
        const { message_key, trigger_type, trigger_spec, channels, category, conditions, display_id } = journey;

        // event-type journeys are fired by app events, not the scheduler
        if (trigger_type === 'event') {
          console.log(`[journey-scheduler] SKIP (event-type) journey: ${message_key}`);
          journeysSkipped++;
          continue;
        }

        // Compute scheduled_at in UTC
        let scheduledAt: Date;
        const baseDate = new Date(intent.effective_at);
        console.log(`[journey-scheduler] intent ${intent.id} | journey ${message_key} | baseDate=${baseDate.toISOString()} trigger_type=${trigger_type}`);

        if (trigger_type === 'time_offset') {
          const offsetMin: number = trigger_spec?.offset_minutes ?? 0;
          scheduledAt = new Date(baseDate.getTime() + offsetMin * 60_000);
          console.log(`[journey-scheduler] time_offset +${offsetMin}min → scheduledAt=${scheduledAt.toISOString()}`);
        } else if (trigger_type === 'time_of_day') {
          const hourLocal: number = trigger_spec?.hour_local  ?? 9;
          const minLocal:  number = trigger_spec?.min_local   ?? 0;
          const dayOffset: number = trigger_spec?.day_offset  ?? 0;
          scheduledAt = localTimeToUTC(baseDate, dayOffset, hourLocal, minLocal, userTimezone);
          console.log(`[journey-scheduler] time_of_day day_offset=${dayOffset} ${String(hourLocal).padStart(2,'0')}:${String(minLocal).padStart(2,'0')} local (${userTimezone}) → scheduledAt=${scheduledAt.toISOString()}`);
        } else {
          console.warn(`[journey-scheduler] SKIP unknown trigger_type=${trigger_type} journey: ${message_key}`);
          journeysSkipped++;
          continue;
        }

        // Stale check
        const nowMs = Date.now();
        const staleThresholdMs = nowMs - STALE_CUTOFF_MS;
        const isStale = scheduledAt.getTime() < staleThresholdMs;
        console.log(`[journey-scheduler] stale check | scheduledAt=${scheduledAt.getTime()} staleThreshold=${staleThresholdMs} nowMs=${nowMs} isStale=${isStale}`);

        if (isStale) {
          console.log(`[journey-scheduler] SKIP (past-time) journey: ${message_key} | scheduledAt was ${scheduledAt.toISOString()}`);
          journeysSkipped++;
          continue;
        }

        // Fan out: one notification_events row per channel
        const channelList: string[] = Array.isArray(channels) ? channels : [channels as string];
        console.log(`[journey-scheduler] channelList=${JSON.stringify(channelList)}`);

        for (const channel of channelList) {
          const dedupKey = `${intent.id}:${message_key}:${channel}`;

          const payload = {
            intent_id:  intent.id,
            context:    intent.context  ?? {},
            conditions: conditions      ?? {},
            display_id: display_id      ?? null,
          };

          console.log(`[journey-scheduler] INSERT notification_events | dedup_key=${dedupKey} | scheduled_at=${scheduledAt.toISOString()}`);

          // Use plain insert + explicit 23505 handling instead of upsert
          // (upsert ON CONFLICT requires a named constraint; dedup_key uses a partial index)
          const { error: insertErr } = await supabase
            .from('notification_events')
            .insert({
              user_id:      intent.user_id,
              event_key:    message_key,
              channel,
              category,
              status:       'queued',
              scheduled_at: scheduledAt.toISOString(),
              payload,
              dedup_key:    dedupKey,
            });

          if (insertErr) {
            // 23505 = unique_violation: row already exists — idempotent, treat as success
            if ((insertErr as Row).code === '23505') {
              console.log(`[journey-scheduler] dedup skip (already exists): ${dedupKey}`);
              eventsInserted++; // count as delivered — idempotent
            } else {
              console.warn(`[journey-scheduler] INSERT FAILED for ${dedupKey}: code=${(insertErr as Row).code} message=${(insertErr as Row).message}`);
            }
          } else {
            console.log(`[journey-scheduler] INSERT OK: ${dedupKey}`);
            eventsInserted++;
          }
        }
      }

      // Step 4 — mark intent processed
      await supabase
        .from('notification_intents')
        .update({
          processed_at:  new Date().toISOString(),
          attempt_count: (intent.attempt_count ?? 0) + 1,
        })
        .eq('id', intent.id);

      console.log(`[journey-scheduler] intent ${intent.id} DONE | events_inserted=${eventsInserted} journeys_skipped=${journeysSkipped}`);

      totalProcessed++;
      summary.push({ id: intent.id, intent_key: intent.intent_key, status: 'processed', events_inserted: eventsInserted, journeys_skipped: journeysSkipped });

    } catch (e) {
      const failureMessage = String(e);
      console.warn(`[journey-scheduler] intent ${intent.id} EXCEPTION: ${failureMessage}`);

      const newAttemptCount = (intent.attempt_count ?? 0) + 1;
      const maxReached = newAttemptCount >= 3;

      await supabase
        .from('notification_intents')
        .update({
          attempt_count: newAttemptCount,
          last_error:    maxReached ? `max_attempts_reached: ${failureMessage}` : failureMessage,
          processed_at:  maxReached ? new Date().toISOString() : null,
        })
        .eq('id', intent.id);

      totalFailed++;
      summary.push({ id: intent.id, intent_key: intent.intent_key, status: maxReached ? 'failed_max_attempts' : 'failed_will_retry', error: failureMessage });
    }

    totalSkipped += journeysSkipped;
  }

  console.log(`[journey-scheduler] SUMMARY | processed=${totalProcessed} skipped=${totalSkipped} failed=${totalFailed}`);
  return Response.json({ processed: totalProcessed, skipped: totalSkipped, failed: totalFailed, intents: summary });
});
