import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { dispatchChannel, DispatchInput } from '../_shared/dispatch.ts';
import { Channel, Category } from '../_shared/gating.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === 'GET' && url.searchParams.get('health') === '1') {
    return Response.json({ status: 'ok' });
  }

  // Auth check
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ') || auth.slice(7) !== SERVICE_ROLE_KEY) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { user_id, event_key, channels, category, payload } = body as Record<string, unknown>;

  if (
    typeof user_id !== 'string' ||
    typeof event_key !== 'string' ||
    !Array.isArray(channels) ||
    channels.length === 0 ||
    typeof category !== 'string'
  ) {
    return Response.json({ error: 'invalid_input', detail: 'user_id, event_key, channels[], category required' }, { status: 400 });
  }

  const validChannels: Channel[] = ['push', 'email', 'in_app'];
  const validCategories: Category[] = ['practice', 'progress', 'monetisation', 'transactional'];

  for (const ch of channels) {
    if (!validChannels.includes(ch as Channel)) {
      return Response.json({ error: 'invalid_channel', detail: ch }, { status: 400 });
    }
  }
  if (!validCategories.includes(category as Category)) {
    return Response.json({ error: 'invalid_category', detail: category }, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const results = await Promise.allSettled(
    (channels as Channel[]).map((channel) =>
      dispatchChannel(supabase, {
        userId: user_id,
        eventKey: event_key,
        channel,
        category: category as Category,
        payload: (payload as Record<string, unknown>) ?? {},
      } satisfies DispatchInput)
    )
  );

  const dispatched = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { channel: 'unknown', status: 'failed', reason: String((r as PromiseRejectedResult).reason) }
  );

  return Response.json({ dispatched });
});
