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
  userId: string,
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
      include_aliases: { external_id: [userId] },
      target_channel: 'push',
      headings,
      contents,
      data: { deep_link: deepLink, ...payload },
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
    if (!res.ok) {
      return { ok: false, error: json?.errors?.[0] ?? `http_${res.status}` };
    }
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
        from: 'Wordifi <notifications@mail.wordifi.com>',
        to: [to],
        subject,
        html,
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
