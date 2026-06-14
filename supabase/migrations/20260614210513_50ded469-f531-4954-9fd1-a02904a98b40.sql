
-- Mirror email onto profiles for easy admin display
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Update handle_new_user trigger to also store email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Backfill email for any existing profile
UPDATE public.profiles p SET email = u.email
  FROM auth.users u WHERE u.id = p.id AND p.email IS NULL;

-- ============ Admin write policies ============
-- projects
CREATE POLICY "projects admin all" ON public.projects FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- project_phases
CREATE POLICY "phases admin all" ON public.project_phases FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- phase_updates
CREATE POLICY "updates admin all" ON public.phase_updates FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- update_photos
CREATE POLICY "photos admin all" ON public.update_photos FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- profiles: admin update (already had self select/update; admin update needed)
CREATE POLICY "profiles admin all" ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Auto-activate next phase when a phase is marked done
CREATE OR REPLACE FUNCTION public.auto_activate_next_phase()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    NEW.completed_at = COALESCE(NEW.completed_at, now());
    UPDATE public.project_phases
       SET status = 'active', started_at = COALESCE(started_at, now())
     WHERE project_id = NEW.project_id
       AND status = 'pending'
       AND sort_order = (
         SELECT MIN(sort_order) FROM public.project_phases
          WHERE project_id = NEW.project_id AND status = 'pending'
            AND sort_order > NEW.sort_order
       );
  END IF;
  IF NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active') THEN
    NEW.started_at = COALESCE(NEW.started_at, now());
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.auto_activate_next_phase() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER project_phases_auto_activate
  BEFORE UPDATE ON public.project_phases
  FOR EACH ROW EXECUTE FUNCTION public.auto_activate_next_phase();
