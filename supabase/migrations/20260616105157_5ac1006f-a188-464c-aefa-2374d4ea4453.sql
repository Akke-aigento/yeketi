
-- 1. Reactions table
CREATE TABLE public.update_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_update_id uuid NOT NULL REFERENCES public.phase_updates(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_update_reactions_update ON public.update_reactions(phase_update_id, created_at);
CREATE INDEX idx_update_reactions_author ON public.update_reactions(author_id);

GRANT SELECT, INSERT ON public.update_reactions TO authenticated;
GRANT ALL ON public.update_reactions TO service_role;

ALTER TABLE public.update_reactions ENABLE ROW LEVEL SECURITY;

-- Customer: SELECT reactions only when the update belongs to their project.
CREATE POLICY "customer select own project reactions"
  ON public.update_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.phase_updates pu
        JOIN public.project_phases pp ON pp.id = pu.phase_id
        JOIN public.projects p ON p.id = pp.project_id
       WHERE pu.id = update_reactions.phase_update_id
         AND p.customer_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Customer: INSERT only on their own project's updates, and only as themselves.
CREATE POLICY "customer insert own project reaction"
  ON public.update_reactions FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1
          FROM public.phase_updates pu
          JOIN public.project_phases pp ON pp.id = pu.phase_id
          JOIN public.projects p ON p.id = pp.project_id
         WHERE pu.id = update_reactions.phase_update_id
           AND p.customer_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- Admin: DELETE any reaction (moderation).
CREATE POLICY "admin delete reaction"
  ON public.update_reactions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Track admin "last seen" per project for unread badges
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS admin_last_seen_reactions_at timestamptz NOT NULL DEFAULT '1970-01-01T00:00:00Z';

-- 3. Notify trigger: dispatch update_reactions INSERT into notify-events
CREATE OR REPLACE FUNCTION public.tg_update_reaction_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.dispatch_notify_event(jsonb_build_object(
    'type', 'INSERT',
    'table', 'update_reactions',
    'record', to_jsonb(NEW)
  ));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS update_reaction_notify ON public.update_reactions;
CREATE TRIGGER update_reaction_notify
  AFTER INSERT ON public.update_reactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_update_reaction_inserted();

-- 4. Helper: count unread customer reactions per project (admin-only)
CREATE OR REPLACE FUNCTION public.unread_customer_reactions(_project_ids uuid[])
RETURNS TABLE(project_id uuid, unread_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id AS project_id, COUNT(r.id) AS unread_count
    FROM public.projects p
    LEFT JOIN public.project_phases pp ON pp.project_id = p.id
    LEFT JOIN public.phase_updates pu ON pu.phase_id = pp.id
    LEFT JOIN public.update_reactions r
           ON r.phase_update_id = pu.id
          AND r.created_at > p.admin_last_seen_reactions_at
          AND NOT public.has_role(r.author_id, 'admin')
   WHERE p.id = ANY(_project_ids)
     AND public.has_role(auth.uid(), 'admin')
   GROUP BY p.id;
$$;

GRANT EXECUTE ON FUNCTION public.unread_customer_reactions(uuid[]) TO authenticated;

-- 5. Mark project reactions as seen (admin-only no-op for non-admins)
CREATE OR REPLACE FUNCTION public.mark_project_reactions_seen(_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN;
  END IF;
  UPDATE public.projects
     SET admin_last_seen_reactions_at = now()
   WHERE id = _project_id;
END $$;

GRANT EXECUTE ON FUNCTION public.mark_project_reactions_seen(uuid) TO authenticated;
