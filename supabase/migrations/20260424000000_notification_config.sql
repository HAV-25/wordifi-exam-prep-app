CREATE TABLE public.notification_config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  category    TEXT
);

-- service_role bypasses RLS by default; enabling RLS with no permissive policy
-- already blocks all non-service-role access. No explicit policy needed.
ALTER TABLE public.notification_config ENABLE ROW LEVEL SECURITY;

-- Seed with current hard-coded values as safe defaults.
-- Adding a new tunable requires BOTH a new row here AND a new typed field in
-- _shared/notifConfig.ts (see that file's DEFAULTS object and loadNotifConfig()).
INSERT INTO public.notification_config (key, value, description, category) VALUES
  ('notif.t1_fire_hour_local',         '20',                              'Hour (0–23) user-local when T1 streak-at-risk fires',  'timing'),
  ('notif.t4_min_hours_inactive',      '48',                              'Min hours inactive before T4 fires',                   'timing'),
  ('notif.t4_max_hours_inactive',      '72',                              'Max hours inactive for T4 window',                     'timing'),
  ('notif.t4_ramp_in_days',            '30',                              'Days post-signup before T4 allowed to fire',           'ramp_in'),
  ('notif.default_max_push_per_day',   '1',                               'Push cap fallback when prefs row has NULL',            'defaults'),
  ('notif.default_max_email_per_week', '2',                               'Email cap fallback when prefs row has NULL',           'defaults'),
  ('notif.email_from_address',         '"Wordifi <team@wordifimail.eu>"', 'Sender address for all Resend outbound email',         'provider');
