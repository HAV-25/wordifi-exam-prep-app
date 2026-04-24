import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { gate, Channel, Category } from './gating.ts';
import { renderTemplate, TemplateContext, RenderedPush, RenderedEmail, RenderedInApp } from './templates.ts';
import { sendPush, sendEmail, setInAppTag } from './providers.ts';

export type DispatchInput = {
  userId: string;
  eventKey: string;
  channel: Channel;
  category: Category;
  payload?: Record<string, unknown>;
};

export type DispatchResult = {
  channel: Channel;
  status: 'sent' | 'suppressed' | 'failed' | 'delivered';
  reason?: string;
  message_id?: string;
};

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

async function buildTemplateContext(
  supabase: SupabaseClient,
  userId: string,
  payload: Record<string, unknown>,
): Promise<TemplateContext> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('first_name, target_level, trial_expires_at, timezone, exam_type, exam_date')
    .eq('id', userId)
    .maybeSingle() as { data: Row | null };

  const { data: streak } = await supabase
    .from('user_streak_state')
    .select('current_streak_days, longest_streak_days')
    .eq('user_id', userId)
    .maybeSingle() as { data: Row | null };

  const trialEndsAt = profile?.trial_expires_at ?? (payload.trial_ends_at as string | undefined);
  const tz = profile?.timezone ?? 'Europe/Berlin';

  // Compute days_to_exam from exam_date if present
  const examDate: string | null = profile?.exam_date ?? null;
  const daysToExam = examDate
    ? Math.max(0, Math.ceil((new Date(examDate).getTime() - Date.now()) / 86_400_000))
    : undefined;

  // Format exam_date for display (e.g. "12 May 2026")
  const examDateFormatted = examDate
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(examDate))
    : undefined;

  return {
    first_name: profile?.first_name ?? '',
    cefr_level: profile?.target_level ?? '',
    target_level: profile?.target_level ?? '',
    exam_type: profile?.exam_type ?? undefined,
    exam_date: examDateFormatted ?? undefined,
    days_to_exam: daysToExam,
    streak_days: (streak?.current_streak_days as number | undefined) ?? 0,
    trial_ends_at_formatted: trialEndsAt
      ? new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(trialEndsAt))
      : '',
    ...payload,
  };
}

// Maps a channel to the external provider name written to notification_events.
// Returns null for cases where no provider was invoked (suppressed rows).
function channelProvider(ch: Channel): string | null {
  if (ch === 'push')   return 'onesignal';
  if (ch === 'email')  return 'resend';
  if (ch === 'in_app') return 'supabase';
  return null;
}

async function logEvent(
  supabase: SupabaseClient,
  userId: string,
  eventKey: string,
  channel: Channel,
  category: Category,
  status: string,
  opts: { suppression_reason?: string; provider_message_id?: string; provider?: string | null; error?: unknown; payload?: Record<string, unknown> },
) {
  await supabase.from('notification_events').insert({
    user_id: userId,
    event_key: eventKey,
    channel,
    category,
    status,
    provider: opts.provider ?? null,
    sent_at: ['sent', 'delivered'].includes(status) ? new Date().toISOString() : null,
    suppression_reason: opts.suppression_reason ?? null,
    provider_message_id: opts.provider_message_id ?? null,
    error: opts.error ? { message: String(opts.error) } : null,
    payload: opts.payload ?? {},
  }).then(({ error: e }) => {
    if (e) console.warn('[dispatch] log insert failed', e.message);
  });
}

async function writeUserNotification(
  supabase: SupabaseClient,
  userId: string,
  eventKey: string,
  rendered: RenderedInApp,
  payload: Record<string, unknown>,
) {
  const { error } = await supabase.from('user_notifications').insert({
    user_id: userId,
    type: eventKey,
    title: rendered.body.slice(0, 60),
    body: rendered.body,
    action_url: rendered.deep_link ?? null,
    metadata: payload,
    read_at: null,
  });
  if (error) {
    console.warn('[dispatch] user_notifications insert failed', error.message);
  }
}

export async function dispatchChannel(
  supabase: SupabaseClient,
  input: DispatchInput,
): Promise<DispatchResult> {
  const { userId, eventKey, channel, category, payload = {} } = input;

  try {
    // Gating
    const gateResult = await gate(supabase, userId, channel, category, eventKey);
    if (!gateResult.ok) {
      await logEvent(supabase, userId, eventKey, channel, category, 'suppressed', {
        suppression_reason: gateResult.reason,
        payload,
      });
      return { channel, status: 'suppressed', reason: gateResult.reason };
    }

    // Build template context
    const ctx = await buildTemplateContext(supabase, userId, payload);

    // Render
    const rendered = renderTemplate(eventKey, channel, ctx);
    if (!rendered) {
      await logEvent(supabase, userId, eventKey, channel, category, 'suppressed', {
        suppression_reason: 'no_template',
        payload,
      });
      return { channel, status: 'suppressed', reason: 'no_template' };
    }

    // Dispatch
    if (channel === 'push') {
      const r = rendered as RenderedPush;
      const result = await sendPush(gateResult.token!, r.headings, r.contents, r.deep_link, payload);
      const status = result.ok ? 'sent' : 'failed';
      await logEvent(supabase, userId, eventKey, channel, category, status, {
        provider: 'onesignal',
        provider_message_id: result.messageId,
        error: result.error,
        payload,
      });
      return { channel, status, message_id: result.messageId, reason: result.error };
    }

    if (channel === 'email') {
      const r = rendered as RenderedEmail;
      const result = await sendEmail(gateResult.email!, r.subject, r.html, r.text);
      const status = result.ok ? 'sent' : 'failed';
      await logEvent(supabase, userId, eventKey, channel, category, status, {
        provider: 'resend',
        provider_message_id: result.messageId,
        error: result.error,
        payload,
      });
      return { channel, status, message_id: result.messageId, reason: result.error };
    }

    // in_app
    const r = rendered as RenderedInApp;

    // Set OneSignal tag (secondary — failure doesn't block)
    setInAppTag(userId, eventKey).catch((e) => console.warn('[dispatch] setInAppTag failed', e));

    // Write to user_notifications (critical path for app display)
    await writeUserNotification(supabase, userId, eventKey, r, payload);

    // Write notification_events log (secondary)
    await logEvent(supabase, userId, eventKey, channel, category, 'delivered', {
      provider: 'supabase',
      payload,
    });

    return { channel, status: 'delivered' };
  } catch (e) {
    console.warn('[dispatch] unexpected error', e);
    await logEvent(supabase, userId, eventKey, channel, category, 'failed', {
      provider: channelProvider(channel),
      error: e,
      payload,
    }).catch(() => {});
    return { channel, status: 'failed', reason: String(e) };
  }
}
