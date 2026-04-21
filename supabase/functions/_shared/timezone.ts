const DEFAULT_TZ = 'Europe/Berlin';

export function getUserTimezone(
  streakState: { timezone?: string | null } | null,
  profile: { timezone?: string | null } | null,
): string {
  return streakState?.timezone || profile?.timezone || DEFAULT_TZ;
}

export function getLocalHour(tz: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
  });
  const val = parseInt(formatter.format(new Date()), 10);
  // Intl may return 24 for midnight in some locales
  return val === 24 ? 0 : val;
}

export function getCurrentDateInTz(tz: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date()); // 'YYYY-MM-DD'
}

export function getStartOfDayUTC(tz: string): Date {
  const dateStr = getCurrentDateInTz(tz); // 'YYYY-MM-DD'
  // Parse midnight in the given timezone by constructing the ISO string and
  // letting Intl figure out the UTC equivalent.
  const [year, month, day] = dateStr.split('-').map(Number);
  // Build a Date by finding when midnight in tz occurs in UTC
  const midnightLocal = new Date(`${dateStr}T00:00:00`);
  // Adjust: find what UTC time corresponds to 00:00 in tz
  const tzOffset = getTzOffsetMinutes(tz, midnightLocal);
  return new Date(Date.UTC(year!, month! - 1, day!, 0, 0, 0) - tzOffset * 60 * 1000);
}

function getTzOffsetMinutes(tz: string, date: Date): number {
  // Returns offset in minutes: UTC + offset = local
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));
  return (tzDate.getTime() - utcDate.getTime()) / 60000;
}

export function isInQuietHours(
  tz: string,
  quietStart: string, // 'HH:MM:SS'
  quietEnd: string,   // 'HH:MM:SS'
): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const s = parseInt(parts.find((p) => p.type === 'second')?.value ?? '0', 10);
  const nowSecs = h * 3600 + m * 60 + s;

  const toSecs = (t: string) => {
    const [hh, mm, ss] = t.split(':').map(Number);
    return (hh ?? 0) * 3600 + (mm ?? 0) * 60 + (ss ?? 0);
  };
  const startSecs = toSecs(quietStart);
  const endSecs = toSecs(quietEnd);

  if (startSecs <= endSecs) {
    // Same-day window e.g. 09:00–17:00
    return nowSecs >= startSecs && nowSecs < endSecs;
  } else {
    // Overnight window e.g. 22:00–08:00
    return nowSecs >= startSecs || nowSecs < endSecs;
  }
}

export function hoursSince(pastIso: string, tz: string): number {
  const past = new Date(pastIso);
  const nowMs = Date.now();
  return (nowMs - past.getTime()) / 3600000;
}

export function formatDateForDisplay(isoDate: string, tz: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(isoDate));
}

// Compute scheduled_at UTC for a local time on a specific date relative to a trial end
export function localTimeToUTC(
  baseDate: Date,
  offsetDays: number,
  localHour: number,
  localMinute: number,
  tz: string,
): Date {
  const target = new Date(baseDate);
  target.setUTCDate(target.getUTCDate() + offsetDays);
  const dateStr = target.toISOString().slice(0, 10); // 'YYYY-MM-DD'
  const hh = String(localHour).padStart(2, '0');
  const mm = String(localMinute).padStart(2, '0');
  // Create a Date as if in UTC, then correct for tz offset
  const naive = new Date(`${dateStr}T${hh}:${mm}:00`);
  const tzOffset = getTzOffsetMinutes(tz, naive);
  return new Date(naive.getTime() - tzOffset * 60000);
}
