const TIMEOUT_MS = 10_000;

function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

export type ProviderResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

export async function sendPush(
  playerToken: string,
  headings: { en: string },
  contents: { en: string },
  deepLink: string,
  payload?: Record<string, unknown>,
): Promise<ProviderResult> {
  const appId = Deno.env.get('ONESIGNAL_APP_ID');
  const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY');
  if (!appId || !apiKey) {
    console.warn('[providers] OneSignal env vars missing');
    return { ok: false, error: 'onesignal_not_configured' };
  }

  try {
    const body = {
      app_id: appId,
      include_subscription_ids: [playerToken],
      headings,
      contents,
      data: { deep_link: deepLink, ...payload },
      priority: 10,
      android_visibility: 1,
    };
    const res = await fetchWithTimeout('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));

    // Log full response for diagnostics
    console.log('[providers] OneSignal response status:', res.status);
    console.log('[providers] OneSignal response body:', JSON.stringify(json));

    if (!res.ok) {
      const errMsg = json?.errors?.[0] ?? `http_${res.status}`;
      console.warn('[providers] OneSignal HTTP error:', errMsg);
      return { ok: false, error: errMsg };
    }

    // errors can be an array OR an object (e.g. {invalid_player_ids:[...]}) — both mean failure
    if (json?.errors) {
      const hasErrors = Array.isArray(json.errors)
        ? json.errors.length > 0
        : typeof json.errors === 'object' && Object.keys(json.errors).length > 0;
      if (hasErrors) {
        const errMsg = Array.isArray(json.errors)
          ? json.errors[0]
          : JSON.stringify(json.errors);
        console.warn('[providers] OneSignal returned errors on 200:', json.errors);
        return { ok: false, error: errMsg };
      }
    }

    // recipients:0 means no device was reached
    if (json?.recipients === 0) {
      console.warn('[providers] OneSignal recipients=0 — device not subscribed or player_id invalid');
      return { ok: false, error: 'no_recipients' };
    }

    console.log('[providers] OneSignal push sent, id:', json?.id, 'recipients:', json?.recipients);
    return { ok: true, messageId: json?.id };
  } catch (e) {
    console.warn('[providers] sendPush error', e);
    return { ok: false, error: String(e) };
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
  from?: string,
): Promise<ProviderResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.warn('[providers] RESEND_API_KEY missing');
    return { ok: false, error: 'resend_not_configured' };
  }

  try {
    const res = await fetchWithTimeout('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: from ?? 'Wordifi <team@wordifimail.eu>',
        to: [to],
        subject,
        html,
        ...(text ? { text } : {}),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json?.message ?? `http_${res.status}` };
    }
    return { ok: true, messageId: json?.id };
  } catch (e) {
    console.warn('[providers] sendEmail error', e);
    return { ok: false, error: String(e) };
  }
}

// Sets an OneSignal user tag so IAM rules can target this user.
// The tag key pattern notif_in_app_<eventKey> is what Payal configures in the dashboard.
export async function setInAppTag(
  userId: string,
  eventKey: string,
): Promise<ProviderResult> {
  const appId = Deno.env.get('ONESIGNAL_APP_ID');
  const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY');
  if (!appId || !apiKey) {
    return { ok: false, error: 'onesignal_not_configured' };
  }

  const tagKey = `notif_in_app_${eventKey.replace(/\./g, '_')}`;
  try {
    const res = await fetchWithTimeout(
      `https://api.onesignal.com/apps/${appId}/users/by/external_id/${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${apiKey}`,
        },
        body: JSON.stringify({ properties: { tags: { [tagKey]: new Date().toISOString() } } }),
      },
    );
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return { ok: false, error: json?.errors?.[0] ?? `http_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.warn('[providers] setInAppTag error', e);
    return { ok: false, error: String(e) };
  }
}
