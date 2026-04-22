-- pg_cron schedules for notification Edge Functions.
-- Requires pg_cron and pg_net extensions and secrets stored in Supabase Vault:
--   name = 'supabase_url'      → project URL
--   name = 'service_role_key'  → service role key

-- Remove existing schedules if re-running (idempotent)
SELECT cron.unschedule('notif-streak-at-risk-hourly')   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notif-streak-at-risk-hourly');
SELECT cron.unschedule('notif-no-activity-hourly')       WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notif-no-activity-hourly');
SELECT cron.unschedule('notif-scheduled-sends-processor') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notif-scheduled-sends-processor');
SELECT cron.unschedule('notif-gamification-worker')       WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notif-gamification-worker');

-- T1 Streak at Risk: every hour at :30
SELECT cron.schedule(
  'notif-streak-at-risk-hourly',
  '30 * * * *',
  $$SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/streak-at-risk-cron',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'))
  )$$
);

-- T4 No Activity 48h: every hour at :45
SELECT cron.schedule(
  'notif-no-activity-hourly',
  '45 * * * *',
  $$SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/no-activity-cron',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'))
  )$$
);

-- Scheduled sends processor: every 5 minutes
SELECT cron.schedule(
  'notif-scheduled-sends-processor',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/scheduled-sends-processor',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'))
  )$$
);

-- Gamification event worker: every minute
SELECT cron.schedule(
  'notif-gamification-worker',
  '* * * * *',
  $$SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/gamification-event-worker',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'))
  )$$
);
