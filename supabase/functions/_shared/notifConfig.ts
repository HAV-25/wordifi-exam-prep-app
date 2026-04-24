import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type NotifConfig = {
  t1FireHourLocal: number;
  t4MinHoursInactive: number;
  t4MaxHoursInactive: number;
  t4RampInDays: number;
  defaultMaxPushPerDay: number;
  defaultMaxEmailPerWeek: number;
  emailFromAddress: string;
};

// Code-level fallbacks — mirrors DB seed values; used if notification_config is
// unreachable. Adding a new tunable requires BOTH a new field here (and its
// mapping in loadNotifConfig below) AND a new row in the migration. This is
// intentional: keeps config typed and prevents silent key-name mismatches.
const DEFAULTS: NotifConfig = {
  t1FireHourLocal: 20,
  t4MinHoursInactive: 48,
  t4MaxHoursInactive: 72,
  t4RampInDays: 30,
  defaultMaxPushPerDay: 1,
  defaultMaxEmailPerWeek: 2,
  emailFromAddress: 'Wordifi <team@wordifimail.eu>',
};

export async function loadNotifConfig(supabase: SupabaseClient): Promise<NotifConfig> {
  const { data, error } = await supabase
    .from('notification_config')
    .select('key, value');

  if (error || !data) {
    console.warn('[notifConfig] falling back to defaults:', error?.message);
    return { ...DEFAULTS };
  }

  const m = new Map(data.map((r: { key: string; value: unknown }) => [r.key, r.value]));
  const n = <T>(key: string, def: T): T => (m.has(key) ? (m.get(key) as T) : def);

  return {
    t1FireHourLocal:        n('notif.t1_fire_hour_local',         DEFAULTS.t1FireHourLocal),
    t4MinHoursInactive:     n('notif.t4_min_hours_inactive',      DEFAULTS.t4MinHoursInactive),
    t4MaxHoursInactive:     n('notif.t4_max_hours_inactive',      DEFAULTS.t4MaxHoursInactive),
    t4RampInDays:           n('notif.t4_ramp_in_days',            DEFAULTS.t4RampInDays),
    defaultMaxPushPerDay:   n('notif.default_max_push_per_day',   DEFAULTS.defaultMaxPushPerDay),
    defaultMaxEmailPerWeek: n('notif.default_max_email_per_week', DEFAULTS.defaultMaxEmailPerWeek),
    emailFromAddress:       n('notif.email_from_address',         DEFAULTS.emailFromAddress),
  };
}
