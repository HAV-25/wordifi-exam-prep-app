import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { dispatchChannel } from '../_shared/dispatch.ts';
import { Channel, Category } from '../_shared/gating.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BATCH_SIZE = 10;

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === 'GET' && url.searchParams.get('health') === '1') {
    return Response.json({ status: 'ok' });
  }

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ') || auth.slice(7) !== SERVICE_ROLE_KEY) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: rows, error } = await supabase
    .from('notification_events')
    .select('*')
    .eq('status', 'queued')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(100) as { data: Row[] | null; error: unknown };

  if (error) {
    console.warn('[scheduled-sends-processor] query failed', error);
    return Response.json({ error: 'query_failed' }, { status: 500 });
  }

  const pending = rows ?? [];
  let sent = 0, failed = 0, suppressed = 0;

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((row) =>
        dispatchChannel(supabase, {
          userId: row.user_id,
          eventKey: row.event_key,
          channel: row.channel as Channel,
          category: row.category as Category,
          payload: row.payload ?? {},
        })
      )
    );

    // Update each row based on result
    await Promise.allSettled(
      results.map(async (result, idx) => {
        const row = batch[idx]!;
        if (result.status === 'fulfilled') {
          const r = result.value;
          if (r.status === 'sent' || r.status === 'delivered') sent++;
          else if (r.status === 'suppressed') suppressed++;
          else failed++;

          await supabase
            .from('notification_events')
            .update({
              status: r.status,
              sent_at: ['sent', 'delivered'].includes(r.status) ? new Date().toISOString() : null,
              provider_message_id: r.message_id ?? null,
              suppression_reason: r.reason ?? null,
            })
            .eq('id', row.id);
        } else {
          failed++;
          await supabase
            .from('notification_events')
            .update({
              status: 'failed',
              error: { message: String(result.reason) },
            })
            .eq('id', row.id);
        }
      })
    );
  }

  return Response.json({ processed: pending.length, sent, failed, suppressed });
});
