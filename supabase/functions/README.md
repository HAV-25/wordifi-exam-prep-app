# Wordifi — Notification Edge Functions

Server-side push/email/in-app dispatch layer. All functions are Deno-based Supabase Edge Functions.

---

## Functions

| Function | Trigger | Purpose |
|---|---|---|
| `notify-user` | HTTP POST (internal) | Core dispatcher — gating pipeline + provider calls |
| `adapty-webhook` | HTTP POST from Adapty | Trial lifecycle → schedule T-3/T-1/T-0 notifications |
| `scheduled-sends-processor` | pg_cron every 5 min | Drains `notification_events` queue |
| `gamification-event-worker` | pg_cron every 1 min | Polls `gamification_event_log`, maps events to notifications |
| `streak-at-risk-cron` | pg_cron every hour :30 | T1 detection — fires at 7 PM local per user |
| `no-activity-cron` | pg_cron every hour :45 | T4 detection — 48–72h no activity window |

---

## Required secrets

Set these in **Supabase Dashboard → Edge Functions → Secrets** (or `supabase secrets set`):

| Secret | Description |
|---|---|
| `ONESIGNAL_APP_ID` | `80019919-1ccf-4629-ad57-067fcb7af435` |
| `ONESIGNAL_REST_API_KEY` | OneSignal REST API key |
| `RESEND_API_KEY` | Resend API key |
| `ADAPTY_WEBHOOK_SECRET` | **Payal must add this** — generate a random 32-char string |
| `SUPABASE_URL` | Auto-provided by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-provided by Supabase |

---

## Manual setup steps (Payal — run once after deploy)

### 1. Set database config vars
Run in **Supabase SQL Editor**:
```sql
ALTER DATABASE postgres SET app.supabase_url = 'https://wwfiauhsbssjowaxmqyn.supabase.co';
ALTER DATABASE postgres SET app.service_role_key = '<paste_service_role_key_here>';
```
The service role key is in **Supabase Dashboard → Settings → API → service_role**.

### 2. Verify extensions are enabled
In **Supabase Dashboard → Database → Extensions**, confirm both are ON:
- `pg_cron`
- `pg_net`

### 3. Run migrations
```bash
supabase db push
```
Or paste each SQL file in the Supabase SQL editor in order:
1. `20260421000001_gamification_event_log.sql`
2. `20260421000002_test_sessions_notify_trigger.sql`
3. `20260421000003_notification_cron_schedules.sql`

### 4. Deploy Edge Functions
```bash
supabase functions deploy notify-user
supabase functions deploy adapty-webhook
supabase functions deploy scheduled-sends-processor
supabase functions deploy gamification-event-worker
supabase functions deploy streak-at-risk-cron
supabase functions deploy no-activity-cron
```

### 5. Configure Adapty webhook
In **Adapty Dashboard → Integrations → Webhooks**:
- URL: `https://wwfiauhsbssjowaxmqyn.supabase.co/functions/v1/adapty-webhook`
- Authorization header: `Bearer <ADAPTY_WEBHOOK_SECRET>`
- Events: subscription_started, trial_started, subscription_renewed, subscription_cancelled, subscription_expired

### 6. Add ADAPTY_WEBHOOK_SECRET in Supabase
```bash
supabase secrets set ADAPTY_WEBHOOK_SECRET=<your_generated_secret>
```

### 7. Configure OneSignal in-app message rules
In **OneSignal Dashboard → In-App Messages**, create rules matching tag pattern:
- `notif_in_app_notif_score_shield_used` is set → show T3 shield banner
- `notif_in_app_notif_badge_rank_up` is set → show T8 badge-up banner
- `notif_in_app_notif_section_completed` is set → show T9 section complete banner

### 8. Regenerate TypeScript types
Once deployed, regenerate types from live schema:
```bash
cd expo
npx supabase gen types typescript --project-id wwfiauhsbssjowaxmqyn --schema public > types/database.ts
```

---

## Verification checklist

1. `GET /functions/v1/notify-user?health=1` → `{"status":"ok"}`
2. POST to `notify-user` with test user + `notif.streak_broken` + `channels=["push"]` → OneSignal dashboard shows delivery
3. Same with `channels=["email"]` → email received via Resend
4. Same with `channels=["in_app"]` → row in `notification_events` AND `user_notifications`
5. Insert `notification_events` row with `status='queued'`, `scheduled_at = now() - '2 minutes'::interval` → picked up within 5 min by processor
6. UPDATE a `test_sessions` row's `completed_at` → row appears in `notification_events`
7. Insert row in `gamification_event_log` with `event_type='streak_broke'` → `processed_at` set within 1 min
8. Toggle `push_enabled=false` in `notification_preferences` → dispatch returns `suppressed / channel_disabled`
9. `SELECT * FROM cron.job` → 4 jobs visible
10. All 6 functions respond 200 on `GET /?health=1`

---

## Architecture notes

- **No HTTP round-trips between functions** — `scheduled-sends-processor` and cron functions import `_shared/dispatch.ts` directly, avoiding internal HTTP calls.
- **In-app dual-write** — dispatching `in_app` channel writes to both `notification_events` (send log) and `user_notifications` (app display). Post-launch TODO: migrate app to read `notification_events` directly via Realtime and deprecate `user_notifications`.
- **Gating pipeline** — every dispatch runs 8 checks (prefs → channel → category → quiet hours → frequency cap → contact). Any failure inserts a `suppressed` row with reason and returns cleanly.
- **Timezone** — pure `Intl.DateTimeFormat`, no external libraries.

---

## Multi-timezone QA

Before declaring T1 and T4 production-ready, Payal must verify with at least two test accounts in different timezones:

1. One account with `timezone = 'Europe/Berlin'` (default)
2. One account with `timezone = 'America/New_York'`

For each: confirm T1 (`notif.streak_at_risk`) fires at 19:00 **local** time and T4 (`notif.no_activity_48h`) fires within the 48–72h window in **local** time, not UTC. Set timezone via:
```sql
UPDATE user_profiles SET timezone = 'America/New_York' WHERE id = '<test_user_id>';
UPDATE user_streak_state SET timezone = 'America/New_York' WHERE user_id = '<test_user_id>';
```

---

## Gamification team integration

**Confirm the table name** `gamification_event_log` with the gamification team before applying migration `20260421000001`. If they've already built an equivalent table with a different name, use theirs and skip that migration. The `gamification-event-worker` only needs the table to exist — rename the reference in the worker if needed.

The `gamification-event-worker` polls `gamification_event_log` every minute. Ask the gamification team to INSERT into this table alongside their `pg_notify` calls:

```sql
INSERT INTO public.gamification_event_log (event_type, user_id, evaluation_date, payload)
VALUES ('streak_broke', '<user_id>', CURRENT_DATE, '{"previous_streak_days": 15, ...}'::jsonb);
```

Supported `event_type` values: `streak_broke`, `shield_applied`, `rank_upgraded`, `rank_downgraded` (others are logged and marked processed with no notification).
