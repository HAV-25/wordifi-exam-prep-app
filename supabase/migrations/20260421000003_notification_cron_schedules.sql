-- pg_cron schedules for notification Edge Functions.
-- Requires pg_cron and pg_net extensions — verify both are enabled in
-- Supabase Dashboard → Database → Extensions before running this migration.
--
-- Also requires app.supabase_url and app.service_role_key to be set
-- (see migration 20260421000002 for the ALTER DATABASE commands).

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
    url     := current_setting('app.supabase_url') || '/functions/v1/streak-at-risk-cron',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
  )$$
);

-- T4 No Activity 48h: every hour at :45
SELECT cron.schedule(
  'notif-no-activity-hourly',
  '45 * * * *',
  $$SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/no-activity-cron',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
  )$$
);

-- Scheduled sends processor: every 5 minutes
SELECT cron.schedule(
  'notif-scheduled-sends-processor',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/scheduled-sends-processor',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
  )$$
);

-- Gamification event worker: every minute
SELECT cron.schedule(
  'notif-gamification-worker',
  '* * * * *',
  $$SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/gamification-event-worker',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
  )$$
);
