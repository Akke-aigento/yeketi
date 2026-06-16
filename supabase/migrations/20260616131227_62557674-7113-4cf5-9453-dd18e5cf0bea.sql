ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.tg_project_inserted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.dispatch_notify_event(jsonb_build_object(
    'type', 'INSERT', 'table', 'projects', 'record', to_jsonb(NEW)
  ));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS projects_insert_notify ON public.projects;
CREATE TRIGGER projects_insert_notify
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.tg_project_inserted();

CREATE OR REPLACE FUNCTION public.tg_project_status_updated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.dispatch_notify_event(jsonb_build_object(
      'type', 'UPDATE', 'table', 'projects',
      'record', to_jsonb(NEW), 'old_record', to_jsonb(OLD)
    ));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS projects_status_notify ON public.projects;
CREATE TRIGGER projects_status_notify
  AFTER UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.tg_project_status_updated();

CREATE OR REPLACE FUNCTION public.tg_project_phase_status_updated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.dispatch_notify_event(jsonb_build_object(
      'type', 'UPDATE', 'table', 'project_phases',
      'record', to_jsonb(NEW), 'old_record', to_jsonb(OLD)
    ));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS project_phases_status_notify ON public.project_phases;
CREATE TRIGGER project_phases_status_notify
  AFTER UPDATE OF status ON public.project_phases
  FOR EACH ROW EXECUTE FUNCTION public.tg_project_phase_status_updated();

CREATE OR REPLACE FUNCTION public.tg_profile_inserted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.dispatch_notify_event(jsonb_build_object(
    'type', 'INSERT', 'table', 'profiles', 'record', to_jsonb(NEW)
  ));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS profiles_insert_notify ON public.profiles;
CREATE TRIGGER profiles_insert_notify
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_profile_inserted();