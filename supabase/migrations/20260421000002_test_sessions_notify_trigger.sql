-- Trigger: fires notify-user when a sectional test session is completed.
-- Requires pg_net extension and secrets stored in Supabase Vault:
--   name = 'supabase_url'      → project URL
--   name = 'service_role_key'  → service role key

CREATE OR REPLACE FUNCTION public.trg_notify_section_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key  TEXT;
BEGIN
  -- Only fire when completed_at transitions NULL → value for sectional sessions
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    IF NEW.session_type = 'sectional' THEN
      v_supabase_url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url');
      v_service_key  := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key');

      IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
        RAISE WARNING 'trg_notify_section_completed: vault secrets supabase_url or service_role_key not found — skipping notify';
        RETURN NEW;
      END IF;

      PERFORM net.http_post(
        url     := v_supabase_url || '/functions/v1/notify-user',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || v_service_key
        ),
        body    := jsonb_build_object(
          'user_id',   NEW.user_id,
          'event_key', 'notif.section_completed',
          'channels',  jsonb_build_array('in_app'),
          'category',  'progress',
          'payload',   jsonb_build_object(
            'section',   NEW.section,
            'level',     NEW.level,
            'score_pct', NEW.score_pct,
            'teil',      NEW.teil
          )
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_test_sessions_notify ON public.test_sessions;
CREATE TRIGGER trg_test_sessions_notify
  AFTER UPDATE ON public.test_sessions
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_section_completed();
