-- Migration: RevenueCat webhook support tables
-- Adds: revenuecat_webhook_events, subscription_events, notification_intents
-- Extends: user_profiles with subscription tracking columns

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend user_profiles
--    Columns trial_expires_at, subscription_tier, trial_active,
--    subscription_valid_until already exist — skip those.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS trial_started_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_since_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_renewed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expired_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_issue          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS billing_issue_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_plan      TEXT,
  ADD COLUMN IF NOT EXISTS subscription_store     TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. revenuecat_webhook_events — idempotency + raw event log
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.revenuecat_webhook_events (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       TEXT        NOT NULL UNIQUE,   -- rc event.id — idempotency key
  event_type     TEXT        NOT NULL,
  user_id        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  raw_payload    JSONB       NOT NULL,
  processed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS revenuecat_webhook_events_user_id_idx
  ON public.revenuecat_webhook_events (user_id);

CREATE INDEX IF NOT EXISTS revenuecat_webhook_events_event_type_idx
  ON public.revenuecat_webhook_events (event_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. subscription_events — audit log of all subscription state transitions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type          TEXT        NOT NULL,
  subscription_plan   TEXT,
  store               TEXT,
  trial_started_at    TIMESTAMPTZ,
  trial_ends_at       TIMESTAMPTZ,
  paid_since_at       TIMESTAMPTZ,
  renewed_at          TIMESTAMPTZ,
  expired_at          TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  billing_issue       BOOLEAN,
  raw_event_id        TEXT,       -- refs revenuecat_webhook_events.event_id
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_events_user_id_idx
  ON public.subscription_events (user_id);

CREATE INDEX IF NOT EXISTS subscription_events_event_type_idx
  ON public.subscription_events (event_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. notification_intents — journey queue
--    Webhook writes one row per intent; downstream scheduler fans out to
--    actual notification_events rows (T-3/T-1/T-0 etc). Webhook is write-only.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_intents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  intent_key      TEXT        NOT NULL,    -- 'trial_started', 'subscription_cancelled', etc.
  effective_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  context         JSONB       NOT NULL DEFAULT '{}',
  source          TEXT        NOT NULL,    -- 'revenuecat_webhook'
  source_event_id TEXT,                   -- refs revenuecat_webhook_events.event_id
  processed_at    TIMESTAMPTZ,            -- NULL = scheduler hasn't processed yet
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_intents_user_intent_idx
  ON public.notification_intents (user_id, intent_key, effective_at DESC);

CREATE INDEX IF NOT EXISTS notification_intents_pending_idx
  ON public.notification_intents (intent_key, effective_at DESC)
  WHERE processed_at IS NULL;
