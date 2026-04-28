# Wordifi — Notification Edge Functions

Server-side push/email/in-app dispatch layer. All functions are Deno-based Supabase Edge Functions.

---

## Functions

| Function | Trigger | Purpose |
|---|---|---|
| `notify-user` | HTTP POST (internal) | Core dispatcher — gating pipeline + provider calls |
| `revenuecat-webhook` | HTTP POST from RevenueCat | Subscription lifecycle → update user_profiles + write notification_intents |
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
| `REVENUECAT_WEBHOOK_SECRET` | Set in RevenueCat Dashboard → Webhooks → Authorization header |
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
4. `20260421000004_welcome_email_trigger.sql`
5. `20260421000005_signup_trigger_welcome_email.sql` (**run in SQL editor with superuser** — requires auth schema access)

### 4. Deploy Edge Functions
```bash
supabase functions deploy notify-user
supabase functions deploy revenuecat-webhook
supabase functions deploy scheduled-sends-processor
supabase functions deploy gamification-event-worker
supabase functions deploy streak-at-risk-cron
supabase functions deploy no-activity-cron
```

### 5. Configure RevenueCat webhook
In **RevenueCat Dashboard → Project → Integrations → Webhooks**:
- URL: `https://wwfiauhsbssjowaxmqyn.supabase.co/functions/v1/revenuecat-webhook`
- Authorization header: `Bearer <REVENUECAT_WEBHOOK_SECRET>`
- Events: INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, BILLING_ISSUE, PRODUCT_CHANGE

### 6. Add REVENUECAT_WEBHOOK_SECRET in Supabase
```bash
supabase secrets set REVENUECAT_WEBHOOK_SECRET=<your_generated_secret>
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

## Welcome email

The welcome email (`notif.welcome_email`) is a one-time transactional email sent after signup.
It is wired via two complementary paths:

| Path | Mechanism | When |
|------|-----------|------|
| **A — Onboarding** | `trg_notify_onboarding_completed` trigger on `user_profiles` | Fires immediately when `onboarding_completed_at` transitions NULL → value |
| **B — Safety net** | `on_auth_user_created_welcome_email` trigger on `auth.users` | Inserts a 15-min queued row at signup; processor sends if Path A has not already |

**Deduplication** — the gating pipeline checks `notification_events` for any prior `sent`/`delivered` row with `event_key = 'notif.welcome_email'` on the same channel and returns `already_sent_once` if found. This prevents double-send when both paths fire.

**Variant selection** — at render time `templates.ts` picks:
- **Rich** — if `first_name`, `target_level`, and `exam_type` are all present in the context
- **Generic** — fallback when any of the three are missing

**Template files** — live at `_shared/email-templates/welcome/`:
- `rich.html` / `rich.txt` — personalized variant with exam countdown or nudge
- `generic.html` / `generic.txt` — fallback variant
- `meta.json` — subjects and preview text for each variant

**Sender** — `Wordifi <team@wordifimail.eu>` (domain: `wordifimail.eu`)

**Category** — `transactional` — bypasses quiet hours and category opt-outs.

---

## `notification_config` table

Runtime tunables are stored in `public.notification_config` (key TEXT PK, value JSONB). The `_shared/notifConfig.ts` helper reads all rows once per function invocation and returns a typed `NotifConfig` object; code-level `DEFAULTS` serve as a last-resort fallback if the table is unreachable.

**Current keys** (seed values match the previous hard-coded constants):

| Key | Default | Description |
|---|---|---|
| `notif.t1_fire_hour_local` | `20` | Hour (0–23) user-local when T1 streak-at-risk fires |
| `notif.t4_min_hours_inactive` | `48` | Min hours inactive before T4 fires |
| `notif.t4_max_hours_inactive` | `72` | Max hours inactive for T4 window |
| `notif.t4_ramp_in_days` | `30` | Days post-signup before T4 is allowed to fire |
| `notif.default_max_push_per_day` | `1` | Push cap fallback when prefs row has NULL |
| `notif.default_max_email_per_week` | `2` | Email cap fallback when prefs row has NULL |
| `notif.email_from_address` | `"Wordifi <team@wordifimail.eu>"` | Sender address for all Resend outbound email |

**Adding a new tunable requires two changes:** insert the new row in a migration, and add the corresponding typed field to `NotifConfig` in `_shared/notifConfig.ts` (plus its mapping in `loadNotifConfig`). This is intentional — the typed helper prevents silent key-name mismatches and gives TypeScript callers compile-time safety. A generic free-form key lookup is deliberately not exposed.

**Hot-reload test** (no redeploy needed):
```sql
UPDATE notification_config SET value = '21' WHERE key = 'notif.t1_fire_hour_local';
-- invoke streak-at-risk-cron, confirm it skips users at hour 20, matches at hour 21
UPDATE notification_config SET value = '20' WHERE key = 'notif.t1_fire_hour_local';
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
8. POST to `notify-user` with test user + `notif.welcome_email` + `channels=["email"]` + `category="transactional"` → welcome email received (rich variant if profile is complete, generic otherwise); send a second identical POST → second call returns `suppressed / already_sent_once`
9. Toggle `push_enabled=false` in `notification_preferences` → dispatch returns `suppressed / channel_disabled`
10. `SELECT * FROM cron.job` → 4 jobs visible
11. All 6 functions respond 200 on `GET /?health=1`

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

For each: confirm T1 (`notif.streak_at_risk`) fires at 20:00 **local** time (configured via `notification_config` key `notif.t1_fire_hour_local`) and T4 (`notif.no_activity_48h`) fires within the 48–72h window in **local** time, not UTC. Set timezone via:
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
