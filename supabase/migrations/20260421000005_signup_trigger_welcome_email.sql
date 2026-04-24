-- Path B: 15-minute safety-net welcome email.
-- Inserts a queued notification_events row 15 minutes after user signup.
-- The scheduled-sends-processor picks it up; gating dedup suppresses it if
-- Path A (onboarding trigger) already delivered the email.
--
-- Trigger fires on auth.users INSERT (standard Supabase SECURITY DEFINER pattern).

CREATE OR REPLACE FUNCTION public.handle_new_user_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_events (
    user_id,
    event_key,
    channel,
    category,
    status,
    payload,
    scheduled_at
  ) VALUES (
    NEW.id,
    'notif.welcome_email',
    'email',
    'transactional',
    'queued',
    '{}'::jsonb,
    NOW() + INTERVAL '15 minutes'
  )
  -- Idempotent: skip if a queued row already exists (e.g. re-run of migration)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_welcome_email ON auth.users;
CREATE TRIGGER on_auth_user_created_welcome_email
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_welcome_email();

-- NOTE: This trigger is on auth.users and requires superuser or equivalent.
-- Run this migration via the Supabase dashboard SQL editor (not supabase db push
-- which may lack the required privilege on auth schema).
