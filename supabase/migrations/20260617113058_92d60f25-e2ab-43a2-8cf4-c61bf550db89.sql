
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_set boolean NOT NULL DEFAULT false;

-- Mark existing admin so they aren't forced through the onboarding flow.
UPDATE public.profiles SET password_set = true
  WHERE id = '76e5970b-3cad-4361-bd4c-773e41860bd0';
