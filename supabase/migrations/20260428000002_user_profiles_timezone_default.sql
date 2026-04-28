-- Layer 1: Change user_profiles.timezone default from 'UTC' to 'Europe/Berlin'.
-- This is the safety-net default: any INSERT that omits timezone will get
-- 'Europe/Berlin' rather than the wrong 'UTC'. The preferred path is the
-- app capturing the real device timezone (Intl.DateTimeFormat) at signup.

ALTER TABLE public.user_profiles
  ALTER COLUMN timezone SET DEFAULT 'Europe/Berlin';

COMMENT ON COLUMN public.user_profiles.timezone IS
  'IANA timezone string for the user (e.g. "Europe/Berlin"). '
  'Set to the device timezone at signup via Intl.DateTimeFormat().resolvedOptions().timeZone. '
  'Defaults to ''Europe/Berlin'' as a safety net when the client does not supply one. '
  'Used by journey-scheduler to compute time_of_day notification sends in local time.';
