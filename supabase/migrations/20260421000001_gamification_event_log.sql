-- Gamification event log: receives INSERT from the gamification layer alongside pg_notify.
-- The gamification-event-worker polls this table every minute (Option B — no long-lived LISTEN).
-- Ask the gamification team to INSERT here alongside their NOTIFY calls.

CREATE TABLE IF NOT EXISTS public.gamification_event_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      TEXT NOT NULL,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evaluation_date DATE NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gamification_event_log_unprocessed
  ON public.gamification_event_log (created_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.gamification_event_log ENABLE ROW LEVEL SECURITY;

-- Service role only — app never reads this directly
CREATE POLICY "gamification_event_log: service role only"
  ON public.gamification_event_log
  FOR ALL
  USING (false);
