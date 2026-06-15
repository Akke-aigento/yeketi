
-- =========================================================================
-- S-1: user_roles + has_role, drop profiles.is_admin
-- =========================================================================

-- 1. Enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Table
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. has_role function (security definer, locked search_path)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 4. RLS policies on user_roles
DROP POLICY IF EXISTS "user_roles self select" ON public.user_roles;
CREATE POLICY "user_roles self select" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "user_roles admin write" ON public.user_roles;
CREATE POLICY "user_roles admin write" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Backfill existing admins
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM public.profiles WHERE is_admin = true
ON CONFLICT DO NOTHING;

-- 6. Drop all policies that reference public.is_admin so we can drop the function
DROP POLICY IF EXISTS "profiles self select" ON public.profiles;
DROP POLICY IF EXISTS "profiles self update" ON public.profiles;
DROP POLICY IF EXISTS "profiles admin all" ON public.profiles;
DROP POLICY IF EXISTS "projects customer select" ON public.projects;
DROP POLICY IF EXISTS "projects admin all" ON public.projects;
DROP POLICY IF EXISTS "phases customer select" ON public.project_phases;
DROP POLICY IF EXISTS "phases admin all" ON public.project_phases;
DROP POLICY IF EXISTS "updates customer select" ON public.phase_updates;
DROP POLICY IF EXISTS "updates admin all" ON public.phase_updates;
DROP POLICY IF EXISTS "photos customer select" ON public.update_photos;
DROP POLICY IF EXISTS "photos admin all" ON public.update_photos;
DROP POLICY IF EXISTS "quote_requests admin select" ON public.quote_requests;
DROP POLICY IF EXISTS "quote_requests admin update" ON public.quote_requests;
DROP POLICY IF EXISTS "project-photos customer read" ON storage.objects;
DROP POLICY IF EXISTS "project-photos admin write" ON storage.objects;

-- 7. Recreate policies using has_role()
-- profiles
CREATE POLICY "profiles self select" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles self update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles admin all" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- projects
CREATE POLICY "projects customer select" ON public.projects
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "projects admin all" ON public.projects
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- project_phases
CREATE POLICY "phases customer select" ON public.project_phases
  FOR SELECT TO authenticated
  USING (public.owns_project(auth.uid(), project_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "phases admin all" ON public.project_phases
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- phase_updates
CREATE POLICY "updates customer select" ON public.phase_updates
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_phases p
    WHERE p.id = phase_updates.phase_id
      AND (public.owns_project(auth.uid(), p.project_id) OR public.has_role(auth.uid(), 'admin'))
  ));
CREATE POLICY "updates admin all" ON public.phase_updates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- update_photos
CREATE POLICY "photos customer select" ON public.update_photos
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.phase_updates u
    JOIN public.project_phases p ON p.id = u.phase_id
    WHERE u.id = update_photos.update_id
      AND (public.owns_project(auth.uid(), p.project_id) OR public.has_role(auth.uid(), 'admin'))
  ));
CREATE POLICY "photos admin all" ON public.update_photos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- quote_requests
CREATE POLICY "quote_requests admin select" ON public.quote_requests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "quote_requests admin update" ON public.quote_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- storage objects (project-photos)
CREATE POLICY "project-photos customer read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-photos'
    AND (public.has_role(auth.uid(), 'admin')
         OR public.owns_project(auth.uid(), (split_part(name, '/', 1))::uuid))
  );
CREATE POLICY "project-photos admin write" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'project-photos' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'project-photos' AND public.has_role(auth.uid(), 'admin'));

-- 8. Drop the old function and column
DROP FUNCTION IF EXISTS public.is_admin(uuid);
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_admin;

-- =========================================================================
-- S-2: rotate WEBHOOK_SHARED_SECRET in vault (no literal in migration)
-- =========================================================================
DO $$
DECLARE
  v_id uuid;
  v_new text := encode(extensions.gen_random_bytes(32), 'hex');
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'WEBHOOK_SHARED_SECRET';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(v_new, 'WEBHOOK_SHARED_SECRET', 'Shared secret used by dispatch_notify_event to authenticate to notify-events edge function');
  ELSE
    PERFORM vault.update_secret(v_id, v_new, 'WEBHOOK_SHARED_SECRET');
  END IF;
END $$;
