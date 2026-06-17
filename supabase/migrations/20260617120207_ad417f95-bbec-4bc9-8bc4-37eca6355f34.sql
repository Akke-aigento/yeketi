CREATE OR REPLACE FUNCTION public.tg_conversations_customer_column_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role bypass (auth.uid() IS NULL) and admins keep full access.
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Allow internal bump trigger (tg_bump_conversation_last_message) to update
  -- last_message_at when the customer inserts a message.
  IF coalesce(current_setting('app.bump_conversation', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  -- Non-admin customers may only patch customer_last_seen_at.
  IF NEW.id                  IS DISTINCT FROM OLD.id
   OR NEW.contact_profile_id IS DISTINCT FROM OLD.contact_profile_id
   OR NEW.project_id         IS DISTINCT FROM OLD.project_id
   OR NEW.subject            IS DISTINCT FROM OLD.subject
   OR NEW.source             IS DISTINCT FROM OLD.source
   OR NEW.status             IS DISTINCT FROM OLD.status
   OR NEW.admin_last_seen_at IS DISTINCT FROM OLD.admin_last_seen_at
   OR NEW.last_message_at    IS DISTINCT FROM OLD.last_message_at
   OR NEW.created_at         IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Alleen customer_last_seen_at mag door de klant gewijzigd worden';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_bump_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.bump_conversation', 'on', true);
  UPDATE public.conversations
     SET last_message_at = NEW.created_at
   WHERE id = NEW.conversation_id;
  PERFORM set_config('app.bump_conversation', 'off', true);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_bump_conversation_last_message() FROM PUBLIC, anon, authenticated;