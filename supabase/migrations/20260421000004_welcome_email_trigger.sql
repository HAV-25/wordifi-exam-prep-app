-- Path A: fire the welcome email immediately when onboarding completes.
-- Trigger: user_profiles UPDATE when onboarding_completed_at transitions NULL → NOT NULL.
-- The notify-user edge function calls dispatchChannel which applies full gating
-- (including the already_sent_once dedup), so Path B's queued row is automatically
-- suppressed if Path A already delivered.
--
-- Prerequisite: vault secrets 'supabase_url' and 'service_role_key' must be set.

CREATE OR REPLACE FUNCTION public.trg_notify_onboarding_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.onboarding_completed_at IS NULL AND NEW.onboarding_completed_at IS NOT NULL THEN
    PERFORM net.http_post(
      url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
                 || '/functions/v1/notify-user',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body    := jsonb_build_object(
        'user_id',   NEW.id,
        'event_key', 'notif.welcome_email',
        'channels',  jsonb_build_array('email'),
        'category',  'transactional'
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_onboarding_completed ON public.user_profiles;
CREATE TRIGGER trg_notify_onboarding_completed
  AFTER UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_onboarding_completed();
