ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS source_reaction_id uuid
    REFERENCES public.update_reactions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS messages_source_reaction_idx
  ON public.messages(source_reaction_id);

CREATE OR REPLACE FUNCTION public.tg_message_inserted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.sender = 'klant' AND NEW.source_reaction_id IS NULL THEN
    PERFORM public.dispatch_notify_event(jsonb_build_object(
      'type', 'INSERT',
      'table', 'messages',
      'record', to_jsonb(NEW)
    ));
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.tg_mirror_reaction_to_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id    uuid;
  v_customer_id   uuid;
  v_project_title text;
  v_conv_id       uuid;
  v_is_admin      boolean;
  v_sender        public.message_sender;
BEGIN
  SELECT pr.id, pr.customer_id, pr.title
    INTO v_project_id, v_customer_id, v_project_title
    FROM public.phase_updates pu
    JOIN public.project_phases pp ON pp.id = pu.phase_id
    JOIN public.projects pr      ON pr.id = pp.project_id
   WHERE pu.id = NEW.phase_update_id
   LIMIT 1;

  IF v_customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_conv_id
    FROM public.conversations
   WHERE contact_profile_id = v_customer_id
   LIMIT 1;

  IF v_conv_id IS NULL THEN
    INSERT INTO public.conversations(contact_profile_id, project_id, subject, source, status)
    VALUES (
      v_customer_id,
      v_project_id,
      COALESCE(NULLIF(btrim(v_project_title), ''), 'Project'),
      'manual',
      'open'
    )
    RETURNING id INTO v_conv_id;
  ELSE
    UPDATE public.conversations
       SET project_id = v_project_id
     WHERE id = v_conv_id
       AND project_id IS NULL;
  END IF;

  v_is_admin := public.has_role(NEW.author_id, 'admin');
  v_sender := CASE WHEN v_is_admin THEN 'admin'::public.message_sender
                   ELSE 'klant'::public.message_sender END;

  INSERT INTO public.messages(conversation_id, author_id, sender, body, source_reaction_id, created_at)
  VALUES (v_conv_id, NEW.author_id, v_sender, NEW.body, NEW.id, NEW.created_at);

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS mirror_reaction_to_message ON public.update_reactions;
CREATE TRIGGER mirror_reaction_to_message
  AFTER INSERT ON public.update_reactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_mirror_reaction_to_message();