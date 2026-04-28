/**
 * notificationPreferences.ts
 *
 * Typed data-layer and hook for the `notification_preferences` table.
 * Each field write is immediate (optimistic) with rollback on error.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';
import { track } from '@/lib/track';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotifPrefs = {
  push_enabled: boolean;
  email_enabled: boolean;
  in_app_enabled: boolean;
  category_practice: boolean;
  category_progress: boolean;
  category_monetisation: boolean;
  category_transactional: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;   // 'HH:MM:SS'
  quiet_hours_end: string;     // 'HH:MM:SS'
  timezone: string;
  max_push_per_day: number;
  daily_reminder_time: string | null;  // 'HH:MM:SS' | null
};

const DEFAULTS: NotifPrefs = {
  push_enabled: true,
  email_enabled: true,
  in_app_enabled: true,
  category_practice: true,
  category_progress: true,
  category_monetisation: true,
  category_transactional: true,
  quiet_hours_enabled: true,
  quiet_hours_start: '22:00:00',
  quiet_hours_end: '08:00:00',
  timezone: 'Europe/Berlin',
  max_push_per_day: 3,
  daily_reminder_time: '19:00:00',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** 'HH:MM:SS' → Date (today's date with given time) */
export function timeStrToDate(t: string): Date {
  const parts = t.split(':').map(Number);
  const d = new Date();
  d.setHours(parts[0] ?? 0, parts[1] ?? 0, 0, 0);
  return d;
}

/** Date → 'HH:MM:SS' */
export function dateToTimeStr(d: Date): string {
  return [
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
    '00',
  ].join(':');
}

/** 'HH:MM:SS' → '7:30 PM' */
export function fmtTime(t: string | null | undefined): string {
  if (!t) return '—';
  const parts = t.split(':').map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotificationPreferences(userId: string | undefined) {
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Ref so updateField callback always has latest prefs without re-binding
  const prefsRef = useRef<NotifPrefs | null>(null);
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setLoadError(null);

    supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()
      .then(({ data, error: err }) => {
        if (err && err.code !== 'PGRST116') {
          setLoadError('Could not load notification preferences.');
        } else {
          setPrefs((data as NotifPrefs | null) ?? DEFAULTS);
        }
        setLoading(false);
      });
  }, [userId]);

  // ── Silently sync device timezone ─────────────────────────────────────────
  // Writes deviceTz to both notification_preferences.timezone AND
  // user_profiles.timezone so journey-scheduler always has the correct
  // local timezone regardless of which table it reads.
  useEffect(() => {
    if (!userId || !prefs) return;
    const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!deviceTz || prefs.timezone === deviceTz) return;
    void Promise.all([
      supabase
        .from('notification_preferences')
        .update({ timezone: deviceTz, updated_at: new Date().toISOString() } as never)
        .eq('user_id', userId),
      supabase
        .from('user_profiles')
        .update({ timezone: deviceTz } as never)
        .eq('id', userId),
    ]).then(() => setPrefs((p) => (p ? { ...p, timezone: deviceTz } : p)));
  }, [userId, prefs?.timezone]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Optimistic write ──────────────────────────────────────────────────────
  const updateField = useCallback(
    async (field: keyof NotifPrefs, value: NotifPrefs[keyof NotifPrefs]) => {
      if (!userId) return;
      const prev = prefsRef.current?.[field];
      setPrefs((p) => (p ? { ...p, [field]: value } : p));
      setSaveError(null);
      try {
        const { error: err } = await supabase
          .from('notification_preferences')
          .update({ [field]: value, updated_at: new Date().toISOString() } as never)
          .eq('user_id', userId);
        if (err) throw err;
        track('notification_preferences_updated', { field });
      } catch {
        // Rollback
        setPrefs((p) => (p ? { ...p, [field]: prev } : p));
        setSaveError("Couldn't save — try again.");
      }
    },
    [userId]
  );

  return { prefs, loading, loadError, saveError, setSaveError, updateField };
}
