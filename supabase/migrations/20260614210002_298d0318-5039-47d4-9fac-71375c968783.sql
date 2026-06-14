
-- Enums
CREATE TYPE public.project_status AS ENUM ('intake','transport_out','in_workshop','transport_return','delivered','archived');
CREATE TYPE public.phase_status AS ENUM ('pending','active','done');
CREATE TYPE public.quote_status AS ENUM ('new','contacted','quoted','won','lost');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ profiles ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- security-definer admin check (no recursion in RLS)
CREATE OR REPLACE FUNCTION public.is_admin(_uid UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = _uid), false);
$$;

CREATE POLICY "profiles self select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ projects ============
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year TEXT,
  title TEXT NOT NULL,
  status public.project_status NOT NULL DEFAULT 'intake',
  cover_photo_url TEXT,
  start_date DATE,
  expected_end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects customer select" ON public.projects FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE INDEX projects_customer_idx ON public.projects(customer_id);
CREATE TRIGGER projects_updated BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- helper: is current user owner of project
CREATE OR REPLACE FUNCTION public.owns_project(_uid UUID, _project UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects WHERE id = _project AND customer_id = _uid);
$$;

-- ============ project_phases ============
CREATE TABLE public.project_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status public.phase_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.project_phases TO authenticated;
GRANT ALL ON public.project_phases TO service_role;
ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phases customer select" ON public.project_phases FOR SELECT TO authenticated
  USING (public.owns_project(auth.uid(), project_id) OR public.is_admin(auth.uid()));
CREATE INDEX phases_project_idx ON public.project_phases(project_id, sort_order);

-- ============ phase_updates ============
CREATE TABLE public.phase_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES public.project_phases(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.phase_updates TO authenticated;
GRANT ALL ON public.phase_updates TO service_role;
ALTER TABLE public.phase_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "updates customer select" ON public.phase_updates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.project_phases p WHERE p.id = phase_id
    AND (public.owns_project(auth.uid(), p.project_id) OR public.is_admin(auth.uid()))));
CREATE INDEX phase_updates_phase_idx ON public.phase_updates(phase_id, created_at DESC);

-- ============ update_photos ============
CREATE TABLE public.update_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id UUID NOT NULL REFERENCES public.phase_updates(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.update_photos TO authenticated;
GRANT ALL ON public.update_photos TO service_role;
ALTER TABLE public.update_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photos customer select" ON public.update_photos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.phase_updates u
    JOIN public.project_phases p ON p.id = u.phase_id
    WHERE u.id = update_id
      AND (public.owns_project(auth.uid(), p.project_id) OR public.is_admin(auth.uid()))
  ));
CREATE INDEX update_photos_update_idx ON public.update_photos(update_id, sort_order);

-- ============ quote_requests: add status enum column (replace existing text) ============
ALTER TABLE public.quote_requests
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.quote_status USING (
    CASE status WHEN 'new' THEN 'new'::public.quote_status
                WHEN 'contacted' THEN 'contacted'::public.quote_status
                WHEN 'quoted' THEN 'quoted'::public.quote_status
                WHEN 'won' THEN 'won'::public.quote_status
                WHEN 'lost' THEN 'lost'::public.quote_status
                ELSE 'new'::public.quote_status END
  ),
  ALTER COLUMN status SET DEFAULT 'new'::public.quote_status;

-- Admin-only select/update on quote_requests
CREATE POLICY "quote_requests admin select" ON public.quote_requests FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "quote_requests admin update" ON public.quote_requests FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ storage policies for project-photos bucket ============
-- Path convention: <project_id>/...
CREATE POLICY "project-photos customer read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-photos'
    AND (
      public.is_admin(auth.uid())
      OR public.owns_project(auth.uid(), (split_part(name, '/', 1))::uuid)
    )
  );
CREATE POLICY "project-photos admin write" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'project-photos' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'project-photos' AND public.is_admin(auth.uid()));
