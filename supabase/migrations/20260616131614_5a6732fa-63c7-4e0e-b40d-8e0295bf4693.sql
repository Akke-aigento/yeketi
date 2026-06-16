-- Customer language preference for emails (and later: portal i18n).
DO $$ BEGIN
  CREATE TYPE public.app_locale AS ENUM ('nl','en');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS locale public.app_locale NOT NULL DEFAULT 'nl';

ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS locale public.app_locale NOT NULL DEFAULT 'nl';

-- When a quote_request gets a matching/new profile via the existing
-- conversation-link trigger, copy the chosen language to the profile
-- (but never downgrade an existing non-default choice).
CREATE OR REPLACE FUNCTION public.tg_quote_request_sync_profile_locale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_profile uuid;
  v_current public.app_locale;
BEGIN
  v_email := lower(trim(COALESCE(NEW.email, '')));
  IF v_email = '' THEN RETURN NEW; END IF;
  SELECT id, locale INTO v_profile, v_current
    FROM public.profiles WHERE lower(email) = v_email LIMIT 1;
  IF v_profile IS NULL THEN RETURN NEW; END IF;
  -- Only set when profile is still on the default 'nl' AND request asked for 'en',
  -- so we don't overwrite Baram's explicit choice.
  IF v_current = 'nl' AND NEW.locale = 'en' THEN
    UPDATE public.profiles SET locale = 'en' WHERE id = v_profile;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS quote_request_sync_locale ON public.quote_requests;
CREATE TRIGGER quote_request_sync_locale
AFTER INSERT ON public.quote_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_quote_request_sync_profile_locale();